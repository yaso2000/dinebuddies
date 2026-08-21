import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppText } from '../base';
import UserAvatar from '../UserAvatar';
import { useLongPress } from './useLongPress';
import StageHostGuestModerationMenu from './StageHostGuestModerationMenu';
import StageParticipantPreviewCard from './StageParticipantPreviewCard';
import StageParticipantActions from './StageParticipantActions';

function ParticipantRow({
  member,
  partnerId,
  canModerate,
  onModerate,
  onPreview,
  onGift,
  mutedLabel,
  layout = 'list',
}) {
  const { t } = useTranslation();
  const longPress = useLongPress(
    (event) => {
      if (!canModerate) return;
      const rect = event.currentTarget?.getBoundingClientRect?.();
      onModerate?.(member, rect || null);
    },
    { disabled: !canModerate }
  );
  const isHostMember = member.id === partnerId || member.isHost;

  if (layout === 'grid') {
    return (
      <li
        className={`community-participants__row community-participants__row--grid${canModerate ? ' community-participants__row--moderatable' : ''}`}
        title={member.displayName}
        {...(canModerate ? longPress : {})}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          onPreview?.(member, rect);
        }}
        onContextMenu={
          canModerate
            ? (event) => {
                event.preventDefault();
                const rect = event.currentTarget.getBoundingClientRect();
                onModerate?.(member, rect);
              }
            : undefined
        }
      >
        <div className="community-participants__avatar-wrap community-participants__avatar-wrap--grid">
          <UserAvatar
            user={member}
            src={member.avatar}
            alt={member.displayName || ''}
            className="community-participants__avatar"
          />
          {member.isOnline ? (
            <span className="community-participants__online-dot" aria-label={t('online', 'Online')} />
          ) : null}
          {isHostMember ? (
            <AppText as="span" className="community-participants__badge community-participants__badge--grid">
              {t('host', 'Host')}
            </AppText>
          ) : null}
        </div>
      </li>
    );
  }

  return (
    <li
      className={`community-participants__row${canModerate ? ' community-participants__row--moderatable' : ''}`}
      {...(canModerate ? longPress : {})}
      onContextMenu={
        canModerate
          ? (event) => {
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              onModerate?.(member, rect);
            }
          : undefined
      }
    >
      <div className="community-participants__avatar-wrap">
        <UserAvatar
          user={member}
          src={member.avatar}
          alt=""
          className="community-participants__avatar"
        />
        {member.isOnline ? (
          <span className="community-participants__online-dot" aria-label={t('online', 'Online')} />
        ) : null}
      </div>
      <div className="community-participants__meta">
        <AppText as="span" className="community-participants__name">
          {member.displayName}
        </AppText>
        {isHostMember ? (
          <AppText as="span" className="community-participants__badge">
            {t('host', 'Host')}
          </AppText>
        ) : member.isMuted ? (
          <AppText as="span" className="community-participants__status-line community-participants__status-line--muted">
            {mutedLabel}
          </AppText>
        ) : member.isOnline ? (
          <AppText as="span" className="community-participants__status-line">
            {t('online', 'Online')}
          </AppText>
        ) : null}
      </div>
      {!isHostMember ? <StageParticipantActions member={member} onGift={onGift} /> : null}
    </li>
  );
}

export default function CommunityParticipantsView({
  participants,
  loading,
  partnerId,
  isHost = false,
  isStageRoom = false,
  onMuteMember,
  onKickMember,
  onBlockMember,
  onGift,
  layout = 'list',
}) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState(null); // { member, rect }
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null); // { member, rect }

  const closeMenu = useCallback(() => setMenu(null), []);
  const closePreview = useCallback(() => setPreview(null), []);

  const openMenu = useCallback((member, rect) => {
    if (!member?.id) return;
    setMenu({ member, rect });
  }, []);

  const openPreview = useCallback((member, rect) => {
    if (!member?.id) return;
    setPreview({ member, rect });
  }, []);

  const runAction = useCallback(
    async (runner) => {
      if (busy) return;
      setBusy(true);
      try {
        await runner();
      } finally {
        setBusy(false);
        setMenu(null);
      }
    },
    [busy]
  );

  if (loading) {
    return (
      <div className="community-participants">
        <AppText as="p" className="community-participants__status">
          {t('inbox_loading', 'Loading…')}
        </AppText>
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="community-participants">
        <AppText as="p" className="community-participants__status">
          {t('community_participants_empty', 'No members yet.')}
        </AppText>
      </div>
    );
  }

  const hostCanModerate = Boolean(isHost && isStageRoom);

  const isGrid = layout === 'grid';

  return (
    <div className={`community-participants${isGrid ? ' community-participants--grid' : ''}`}>
      {!isGrid ? (
        <AppText as="h2" className="community-participants__title">
          {t('community_participants_title', 'Online Participants')}
        </AppText>
      ) : null}
      {hostCanModerate && !isGrid ? (
        <AppText as="p" className="community-participants__hint">
          {t(
            'stage_host_long_press_hint',
            'Long-press a guest to mute, remove, or block.'
          )}
        </AppText>
      ) : null}
      <ul className={`community-participants__list${isGrid ? ' community-participants__list--grid' : ''}`}>
        {participants.map((member) => {
          const canModerate =
            hostCanModerate &&
            member?.id &&
            member.id !== partnerId &&
            !member.isHost;
          return (
            <ParticipantRow
              key={member.id}
              member={member}
              partnerId={partnerId}
              canModerate={canModerate}
              onModerate={openMenu}
              onPreview={isGrid ? openPreview : undefined}
              onGift={onGift}
              mutedLabel={t('member_muted_badge', 'Muted')}
              layout={layout}
            />
          );
        })}
      </ul>

      {hostCanModerate ? (
        <StageHostGuestModerationMenu
          open={Boolean(menu)}
          anchorRect={menu?.rect}
          member={menu?.member}
          busy={busy}
          onClose={closeMenu}
          onMute={(duration) =>
            runAction(async () => {
              await onMuteMember?.(menu?.member?.id, duration);
            })
          }
          onKick={() =>
            runAction(async () => {
              const ok = window.confirm(
                t(
                  'stage_remove_member_confirm',
                  'Remove this member from the Stage? They will lose access to the chat.'
                )
              );
              if (!ok) return;
              await onKickMember?.(menu?.member?.id);
            })
          }
          onBlock={() =>
            runAction(async () => {
              const ok = window.confirm(
                t(
                  'stage_block_member_confirm',
                  'Block this guest from all your future Stages? They will be removed from this broadcast too.'
                )
              );
              if (!ok) return;
              await onBlockMember?.(menu?.member?.id);
            })
          }
        />
      ) : null}

      {isGrid ? (
        <StageParticipantPreviewCard
          open={Boolean(preview)}
          anchorRect={preview?.rect}
          member={preview?.member}
          isHost={Boolean(preview?.member?.id === partnerId || preview?.member?.isHost)}
          onGift={onGift}
          onClose={closePreview}
        />
      ) : null}
    </div>
  );
}
