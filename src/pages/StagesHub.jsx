import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FaMicrophone,
  FaUsers,
  FaCircle,
  FaSearch,
  FaCrown,
  FaDoorClosed,
  FaStore,
} from 'react-icons/fa';
import AppBackButton from '../components/AppBackButton';
import UserAvatar from '../components/UserAvatar';
import { AppText } from '../components/base';
import { useAuth } from '../context/AuthContext';
import { useLiveStagesDiscover } from '../hooks/useLiveStagesDiscover';
import { useMyLiveStage } from '../hooks/useMyLiveStage';
import { APP_HOME_PATH } from '../utils/appRouteShell';
import './StagesHub.css';

const PANEL_PEOPLE = 'people';
const PANEL_BUSINESS = 'business';

function formatExpiry(expiresAtIso, t) {
  if (!expiresAtIso) return null;
  const expiresAt = new Date(expiresAtIso);
  if (Number.isNaN(expiresAt.getTime())) return null;
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) return t('stage_expires_soon', 'Ending soon');
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  if (hours <= 1) return t('stage_expires_under_hour', 'Less than 1 hour left');
  return t('stage_expires_in_hours', '{{hours}} hours left', { hours });
}

function formatDistance(km, t) {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 1) {
    return t('stage_distance_m', '{{m}} m away', { m: Math.max(50, Math.round(km * 1000)) });
  }
  if (km < 10) {
    return t('stage_distance_km', '{{km}} km away', { km: km.toFixed(1) });
  }
  return t('stage_distance_km', '{{km}} km away', { km: Math.round(km) });
}

function isStageLive(stage) {
  const status = String(stage?.status || 'active').toLowerCase();
  return status === 'active';
}

function isBusinessHostKind(stage) {
  return String(stage?.hostKind || 'people').toLowerCase() === 'business';
}

function StageCard({ stage, index, t, onOpen }) {
  const live = isStageLive(stage);
  const expiryLabel = formatExpiry(stage.expiresAt, t);
  const distanceLabel = formatDistance(stage.distanceKm, t);
  const business = isBusinessHostKind(stage);

  return (
    <li style={{ '--stage-i': index }}>
      <button
        type="button"
        className={`stages-hub__card${stage.isMember ? ' is-joined' : ''}${live ? '' : ' is-closed'}${business ? ' stages-hub__card--business' : ''}`}
        onClick={() => onOpen(stage.id)}
      >
        <div className="stages-hub__card-media">
          {stage.hostAvatar ? (
            <img src={stage.hostAvatar} alt="" className="stages-hub__card-avatar" />
          ) : (
            <UserAvatar
              user={{ display_name: stage.hostName || stage.title }}
              alt=""
              solidPlaceholder
              noGenderRing
              className="stages-hub__card-avatar"
            />
          )}
          {stage.isHost ? (
            <AppText
              as="span"
              className="stages-hub__host-badge"
              title={t('stage_you_host', 'You host')}
            >
              <FaCrown aria-hidden />
            </AppText>
          ) : null}
          {business ? (
            <AppText as="span" className="stages-hub__biz-pill" aria-hidden>
              <FaStore />
            </AppText>
          ) : null}
          {live ? (
            <AppText as="span" className="stages-hub__live-pill" aria-label={t('stage_live', 'Live')}>
              <FaCircle aria-hidden className="stages-hub__online-dot" />
              {t('stage_live', 'Live')}
            </AppText>
          ) : (
            <AppText
              as="span"
              className="stages-hub__closed-pill"
              aria-label={t('stage_status_closed', 'Closed')}
            >
              <FaDoorClosed aria-hidden />
              {t('stage_status_closed', 'Closed')}
            </AppText>
          )}
        </div>

        <div className="stages-hub__card-body">
          <div className="stages-hub__card-top">
            <AppText as="h2" className="stages-hub__card-title">
              {stage.title}
            </AppText>
          </div>

          <AppText as="p" className="stages-hub__card-preview">
            {stage.isHost
              ? live
                ? t('stage_your_room_live', 'Your Stage is live')
                : t('stage_your_room_closed', 'Your Stage is closed — reopen to chat')
              : stage.hostName
                ? t('stage_hosted_by', 'Hosted by {{name}}', { name: stage.hostName })
                : t('stage_ready_to_chat', 'Ready to chat')}
            {business
              ? ` · ${t('stage_visibility_community', 'Community')}`
              : stage.visibility === 'private'
                ? ` · ${t('create_stage_visibility_private', 'Private')}`
                : ''}
          </AppText>

          <div className="stages-hub__meta">
            <AppText
              as="span"
              className={`stages-hub__meta-item${live ? ' stages-hub__meta-item--online' : ''}`}
            >
              <FaUsers aria-hidden />
              {t('stage_attendees_count', '{{count}} attending', {
                count: stage.memberCount || 0,
              })}
            </AppText>
            {distanceLabel ? (
              <AppText as="span" className="stages-hub__meta-item">
                {distanceLabel}
              </AppText>
            ) : null}
            {expiryLabel ? (
              <AppText as="span" className="stages-hub__meta-item">
                {expiryLabel}
              </AppText>
            ) : null}
            {stage.isFriend && !stage.isHost && !business ? (
              <AppText as="span" className="stages-hub__meta-item">
                {t('friends', 'Friends')}
              </AppText>
            ) : null}
          </div>
        </div>

        <AppText as="span" className="stages-hub__enter">
          {stage.isHost || stage.isMember
            ? t('stage_enter', 'Enter')
            : t('stage_join', 'Join Stage')}
        </AppText>
      </button>
    </li>
  );
}

export default function StagesHub() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { cannotCreateInvitations, isBusiness } = useAuth();
  const {
    stageId: myLiveStageId,
    hasLiveStage,
    loading: myLiveLoading,
  } = useMyLiveStage();

  // Business accounts use Community Chat — Stage open/browse is personal-only.
  useEffect(() => {
    if (!isBusiness) return;
    navigate('/business-dashboard', { replace: true });
  }, [isBusiness, navigate]);

  const [panel, setPanel] = useState(PANEL_PEOPLE);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  // Always fetch all discoverable rooms so People/Business panels stay independent.
  // Business accounts never browse this directory.
  const { stages, loading, error, refresh } = useLiveStagesDiscover({
    filter: 'all',
    search,
    enabled: !isBusiness,
  });

  const canCreateOnPanel =
    (panel === PANEL_PEOPLE && !cannotCreateInvitations) ||
    (panel === PANEL_BUSINESS && isBusiness);

  const { peopleStages, businessStages } = useMemo(() => {
    const list = Array.isArray(stages) ? stages : [];
    const people = [];
    const business = [];
    list.forEach((s) => {
      if (isBusinessHostKind(s)) business.push(s);
      else if (filter === 'friends' && !s.isFriend && !s.isHost) return;
      else people.push(s);
    });
    return { peopleStages: people, businessStages: business };
  }, [stages, filter]);

  const panelStages = panel === PANEL_BUSINESS ? businessStages : peopleStages;

  const { myStage, otherStages } = useMemo(() => {
    const mine = panelStages.find((s) => s.isHost) || null;
    const others = panelStages.filter((s) => !s.isHost);
    return { myStage: mine, otherStages: others };
  }, [panelStages]);

  const openStage = (id) => navigate(`/stage/${id}`);
  const hasAnyStages = panelStages.length > 0;

  if (isBusiness) {
    return (
      <div className="stages-hub">
        <AppText as="p" className="stages-hub__loading">
          {t('loading_stages', 'Loading stages…')}
        </AppText>
      </div>
    );
  }

  const createLink =
    hasLiveStage && myLiveStageId ? (
      <Link to={`/stage/${myLiveStageId}`} className="stages-hub__create">
        {t('stage_open_existing', 'Open your Stage')}
      </Link>
    ) : (
      <Link to="/create-stage" className="stages-hub__create">
        {panel === PANEL_BUSINESS
          ? t('create_business_stage_open', 'Open business Stage')
          : t('create_stage_open', 'Open Stage')}
      </Link>
    );

  return (
    <div className="stages-hub">
      <div className="stages-hub__glow" aria-hidden />
      <header className="stages-hub__header">
        <AppBackButton className="stages-hub__back" fallback={APP_HOME_PATH} />
        <div className="stages-hub__brand">
          <AppText as="span" className="stages-hub__mark" aria-hidden>
            <FaMicrophone />
          </AppText>
          <div>
            <AppText as="h1" className="stages-hub__title">
              {t('stages_hub_title', 'Stages')}
            </AppText>
            <AppText as="p" className="stages-hub__subtitle">
              {t(
                'stages_hub_panels_subtitle',
                'People and business Stages — separate panels. Each room lasts 24 hours, then is deleted.'
              )}
            </AppText>
          </div>
        </div>
        {canCreateOnPanel ? (
          myLiveLoading ? (
            <span className="stages-hub__create stages-hub__create--muted" aria-busy="true">
              {t('loading', 'Loading…')}
            </span>
          ) : (
            createLink
          )
        ) : (
          <span className="stages-hub__header-spacer" aria-hidden />
        )}
      </header>

      <div
        className="stages-hub__panels"
        role="tablist"
        aria-label={t('stages_hub_panels', 'Room type')}
      >
        <button
          type="button"
          role="tab"
          aria-selected={panel === PANEL_PEOPLE}
          className={`stages-hub__panel-tab${panel === PANEL_PEOPLE ? ' is-active' : ''}`}
          onClick={() => setPanel(PANEL_PEOPLE)}
        >
          <FaMicrophone aria-hidden />
          {t('stages_panel_people', 'People')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={panel === PANEL_BUSINESS}
          className={`stages-hub__panel-tab${panel === PANEL_BUSINESS ? ' is-active' : ''}`}
          onClick={() => setPanel(PANEL_BUSINESS)}
        >
          <FaStore aria-hidden />
          {t('stages_panel_business', 'Business')}
          {businessStages.length > 0 ? (
            <AppText as="span" className="stages-hub__panel-count">
              {businessStages.length > 99 ? '99+' : businessStages.length}
            </AppText>
          ) : null}
        </button>
      </div>

      <div className="stages-hub__toolbar">
        <label className="stages-hub__search">
          <FaSearch aria-hidden className="stages-hub__search-icon" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search_stages', 'Search stages…')}
            aria-label={t('search_stages', 'Search stages…')}
            autoComplete="off"
          />
        </label>
        {panel === PANEL_PEOPLE ? (
          <div className="stages-hub__filters" role="tablist" aria-label={t('stages_filter', 'Filter')}>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'all'}
              className={`stages-hub__filter${filter === 'all' ? ' is-active' : ''}`}
              onClick={() => setFilter('all')}
            >
              {t('stages_filter_all', 'All')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'friends'}
              className={`stages-hub__filter${filter === 'friends' ? ' is-active' : ''}`}
              onClick={() => setFilter('friends')}
            >
              {t('stages_filter_friends', 'Friends')}
            </button>
          </div>
        ) : null}
      </div>

      <main className="stages-hub__body">
        {loading ? (
          <AppText as="p" className="stages-hub__loading">
            {t('loading_stages', 'Loading stages…')}
          </AppText>
        ) : error ? (
          <div className="stages-hub__empty">
            <AppText as="h2" className="stages-hub__empty-title">
              {t('stages_load_failed', 'Could not load live stages')}
            </AppText>
            <AppText as="p" className="stages-hub__empty-text">
              {t('stages_load_failed_hint', 'Check your connection and try again.')}
            </AppText>
            <button type="button" className="stages-hub__empty-cta" onClick={() => void refresh()}>
              {t('retry', 'Retry')}
            </button>
          </div>
        ) : !hasAnyStages ? (
          <div className="stages-hub__empty">
            <AppText as="span" className="stages-hub__empty-icon" aria-hidden>
              {panel === PANEL_BUSINESS ? <FaStore /> : <FaMicrophone />}
            </AppText>
            <AppText as="h2" className="stages-hub__empty-title">
              {search.trim()
                ? t('no_stages_found', 'No matching stages')
                : panel === PANEL_BUSINESS
                  ? t('no_live_business_stages', 'No live business Stages right now')
                  : filter === 'friends'
                    ? t('no_friend_stages', 'No friends have an open Stage right now')
                    : t('no_live_stages', 'No live open stages right now')}
            </AppText>
            <AppText as="p" className="stages-hub__empty-text">
              {panel === PANEL_BUSINESS
                ? t(
                    'stages_business_empty_hint',
                    'Business Stages last 24 hours, then are fully deleted. Open one from your business account.'
                  )
                : t(
                    'stages_live_empty_hint',
                    'Open a Stage yourself, or check back when rooms go live nearby.'
                  )}
            </AppText>
            {canCreateOnPanel && hasLiveStage && myLiveStageId ? (
              <Link to={`/stage/${myLiveStageId}`} className="stages-hub__empty-cta">
                {t('stage_open_existing', 'Open your Stage')}
              </Link>
            ) : canCreateOnPanel && !myLiveLoading ? (
              <Link to="/create-stage" className="stages-hub__empty-cta">
                {panel === PANEL_BUSINESS
                  ? t('create_business_stage_open', 'Open business Stage')
                  : t('create_stage_open', 'Open Stage')}
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            {myStage ? (
              <section className="stages-hub__section" aria-labelledby="stages-hub-mine">
                <AppText as="h2" id="stages-hub-mine" className="stages-hub__section-title">
                  {t('stages_section_yours', 'Your Stage')}
                </AppText>
                <ul className="stages-hub__list">
                  <StageCard stage={myStage} index={0} t={t} onOpen={openStage} />
                </ul>
              </section>
            ) : null}

            {otherStages.length > 0 ? (
              <section className="stages-hub__section" aria-labelledby="stages-hub-others">
                <AppText as="h2" id="stages-hub-others" className="stages-hub__section-title">
                  {panel === PANEL_BUSINESS
                    ? t('stages_section_business', 'Business rooms')
                    : myStage
                      ? t('stages_section_others', 'Other rooms')
                      : t('stages_section_live', 'Live rooms')}
                </AppText>
                <ul className="stages-hub__list">
                  {otherStages.map((stage, index) => (
                    <StageCard
                      key={stage.id}
                      stage={stage}
                      index={index}
                      t={t}
                      onOpen={openStage}
                    />
                  ))}
                </ul>
              </section>
            ) : myStage ? (
              <AppText as="p" className="stages-hub__section-empty">
                {t('stages_no_other_rooms', 'No other rooms to show right now.')}
              </AppText>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
