import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaMicrophone, FaTrash } from 'react-icons/fa';
import { AppText } from '../base';
import { useAuth } from '../../context/AuthContext';

export default function StagesChatPanel({
  stages = [],
  loading = false,
  searchQuery = '',
  onLeaveStage,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { cannotCreateInvitations } = useAuth();

  const filtered = stages.filter((s) =>
    (s.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLeave = async (e, stage) => {
    e.stopPropagation();
    if (stage.isHost) {
      window.alert(
        t(
          'stage_host_cannot_leave',
          'As host, close the Stage from inside the room instead of leaving.'
        )
      );
      return;
    }
    if (
      !window.confirm(
        `${t('Are you sure you want to leave', 'Are you sure you want to leave')} ${stage.name}?`
      )
    ) {
      return;
    }
    try {
      await onLeaveStage?.(stage.id);
    } catch (error) {
      console.error('Error leaving stage:', error);
    }
  };

  if (loading) {
    return (
      <div className="messages-page__loading">
        {t('loading_stages', 'Loading stages…')}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="messages-page__empty">
        <div className="messages-page__empty-icon" aria-hidden>
          <FaMicrophone />
        </div>
        <AppText as="h3" className="messages-page__empty-title" format={false}>
          {searchQuery
            ? t('no_stages_found', 'No stages found')
            : t('no_stages_yet', 'No active stages yet')}
        </AppText>
        <AppText as="p" className="messages-page__empty-text" format={false}>
          {searchQuery
            ? t('Try a different search', 'Try a different search')
            : t(
                'stages_empty_hint',
                'Open a Stage with mutual follows, or wait for an invite.'
              )}
        </AppText>
        {!searchQuery && !cannotCreateInvitations ? (
          <Link to="/create-stage" className="messages-page__empty-cta">
            {t('create_stage_open', 'Open Stage')}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="messages-page__list">
      {filtered.map((stage) => {
        const closed = stage.status === 'closed';
        return (
          <div
            key={stage.id}
            className={`messages-page__item community-chat-item${stage.unreadCount > 0 ? ' unread' : ''}`}
            onClick={() => navigate(`/stage/${stage.id}`)}
          >
            <div className="messages-page__avatar community-chat-avatar">
              {stage.logo ? (
                <img src={stage.logo} alt={stage.name} />
              ) : (
                <AppText as="span" className="community-chat-avatar-fallback">
                  {stage.name ? stage.name.charAt(0).toUpperCase() : 'S'}
                </AppText>
              )}
            </div>

            <div className="messages-page__content">
              <div className="messages-page__row-top">
                <AppText as="h3" className="messages-page__name">
                  {stage.name}
                  {closed
                    ? ` · ${t('stage_status_closed', 'Closed')}`
                    : ''}
                </AppText>
                {stage.unreadCount > 0 ? (
                  <AppText as="span" className="community-unread-pill">
                    {stage.unreadCount > 99 ? '99+' : stage.unreadCount}
                  </AppText>
                ) : null}
              </div>
              <div className="messages-page__row-bottom">
                <AppText as="p" className="messages-page__preview">
                  {`${t('stage_members_count', '{{count}} members', {
                    count: stage.memberCount || 0,
                  })} · ${t('stage_online_members', '{{count}} online', {
                    count: stage.onlineCount || 0,
                  })}${
                    stage.lastMessage ? ` — ${stage.lastMessage}` : ''
                  }`}
                </AppText>
                {!stage.isHost ? (
                  <button
                    type="button"
                    className="community-leave-btn"
                    onClick={(e) => handleLeave(e, stage)}
                    title={t('leave_stage', 'Leave Stage')}
                    aria-label={t('leave_stage', 'Leave Stage')}
                  >
                    <FaTrash size={12} />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
