import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaMicrophone, FaDoorClosed, FaCrown, FaUsers, FaCircle } from 'react-icons/fa';
import AppBackButton from '../components/AppBackButton';
import UserAvatar from '../components/UserAvatar';
import { AppText } from '../components/base';
import { useAuth } from '../context/AuthContext';
import { useJoinedStages } from '../hooks/useJoinedStages';
import { APP_HOME_PATH } from '../utils/appRouteShell';
import './StagesHub.css';

function formatExpiry(expiresAt, t) {
  if (!expiresAt) return null;
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) return t('stage_expires_soon', 'Ending soon');
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  if (hours <= 1) return t('stage_expires_under_hour', 'Less than 1 hour left');
  return t('stage_expires_in_hours', '{{hours}} hours left', { hours });
}

export default function StagesHub() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { cannotCreateInvitations } = useAuth();
  const { stages, loading, leaveStage } = useJoinedStages();

  const sorted = useMemo(() => {
    return [...stages].sort((a, b) => {
      if (a.status === 'closed' !== (b.status === 'closed')) {
        return a.status === 'closed' ? 1 : -1;
      }
      if (Boolean(a.unreadCount) !== Boolean(b.unreadCount)) {
        return (b.unreadCount || 0) - (a.unreadCount || 0);
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [stages]);

  const handleLeave = async (e, stage) => {
    e.stopPropagation();
    if (stage.isHost) return;
    if (
      !window.confirm(
        `${t('Are you sure you want to leave', 'Are you sure you want to leave')} ${stage.name}?`
      )
    ) {
      return;
    }
    try {
      await leaveStage(stage.id);
    } catch (err) {
      console.error('[StagesHub] leave', err);
    }
  };

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
                'stages_hub_subtitle',
                'Your live event rooms — open, closed, and ready to rejoin.'
              )}
            </AppText>
          </div>
        </div>
        {!cannotCreateInvitations ? (
          sorted.some((s) => s.isHost) ? (
            <Link
              to={`/stage/${sorted.find((s) => s.isHost).id}`}
              className="stages-hub__create"
            >
              {t('stage_open_existing', 'Open your Stage')}
            </Link>
          ) : (
            <Link to="/create-stage" className="stages-hub__create">
              {t('create_stage_open', 'Open Stage')}
            </Link>
          )
        ) : (
          <span className="stages-hub__header-spacer" aria-hidden />
        )}
      </header>

      <main className="stages-hub__body">
        {loading ? (
          <AppText as="p" className="stages-hub__loading">
            {t('loading_stages', 'Loading stages…')}
          </AppText>
        ) : sorted.length === 0 ? (
          <div className="stages-hub__empty">
            <AppText as="span" className="stages-hub__empty-icon" aria-hidden>
              <FaMicrophone />
            </AppText>
            <AppText as="h2" className="stages-hub__empty-title">
              {t('no_stages_yet', 'No active stages yet')}
            </AppText>
            <AppText as="p" className="stages-hub__empty-text">
              {t(
                'stages_empty_hint',
                'Open a Stage with mutual follows, or wait for an invite.'
              )}
            </AppText>
            {!cannotCreateInvitations ? (
              <Link to="/create-stage" className="stages-hub__empty-cta">
                {t('create_stage_open', 'Open Stage')}
              </Link>
            ) : null}
          </div>
        ) : (
          <ul className="stages-hub__list">
            {sorted.map((stage, index) => {
              const closed = stage.status === 'closed';
              const expiryLabel = formatExpiry(stage.expiresAt, t);
              return (
                <li key={stage.id} style={{ '--stage-i': index }}>
                  <button
                    type="button"
                    className={`stages-hub__card${closed ? ' is-closed' : ''}${stage.unreadCount > 0 ? ' is-unread' : ''}`}
                    onClick={() => navigate(`/stage/${stage.id}`)}
                  >
                    <div className="stages-hub__card-media">
                      {stage.logo ? (
                        <img src={stage.logo} alt="" className="stages-hub__card-avatar" />
                      ) : (
                        <UserAvatar
                          user={{ display_name: stage.name }}
                          alt=""
                          solidPlaceholder
                          noGenderRing
                          className="stages-hub__card-avatar"
                        />
                      )}
                      {stage.isHost ? (
                        <AppText as="span" className="stages-hub__host-badge" title={t('stage_you_host', 'You host')}>
                          <FaCrown aria-hidden />
                        </AppText>
                      ) : null}
                    </div>

                    <div className="stages-hub__card-body">
                      <div className="stages-hub__card-top">
                        <AppText as="h2" className="stages-hub__card-title">
                          {stage.name}
                        </AppText>
                        {stage.unreadCount > 0 ? (
                          <AppText as="span" className="stages-hub__unread">
                            {stage.unreadCount > 99 ? '99+' : stage.unreadCount}
                          </AppText>
                        ) : null}
                      </div>

                      <AppText as="p" className="stages-hub__card-preview">
                        {closed
                          ? t('stage_status_closed', 'Closed')
                          : stage.lastMessage ||
                            t('stage_ready_to_chat', 'Ready to chat')}
                      </AppText>

                      <div className="stages-hub__meta">
                        <AppText as="span" className="stages-hub__meta-item">
                          <FaUsers aria-hidden />
                          {t('stage_members_count', '{{count}} members', {
                            count: stage.memberCount || 0,
                          })}
                        </AppText>
                        <AppText
                          as="span"
                          className="stages-hub__meta-item stages-hub__meta-item--online"
                          title={t('stage_online_members', '{{count}} online', {
                            count: stage.onlineCount || 0,
                          })}
                        >
                          <FaCircle aria-hidden className="stages-hub__online-dot" />
                          {t('stage_online_members', '{{count}} online', {
                            count: stage.onlineCount || 0,
                          })}
                        </AppText>
                        {closed ? (
                          <AppText as="span" className="stages-hub__meta-item stages-hub__meta-item--closed">
                            <FaDoorClosed aria-hidden />
                            {t('stage_status_closed', 'Closed')}
                          </AppText>
                        ) : null}
                        {expiryLabel ? (
                          <AppText as="span" className="stages-hub__meta-item">
                            {expiryLabel}
                          </AppText>
                        ) : null}
                      </div>
                    </div>

                    <AppText as="span" className="stages-hub__enter">
                      {t('stage_enter', 'Enter')}
                    </AppText>
                  </button>

                  {!stage.isHost ? (
                    <button
                      type="button"
                      className="stages-hub__leave"
                      onClick={(e) => void handleLeave(e, stage)}
                    >
                      {t('leave_stage', 'Leave Stage')}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
