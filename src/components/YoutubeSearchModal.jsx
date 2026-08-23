import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaTimes } from 'react-icons/fa';
import { searchYoutubeVideos } from '../utils/youtubeSearchClient';
import './YoutubeSearchModal.css';

const FILTERS = [
  { key: 'all', labelKey: 'youtube_search_tab_all', fallback: 'Videos' },
  { key: 'live', labelKey: 'youtube_search_tab_live', fallback: 'Live' },
  { key: 'music', labelKey: 'youtube_search_tab_music', fallback: 'Music' },
];

/**
 * @param {{ open: boolean, onClose: () => void, onSelect: (video: { id: string, title: string, isLive: boolean, filter: string }) => void }} props
 */
export default function YoutubeSearchModal({ open, onClose, onSelect }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const overlayRef = useRef(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | error | quota | done
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setFilter('all');
    setResults([]);
    setStatus('idle');
    setErrorMessage('');
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Keep the sheet inside the visible viewport above the iOS/Android keyboard —
  // `position: fixed; inset: 0` alone stays pinned to the full layout viewport
  // on iOS, so an open keyboard covers the input instead of shrinking the sheet.
  useEffect(() => {
    if (!open) return undefined;
    const overlay = overlayRef.current;
    if (!overlay || typeof window === 'undefined') return undefined;

    const vv = window.visualViewport;
    const clearGeometry = () => {
      overlay.style.top = '';
      overlay.style.left = '';
      overlay.style.width = '';
      overlay.style.height = '';
    };
    if (!vv) return clearGeometry;

    const sync = () => {
      overlay.style.top = `${vv.offsetTop}px`;
      overlay.style.left = `${vv.offsetLeft}px`;
      overlay.style.width = `${vv.width}px`;
      overlay.style.height = `${vv.height}px`;
    };

    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      clearGeometry();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const runSearch = async (nextFilter = filter) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setStatus('loading');
    setErrorMessage('');
    const outcome = await searchYoutubeVideos({ query: trimmed, filter: nextFilter });
    if (!outcome.ok) {
      setStatus(outcome.quotaExhausted ? 'quota' : 'error');
      setErrorMessage(outcome.message);
      setResults([]);
      return;
    }
    setResults(outcome.results);
    setStatus('done');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    runSearch(filter);
  };

  const handleFilterClick = (key) => {
    if (key === filter) return;
    setFilter(key);
    if (query.trim()) runSearch(key);
  };

  const handlePick = (video) => {
    onSelect?.({ id: video.id, title: video.title, isLive: video.isLive, filter });
    onClose?.();
  };

  return createPortal(
    <div
      ref={overlayRef}
      className="youtube-search-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="youtube-search-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="youtube-search-modal__panel">
        <div className="youtube-search-modal__header">
          <span id="youtube-search-modal-title" className="youtube-search-modal__title">
            {t('youtube_search_title', 'Search YouTube')}
          </span>
          <button
            type="button"
            className="youtube-search-modal__close"
            aria-label={t('close', 'Close')}
            onClick={() => onClose?.()}
          >
            <FaTimes />
          </button>
        </div>

        <form className="youtube-search-modal__search-row" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="search"
            className="youtube-search-modal__input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('youtube_search_placeholder', 'Search videos, live streams, music…')}
            autoComplete="off"
          />
          <button type="submit" className="youtube-search-modal__submit" aria-label={t('search', 'Search')}>
            <FaSearch />
          </button>
        </form>

        <div className="youtube-search-modal__tabs" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              className={`youtube-search-modal__tab${filter === f.key ? ' youtube-search-modal__tab--active' : ''}`}
              onClick={() => handleFilterClick(f.key)}
            >
              {t(f.labelKey, f.fallback)}
            </button>
          ))}
        </div>

        <div className="youtube-search-modal__body">
          {status === 'loading' ? (
            <div className="youtube-search-modal__state">
              {t('youtube_search_loading', 'Searching…')}
            </div>
          ) : status === 'quota' ? (
            <div className="youtube-search-modal__state youtube-search-modal__state--warn">
              {t(
                'youtube_search_quota_exhausted',
                'Search is unavailable right now — please paste the video link instead.'
              )}
            </div>
          ) : status === 'error' ? (
            <div className="youtube-search-modal__state youtube-search-modal__state--warn">
              {t('youtube_search_error', 'Search failed. Please try again or paste the link instead.')}
            </div>
          ) : status === 'done' && results.length === 0 ? (
            <div className="youtube-search-modal__state">
              {t('youtube_search_empty', 'No results found.')}
            </div>
          ) : status === 'done' ? (
            <div className="youtube-search-modal__grid">
              {results.map((video) => (
                <button
                  key={video.id}
                  type="button"
                  className="youtube-search-modal__card"
                  onClick={() => handlePick(video)}
                >
                  <span className="youtube-search-modal__thumb-wrap">
                    <img src={video.thumbnailUrl} alt="" loading="lazy" />
                    {video.isLive ? (
                      <span className="youtube-search-modal__live-badge">
                        {t('youtube_search_live_badge', 'LIVE')}
                      </span>
                    ) : null}
                  </span>
                  <span className="youtube-search-modal__card-title">{video.title}</span>
                  <span className="youtube-search-modal__card-channel">{video.channelTitle}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="youtube-search-modal__state">
              {t('youtube_search_hint', 'Type a search and press enter.')}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
