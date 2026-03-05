import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { premiumOfferService } from '../../services/premiumOfferService';
import PremiumOfferCard from '../../components/PremiumOfferCard';
import { FaPlus, FaEdit, FaTrash, FaBolt, FaSnowflake, FaPlay, FaClock } from 'react-icons/fa';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { BASE_CREDIT_PACKS } from '../../config/planDefaults';

const OFFER_SLOT_PACK = BASE_CREDIT_PACKS.find(p => p.type === 'offer_slot');

/* ---------- status badge ------------------------------------------ */
const StatusBadge = ({ status, isExpired }) => {
    const map = {
        active: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: '● Live' },
        inactive: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: '⏸ Frozen' },
        expired: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: '✕ Expired' },
    };
    const key = isExpired ? 'expired' : (status || 'active');
    const s = map[key] || map.active;
    return (
        <span style={{
            fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.03em',
            padding: '3px 10px', borderRadius: 20,
            color: s.color, background: s.bg, border: `1px solid ${s.color}40`
        }}>{s.label}</span>
    );
};

/* ---------- time left pill ---------------------------------------- */
const TimeLeft = ({ expiresAt }) => {
    if (!expiresAt) return <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>Permanent</span>;
    const exp = expiresAt?.toDate?.() || new Date(expiresAt);
    const diff = exp - Date.now();
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return (
        <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <FaClock size={10} /> {h}h {m}m left
        </span>
    );
};

/* ================================================================== */
const ProOffers = ({ onNavigate }) => {
    const { currentUser, userProfile } = useAuth();
    const [offers, setOffers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState({});     // offerId → true while action runs
    const [buyingSlot, setBuyingSlot] = useState(false);

    const tier = userProfile?.subscriptionTier || 'free';
    const isElite = tier === 'elite';
    const isProfessional = tier === 'professional';
    const canPublish = isElite || isProfessional;

    /* ---- load ---------------------------------------------------- */
    useEffect(() => {
        if (!currentUser?.uid) return;
        loadOffers();
    }, [currentUser?.uid]);

    const loadOffers = async () => {
        try {
            setLoading(true);
            let data = await premiumOfferService.getPartnerOffers(currentUser.uid);

            // Fallback: if nothing in `offers`, check `active_offers` directly
            if (!data || data.length === 0) {
                try {
                    const { db } = await import('../../firebase/config');
                    const { collection, query, where, getDocs } = await import('firebase/firestore');
                    const q = query(collection(db, 'active_offers'), where('partnerId', '==', currentUser.uid));
                    const snap = await getDocs(q);
                    data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                } catch (e2) {
                    console.warn('active_offers fallback failed:', e2);
                }
            }

            // Sort: active first, then frozen, then expired
            const sorted = (data || []).sort((a, b) => {
                const rank = o => {
                    const exp = o.expiresAt ? (o.expiresAt?.toDate?.() || new Date(o.expiresAt)) : null;
                    if (exp && exp < new Date()) return 2;
                    if (o.status === 'inactive') return 1;
                    return 0;
                };
                return rank(a) - rank(b);
            });
            setOffers(sorted);
        } catch (e) {
            console.error('ProOffers load error:', e);
        } finally {
            setLoading(false);
        }
    };

    /* ---- actions ------------------------------------------------- */
    const withBusy = (id, fn) => async () => {
        setBusy(prev => ({ ...prev, [id]: true }));
        try { await fn(); } finally {
            setBusy(prev => ({ ...prev, [id]: false }));
        }
    };

    const handleEdit = (offer) => {
        // Pass offer data to design editor so it can prefill the editor
        onNavigate?.('design', { editOffer: offer });
    };

    const handleFreeze = (offer) =>
        withBusy(offer.id, async () => {
            await premiumOfferService.freezeOffer(offer.id);
            await loadOffers();
        })();

    const handleRepublish = (offer) =>
        withBusy(offer.id, async () => {
            await premiumOfferService.republishOffer(offer.id, currentUser.uid, offer);
            await loadOffers();
        })();

    const handleDelete = (offer) =>
        withBusy(offer.id, async () => {
            if (!window.confirm(`Delete "${offer.title}"? This cannot be undone.`)) return;
            await premiumOfferService.deleteOffer(offer.id);
            setOffers(prev => prev.filter(o => o.id !== offer.id));
        })();

    /* ---- buy slot ------------------------------------------------ */
    const handleBuySlot = async () => {
        if (!OFFER_SLOT_PACK?.stripePriceId) {
            alert('Offer slot pack is not configured yet.');
            return;
        }
        setBuyingSlot(true);
        try {
            const functions = getFunctions();
            const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');
            const result = await createCheckoutSession({
                priceId: OFFER_SLOT_PACK.stripePriceId,
                planId: OFFER_SLOT_PACK.id,
                planName: OFFER_SLOT_PACK.name,
                successUrl: `${window.location.origin}/business-pro?tab=offers&purchase=success`,
                cancelUrl: `${window.location.origin}/business-pro?tab=offers`
            });
            window.location.href = result.data.url;
        } catch (e) {
            console.error('Checkout error:', e);
            alert('Could not start checkout: ' + e.message);
        } finally {
            setBuyingSlot(false);
        }
    };

    /* ---- offer card ---------------------------------------------- */
    const OfferRow = ({ offer }) => {
        const isExpired = offer.expiresAt && (() => {
            const exp = offer.expiresAt?.toDate?.() || new Date(offer.expiresAt);
            return exp.getTime() < Date.now();
        })();
        const isFrozen = offer.status === 'inactive';
        const isActive = !isFrozen && !isExpired;
        const isBusy = busy[offer.id];

        return (
            <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${isActive ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 16,
                overflow: 'hidden',
                transition: 'border-color 0.2s'
            }}>
                {/* Preview card */}
                <div style={{ pointerEvents: 'none', opacity: isFrozen || isExpired ? 0.55 : 1 }}>
                    <PremiumOfferCard offer={offer} onRefresh={loadOffers} />
                </div>

                {/* Action bar */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(0,0,0,0.2)'
                }}>
                    {/* Status + time */}
                    <StatusBadge status={offer.status} isExpired={isExpired} />
                    <TimeLeft expiresAt={offer.expiresAt} />

                    <div style={{ flex: 1 }} />

                    {/* Edit */}
                    <button
                        onClick={() => handleEdit(offer)}
                        disabled={isBusy}
                        title="Edit offer"
                        style={actionBtn()}
                    >
                        <FaEdit size={13} /> Edit
                    </button>

                    {/* Freeze / Republish */}
                    {isActive ? (
                        <button
                            onClick={() => handleFreeze(offer)}
                            disabled={isBusy}
                            title="Freeze (remove from carousel)"
                            style={actionBtn('#f59e0b')}
                        >
                            {isBusy ? '...' : <><FaSnowflake size={13} /> Freeze</>}
                        </button>
                    ) : !isExpired ? (
                        <button
                            onClick={() => handleRepublish(offer)}
                            disabled={isBusy}
                            title="Re-publish to carousel"
                            style={actionBtn('#10b981')}
                        >
                            {isBusy ? '...' : <><FaPlay size={11} /> Publish</>}
                        </button>
                    ) : null}

                    {/* Delete */}
                    <button
                        onClick={() => handleDelete(offer)}
                        disabled={isBusy}
                        title="Delete permanently"
                        style={actionBtn('#ef4444', true)}
                    >
                        {isBusy ? '...' : <FaTrash size={13} />}
                    </button>
                </div>
            </div>
        );
    };

    /* ---- slot info banner ---------------------------------------- */
    const renderSlotBanner = () => {
        if (!canPublish) return null;
        const activeCount = offers.filter(o => {
            if (o.status !== 'active') return false;
            if (!o.expiresAt) return true;
            const exp = o.expiresAt?.toDate?.() || new Date(o.expiresAt);
            return exp > new Date();
        }).length;

        return (
            <div style={{
                background: isElite
                    ? 'linear-gradient(135deg,rgba(251,191,36,.1),rgba(245,158,11,.05))'
                    : 'linear-gradient(135deg,rgba(139,92,246,.1),rgba(109,40,217,.05))',
                border: `1px solid ${isElite ? 'rgba(251,191,36,0.3)' : 'rgba(139,92,246,0.3)'}`,
                borderRadius: 12, padding: '14px 18px', marginBottom: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 12
            }}>
                <div>
                    <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', marginBottom: 3 }}>
                        {isElite ? '👑 Elite Plan' : '⚡ Professional Plan'}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#f1f5f9', fontWeight: 600 }}>
                        {activeCount} active offer{activeCount !== 1 ? 's' : ''} in carousel
                        {isElite ? ' · Permanent slots' : ' · 50h per slot'}
                    </div>
                </div>
                {!isElite && (
                    <button
                        onClick={handleBuySlot}
                        disabled={buyingSlot}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '9px 16px', borderRadius: 10,
                            border: '1px solid rgba(251,191,36,0.4)',
                            background: 'rgba(251,191,36,0.12)',
                            color: '#fbbf24', fontWeight: 700, fontSize: '0.85rem',
                            cursor: buyingSlot ? 'not-allowed' : 'pointer',
                            opacity: buyingSlot ? 0.6 : 1
                        }}
                    >
                        <FaBolt />
                        {buyingSlot ? 'Loading...' : 'Buy 50h Slot — $5 AUD'}
                    </button>
                )}
            </div>
        );
    };

    /* ---- render -------------------------------------------------- */
    return (
        <div>
            {/* Header */}
            <div className="bpro-card-header" style={{ marginBottom: 20 }}>
                <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9' }}>My Offers</div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                        Manage, edit, freeze or delete your published offers
                    </div>
                </div>
                {canPublish && (
                    <button className="bpro-btn-primary" onClick={() => onNavigate?.('design')}>
                        <FaPlus /> New Offer
                    </button>
                )}
            </div>

            {renderSlotBanner()}

            {/* Loading spinner */}
            {loading && <div className="bpro-spinner" />}

            {/* Offers list — always show if there are offers, regardless of tier */}
            {!loading && (offers.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
                    {offers.map(offer => <OfferRow key={offer.id} offer={offer} />)}
                </div>
            ) : !canPublish ? (
                /* Locked state — only show if no offers at all */
                <div className="bpro-card" style={{ textAlign: 'center', padding: '2rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔒</div>
                    <h3 style={{ color: '#f1f5f9', marginBottom: 8 }}>Premium Offers Require Elite or Professional Plan</h3>
                    <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>
                        Upgrade your plan to publish exclusive offers in the app's banner carousel.
                    </p>
                    <button className="bpro-btn-primary" onClick={() => onNavigate?.('subscription')}>
                        View Plans
                    </button>
                </div>
            ) : (
                <div className="bpro-card">
                    <div className="bpro-empty">
                        <div className="bpro-empty-icon">🎁</div>
                        <h3>No offers yet</h3>
                        <p>Create your first offer to appear in the app's banner</p>
                        <button className="bpro-btn-primary" onClick={() => onNavigate?.('design')}>
                            <FaPlus /> Create First Offer
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

/* ---- style helper -------------------------------------------------- */
const actionBtn = (color = '#c4b5fd', iconOnly = false) => ({
    display: 'flex', alignItems: 'center', gap: 5,
    padding: iconOnly ? '6px 10px' : '6px 12px',
    borderRadius: 8,
    border: `1px solid ${color}80`,
    background: `${color}20`,
    color, fontWeight: 600, fontSize: '0.78rem',
    cursor: 'pointer', transition: 'all 0.15s'
});

export default ProOffers;
