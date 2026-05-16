import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs, limit, orderBy, startAfter } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { auth, db } from '../firebase/config';
import { FaSearch, FaTimes, FaChevronLeft, FaUser, FaStore, FaMapMarkerAlt } from 'react-icons/fa';
import { getSafeAvatar } from '../utils/avatarUtils';
import UserAvatar from '../components/UserAvatar';
import { useAuth } from '../context/AuthContext';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import { buildFollowPlusProps } from '../utils/followPlusUi';
import { shouldHideUserFromPublicDirectorySearch } from '../utils/searchVisibility';
import './SearchPage.css';

/** Results load only after this many characters (inclusive). */
const MIN_QUERY_CHARS = 2;

const FUNCTIONS_REGION = 'us-central1';

/** Server-side directory (Admin SDK); merges with client pools in runSearch. */
async function directorySearchCloud(q) {
    const fn = httpsCallable(getFunctions(app, FUNCTIONS_REGION), 'directorySearch');
    const res = await fn({ q });
    const data = res.data || {};
    return {
        users: Array.isArray(data.users) ? data.users : [],
        businesses: Array.isArray(data.businesses) ? data.businesses : [],
    };
}

function mergeDirectoryWithClient(cloudBiz, cloudUsers, clientBiz, clientUsers, selfId) {
    const bizMap = new Map();
    const userMap = new Map();
    for (const x of cloudBiz) {
        if (x?.id && x.id !== selfId) bizMap.set(x.id, x);
    }
    for (const x of clientBiz) {
        if (x?.id && x.id !== selfId && !bizMap.has(x.id)) bizMap.set(x.id, x);
    }
    for (const x of cloudUsers) {
        if (x?.id && x.id !== selfId) userMap.set(x.id, x);
    }
    for (const x of clientUsers) {
        if (x?.id && x.id !== selfId && !userMap.has(x.id)) userMap.set(x.id, x);
    }
    return {
        businesses: [...bizMap.values()],
        users: [...userMap.values()],
    };
}

/**
 * Per-query caps. Firestore rules (users list): signed-in users may list only if limit != null && limit <= 500.
 * Anything above 500 is denied — search returned empty for everyone.
 */
const USER_POOL_LASTSEEN = 500;
const USER_POOL_CREATED = 500;
/** Unordered sample merged with ordered pools (catches profiles missing lastSeen/created_time). */
const USER_POOL_RANDOM = 500;
const BIZ_POOL_LASTSEEN = 480;
const PARTNER_POOL_LASTSEEN = 180;
const BIZ_POOL_CREATED = 320;
/** Fallback if composite indexes are missing — must stay <= 500 per firestore.rules. */
const SCAN_LIMIT_FALLBACK = 500;

// Case-insensitive substring: needle must appear anywhere in joined fields.
const textMatchesQuery = (query, ...fields) => {
    const needle = String(query || '').trim().toLowerCase();
    if (needle.length < MIN_QUERY_CHARS) return false;
    const hay = fields.filter(Boolean).join(' ').toLowerCase();
    return hay.includes(needle);
};

/** Dedupe Firestore doc snapshots by id (first wins). */
function mergeDocSnapshots(...docLists) {
    const map = new Map();
    for (const list of docLists) {
        for (const d of list || []) {
            if (!map.has(d.id)) map.set(d.id, d);
        }
    }
    return Array.from(map.values());
}

/** OAuth / Apple sign-ups sometimes lack `role: user` until profile completes — still in `users`. */
async function fetchOauthUserDocs() {
    const col = collection(db, 'users');
    try {
        const [g, f, a] = await Promise.all([
            getDocs(query(col, where('authProvider', '==', 'google'), limit(200))),
            getDocs(query(col, where('authProvider', '==', 'facebook'), limit(200))),
            getDocs(query(col, where('authProvider', '==', 'apple'), limit(120))),
        ]);
        return mergeDocSnapshots(g.docs, f.docs, a.docs);
    } catch (e) {
        console.warn('[SearchPage] oauth user pool:', e?.code, e?.message);
        return [];
    }
}

/**
 * Backend mirror of users (syncPublicProfileOnUserWrite). Lists without needing role==user.
 * Rules: list limit <= 200 per request — paginate to widen coverage.
 */
const PUBLIC_PROFILE_PAGE = 200;
const PUBLIC_PROFILE_MAX_PAGES = 4;

async function fetchPublicConsumerProfileDocs() {
    const col = collection(db, 'public_profiles');
    const out = [];
    let lastDoc = null;
    try {
        for (let page = 0; page < PUBLIC_PROFILE_MAX_PAGES; page += 1) {
            const q = lastDoc
                ? query(
                    col,
                    where('profileType', '==', 'user'),
                    orderBy('updatedAt', 'desc'),
                    startAfter(lastDoc),
                    limit(PUBLIC_PROFILE_PAGE)
                )
                : query(
                    col,
                    where('profileType', '==', 'user'),
                    orderBy('updatedAt', 'desc'),
                    limit(PUBLIC_PROFILE_PAGE)
                );
            const snap = await getDocs(q);
            if (snap.empty) break;
            out.push(...snap.docs);
            lastDoc = snap.docs[snap.docs.length - 1];
            if (snap.size < PUBLIC_PROFILE_PAGE) break;
        }
    } catch (e) {
        console.warn('[SearchPage] public_profiles user pool:', e?.code, e?.message);
    }
    return out;
}

async function fetchConsumerUserDocs() {
    const col = collection(db, 'users');
    const qRandom = query(col, where('role', '==', 'user'), limit(USER_POOL_RANDOM));

    let orderedDocs = [];
    try {
        const [bySeen, byCreated] = await Promise.all([
            getDocs(query(col, where('role', '==', 'user'), orderBy('lastSeen', 'desc'), limit(USER_POOL_LASTSEEN))),
            getDocs(query(col, where('role', '==', 'user'), orderBy('created_time', 'desc'), limit(USER_POOL_CREATED))),
        ]);
        orderedDocs = mergeDocSnapshots(bySeen.docs, byCreated.docs);
    } catch (e) {
        console.warn('[SearchPage] ordered user pool failed (indexes or field missing?):', e?.code, e?.message);
    }

    try {
        const randomSnap = await getDocs(qRandom);
        let merged = mergeDocSnapshots(orderedDocs, randomSnap.docs);
        const oauth = await fetchOauthUserDocs();
        merged = mergeDocSnapshots(merged, oauth);
        return merged;
    } catch (e) {
        console.warn('[SearchPage] user random pool failed:', e?.code, e?.message);
        if (orderedDocs.length) return mergeDocSnapshots(orderedDocs, await fetchOauthUserDocs());
        const snap = await getDocs(query(col, where('role', '==', 'user'), limit(SCAN_LIMIT_FALLBACK)));
        return mergeDocSnapshots(snap.docs, await fetchOauthUserDocs());
    }
}

async function fetchBusinessRoleDocs() {
    const col = collection(db, 'users');
    let merged = [];
    try {
        const [bizSeen, partSeen, bizCreated] = await Promise.all([
            getDocs(query(col, where('role', '==', 'business'), orderBy('lastSeen', 'desc'), limit(BIZ_POOL_LASTSEEN))),
            getDocs(query(col, where('role', '==', 'partner'), orderBy('lastSeen', 'desc'), limit(PARTNER_POOL_LASTSEEN))),
            getDocs(query(col, where('role', '==', 'business'), orderBy('created_time', 'desc'), limit(BIZ_POOL_CREATED))),
        ]);
        merged = mergeDocSnapshots(bizSeen.docs, partSeen.docs, bizCreated.docs);
    } catch (e) {
        console.warn('[SearchPage] ordered business pool failed, fallback:', e?.message);
        const [b, p] = await Promise.all([
            getDocs(query(col, where('role', '==', 'business'), limit(SCAN_LIMIT_FALLBACK))),
            getDocs(query(col, where('role', '==', 'partner'), limit(200))),
        ]);
        merged = mergeDocSnapshots(b.docs, p.docs);
    }
    try {
        const [b, p] = await Promise.all([
            getDocs(query(col, where('role', '==', 'business'), limit(400))),
            getDocs(query(col, where('role', '==', 'partner'), limit(100))),
        ]);
        return mergeDocSnapshots(merged, b.docs, p.docs);
    } catch {
        return merged;
    }
}

const CATEGORIES = [
    { id: 'all', label: 'All', icon: <FaSearch /> },
    { id: 'businesses', label: 'Businesses', icon: <FaStore /> },
    { id: 'users', label: 'Users', icon: <FaUser /> },
];

const SearchPage = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const inputRef = useRef(null);

    const initialQuery = searchParams.get('q') || '';
    const initialCat = searchParams.get('cat') || 'all';
    const initialOnlineOnly = searchParams.get('online') === '1';

    const [query2, setQuery2] = useState(initialQuery);
    const [activeCategory, setActiveCategory] = useState(initialCat);
    const [onlineUsersOnly, setOnlineUsersOnly] = useState(initialOnlineOnly);
    const [loading, setLoading] = useState(false);

    const [results, setResults] = useState({
        businesses: [],
        users: [],
    });

    const { userProfile } = useAuth();
    const { currentUser, toggleFollow } = useInvitations();
    const { showToast } = useToast();

    const followSearchCtx = useMemo(
        () => ({ currentUser, userProfile, toggleFollow, showToast, t }),
        [currentUser, userProfile, toggleFollow, showToast, t]
    );

    const activeCategoryRef = useRef(activeCategory);
    const onlineUsersOnlyRef = useRef(onlineUsersOnly);
    activeCategoryRef.current = activeCategory;
    onlineUsersOnlyRef.current = onlineUsersOnly;

    const isRTL = i18n.language === 'ar';

    const syncSearchUrl = useCallback(
        (q, cat, onlineOnly) => {
            const params = new URLSearchParams();
            const trimmed = String(q || '').trim();
            if (trimmed.length >= MIN_QUERY_CHARS) params.set('q', trimmed);
            if (cat && cat !== 'all') params.set('cat', cat);
            else params.set('cat', 'all');
            if (onlineOnly) params.set('online', '1');
            setSearchParams(params, { replace: true });
        },
        [setSearchParams]
    );

    // Auto-focus input
    useEffect(() => { inputRef.current?.focus(); }, []);

    // Re-fetch when query has at least MIN_QUERY_CHARS — fetch businesses + users together
    useEffect(() => {
        const trimmed = query2.trim();
        if (trimmed.length < MIN_QUERY_CHARS) {
            setResults({ businesses: [], users: [] });
            syncSearchUrl(trimmed, activeCategory, onlineUsersOnly);
            return;
        }
        const timer = setTimeout(() => runSearch(trimmed), 350);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query2]);

    useEffect(() => {
        syncSearchUrl(query2, activeCategory, onlineUsersOnly);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCategory, onlineUsersOnly]);

    const runSearch = async (q) => {
        const trimmed = String(q || '').trim();
        if (trimmed.length < MIN_QUERY_CHARS) return;

        setLoading(true);
        syncSearchUrl(trimmed, activeCategoryRef.current, onlineUsersOnlyRef.current);

        try {
            const cloudP = directorySearchCloud(trimmed).catch((e) => {
                console.warn('[SearchPage] directorySearch:', e?.code, e?.message);
                return { users: [], businesses: [] };
            });
            const [cloud, businesses, users] = await Promise.all([
                cloudP,
                searchBusinesses(trimmed),
                searchUsers(trimmed),
            ]);
            const selfId = auth.currentUser?.uid || '';
            const merged = mergeDirectoryWithClient(cloud.businesses, cloud.users, businesses, users, selfId);
            merged.users = merged.users.filter((u) => !shouldHideUserFromPublicDirectorySearch(u, u.id));
            setResults(merged);
        } catch (err) {
            console.error('Search error:', err);
        } finally {
            setLoading(false);
        }
    };

    const searchBusinesses = async (q) => {
        try {
            const docs = await fetchBusinessRoleDocs();
            return docs
                .map(d => ({ id: d.id, _type: 'business', ...d.data() }))
                .filter(b => {
                    const bi = b.businessInfo || {};
                    return textMatchesQuery(
                        q,
                        b.display_name,
                        b.displayName,
                        b.name,
                        b.email,
                        bi.businessName,
                        bi.email,
                        bi.businessType,
                        bi.city,
                        bi.address,
                        bi.description
                    );
                });
        } catch { return []; }
    };

    const searchUsers = async (q) => {
        try {
            const [userColDocs, publicDocs] = await Promise.all([
                fetchConsumerUserDocs(),
                fetchPublicConsumerProfileDocs(),
            ]);

            const byId = new Map();

            for (const d of userColDocs) {
                const data = d.data() || {};
                if (shouldHideUserFromPublicDirectorySearch(data, d.id)) continue;
                byId.set(d.id, { id: d.id, _type: 'user', ...data });
            }

            for (const d of publicDocs) {
                if (byId.has(d.id)) continue;
                const p = d.data() || {};
                if ((p.profileType || 'user') !== 'user') continue;
                if (shouldHideUserFromPublicDirectorySearch(p, d.id)) continue;
                const name = p.displayName || '';
                const dnLower = p.search?.displayNameLower || '';
                byId.set(d.id, {
                    id: d.id,
                    _type: 'user',
                    display_name: name,
                    displayName: name,
                    photo_url: p.avatarUrl || null,
                    photoURL: p.avatarUrl || null,
                    email: '',
                    isOnline: undefined,
                    _searchDisplayNameLower: dnLower,
                });
            }

            return [...byId.values()].filter((u) => {
                const name =
                    u.display_name ||
                    u.displayName ||
                    u.name ||
                    u.username ||
                    '';
                const email = (u.email || '').trim();
                const emailPrefix = email.includes('@') ? email.split('@')[0] : email;
                return textMatchesQuery(
                    q,
                    name,
                    emailPrefix,
                    email,
                    u._searchDisplayNameLower
                );
            });
        } catch (err) {
            console.error('User search error:', err);
            return [];
        }
    };

    const usersForDisplay = useMemo(() => {
        if (!onlineUsersOnly) return results.users;
        return results.users.filter((u) => u.isOnline === true);
    }, [results.users, onlineUsersOnly]);

    const totalCount = results.businesses.length + usersForDisplay.length;
    const queryReady = query2.trim().length >= MIN_QUERY_CHARS;

    // ── Navigation ───────────────────────────────────────────────────────────
    const navigateToResult = (item) => {
        if (item._type === 'invitation') navigate(`/invitation/${item.id}`);
        else if (item._type === 'private_invitation') navigate(`/invitation/private/${item.id}`);
        else if (item._type === 'post') navigate(`/profile/${item.authorId || item.userId}`);
        else if (item._type === 'business') navigate(`/business/${item.id}`);
        else if (item._type === 'user') navigate(`/profile/${item.id}`);
    };

    const renderBusinessItem = (item) => {
        const bi = item.businessInfo || {};
        return (
            <div key={item.id} className="search-result-item" onClick={() => navigateToResult(item)}>
                <UserAvatar
                    user={item}
                    src={getSafeAvatar(item) || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=80&q=60'}
                    alt={item.display_name}
                    className="search-result-thumb"
                    style={{ width: 48, height: 48, objectFit: 'cover' }}
                />
                <div className="search-result-content">
                    <div className="search-result-title">{bi.businessName || item.display_name || 'Business'}</div>
                    <div className="search-result-sub">
                        {bi.businessType && <span>{bi.businessType}</span>}
                        {bi.city && <span><FaMapMarkerAlt style={{ marginRight: 3 }} />{bi.city}</span>}
                        {(bi.email || item.email) && (
                            <span>{String(bi.email || item.email).split('@')[0]}@…</span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderUserItem = (item) => {
        const userFp = buildFollowPlusProps(item, followSearchCtx);
        return (
            <div key={item.id} className="search-result-item" onClick={() => navigateToResult(item)}>
                <UserAvatar
                    user={item}
                    alt={item.display_name}
                    className="search-result-thumb"
                    followPlus={userFp || undefined}
                    followBadgeSize={15}
                    style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
                />
                <div className="search-result-content">
                    <div className="search-result-title">
                        {item.display_name || item.displayName || item.name || item.username || item.email?.split('@')[0] || 'User'}
                    </div>
                    <div className="search-result-sub">
                        {item.isOnline === true && (
                            <span className="search-badge-online">{t('search_online_badge', 'Online')}</span>
                        )}
                        {item.email && <span>{item.email.split('@')[0]}@…</span>}
                        {item.subscriptionTier && item.subscriptionTier !== 'free' && (
                            <span className="search-badge-tier">{item.subscriptionTier}</span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderSection = (title, items, renderFn) => {
        if (!items.length) return null;
        return (
            <div className="search-section">
                <div className="search-section-title">{title} <span className="search-section-count">{items.length}</span></div>
                {items.map(renderFn)}
            </div>
        );
    };

    const showEmpty = !loading && queryReady && totalCount === 0;
    const showResults = !loading && queryReady && totalCount > 0;
    const showTooShort = !query2.trim() || query2.trim().length < MIN_QUERY_CHARS;

    return (
        <div className="search-page" dir={isRTL ? 'rtl' : 'ltr'}>
            {/* One sticky block: avoids iOS overlap between bar + tabs (was two stickies with wrong top offset). */}
            <div className="search-top-sticky sticky-header-glass">
                <header className="search-header">
                    <button type="button" className="back-btn" onClick={() => navigate(-1)} aria-label="Go back">
                        <FaChevronLeft style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }} />
                    </button>

                    <div className="search-input-wrapper">
                        <FaSearch className="search-input-icon" />
                        <input
                            ref={inputRef}
                            type="search"
                            className="search-input"
                            placeholder={t('search_placeholder', 'Type 2+ characters (business or user)...')}
                            value={query2}
                            onChange={e => setQuery2(e.target.value)}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                        />
                        {query2 && (
                            <button type="button" className="search-clear-btn" onClick={() => setQuery2('')} aria-label="Clear">
                                <FaTimes />
                            </button>
                        )}
                    </div>
                </header>

                <div className="search-tabs-wrap">
                    <div className="search-tabs">
                        {CATEGORIES.map(cat => (
                            <button
                                type="button"
                                key={cat.id}
                                className={`search-tab ${activeCategory === cat.id ? 'active' : ''}`}
                                onClick={() => setActiveCategory(cat.id)}
                            >
                                <span className="search-tab-icon">{cat.icon}</span>
                                {t(`search_cat_${cat.id}`, cat.label)}
                            </button>
                        ))}
                    </div>
                    <label className="search-online-toggle">
                        <span className="search-online-toggle-label">{t('search_online_only', 'Online users only')}</span>
                        <span className="search-online-switch">
                            <input
                                type="checkbox"
                                checked={onlineUsersOnly}
                                onChange={(e) => setOnlineUsersOnly(e.target.checked)}
                            />
                            <span className="search-online-slider" aria-hidden />
                        </span>
                    </label>
                </div>
            </div>

            {/* ── Body ── */}
            <div className="search-body">
                {/* Loading */}
                {loading && (
                    <div className="search-loading">
                        <div className="search-spinner" />
                        <p>{t('searching', 'Searching…')}</p>
                    </div>
                )}

                {/* Empty state */}
                {showTooShort && (
                    <div className="search-empty-prompt">
                        <FaSearch style={{ fontSize: '3rem', opacity: 0.2 }} />
                        <p>{t('search_min_two_chars', 'Type at least 2 characters to search.')}</p>
                    </div>
                )}

                {/* No results */}
                {showEmpty && (
                    <div className="search-empty-prompt">
                        <p style={{ fontWeight: '700' }}>{t('no_results', 'No results found')}</p>
                        <p style={{ fontSize: '0.85rem', opacity: 0.6 }}>"{query2}"</p>
                    </div>
                )}

                {/* Results */}
                {showResults && (
                    <div className="search-results">
                        {(activeCategory === 'all' || activeCategory === 'businesses') &&
                            renderSection(`🏪 ${t('search_cat_businesses', 'Businesses')}`, results.businesses, renderBusinessItem)}
                        {(activeCategory === 'all' || activeCategory === 'users') &&
                            renderSection(`👤 ${t('search_cat_users', 'Users')}`, usersForDisplay, renderUserItem)}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchPage;
