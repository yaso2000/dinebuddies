import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { attachRankingScores, rankBusinesses } from '../services/businessRankingService';
import { useTranslation } from 'react-i18next';
import { getSafeAvatar } from '../utils/avatarUtils';
import { normalizeBusinessTier } from '../utils/businessSubscription';

const RANKING_LIMIT = 100;
const BUSINESSES_QUERY_LIMIT = 200;

/** Full business name (trimmed); no word limit */
function getDisplayName(name) {
    if (!name || typeof name !== 'string') return '';
    return name.trim();
}

/** Country code to flag emoji (e.g. AU → 🇦🇺) */
function getCountryFlag(countryCode) {
    if (!countryCode || typeof countryCode !== 'string') return '';
    const c = countryCode.trim().toUpperCase().slice(0, 2);
    if (c.length < 2) return '';
    return String.fromCodePoint(...[...c].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65));
}

export default function BusinessRankings() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [scope, setScope] = useState('global'); // 'country' | 'global' (competition scope)
    const [businesses, setBusinesses] = useState([]);
    const [ranked, setRanked] = useState([]);
    const [scopeLabel, setScopeLabel] = useState('');
    const [totalInScope, setTotalInScope] = useState(0);
    const [errorMsg, setErrorMsg] = useState(null);

    const userScope = {
        city: (userProfile?.city || userProfile?.businessInfo?.city || '').toString().trim(),
        region: (userProfile?.state || userProfile?.businessInfo?.state || userProfile?.region || '').toString().trim(),
        country: (userProfile?.country || userProfile?.businessInfo?.country || userProfile?.countryCode || '').toString().trim()
    };

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const q = query(
                    collection(db, 'public_profiles'),
                    where('profileType', '==', 'business'),
                    where('businessPublic.isPublished', '==', true),
                    limit(BUSINESSES_QUERY_LIMIT)
                );
                const snap = await getDocs(q);
                const list = [];
                snap.docs.forEach(d => {
                    const data = d.data();
                    const info = data.businessPublic || {};
                    const logo = data.avatarUrl || info.logo || info.coverImage || null;
                    list.push({
                        id: d.id,
                        uid: d.id,
                        name: info.businessName || data.displayName || 'Business',
                        logo,
                        subscriptionTier: (data.subscriptionTier || 'free').toString().toLowerCase(),
                        businessPublic: {
                            city: info.city || '',
                            country: info.country || '',
                            state: info.state || '',
                            region: info.region || '',
                            address: info.address || '',
                            coverImage: info.coverImage
                        },
                        businessInfo: {}
                    });
                });

                if (cancelled) return;

                const ids = list.map(b => b.id);
                const statsById = {};

                const BATCH = 10;
                if (auth.currentUser) {
                    for (let i = 0; i < ids.length; i += BATCH) {
                        const chunk = ids.slice(i, i + BATCH);
                        const userSnaps = await Promise.all(chunk.map(id => getDoc(doc(db, 'users', id)).catch(() => null)));
                        userSnaps.forEach((s, idx) => {
                            const id = chunk[idx];
                            if (!s || !s.exists()) return;
                            const d = s.data();
                            const biz = d.businessInfo || {};
                            const members = Array.isArray(d.communityMembers) ? d.communityMembers.length : (biz.memberCount ?? 0);
                            const tier = (d.subscriptionTier || 'free').toString().toLowerCase();
                            statsById[id] = {
                                profileViews: Number(biz.profileViews) || 0,
                                profileLikes: Number(biz.profileLikes) || 0,
                                profileShares: Number(biz.profileShares) || 0,
                                memberCount: Number(members) || 0,
                                totalInvitations: Number(biz.totalInvitations) || 0,
                                rating: 0,
                                reviewCount: 0,
                                subscriptionTier: tier
                            };
                        });
                    }
                }

                const reviewsRef = collection(db, 'reviews');
                for (let i = 0; i < ids.length; i += BATCH) {
                    const chunk = ids.slice(i, i + BATCH);
                    const [sp, sf, sr] = await Promise.all([
                        getDocs(query(reviewsRef, where('partnerId', 'in', chunk), limit(100))).catch(() => ({ docs: [] })),
                        getDocs(query(reviewsRef, where('profileId', 'in', chunk), limit(100))).catch(() => ({ docs: [] })),
                        getDocs(query(reviewsRef, where('restaurantId', 'in', chunk), limit(100))).catch(() => ({ docs: [] }))
                    ]);
                    const allReviews = [...sp.docs, ...sf.docs, ...sr.docs].map(d => d.data());
                    chunk.forEach(id => {
                        const reviews = allReviews.filter(
                            r => r.partnerId === id || r.profileId === id || r.restaurantId === id
                        );
                        const count = reviews.length;
                        const total = reviews.reduce((s, r) => s + (r.rating || 0), 0);
                        if (!statsById[id]) statsById[id] = { profileViews: 0, profileLikes: 0, profileShares: 0, memberCount: 0, totalInvitations: 0, rating: 0, reviewCount: 0 };
                        statsById[id].rating = count > 0 ? total / count : 0;
                        statsById[id].reviewCount = count;
                    });
                }

                // totalInvitations: use stored counter only (never decremented when invitations are deleted/completed)
                // so businesses do not lose ranking points. Counter is incremented on create in InvitationContext.

                if (cancelled) return;

                list.forEach(b => { b.subscriptionTier = statsById[b.id]?.subscriptionTier || b.subscriptionTier || 'free'; });
                const paidOnly = list.filter((b) => normalizeBusinessTier(b.subscriptionTier) === 'paid');
                const withScores = attachRankingScores(paidOnly, statsById);
                setBusinesses(withScores);
            } catch (e) {
                if (!cancelled) {
                    console.error('BusinessRankings load error:', e);
                    setErrorMsg(e.message || String(e));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!businesses.length) {
            setRanked([]);
            setScopeLabel(scope === 'global' ? t('rankings_global', 'Global') : '');
            setTotalInScope(0);
            return;
        }
        
        let currentLimit = 100;
        if (scope === 'city') currentLimit = 10;
        else if (scope === 'country') currentLimit = 50;

        const { ranked: r, scope: sl, totalInScope: tot } = rankBusinesses(businesses, scope, userScope, currentLimit);
        setRanked(r);
        setScopeLabel(sl === 'Global' ? t('rankings_global', 'Global') : (sl ? t(sl, sl) : ''));
        setTotalInScope(tot);
    }, [businesses, scope, userScope.city, userScope.region, userScope.country, t]);

    if (loading) {
        return (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
                {t('loading', 'Loading')}…
            </div>
        );
    }

    return (
        <div style={{ padding: 24, maxWidth: '100%', width: '100%', margin: 0, boxSizing: 'border-box' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>
                {t('rankings_title', 'Business Rankings')}
            </h1>
            <p style={{ fontSize: '0.9rem', marginBottom: 20 }}>
                <strong style={{ color: '#ea580c' }}>{t('rankings_paid_only', 'Only Paid Business subscribers are included in the ranking.')}</strong>
            </p>

            {/* Competition scope: City, Country and Global */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {userScope.city && (
                    <button
                        type="button"
                        onClick={() => setScope('city')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: 12,
                            border: scope === 'city' ? '2px solid #6366f1' : '1px solid var(--border)',
                            background: scope === 'city' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-elevated)',
                            color: 'var(--text-main)',
                            cursor: 'pointer',
                            fontWeight: scope === 'city' ? 700 : 500
                        }}
                    >
                        {t(userScope.city, userScope.city)}
                    </button>
                )}
                {userScope.country && (
                    <button
                        type="button"
                        onClick={() => setScope('country')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: 12,
                            border: scope === 'country' ? '2px solid #6366f1' : '1px solid var(--border)',
                            background: scope === 'country' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-elevated)',
                            color: 'var(--text-main)',
                            cursor: 'pointer',
                            fontWeight: scope === 'country' ? 700 : 500
                        }}
                    >
                        {t(userScope.country, userScope.country)}
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => setScope('global')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: 12,
                        border: scope === 'global' ? '2px solid #6366f1' : '1px solid var(--border)',
                        background: scope === 'global' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-elevated)',
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                        fontWeight: scope === 'global' ? 700 : 500
                    }}
                >
                    {t('rankings_global', 'Global')}
                </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: 10, border: '1px solid var(--border)' }}>
                    {scopeLabel || t('rankings_global', 'Global')}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {totalInScope} {t('rankings_businesses', 'businesses')}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.85 }}>
                    {t('rankings_top', 'top')} {scope === 'city' ? 10 : scope === 'country' ? 50 : 100}
                </span>
            </div>

            {/* Olympic-style podium: 2nd left, 1st center (highest), 3rd right — with gold/silver/bronze */}
            {ranked.length >= 3 && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        gap: 12,
                        marginBottom: 24,
                        minHeight: 200
                    }}
                >
                    {/* 2nd — Silver — left */}
                    <div style={{ flex: 1, minWidth: 100, maxWidth: 140, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ flex: 1, minHeight: 8 }} />
                        <div
                            onClick={() => navigate(`/business/${ranked[1].business.id}`)}
                            style={{
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                cursor: 'pointer',
                                padding: '12px 8px',
                                borderRadius: 16,
                                background: 'linear-gradient(180deg, rgba(192,192,192,0.25) 0%, rgba(192,192,192,0.08) 100%)',
                                border: '2px solid #C0C0C0',
                                height: 180,
                                width: '100%',
                                overflow: 'hidden',
                                boxSizing: 'border-box'
                            }}
                        >
                            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 6, flexShrink: 0 }}>
                                <img
                                    src={getSafeAvatar({ avatarUrl: ranked[1].business.logo, photo_url: ranked[1].business.logo, displayName: ranked[1].business.name })}
                                    alt={ranked[1].business.name}
                                    style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '3px solid #C0C0C0' }}
                                    onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(ranked[1].business.name)}`; }}
                                />
                                {scope === 'global' && ranked[1].business.businessPublic?.country && getCountryFlag(ranked[1].business.businessPublic.country) ? (
                                    <span style={{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-card)', border: '2px solid #C0C0C0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', lineHeight: 1, boxSizing: 'border-box' }} title={ranked[1].business.businessPublic.country}>{getCountryFlag(ranked[1].business.businessPublic.country)}</span>
                                ) : null}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
                                <span style={{ fontSize: '1.25rem' }}>🥈</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{Math.round(ranked[1].business.rankingScore ?? 0)} {t('rankings_points', 'pts')}</span>
                            </div>
                            <div style={{ width: '100%', minHeight: 32, maxHeight: 56, overflow: 'hidden', textAlign: 'center', padding: '0 4px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ fontWeight: 700, fontSize: 'clamp(0.5rem, 1.8vw + 0.5rem, 0.95rem)', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', lineHeight: 1.2, wordBreak: 'normal' }} title={ranked[1].business.name}>{getDisplayName(ranked[1].business.name)}</div>
                            </div>
                            <div style={{ flex: 1, minHeight: 4 }} />
                        </div>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#C0C0C0', color: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0, marginTop: 8 }}>2</div>
                    </div>
                    {/* 1st — Gold — center (tallest) */}
                    <div style={{ flex: 1, minWidth: 100, maxWidth: 140, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ flex: 1, minHeight: 8 }} />
                        <div
                            onClick={() => navigate(`/business/${ranked[0].business.id}`)}
                            style={{
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                cursor: 'pointer',
                                padding: '12px 8px',
                                borderRadius: 16,
                                background: 'linear-gradient(180deg, rgba(255,215,0,0.2) 0%, rgba(255,215,0,0.06) 100%)',
                                border: '2px solid #D4AF37',
                                height: 220,
                                width: '100%',
                                overflow: 'hidden',
                                boxSizing: 'border-box'
                            }}
                        >
                            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 6, flexShrink: 0 }}>
                                <img
                                    src={getSafeAvatar({ avatarUrl: ranked[0].business.logo, photo_url: ranked[0].business.logo, displayName: ranked[0].business.name })}
                                    alt={ranked[0].business.name}
                                    style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '3px solid #D4AF37' }}
                                    onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(ranked[0].business.name)}`; }}
                                />
                                {scope === 'global' && ranked[0].business.businessPublic?.country && getCountryFlag(ranked[0].business.businessPublic.country) ? (
                                    <span style={{ position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-card)', border: '2px solid #D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', lineHeight: 1, boxSizing: 'border-box' }} title={ranked[0].business.businessPublic.country}>{getCountryFlag(ranked[0].business.businessPublic.country)}</span>
                                ) : null}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
                                <span style={{ fontSize: '1.4rem' }}>🥇</span>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{Math.round(ranked[0].business.rankingScore ?? 0)} {t('rankings_points', 'pts')}</span>
                            </div>
                            <div style={{ width: '100%', minHeight: 32, maxHeight: 56, overflow: 'hidden', textAlign: 'center', padding: '0 4px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ fontWeight: 800, fontSize: 'clamp(0.55rem, 1.8vw + 0.5rem, 1rem)', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', lineHeight: 1.2, wordBreak: 'normal' }} title={ranked[0].business.name}>{getDisplayName(ranked[0].business.name)}</div>
                            </div>
                            <div style={{ flex: 1, minHeight: 4 }} />
                        </div>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#D4AF37', color: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', flexShrink: 0, marginTop: 8 }}>1</div>
                    </div>
                    {/* 3rd — Bronze — right */}
                    <div style={{ flex: 1, minWidth: 100, maxWidth: 140, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ flex: 1, minHeight: 8 }} />
                        <div
                            onClick={() => navigate(`/business/${ranked[2].business.id}`)}
                            style={{
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                cursor: 'pointer',
                                padding: '12px 8px',
                                borderRadius: 16,
                                background: 'linear-gradient(180deg, rgba(205,127,50,0.25) 0%, rgba(205,127,50,0.08) 100%)',
                                border: '2px solid #CD7F32',
                                height: 160,
                                width: '100%',
                                overflow: 'hidden',
                                boxSizing: 'border-box'
                            }}
                        >
                            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 6, flexShrink: 0 }}>
                                <img
                                    src={getSafeAvatar({ avatarUrl: ranked[2].business.logo, photo_url: ranked[2].business.logo, displayName: ranked[2].business.name })}
                                    alt={ranked[2].business.name}
                                    style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '3px solid #CD7F32' }}
                                    onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(ranked[2].business.name)}`; }}
                                />
                                {scope === 'global' && ranked[2].business.businessPublic?.country && getCountryFlag(ranked[2].business.businessPublic.country) ? (
                                    <span style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: '50%', background: 'var(--bg-card)', border: '2px solid #CD7F32', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', lineHeight: 1, boxSizing: 'border-box' }} title={ranked[2].business.businessPublic.country}>{getCountryFlag(ranked[2].business.businessPublic.country)}</span>
                                ) : null}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
                                <span style={{ fontSize: '1.25rem' }}>🥉</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{Math.round(ranked[2].business.rankingScore ?? 0)} {t('rankings_points', 'pts')}</span>
                            </div>
                            <div style={{ width: '100%', minHeight: 32, maxHeight: 56, overflow: 'hidden', textAlign: 'center', padding: '0 4px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ fontWeight: 700, fontSize: 'clamp(0.5rem, 1.8vw + 0.45rem, 0.9rem)', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', lineHeight: 1.2, wordBreak: 'normal' }} title={ranked[2].business.name}>{getDisplayName(ranked[2].business.name)}</div>
                            </div>
                            <div style={{ flex: 1, minHeight: 4 }} />
                        </div>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#CD7F32', color: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0, marginTop: 8 }}>3</div>
                    </div>
                </div>
            )}

            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {ranked.slice(ranked.length >= 3 ? 3 : 0).map(({ rank, business }) => (
                    <li
                        key={business.id}
                        onClick={() => navigate(`/business/${business.id}`)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '12px 16px',
                            marginBottom: 8,
                            borderRadius: 12,
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border)',
                            cursor: 'pointer'
                        }}
                    >
                        <span style={{ fontWeight: 800, color: '#6366f1', minWidth: 28, flexShrink: 0 }}>#{rank}</span>
                        <img
                            src={getSafeAvatar({ avatarUrl: business.logo, photo_url: business.logo, displayName: business.name })}
                            alt=""
                            style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                            onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(business.name)}`; }}
                        />
                        <span style={{ fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.25, wordBreak: 'normal', fontSize: 'clamp(0.7rem, 1.5vw + 0.55rem, 0.95rem)' }} title={business.name}>{getDisplayName(business.name)}{scope === 'global' && business.businessPublic?.country ? ` ${getCountryFlag(business.businessPublic.country)}` : ''}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', flexShrink: 0 }}>{Math.round(business.rankingScore ?? 0)} {t('rankings_points', 'pts')}</span>
                    </li>
                ))}
            </ul>

            {ranked.length === 0 && (
                <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 24 }}>
                    <p>{scope === 'global' ? t('rankings_no_businesses', 'No businesses in this scope.') : t('rankings_no_in_scope', 'No businesses in this area. Try Global.')}</p>
                    {errorMsg && (
                        <p style={{ marginTop: 12, color: '#ef4444', fontSize: '0.85rem', fontWeight: 'bold' }}>
                            [Debug Error]: {errorMsg}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
