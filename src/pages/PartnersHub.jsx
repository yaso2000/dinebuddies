import { lazy, Suspense, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaStore, FaTag, FaBriefcase, FaLayerGroup } from 'react-icons/fa';
import { AppText } from '../components/base';
import './PartnersHub.css';

// Each tab is a full directory (venues / offers / jobs) rendered chrome-less via its
// `embedded` prop — the hub's tab bar replaces each page's own header. Lazy so a tab's
// bundle only loads when opened. Only the active tab mounts, so only it fetches data.
const BusinessesSwipePage = lazy(() => import('./BusinessesSwipePage'));
const BusinessesDirectory = lazy(() => import('./BusinessesDirectory'));
const SpecialOffersPage = lazy(() => import('./SpecialOffersPage'));
const JobsDirectory = lazy(() => import('./JobsDirectory'));

/** Venues tab: swipe deck (canonical) ↔ list/map directory, staying inside the hub. */
function VenuesTab({ view, onViewChange }) {
  return view === 'swipe'
    ? <BusinessesSwipePage onClose={() => onViewChange('list')} />
    : <BusinessesDirectory embedded view={view} onViewChange={onViewChange} />;
}

const TABS = [
  { id: 'venues', labelKey: 'partners_tab_venues', fallback: 'Venues', icon: <FaStore aria-hidden /> },
  { id: 'offers', labelKey: 'partners_tab_offers', fallback: 'Offers', icon: <FaTag aria-hidden /> },
  { id: 'jobs', labelKey: 'partners_tab_jobs', fallback: 'Jobs', icon: <FaBriefcase aria-hidden /> },
];

/**
 * Unified discovery hub reached from the Partners nav — one screen, three tabs
 * (venues / offers / jobs). The three tab banners plus an icon-only swipe toggle stay
 * pinned at the top in every view; each tab shares one view mode (swipe / list / map).
 */
export default function PartnersHub() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const paramTab = searchParams.get('tab');
  const [tab, setTab] = useState(TABS.some((x) => x.id === paramTab) ? paramTab : 'venues');
  // One view shared across tabs: swipe (default) | list | map.
  const [view, setView] = useState('swipe');

  const select = (id) => {
    setTab(id);
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

  const swipeActive = view === 'swipe';

  return (
    <div className="partners-hub">
      <div className="partners-hub__tabs">
        {TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            className={`partners-hub__tab${tab === x.id ? ' active' : ''}`}
            onClick={() => select(x.id)}>
            <span className="partners-hub__tab-icon">{x.icon}</span>
            <AppText as="span">{t(x.labelKey, x.fallback)}</AppText>
          </button>
        ))}
        {/* Icon-only swipe toggle, beside the three banners. Active = swipe deck. */}
        <button
          type="button"
          className={`partners-hub__swipe-toggle${swipeActive ? ' active' : ''}`}
          aria-pressed={swipeActive}
          aria-label={t('view_swipe', 'Swipe')}
          title={t('view_swipe', 'Swipe')}
          onClick={() => setView(swipeActive ? 'list' : 'swipe')}>
          <FaLayerGroup aria-hidden />
        </button>
      </div>
      <div className="partners-hub__body">
        <Suspense fallback={<div className="partners-hub__loading">{t('loading', 'Loading…')}</div>}>
          {tab === 'venues' && <VenuesTab view={view} onViewChange={setView} />}
          {tab === 'offers' && <SpecialOffersPage embedded view={view} onViewChange={setView} />}
          {tab === 'jobs' && <JobsDirectory embedded view={view} onViewChange={setView} />}
        </Suspense>
      </div>
    </div>
  );
}
