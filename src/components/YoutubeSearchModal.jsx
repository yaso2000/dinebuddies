import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaTimes } from 'react-icons/fa';
import { getYoutubeSearchSuggestions, searchYoutubeVideos } from '../utils/youtubeSearchClient';
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
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setFilter('all');
    setResults([]);
    setStatus('idle');
    setErrorMessage('');
    setSuggestions([]);
    setShowSuggestions(false);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  // Free-tier autocomplete (Google's unofficial "suggest" endpoint) — debounced
  // so we only fire once typing pauses, not on every keystroke.
  useEffect(() => {
    if (!open) return undefined;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const result = await getYoutubeSearchSuggestions({ query: trimmed });
      if (!cancelled) setSuggestions(result);
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query]);

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
    setShowSuggestions(false);
    runSearch(filter);
  };

  const handlePickSuggestion = (suggestion) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    setStatus('loading');
    setErrorMessage('');
    (async () => {
      const outcome = await searchYoutubeVideos({ query: suggestion, filter });
      if (!outcome.ok) {
        setStatus(outcome.quotaExhausted ? 'quota' : 'error');
        setErrorMessage(outcome.message);
        setResults([]);
        return;
      }
      setResults(outcome.results);
      setStatus('done');
    })();
  };

  const handleFilterClick = (key) => {
    setShowSuggestions(false);
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

        <div className="youtube-search-modal__search-wrap">
          <form className="youtube-search-modal__search-row" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="search"
              className="youtube-search-modal__input"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder={t('youtube_search_placeholder', 'Search videos, live streams, music…')}
              autoComplete="off"
            />
            <button type="submit" className="youtube-search-modal__submit" aria-label={t('search', 'Search')}>
              <FaSearch />
            </button>
          </form>
          {showSuggestions && suggestions.length > 0 ? (
            <ul className="youtube-search-modal__suggestions">
              {suggestions.map((suggestion) => (
                <li key={suggestion}>
                  <button type="button" onClick={() => handlePickSuggestion(suggestion)}>
                    <FaSearch size={11} aria-hidden />
                    <span>{suggestion}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

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

        <div className="youtube-search-modal__body" onMouseDown={() => setShowSuggestions(false)}>
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
