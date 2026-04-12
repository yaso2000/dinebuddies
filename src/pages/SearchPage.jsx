import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    collection, query, where, getDocs, orderBy, limit,
    or
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { FaSearch, FaTimes, FaChevronLeft, FaUser, FaStore, FaMapMarkerAlt } from 'react-icons/fa';
import { getSafeAvatar, getGenderBorderColor } from '../utils/avatarUtils';
import UserAvatar from '../components/UserAvatar';
import './SearchPage.css';

// ── Partial word matching helper ─────────────────────────────────────────────
// Returns true if ANY word in the query appears (case-insensitive) anywhere in
// ANY of the provided text fields.
const partialMatch = (query, ...fields) => {
    if (!query || !query.trim()) return true;
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const text = fields.filter(Boolean).join(' ').toLowerCase();
    return words.some(word => text.includes(word));
};

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

    const [query2, setQuery2] = useState(initialQuery);
    const [activeCategory, setActiveCategory] = useState(initialCat);
    const [loading, setLoading] = useState(false);

    const [results, setResults] = useState({
        businesses: [],
        users: [],
    });

    const isRTL = i18n.language === 'ar';

    // Auto-focus input
    useEffect(() => { inputRef.current?.focus(); }, []);

    // Re-fetch only when the search query changes — always fetch ALL categories at once
    useEffect(() => {
        if (!query2.trim()) {
            setResults({ businesses: [], users: [] });
            return;
        }
        const timer = setTimeout(() => runSearch(query2), 350);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query2]);

    // Tab change: just update URL param, no re-fetch
    useEffect(() => {
        if (query2.trim()) {
            setSearchParams({ q: query2, cat: activeCategory }, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCategory]);

    const runSearch = async (q) => {
        if (!q.trim()) return;

        // Security: Block exact or partial search for "admin" keywords
        const checkQ = q.trim().toLowerCase();
        if (checkQ.includes('admin') || checkQ.includes('أدمن') || checkQ.includes('ادمن')) {
            setResults({ businesses: [], users: [] });
            return;
        }

        setLoading(true);
        setSearchParams({ q, cat: activeCategory }, { replace: true });

        try {
            const [businesses, users] = await Promise.all([
                searchBusinesses(q),
                searchUsers(q),
            ]);
            setResults({ businesses, users });
        } catch (err) {
            console.error('Search error:', err);
        } finally {
            setLoading(false);
        }
    };

    const searchBusinesses = async (q) => {
        try {
            const snap = await getDocs(
                query(collection(db, 'users'), where('role', '==', 'business'), limit(200))
            );
            return snap.docs
                .map(d => ({ id: d.id, _type: 'business', ...d.data() }))
                .filter(b => {
                    const bi = b.businessInfo || {};
                    return partialMatch(q, b.display_name, bi.businessName, bi.businessType, bi.city, bi.address, bi.description);
                });
        } catch { return []; }
    };

    const searchUsers = async (q) => {
        try {
            const lower = q.trim().toLowerCase();
            const words = lower.split(/\s+/).filter(Boolean);
            if (!words.length) return [];

            // Only query regular users. Admins should not be searchable by the general public.
            const snapUser = await getDocs(query(collection(db, 'users'), where('role', '==', 'user'), limit(300)));

            const seen = new Set();
            const allDocs = snapUser.docs.filter(d => {
                if (seen.has(d.id)) return false;
                seen.add(d.id);
                return true;
            });

            return allDocs
                .map(d => ({ id: d.id, _type: 'user', ...d.data() }))
                .filter(u => {
                    const name = (u.display_name || u.displayName || '').toLowerCase();
                    const emailPrefix = (u.email || '').split('@')[0].toLowerCase();
                    return words.some(w => name.includes(w) || emailPrefix.includes(w));
                });
        } catch (err) {
            console.error('User search error:', err);
            return [];
        }
    };

    // ── Navigation ───────────────────────────────────────────────────────────
    const navigateToResult = (item) => {
        if (item._type === 'invitation') navigate(`/invitation/${item.id}`);
        else if (item._type === 'private_invitation') navigate(`/invitation/private/${item.id}`);
        else if (item._type === 'post') navigate(`/profile/${item.authorId || item.userId}`);
        else if (item._type === 'business') navigate(`/business/${item.id}`);
        else if (item._type === 'user') navigate(`/profile/${item.id}`);
    };

    // ── Total count ──────────────────────────────────────────────────────────
    const totalCount = results.businesses.length + results.users.length;


    const renderBusinessItem = (item) => {
        const bi = item.businessInfo || {};
        return (
            <div key={item.id} className="search-result-item" onClick={() => navigateToResult(item)}>
                <UserAvatar
                    user={item}
                    src={getSafeAvatar(item) || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=80&q=60'}
                    alt={item.display_name}
                    className="search-result-thumb"
                    style={{ 
                        boxShadow: `0 0 0 2px ${getGenderBorderColor(item)}`,
                        border: `2px solid var(--bg-card)` // Space around image
                    }}
                />
                <div className="search-result-content">
                    <div className="search-result-title">{bi.businessName || item.display_name || 'Business'}</div>
                    <div className="search-result-sub">
                        {bi.businessType && <span>{bi.businessType}</span>}
                        {bi.city && <span><FaMapMarkerAlt style={{ marginRight: 3 }} />{bi.city}</span>}
                    </div>
                </div>
            </div>
        );
    };

    const renderUserItem = (item) => (
        <div key={item.id} className="search-result-item" onClick={() => navigateToResult(item)}>
            <UserAvatar
                user={item}
                alt={item.display_name}
                className="search-result-thumb"
                style={{ 
                    borderRadius: '50%', 
                    boxShadow: `0 0 0 2px ${getGenderBorderColor(item)}`,
                    border: `2px solid var(--bg-card)` // gives the nice padding illusion 
                }}
            />
            <div className="search-result-content">
                <div className="search-result-title">{item.display_name || item.displayName || item.email?.split('@')[0] || 'User'}</div>
                <div className="search-result-sub">
                    {item.email && <span>{item.email.split('@')[0]}@…</span>}
                    {item.subscriptionTier && item.subscriptionTier !== 'free' && (
                        <span className="search-badge-tier">{item.subscriptionTier}</span>
                    )}
                </div>
            </div>
        </div>
    );

    const renderSection = (title, items, renderFn) => {
        if (!items.length) return null;
        return (
            <div className="search-section">
                <div className="search-section-title">{title} <span className="search-section-count">{items.length}</span></div>
                {items.map(renderFn)}
            </div>
        );
    };

    const showEmpty = !loading && query2.trim() && totalCount === 0;
    const showResults = !loading && query2.trim() && totalCount > 0;

    return (
        <div className="search-page" dir={isRTL ? 'rtl' : 'ltr'}>
            {/* ── Header ── */}
            <header className="search-header app-header sticky-header-glass">
                <button className="back-btn" onClick={() => navigate(-1)} aria-label="Go back">
                    <FaChevronLeft style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }} />
                </button>

                <div className="search-input-wrapper">
                    <FaSearch className="search-input-icon" />
                    <input
                        ref={inputRef}
                        type="search"
                        className="search-input"
                        placeholder={t('search_placeholder', 'Search for a business or user...')}
                        value={query2}
                        onChange={e => setQuery2(e.target.value)}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                    />
                    {query2 && (
                        <button className="search-clear-btn" onClick={() => setQuery2('')} aria-label="Clear">
                            <FaTimes />
                        </button>
                    )}
                </div>
            </header>

            {/* ── Category Tabs ── */}
            <div className="search-tabs-wrap">
                <div className="search-tabs">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            className={`search-tab ${activeCategory === cat.id ? 'active' : ''}`}
                            onClick={() => setActiveCategory(cat.id)}
                        >
                            <span className="search-tab-icon">{cat.icon}</span>
                            {t(`search_cat_${cat.id}`, cat.label)}
                        </button>
                    ))}
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
                {!query2.trim() && (
                    <div className="search-empty-prompt">
                        <FaSearch style={{ fontSize: '3rem', opacity: 0.2 }} />
                        <p>{t('search_prompt', 'Type something to search…')}</p>
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
                            renderSection(`👤 ${t('search_cat_users', 'Users')}`, results.users, renderUserItem)}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchPage;
