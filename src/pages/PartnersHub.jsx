import { lazy, Suspense, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaStore, FaTag, FaBriefcase } from 'react-icons/fa';
import { AppText } from '../components/base';
import './PartnersHub.css';

// Each tab is a full directory (venues / offers / jobs) rendered chrome-less via its
// `embedded` prop — the hub's tab bar replaces each page's own header. Lazy so a tab's
// bundle only loads when opened. Only the active tab mounts, so only it fetches data.
const BusinessesSwipePage = lazy(() => import('./BusinessesSwipePage'));
const BusinessesDirectory = lazy(() => import('./BusinessesDirectory'));
const SpecialOffersPage = lazy(() => import('./SpecialOffersPage'));
const JobsDirectory = lazy(() => import('./JobsDirectory'));

/** Venues tab: swipe (default) ↔ list/map, staying inside the hub. */
function VenuesTab() {
  const [mode, setMode] = useState('swipe');
  return mode === 'swipe'
    ? <BusinessesSwipePage onClose={() => setMode('list')} />
    : <BusinessesDirectory embedded onSwipeView={() => setMode('swipe')} />;
}

const TABS = [
  { id: 'venues', labelKey: 'partners_tab_venues', fallback: 'Venues', icon: <FaStore aria-hidden /> },
  { id: 'offers', labelKey: 'partners_tab_offers', fallback: 'Offers', icon: <FaTag aria-hidden /> },
  { id: 'jobs', labelKey: 'partners_tab_jobs', fallback: 'Jobs', icon: <FaBriefcase aria-hidden /> },
];

/**
 * Unified discovery hub reached from the Partners nav — one screen, three tabs
 * (venues / offers / jobs), each with the same search + venue-type + list/map tools.
 */
export default function PartnersHub() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const paramTab = searchParams.get('tab');
  const [tab, setTab] = useState(TABS.some((x) => x.id === paramTab) ? paramTab : 'venues');

  const select = (id) => {
    setTab(id);
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

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
      </div>
      <div className="partners-hub__body">
        <Suspense fallback={<div className="partners-hub__loading">{t('loading', 'Loading…')}</div>}>
          {tab === 'venues' && <VenuesTab />}
          {tab === 'offers' && <SpecialOffersPage embedded />}
          {tab === 'jobs' && <JobsDirectory embedded />}
        </Suspense>
      </div>
    </div>
  );
}
