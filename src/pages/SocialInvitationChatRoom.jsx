import React, { useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { FaPalette, FaTimes } from 'react-icons/fa';
import CommunityChatSwipePager from '../components/community/CommunityChatSwipePager';
import StageDesktopLayout from '../components/community/StageDesktopLayout';
import CommunityChatHeaderMenu from '../components/community/CommunityChatHeaderMenu';
import useZoneThemeModal from '../components/community/useZoneThemeModal';
import UserAvatar from '../components/UserAvatar';
import { useAuth } from '../context/AuthContext';
import { useSocialInvitationChatRoom } from '../hooks/useSocialInvitationChatRoom';
import { useProfileGiftPicker } from '../hooks/useProfileGiftPicker';
import { useDesktopShell } from '../hooks/useDesktopShell';
import { useAppBackNavigation } from '../hooks/useAppBackNavigation';
import { attachChatShellToVisualViewport } from '../utils/chatVisualViewportLock';
import {
  buildCommunityGuestFrameBackgroundStyle,
  getCommunityGuestFrameShellAttributes,
} from '../constants/communityChatGuestFrameLook';
import { getHostedInvitationDetailsPath } from '../utils/hostedInvitationRoutes';
import './CommunityChatRoom.css';
import '../components/community/community-chat-theme.css';
import '../components/community/CommunityChatSwipePager.css';
import '../styles/chatReferenceTheme.css';
import { AppText } from '../components/base';

/**
 * Social (group) invitation chat — the invitation's own "Stage": same banner,
 * host-controlled YouTube playback, pin/spotlight messages, member list, and
 * moderation (mute/kick/block) as a real Stage room, with the invitation's
 * author as host. Invitations are invite-only (no public join/discovery), so
 * this is simpler than StageChatRoom: no join-request flow, no
 * close/reopen lifecycle — just accepted (rsvps[uid] === 'accepted') vs not.
 */
export default function SocialInvitationChatRoom() {
  const { t } = useTranslation();
  const { id: invitationId } = useParams();
  const navigate = useNavigate();
  const { isBusiness } = useAuth();
  const room = useSocialInvitationChatRoom(invitationId);
  const { openGiftPicker, giftModal } = useProfileGiftPicker();
  const zoneTheme = useZoneThemeModal(room);
  const canEnterChat = room.isMember || room.isHost;
  const containerRef = useRef(null);
  const isDesktopShell = useDesktopShell();
  const { goBack: goBackFromChat } = useAppBackNavigation({ fallback: '/invitations' });
  const useMobileFullscreen = !isDesktopShell;

  useEffect(() => {
    if (!useMobileFullscreen) return undefined;
    const { detach } = attachChatShellToVisualViewport(() => containerRef.current);
    return detach;
  }, [useMobileFullscreen]);

  const closeChat = goBackFromChat;

  const goToInvitationDetails = () => {
    navigate(getHostedInvitationDetailsPath({ id: invitationId, ...room.partner }));
  };

  const roomWithGifts = useMemo(() => {
    const canGift = canEnterChat && !room.isHost && !isBusiness && room.hostId;
    if (!canGift) return room;
    return {
      ...room,
      onSendGiftToHost: () =>
        openGiftPicker({
          id: room.hostId,
          display_name: room.partner?.display_name || t('social_invitation_chat', 'Event chat'),
        }),
    };
  }, [room, canEnterChat, isBusiness, openGiftPicker, t]);

  const headerMenuActions = room.isHost
    ? [
        {
          id: 'chat-look',
          label: t('community_guest_frame_bg_tool', 'Chat look'),
          icon: <FaPalette size={15} aria-hidden />,
          onClick: zoneTheme.open,
        },
      ]
    : [];

  const shellClass = [
    'chat-room-container',
    'chat-screen',
    'community-chat-root',
    'community-chat-swipe-shell',
    'stage-chat-root',
    useMobileFullscreen ? 'community-chat-fullscreen' : '',
    room.bannerVisible === false ? 'community-chat-root--no-banner' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const zoneThemeId = room.zoneThemeId || 'stage';
  const zoneThemeInlineStyle = room.zoneThemeInlineStyle;
  const guestFrameBackground = room.guestFrameBackground;

  const guestFrameShellAttrs = useMemo(
    () => getCommunityGuestFrameShellAttributes({ background: guestFrameBackground }),
    [guestFrameBackground]
  );

  const guestFrameBackgroundStyle = useMemo(
    () => buildCommunityGuestFrameBackgroundStyle(guestFrameBackground),
    [guestFrameBackground]
  );

  const shellInlineStyle = useMemo(
    () => ({ ...zoneThemeInlineStyle, ...guestFrameBackgroundStyle }),
    [zoneThemeInlineStyle, guestFrameBackgroundStyle]
  );

  const renderGate = (title, description, { showAccept = false } = {}) => (
    <div
      ref={containerRef}
      className={`${shellClass} community-chat-join-gate`}
      data-cchat-zone-theme={zoneThemeId}
      style={zoneThemeInlineStyle}
    >
      <button
        type="button"
        className="header-close-btn community-chat-fullscreen__close"
        onClick={closeChat}
        aria-label={t('close', 'Close')}
      >
        <FaTimes size={18} />
      </button>
      <AppText as="h2" style={{ margin: '0 0 10px', fontSize: '1.15rem' }}>
        {title}
      </AppText>
      {description ? (
        <AppText as="p" style={{ margin: '0 0 16px', opacity: 0.85, maxWidth: '320px', lineHeight: 1.5 }}>
          {description}
        </AppText>
      ) : null}
      {showAccept ? (
        <button
          type="button"
          onClick={goToInvitationDetails}
          className="community-chat-join-gate__back"
          style={{ marginBottom: 10 }}
        >
          {t('social_invitation_view_invite', 'View invitation')}
        </button>
      ) : null}
      <button type="button" onClick={closeChat} className="community-chat-join-gate__back">
        {t('go_back', 'Go back')}
      </button>
    </div>
  );

  let shellContent;

  if (room.loading && !canEnterChat && !room.loadError) {
    shellContent = (
      <div
        ref={containerRef}
        className={shellClass}
        data-cchat-zone-theme={zoneThemeId}
        style={{ ...zoneThemeInlineStyle, justifyContent: 'center', alignItems: 'center', color: 'var(--text-primary)' }}
      >
        <button
          type="button"
          className="header-close-btn community-chat-fullscreen__close"
          onClick={closeChat}
          aria-label={t('close', 'Close')}
        >
          <FaTimes size={18} />
        </button>
        {t('inbox_loading', 'Loading…')}
      </div>
    );
  } else if (room.loadError && !canEnterChat) {
    shellContent = renderGate(
      t('social_invitation_chat_unavailable', 'This event chat is not available'),
      t('stage_load_failed_hint', 'Could not load this chat. Check your connection and try again.')
    );
  } else if (!canEnterChat) {
    if (room.isBlockedFromCommunity) {
      shellContent = renderGate(
        t('social_invitation_chat_unavailable', 'This event chat is not available'),
        t('stage_chat_blocked_hint', 'You cannot access this chat right now.')
      );
    } else {
      shellContent = renderGate(
        room.partner?.display_name || t('social_invitation_chat', 'Event chat'),
        t(
          'social_invitation_accept_hint',
          'Accept the invitation to unlock this chat.'
        ),
        { showAccept: true }
      );
    }
  } else {
    shellContent = (
      <div
        ref={containerRef}
        dir="ltr"
        className={shellClass}
        data-cchat-zone-theme={zoneThemeId}
        {...guestFrameShellAttrs}
        style={shellInlineStyle}
      >
        <header className="chat-header">
          <button
            type="button"
            className="header-close-btn"
            onClick={closeChat}
            style={{ color: 'var(--text-primary)' }}
            aria-label={t('close', 'Close')}
          >
            <FaTimes size={18} />
          </button>
          <div
            className="header-info"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-start',
              marginInlineStart: '8px',
              flex: 1,
              minWidth: 0,
            }}
          >
            <UserAvatar
              user={room.partner}
              alt=""
              solidPlaceholder
              noGenderRing
              className="community-chat-header__avatar"
              style={{ width: '40px', height: '40px', minWidth: '40px', minHeight: '40px', marginInlineEnd: '10px' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
              <AppText
                as="h1"
                className="header-title"
                style={{ fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}
              >
                {room.partner?.display_name || t('social_invitation_chat', 'Event chat')}
              </AppText>
              <AppText as="span" className="header-subtitle" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {(() => {
                  const memberCount = room.participants?.length || 0;
                  const onlineCount = Array.isArray(room.participants)
                    ? room.participants.filter((p) => p?.isOnline).length
                    : 0;
                  return `${t('stage_members_count', '{{count}} members', { count: memberCount })} · ${t('stage_online_members', '{{count}} online', { count: onlineCount })}`;
                })()}
              </AppText>
            </div>
          </div>
          <div className="community-chat-header__actions">
            <CommunityChatHeaderMenu
              bannerChecked={room.bannerVisible !== false}
              bannerDisabled={room.bannerVisibleSaving || room.bannerToggleDisabled}
              bannerPersonal={!room.isHost}
              onBannerChange={(visible) => room.setCommunityChatBannerVisible(visible)}
              actions={headerMenuActions}
              inline={isDesktopShell}
            />
          </div>
        </header>

        {isDesktopShell ? (
          <StageDesktopLayout room={roomWithGifts} onGiftParticipant={openGiftPicker} />
        ) : (
          <CommunityChatSwipePager room={roomWithGifts} onGiftParticipant={openGiftPicker} />
        )}
        {giftModal}
        {zoneTheme.modal}
      </div>
    );
  }

  if (useMobileFullscreen && typeof document !== 'undefined') {
    return createPortal(shellContent, document.body);
  }
  return shellContent;
}
