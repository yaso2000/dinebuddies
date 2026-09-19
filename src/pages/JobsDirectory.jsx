import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaBriefcase, FaArrowLeft, FaArrowRight, FaList, FaMapMarkedAlt, FaMapMarkerAlt } from 'react-icons/fa';
import { AppText, AppTextInput } from '../components/base';
import { useAuth } from '../context/AuthContext';
import { haversineKm } from '../utils/postsFeedScope';
import { listOpenJobs } from '../services/jobPostings';
import DirectoryMap from '../components/DirectoryMap';
import MagneticDeck from '../components/discovery/MagneticDeck';
import DirectorySwipeCard from '../components/discovery/DirectorySwipeCard';
import JobApplicationModal from '../components/JobApplicationModal';
import './SpecialOffersPage.css';

const JOB_MARKER_COLOR = '#0ea5e9';

// Same venue types as the businesses/offers directories — a job inherits its business type.
const JOB_CATEGORIES = [
  { id: 'All', labelKey: 'filter_all', fallback: 'All', icon: '🌍' },
  { id: 'Restaurant', labelKey: 'type_restaurant', fallback: 'Restaurant', icon: '🍴' },
  { id: 'Cafe', labelKey: 'type_cafe', fallback: 'Café', icon: '☕' },
  { id: 'Bar', labelKey: 'type_bar', fallback: 'Bar', icon: '🍺' },
  { id: 'Night Club', labelKey: 'type_nightclub', fallback: 'Night Club', icon: '🎵' },
  { id: 'Hotel', labelKey: 'type_hotel', fallback: 'Hotel', icon: '🏨' },
];

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function jobTypeLabel(t, jobType) {
  return t(`job_type_${String(jobType || 'full_time')}`, String(jobType || 'full_time').replace(/_/g, ' '));
}

/**
 * Consumer Jobs directory — every open job businesses posted, with the same list/map +
 * filter tools as the offers and businesses directories. Jobs inherit their business's
 * geo + venue type (stamped at creation), so they plot on the shared map and filter by type.
 */
export default function JobsDirectory({ embedded = false, view = null, onViewChange = null }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const BackIcon = i18n.dir() === 'rtl' ? FaArrowRight : FaArrowLeft;

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [internalViewMode, setInternalViewMode] = useState('swipe');
  // In the hub the view is controlled (shared swipe/list/map toggle); standalone keeps its own.
  const controlledView = typeof onViewChange === 'function' && !!view;
  const viewMode = controlledView ? view : internalViewMode;
  const setViewMode = controlledView ? onViewChange : setInternalViewMode;
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [applyJob, setApplyJob] = useState(null);

  const [userLoc, setUserLoc] = useState(() => {
    const lat = Number(userProfile?.coordinates?.lat);
    const lng = Number(userProfile?.coordinates?.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  });
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await listOpenJobs();
        if (!cancelled) setJobs(list);
      } catch {
        if (!cancelled) setJobs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const sortedJobs = useMemo(() => {
    const withDist = jobs.map((j) => {
      const hasGeo = userLoc && Number.isFinite(j.lat) && Number.isFinite(j.lng);
      return { ...j, _dist: hasGeo ? haversineKm(userLoc.lat, userLoc.lng, j.lat, j.lng) : null };
    });
    return withDist.sort((a, b) => {
      if (a._dist == null && b._dist == null) return (b.createdAt || 0) - (a.createdAt || 0);
      if (a._dist == null) return 1;
      if (b._dist == null) return -1;
      return a._dist - b._dist;
    });
  }, [jobs, userLoc]);

  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortedJobs.filter((j) => {
      if (activeCategory !== 'All' && String(j.businessType || '') !== activeCategory) return false;
      if (q) {
        const hay = `${j.title || ''} ${j.businessName || ''} ${j.description || ''} ${j.location || ''} ${j.city || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sortedJobs, searchQuery, activeCategory]);

  const viewLabel = t('job_post_view', 'View & apply');
  const buildJobPopup = useCallback(
    (j, { distanceKm }) => `
      <div class="compact-popup" dir="auto" style="unicode-bidi:isolate;text-align:start">
        <div class="compact-popup-body">
          <h4 class="compact-popup-title">${escapeHtml(j.title || '')}</h4>
          <div class="compact-popup-meta">${escapeHtml(j.businessName || '')}${j.location ? ' · ' + escapeHtml(j.location) : ''}</div>
          ${distanceKm != null ? `<div class="compact-popup-stats"><span dir="auto" style="unicode-bidi:isolate;">📏 ${distanceKm.toFixed(1)} km</span></div>` : ''}
          <div><button onclick="window.location.href='/business/${escapeHtml(j.businessId || '')}'" class="compact-popup-btn" style="background:${JOB_MARKER_COLOR};color:#fff;">${escapeHtml(viewLabel)}</button></div>
        </div>
      </div>`,
    [viewLabel]
  );

  const jobDeckItems = useMemo(
    () => filteredJobs.map((j) => ({ ...j, coverImage: j.businessAvatar || '' })),
    [filteredJobs]
  );

  // MagneticDeck card renderer (same swipe as venues, blue accent).
  const renderJobSwipeCard = ({ item, isTop, onSkip, onBack }) => {
    const chips = [{ key: 'type', icon: FaBriefcase, label: jobTypeLabel(t, item.jobType) }];
    if (item.location) chips.push({ key: 'loc', icon: FaMapMarkerAlt, label: item.location });
    else if (item._dist != null) chips.push({ key: 'dist', icon: FaMapMarkerAlt, label: `${item._dist.toFixed(1)} km` });
    return (
      <DirectorySwipeCard
        item={item}
        isTop={isTop}
        onSkip={onSkip}
        onBack={onBack}
        accent={JOB_MARKER_COLOR}
        badge={t('jobs_badge', 'Hiring')}
        title={item.title}
        subtitle={item.businessName}
        description={item.description}
        chips={chips}
        ctaLabel={viewLabel}
        onCta={() => setApplyJob(item)}
        onOpen={() => item.businessId && navigate(`/business/${item.businessId}`)}
        onClose={() => setViewMode('list')} />
    );
  };

  return (
    <div className="special-offers-page">
      {!embedded && (
        <div className="special-offers-page__header">
          <button type="button" onClick={() => navigate(-1)} aria-label={t('back', 'Back')} className="special-offers-page__back">
            <BackIcon />
          </button>
          <AppText as="h1" className="special-offers-page__title">
            <FaBriefcase aria-hidden style={{ marginInlineEnd: 8, color: JOB_MARKER_COLOR }} />
            {t('jobs_directory_title', 'Jobs')}
          </AppText>
        </div>
      )}

      <div className="offers-filterbar">
        {viewMode !== 'swipe' && (
        <div className="offers-searchrow">
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <AppTextInput
              type="search"
              className="offers-search"
              placeholder={t('search_job_or_business', 'Search a job or business…')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="special-offers-viewtoggle">
            <button type="button" className={`sov-toggle${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode('list')}>
              <FaList aria-hidden /> {t('view_list', 'List')}
            </button>
            <button type="button" className={`sov-toggle${viewMode === 'map' ? ' active' : ''}`} onClick={() => setViewMode('map')}>
              <FaMapMarkedAlt aria-hidden /> {t('view_map', 'Map')}
            </button>
          </div>
        </div>
        )}
        <div className="offers-cat-chips category-icons-scroll">
          {JOB_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`offers-cat-chip${activeCategory === c.id ? ' active' : ''}`}
              onClick={() => setActiveCategory(c.id)}>
              {c.icon ? <AppText as="span" aria-hidden>{c.icon} </AppText> : null}{t(c.labelKey, c.fallback)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="special-offers-page__status">{t('loading', 'Loading…')}</div>
      ) : viewMode === 'map' ? (
        <div className="special-offers-map">
          <DirectoryMap
            active
            items={filteredJobs}
            getCoords={(j) => ({ lat: j.lat, lng: j.lng })}
            getMarkerImageUrl={(j) => j.businessAvatar || ''}
            getFallbackName={(j) => j.businessName || j.title || 'Job'}
            buildPopupHtml={buildJobPopup}
            userLocation={userLoc}
            markerColor={JOB_MARKER_COLOR} />
        </div>
      ) : viewMode === 'swipe' ? (
        <div className="special-offers-map">
          <MagneticDeck
            items={jobDeckItems}
            renderCard={renderJobSwipeCard}
            emptyTitle={jobs.length === 0
              ? t('jobs_directory_empty', 'No open jobs right now. Check back soon.')
              : t('jobs_directory_none_match', 'No jobs match your filters.')}
            emptySub=""
            finishedTitle={t('jobs_deck_done', "That's every job for now")}
            finishedSub="" />
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="special-offers-page__empty">
          <FaBriefcase style={{ fontSize: '2.4rem', opacity: 0.3 }} aria-hidden />
          <AppText as="p">
            {jobs.length === 0
              ? t('jobs_directory_empty', 'No open jobs right now. Check back soon.')
              : t('jobs_directory_none_match', 'No jobs match your filters.')}
          </AppText>
        </div>
      ) : (
        <div className="special-offers-list">
          {filteredJobs.map((job) => (
            <div key={job.id} className="offer-banner" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div className="offer-banner__content">
                <button
                  type="button"
                  className="offer-banner__business"
                  style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', textAlign: 'start' }}
                  onClick={() => job.businessId && navigate(`/business/${job.businessId}`)}>
                  {job.businessName}
                </button>
                <div className="offer-banner__title">{job.title}</div>
                <div className="offer-banner__desc" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span>{jobTypeLabel(t, job.jobType)}</span>
                  {job.location ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <FaMapMarkerAlt size={11} aria-hidden /> {job.location}
                    </span>
                  ) : null}
                </div>
              </div>
              <button type="button" className="offer-banner__take" onClick={() => setApplyJob(job)}>
                {viewLabel}
              </button>
            </div>
          ))}
        </div>
      )}

      <JobApplicationModal isOpen={Boolean(applyJob)} job={applyJob} onClose={() => setApplyJob(null)} />
    </div>
  );
}
