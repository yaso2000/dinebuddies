/**
 * ProDrafts — Studio Vault
 * 4 tabs: Posts (featured_posts), Offers (active_offers), Reports (saved PDFs), Prints (saved export assets)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { premiumOfferService } from '../../services/premiumOfferService';
import FeaturedPostSlideCard from '../../components/FeaturedPostSlideCard';
import { FaTrash, FaEdit, FaEye, FaEyeSlash, FaPlus, FaLayerGroup, FaGift, FaFilePdf, FaPrint, FaSnowflake, FaPlay, FaCalendarAlt } from 'react-icons/fa';

// ─── helpers ──────────────────────────────────────────────────────────────────

function getBackgroundForPreview(bg) {
    if (!bg) return { type: 'gradient', value: 'linear-gradient(135deg,#1e1e2e,#2d2b42)' };
    if (bg.type === 'gradient') {
        const start = bg.gradientStart || '#1e1e2e';
        const end   = bg.gradientEnd   || '#2d2b42';
        return { type: 'gradient', value: `linear-gradient(135deg,${start},${end})` };
    }
    return bg;
}

const STATUS_PILL = {
    published: { label: 'Published', bg: 'rgba(48,209,88,0.15)',    border: 'rgba(48,209,88,0.4)',    color: '#30d158' },
    draft:     { label: 'Draft',     bg: 'rgba(167,139,250,0.12)',  border: 'rgba(167,139,250,0.35)', color: '#a78bfa' },
};

const actionBtn = (color = '#c4b5fd', iconOnly = false) => ({
    display: 'flex', alignItems: 'center', gap: 5,
    padding: iconOnly ? '6px 10px' : '6px 12px',
    borderRadius: 8, border: `1px solid ${color}80`,
    background: `${color}20`, color, fontWeight: 600, fontSize: '0.78rem',
    cursor: 'pointer', transition: 'all 0.15s'
});

const TAB_STYLE = (active) => ({
    padding: '8px 20px', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem',
    border: active ? '2px solid #a78bfa' : '1px solid rgba(255,255,255,0.1)',
    background: active ? 'rgba(167,139,250,0.18)' : 'transparent',
    color: active ? '#a78bfa' : 'rgba(255,255,255,0.5)',
    cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 7
});

const EmptyState = ({ icon, title, desc, action }) => (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.3)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>{icon}</div>
        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>{title}</div>
        <div style={{ fontSize: '0.8rem', marginTop: 6, marginBottom: 20 }}>{desc}</div>
        {action}
    </div>
);

// ─── TABS ─────────────────────────────────────────────────────────────────────

const TABS = [
    { key: 'posts',   label: 'Posts',   icon: <FaLayerGroup /> },
    { key: 'events',  label: 'Events',  icon: <FaCalendarAlt /> },
    { key: 'offers',  label: 'Offers',  icon: <FaGift /> },
    { key: 'reports', label: 'Reports', icon: <FaFilePdf /> },
    { key: 'prints',  label: 'Prints',  icon: <FaPrint /> },
];

// ─── POSTS TAB ----------------------------------------------------------------

function PostsTab({ onNewPost, onEditPost }) {
    const { currentUser } = useAuth();
    const { showToast } = useToast();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [confirmDelete, setConfirmDelete] = useState(null);

    useEffect(() => {
        if (!currentUser?.uid) return;
        const q = query(
            collection(db, 'featured_posts'),
            where('partnerId', '==', currentUser.uid)
        );
        const unsub = onSnapshot(q, snap => {
            const sorted = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => {
                    const ta = a.updatedAt?.toDate?.()?.getTime?.() || 0;
                    const tb = b.updatedAt?.toDate?.()?.getTime?.() || 0;
                    return tb - ta;
                });
            setPosts(sorted);
            setLoading(false);
        }, (err) => { console.error('ProDrafts onSnapshot error:', err); setLoading(false); });
        return () => unsub();
    }, [currentUser]);

    const toggleStatus = useCallback(async (post) => {
        const newStatus = post.status === 'published' ? 'draft' : 'published';
        try {
            await updateDoc(doc(db, 'featured_posts', post.id), {
                status: newStatus,
                ...(newStatus === 'published' ? { publishedAt: serverTimestamp() } : {}),
                updatedAt: serverTimestamp(),
            });
            showToast(newStatus === 'published' ? 'Published to feed' : 'Moved to drafts', 'success');
        } catch (e) { showToast(e?.message || 'Update failed', 'error'); }
    }, [showToast]);

    const deletePost = useCallback(async (id) => {
        try {
            await deleteDoc(doc(db, 'featured_posts', id));
            showToast('Post deleted', 'success');
        } catch (e) { showToast(e?.message || 'Delete failed', 'error'); }
        setConfirmDelete(null);
    }, [showToast]);

    if (loading) return <div className="bpro-spinner" />;

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
                    {posts.length} post{posts.length !== 1 ? 's' : ''} · {posts.filter(p => p.status === 'published').length} published
                </div>
                <button className="ui-btn ui-btn--primary" onClick={onNewPost} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FaPlus /> New post
                </button>
            </div>

            {posts.length === 0 ? (
                <EmptyState icon="📭" title="No posts yet" desc="Create your first featured post" />
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
                    {posts.map(post => {
                        const pill = STATUS_PILL[post.status === 'published' ? 'published' : 'draft'];
                        return (
                            <div key={post.id} style={{ background: 'var(--bg-elevated)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ aspectRatio: '16/9', overflow: 'hidden', background: '#000' }}>
                                    <FeaturedPostSlideCard
                                        data={{ ...post, background: getBackgroundForPreview(post.background) }}
                                        businessName={post.businessName}
                                        businessLogoUrl={post.businessLogoUrl}
                                        playEntrance={false} compact={true}
                                    />
                                </div>
                                <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{post.title?.text || 'Untitled'}</span>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, border: `1px solid ${pill.border}`, background: pill.bg, color: pill.color, flexShrink: 0 }}>{pill.label}</span>
                                    </div>
                                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>
                                        {post.updatedAt?.toDate ? post.updatedAt.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                    </span>
                                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                        <button onClick={() => onEditPost(post)} style={actionBtn('#a78bfa')}><FaEdit /> Edit</button>
                                        <button onClick={() => toggleStatus(post)} style={actionBtn(post.status === 'published' ? '#9ca3af' : '#30d158')}>
                                            {post.status === 'published' ? <><FaEyeSlash /> Hide</> : <><FaEye /> Publish</>}
                                        </button>
                                        <button onClick={() => setConfirmDelete(post.id)} style={actionBtn('#f87171', true)}><FaTrash /></button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {confirmDelete && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 24 }}>
                    <div style={{ background: 'var(--bg-elevated)', borderRadius: 16, padding: 28, maxWidth: 380, width: '100%', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: 12, textAlign: 'center' }}>🗑️</div>
                        <h3 style={{ margin: '0 0 8px', textAlign: 'center', fontSize: '1rem', color: '#f1f5f9' }}>Delete this post?</h3>
                        <p style={{ margin: '0 0 20px', textAlign: 'center', fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)' }}>This action cannot be undone.</p>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                            <button onClick={() => deletePost(confirmDelete)} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── EVENTS TAB ---------------------------------------------------------------

function EventsTab({ onNewEvent, onEditEvent, onNavigate }) {
    const { currentUser } = useAuth();
    const { showToast } = useToast();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [confirmDelete, setConfirmDelete] = useState(null);

    useEffect(() => {
        if (!currentUser?.uid) return;
        const q = query(
            collection(db, 'communityPosts'),
            where('partnerId', '==', currentUser.uid),
            where('type', '==', 'event')
        );
        const unsub = onSnapshot(q, snap => {
            const sorted = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => {
                    const ta = a.updatedAt?.toDate?.()?.getTime?.() || 0;
                    const tb = b.updatedAt?.toDate?.()?.getTime?.() || 0;
                    return tb - ta;
                });
            setEvents(sorted);
            setLoading(false);
        }, (err) => { console.error('Events onSnapshot error:', err); setLoading(false); });
        return () => unsub();
    }, [currentUser]);

    const toggleStatus = useCallback(async (eventObj) => {
        const newStatus = eventObj.status === 'published' ? 'draft' : 'published';
        try {
            await updateDoc(doc(db, 'communityPosts', eventObj.id), {
                status: newStatus,
                ...(newStatus === 'published' ? { publishedAt: serverTimestamp() } : {}),
                updatedAt: serverTimestamp(),
            });
            showToast(newStatus === 'published' ? 'Published to feed' : 'Moved to drafts', 'success');
        } catch (e) { showToast(e?.message || 'Update failed', 'error'); }
    }, [showToast]);

    const deleteEvent = useCallback(async (id) => {
        try {
            await deleteDoc(doc(db, 'communityPosts', id));
            showToast('Event deleted', 'success');
        } catch (e) { showToast(e?.message || 'Delete failed', 'error'); }
        setConfirmDelete(null);
    }, [showToast]);

    if (loading) return <div className="bpro-spinner" />;

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
                    {events.length} event{events.length !== 1 ? 's' : ''} · {events.filter(p => p.status === 'published').length} published
                </div>
                <button className="ui-btn ui-btn--primary" onClick={onNewEvent} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FaPlus /> New event
                </button>
            </div>

            {events.length === 0 ? (
                <EmptyState icon="📭" title="No events yet" desc="Create your first event" action={<button className="ui-btn ui-btn--primary" onClick={onNewEvent}><FaPlus /> New Event</button>} />
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
                    {events.map(eventObj => {
                        const pill = STATUS_PILL[eventObj.status === 'published' ? 'published' : 'draft'];
                        return (
                            <div key={eventObj.id} style={{ background: 'var(--bg-elevated)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ aspectRatio: '16/9', overflow: 'hidden', background: '#1a1a24', position: 'relative' }}>
                                    {eventObj.eventDetails?.imageUrl ? (
                                        <img src={eventObj.eventDetails.imageUrl} alt="Event" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.1)' }}>
                                            <FaCalendarAlt size={48} />
                                        </div>
                                    )}
                                </div>
                                <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{eventObj.eventDetails?.title || 'Untitled Event'}</span>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, border: `1px solid ${pill.border}`, background: pill.bg, color: pill.color, flexShrink: 0 }}>{pill.label}</span>
                                    </div>
                                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>
                                        {eventObj.eventDetails?.startDate ? new Date(eventObj.eventDetails.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} 
                                        {eventObj.eventDetails?.startTime ? ` at ${eventObj.eventDetails.startTime}` : ''}
                                    </span>
                                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                        <button onClick={() => onEditEvent(eventObj)} style={actionBtn('#a78bfa')}><FaEdit /> Edit</button>
                                        <button onClick={() => toggleStatus(eventObj)} style={actionBtn(eventObj.status === 'published' ? '#9ca3af' : '#30d158')}>
                                            {eventObj.status === 'published' ? <><FaEyeSlash /> Hide</> : <><FaEye /> Publish</>}
                                        </button>
                                        <button onClick={() => setConfirmDelete(eventObj.id)} style={actionBtn('#f87171', true)}><FaTrash /></button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {confirmDelete && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 24 }}>
                    <div style={{ background: 'var(--bg-elevated)', borderRadius: 16, padding: 28, maxWidth: 380, width: '100%', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: 12, textAlign: 'center' }}>🗑️</div>
                        <h3 style={{ margin: '0 0 8px', textAlign: 'center', fontSize: '1rem', color: '#f1f5f9' }}>Delete this event?</h3>
                        <p style={{ margin: '0 0 20px', textAlign: 'center', fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)' }}>This action cannot be undone.</p>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                            <button onClick={() => deleteEvent(confirmDelete)} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── OFFERS TAB ───────────────────────────────────────────────────────────────

function OffersTab({ onNavigate }) {
    const { currentUser } = useAuth();
    const [offers, setOffers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState({});

    const loadOffers = useCallback(async () => {
        if (!currentUser?.uid) return;
        setLoading(true);
        try {
            let data = await premiumOfferService.getPartnerOffers(currentUser.uid);
            if (!data || data.length === 0) {
                const { collection: col, query: q, where: w, getDocs } = await import('firebase/firestore');
                const snap = await getDocs(q(col(db, 'active_offers'), w('partnerId', '==', currentUser.uid)));
                data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            }
            setOffers((data || []).sort((a, b) => {
                const rank = o => { const exp = o.expiresAt ? (o.expiresAt?.toDate?.() || new Date(o.expiresAt)) : null; if (exp && exp < new Date()) return 2; if (o.status === 'inactive') return 1; return 0; };
                return rank(a) - rank(b);
            }));
        } catch (e) { console.error(e); }
        setLoading(false);
    }, [currentUser?.uid]);

    useEffect(() => { loadOffers(); }, [loadOffers]);

    const withBusy = (id, fn) => async () => {
        setBusy(p => ({ ...p, [id]: true }));
        try { await fn(); } finally { setBusy(p => ({ ...p, [id]: false })); }
    };

    const handleFreeze = (offer) => withBusy(offer.id, async () => { await premiumOfferService.freezeOffer(offer.id); await loadOffers(); })();
    const handleRepublish = (offer) => withBusy(offer.id, async () => { await premiumOfferService.republishOffer(offer.id, currentUser.uid, offer); await loadOffers(); })();
    const handleDelete = (offer) => withBusy(offer.id, async () => {
        if (!window.confirm(`Delete "${offer.title}"?`)) return;
        await premiumOfferService.deleteOffer(offer.id);
        setOffers(p => p.filter(o => o.id !== offer.id));
    })();

    if (loading) return <div className="bpro-spinner" />;

    if (offers.length === 0) return (
        <EmptyState icon="🎁" title="No offers saved" desc="Create an offer from Design Studio"
            action={<button className="ui-btn ui-btn--primary" onClick={() => onNavigate?.('design', { tool: 'offer-editor' })}><FaPlus /> New Offer</button>} />
    );

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
            {offers.map(offer => {
                const isExpired = offer.expiresAt && (() => (offer.expiresAt?.toDate?.() || new Date(offer.expiresAt)) < new Date())();
                const isFrozen = offer.status === 'inactive';
                const isActive = !isFrozen && !isExpired;
                const isBusy = busy[offer.id];
                return (
                    <div key={offer.id} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${isActive ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 16, overflow: 'hidden' }}>
                        <div style={{ pointerEvents: 'none', opacity: isFrozen || isExpired ? 0.55 : 1 }}>
                            <PremiumOfferCard offer={offer} onRefresh={loadOffers} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, color: isExpired ? '#ef4444' : isFrozen ? '#f59e0b' : '#10b981', background: isExpired ? 'rgba(239,68,68,0.12)' : isFrozen ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)', border: `1px solid ${isExpired ? '#ef444440' : isFrozen ? '#f59e0b40' : '#10b98140'}` }}>
                                {isExpired ? '✕ Expired' : isFrozen ? '⏸ Frozen' : '● Live'}
                            </span>
                            <div style={{ flex: 1 }} />
                            <button onClick={() => onNavigate?.('design', { editOffer: offer })} disabled={isBusy} style={actionBtn()}><FaEdit size={13} /> Edit</button>
                            {isActive ? (
                                <button onClick={() => handleFreeze(offer)} disabled={isBusy} style={actionBtn('#f59e0b')}>
                                    {isBusy ? '…' : <><FaSnowflake size={13} /> Freeze</>}
                                </button>
                            ) : !isExpired ? (
                                <button onClick={() => handleRepublish(offer)} disabled={isBusy} style={actionBtn('#10b981')}>
                                    {isBusy ? '…' : <><FaPlay size={11} /> Publish</>}
                                </button>
                            ) : null}
                            <button onClick={() => handleDelete(offer)} disabled={isBusy} style={actionBtn('#ef4444', true)}>
                                {isBusy ? '…' : <FaTrash size={13} />}
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── REPORTS TAB ──────────────────────────────────────────────────────────────

function ReportsTab({ onNavigate }) {
    return (
        <EmptyState
            icon="📊"
            title="Reports are generated on-demand"
            desc="Generate activity reports (Weekly / Monthly / Yearly) from the Activity Report tool and download as PDF"
            action={
                <button className="ui-btn ui-btn--primary" onClick={() => onNavigate?.('design', { tool: 'activity-report' })}>
                    <FaFilePdf /> Open Activity Report
                </button>
            }
        />
    );
}

// ─── PRINTS TAB ──────────────────────────────────────────────────────────────

function PrintsTab({ onNavigate }) {
    return (
        <EmptyState
            icon="🖨️"
            title="Printables are generated on-demand"
            desc="Create business cards, flyers and QR-code sheets using the Export Assets tool"
            action={
                <button className="ui-btn ui-btn--primary" onClick={() => onNavigate?.('design', { tool: 'export' })}>
                    <FaPrint /> Open Export Assets
                </button>
            }
        />
    );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function ProDrafts({ onNewPost, onEditPost, onNewEvent, onEditEvent, onNavigate }) {
    const [activeTab, setActiveTab] = useState('posts');

    return (
        <div style={{ padding: '20px 24px', maxWidth: 1000, margin: '0 auto' }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
                {TABS.map(tab => (
                    <button key={tab.key} style={TAB_STYLE(activeTab === tab.key)} onClick={() => setActiveTab(tab.key)}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {activeTab === 'posts'   && <PostsTab  onNewPost={onNewPost} onEditPost={onEditPost} />}
            {activeTab === 'events'  && <EventsTab onNewEvent={onNewEvent} onEditEvent={onEditEvent} onNavigate={onNavigate} />}
            {activeTab === 'offers'  && <OffersTab onNavigate={onNavigate} />}
            {activeTab === 'reports' && <ReportsTab onNavigate={onNavigate} />}
            {activeTab === 'prints'  && <PrintsTab onNavigate={onNavigate} />}
        </div>
    );
}
