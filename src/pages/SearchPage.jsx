import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaStore, FaTimes, FaUser } from 'react-icons/fa';
import UserAvatar from '../components/UserAvatar';
import { searchAccounts } from '../services/accountSearch';
import { getSafeAvatar } from '../utils/avatarUtils';
import './SearchPage.css';

const MIN_CHARS = 2;
const DEBOUNCE_MS = 350;

export default function SearchPage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const rtl = i18n.language === 'ar';
    const inputRef = useRef(null);
    const requestId = useRef(0);

    const [query, setQuery] = useState('');
    const [tab, setTab] = useState('all');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [businesses, setBusinesses] = useState([]);
    const [users, setUsers] = useState([]);

    const term = query.trim();

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (term.length < MIN_CHARS) {
            setBusinesses([]);
            setUsers([]);
            setError('');
            setLoading(false);
            return;
        }

        const id = ++requestId.current;
        setLoading(true);
        setError('');

        const timer = setTimeout(async () => {
            try {
                const result = await searchAccounts(term);
                if (id !== requestId.current) return;
                setBusinesses(result.businesses);
                setUsers(result.users);
            } catch (err) {
                console.error('[SearchPage]', err);
                if (id !== requestId.current) return;
                setBusinesses([]);
                setUsers([]);
                setError(t('search_error', {  /* defaultValue removed */ }));
            } finally {
                if (id === requestId.current) setLoading(false);
            }
        }, DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [term, t]);

    const showBusinesses = tab !== 'users';
    const showUsers = tab !== 'businesses';
    const visibleBiz = showBusinesses ? businesses : [];
    const visibleUsers = showUsers ? users : [];
    const hasResults = visibleBiz.length + visibleUsers.length > 0;

    const clear = () => {
        requestId.current += 1;
        setQuery('');
        setBusinesses([]);
        setUsers([]);
        setError('');
        setLoading(false);
    };

    return (
        <div className="search-page" dir={rtl ? 'rtl' : 'ltr'}>
            <div className="search-toolbar">
                <div className="search-field">
                    <FaSearch className="search-field-icon" aria-hidden />
                    <input
                        ref={inputRef}
                        className="search-field-input"
                        type="search"
                        enterKeyHint="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t('search_placeholder')}
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                    />
                    {query ? (
                        <button type="button" className="search-field-clear" onClick={clear} aria-label="Clear">
                            <FaTimes />
                        </button>
                    ) : null}
                </div>
            </div>

            <div className="search-tabs" role="tablist">
                {[
                    ['all', FaSearch, 'search_cat_all'],
                    ['businesses', FaStore, 'search_cat_businesses'],
                    ['users', FaUser, 'search_cat_users'],
                ].map(([key, Icon, labelKey]) => (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={tab === key}
                        className={`search-tab${tab === key ? ' search-tab--active' : ''}`}
                        onClick={() => setTab(key)}
                    >
                        <Icon aria-hidden /> {t(labelKey, key)}
                    </button>
                ))}
            </div>

            <main className="search-main">
                {term.length < MIN_CHARS && (
                    <p className="search-message search-message--muted">
                        {t('search_prompt')}
                    </p>
                )}

                {term.length >= MIN_CHARS && loading && (
                    <p className="search-message">{t('searching')}</p>
                )}

                {term.length >= MIN_CHARS && !loading && error && (
                    <p className="search-message search-message--error">{error}</p>
                )}

                {term.length >= MIN_CHARS && !loading && !error && !hasResults && (
                    <p className="search-message">{t('no_results')}</p>
                )}

                {!loading && !error && visibleBiz.length > 0 && (
                    <section className="search-section">
                        <h2>
                            {t('search_cat_businesses')} <span>{visibleBiz.length}</span>
                        </h2>
                        {visibleBiz.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                className="search-row"
                                onClick={() => navigate(`/business/${item.id}`)}
                            >
                                <UserAvatar
                                    user={item}
                                    src={getSafeAvatar(item)}
                                    className="search-row-avatar"
                                    alt=""
                                />
                                <span className="search-row-text">
                                    <strong>{item.businessInfo?.businessName || item.display_name}</strong>
                                    {item.businessInfo?.city ? <small>{item.businessInfo.city}</small> : null}
                                </span>
                            </button>
                        ))}
                    </section>
                )}

                {!loading && !error && visibleUsers.length > 0 && (
                    <section className="search-section">
                        <h2>
                            {t('search_cat_users')} <span>{visibleUsers.length}</span>
                        </h2>
                        {visibleUsers.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                className="search-row"
                                onClick={() => navigate(`/profile/${item.id}`)}
                            >
                                <UserAvatar user={item} className="search-row-avatar search-row-avatar--round" alt="" />
                                <span className="search-row-text">
                                    <strong>{item.display_name || item.displayName}</strong>
                                </span>
                            </button>
                        ))}
                    </section>
                )}
            </main>
        </div>
    );
}
