import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FaSearch, FaTimes, FaUsers } from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';
import { useUserDirectory } from '../hooks/useUserDirectory';
import UserDirectoryCard from '../components/UserDirectory/UserDirectoryCard';
import { goToLogin } from '../utils/goToLogin';
import './UsersDirectory.css';
import { AppText, AppTextInput } from "../components/base";

export default function UsersDirectory() {
  const { t, i18n } = useTranslation();
  const { currentUser, isGuest } = useAuth();
  const rtl = i18n.language === 'ar';
  const inputRef = useRef(null);
  const loadMoreRef = useRef(null);

  const viewerUid = currentUser?.uid || currentUser?.id;
  const canBrowse = Boolean(viewerUid && !isGuest);

  const {
    users,
    loading,
    loadingMore,
    error,
    hasMore,
    query,
    setQuery,
    isSearchMode,
    loadMore
  } = useUserDirectory({
    excludeUid: viewerUid,
    enabled: canBrowse
  });

  useEffect(() => {
    if (!canBrowse) return;
    inputRef.current?.focus();
  }, [canBrowse]);

  useEffect(() => {
    if (!hasMore || loading || loadingMore) return undefined;

    const node = loadMoreRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '240px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loading, loadingMore]);

  const clearQuery = () => setQuery('');

  if (!canBrowse) {
    return (
      <div className="users-directory-page" dir={rtl ? 'rtl' : 'ltr'}>
                <main className="users-directory-main">
                    <AppText as="p" className="users-directory-message">
                        {t(
              'user_directory_login_required',
              'Sign in to browse members and send invitations.'
            )}
                    </AppText>
                    <div className="users-directory-load-more">
                        <button
              type="button"
              className="users-directory-load-more-btn"
              onClick={() => goToLogin({ returnPath: '/search/list' })}>
              
                            {t('login_signup', 'Login / Sign Up')}
                        </button>
                    </div>
                </main>
            </div>);

  }

  return (
    <div className="users-directory-page" dir={rtl ? 'rtl' : 'ltr'}>
            <div className="users-directory-toolbar">
                <div className="users-directory-field">
                    <FaSearch className="users-directory-field-icon" aria-hidden />
                    <AppTextInput
            ref={inputRef}
            className="users-directory-field-input"
            type="search"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(
              'user_directory_search_placeholder',
              'Search members by name…'
            )}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false} />
          
                    {query ?
          <button
            type="button"
            className="users-directory-field-clear"
            onClick={clearQuery}
            aria-label={t('clear', 'Clear')}>
            
                            <FaTimes />
                        </button> :
          null}
                </div>
            </div>

            <header className="users-directory-header">
                <div className="users-directory-header-row">
                    <AppText as="h1" className="users-directory-title">
                        <FaUsers aria-hidden /> {t('user_directory_title', 'Members directory')}
                    </AppText>
                    <Link
            to="/search"
            className="users-directory-feed-link"
            title={t('user_directory_feed_view', 'Swipe discovery')}>
            
                        <LuSparkles size={18} aria-hidden />
                        <AppText as="span">{t('user_directory_feed_view', 'Swipe view')}</AppText>
                    </Link>
                </div>
                <AppText as="p" className="users-directory-subtitle">
                    {t(
            'user_directory_subtitle',
            'Discover members, send private invites, or send a gift.'
          )}
                </AppText>
            </header>

            <main className="users-directory-main">
                {!isSearchMode && loading && users.length === 0 ?
        <AppText as="p" className="users-directory-message">{t('loading', 'Loading…')}</AppText> :
        null}

                {isSearchMode && loading &&
        <AppText as="p" className="users-directory-message">{t('searching', 'Searching…')}</AppText>
        }

                {error ?
        <AppText as="p" className="users-directory-message users-directory-message--error">
                        {t(error, 'Could not load members. Try again.')}
                    </AppText> :
        null}

                {!loading && !error && users.length === 0 && isSearchMode ?
        <AppText as="p" className="users-directory-message">{t('no_results', 'No results')}</AppText> :
        null}

                {!loading && !error && users.length === 0 && !isSearchMode ?
        <AppText as="p" className="users-directory-message">
                        {t('user_directory_empty', 'No members to show yet.')}
                    </AppText> :
        null}

                {users.length > 0 ?
        <div className="users-directory-grid">
                        {users.map((user) =>
          <UserDirectoryCard key={user.id} user={user} currentUser={currentUser} />
          )}
                    </div> :
        null}

                {hasMore ?
        <div className="users-directory-load-more" ref={loadMoreRef}>
                        <button
            type="button"
            className="users-directory-load-more-btn"
            onClick={loadMore}
            disabled={loadingMore}>
            
                            {loadingMore ?
            t('loading', 'Loading…') :
            t('user_directory_load_more', 'Load more')}
                        </button>
                    </div> :
        null}
            </main>
        </div>);

}