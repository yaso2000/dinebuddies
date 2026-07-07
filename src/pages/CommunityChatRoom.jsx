import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { FaTimes } from 'react-icons/fa';
import CommunityChatSwipePager from '../components/community/CommunityChatSwipePager';
import CommunityFullChatView from '../components/community/CommunityFullChatView';
import CommunityChatBannerToggle from '../components/community/CommunityChatBannerToggle';
import CommunityChatLeaveButton from '../components/community/CommunityChatLeaveButton';
import UserAvatar from '../components/UserAvatar';
import { useAuth } from '../context/AuthContext';
import { useInvitations } from '../context/InvitationContext';
import { useCommunityChatRoom } from '../hooks/useCommunityChatRoom';
import { useDesktopShell } from '../hooks/useDesktopShell';
import { useAppBackNavigation } from '../hooks/useAppBackNavigation';
import { attachChatShellToVisualViewport } from '../utils/chatVisualViewportLock';
import {
  buildCommunityGuestFrameBackgroundStyle,
  getCommunityGuestFrameShellAttributes,
} from '../constants/communityChatGuestFrameLook';
import './CommunityChatRoom.css';
import '../components/community/community-chat-theme.css';
import '../components/community/CommunityChatSwipePager.css';
import '../styles/chatReferenceTheme.css';
import { AppText } from '../components/base';
import { useChatTheme } from '../hooks/useChatTheme';
import ChatThemePicker from '../components/chat/ChatThemePicker';
import CommunityChatCastLauncher from '../components/community/CommunityChatCastLauncher';

export default function CommunityChatRoom() {
  const { t } = useTranslation();
  const { partnerId } = useParams();
  const { isBusiness } = useAuth();
  const { joinCommunity, currentUser: inviteUser } = useInvitations();
  const room = useCommunityChatRoom(partnerId);
  const joinedCommunityIds = inviteUser?.joinedCommunities ?? [];
  const canEnterChat =
    room.isMember ||
    room.isHost ||
    (partnerId && joinedCommunityIds.includes(partnerId));
  const containerRef = useRef(null);
  const isDesktopShell = useDesktopShell();
  const { goBack: goBackFromCommunity } = useAppBackNavigation({ fallback: '/messages?tab=communities' });
  const useMobileFullscreen = !isDesktopShell;
  const [joinStatus, setJoinStatus] = useState('idle');
  const joinAttemptRef = useRef(false);
  const { themeId: chatThemeId, setThemeId: setChatThemeId, themeStyle: chatThemeStyle } = useChatTheme();

  const attemptJoin = useCallback(async () => {
    if (!partnerId || joinAttemptRef.current) return;
    joinAttemptRef.current = true;
    setJoinStatus('joining');
    try {
      const ok = await joinCommunity(partnerId);
      setJoinStatus(ok ? 'idle' : 'failed');
    } catch {
      setJoinStatus('failed');
    } finally {
      joinAttemptRef.current = false;
    }
  }, [joinCommunity, partnerId]);

  useEffect(() => {
    setJoinStatus('idle');
    joinAttemptRef.current = false;
  }, [partnerId]);

  useEffect(() => {
    if (room.loading || canEnterChat || room.isBlockedFromCommunity || !partnerId) return;
    if (isBusiness) return;
    if (joinStatus === 'joining' || joinStatus === 'failed') return;
    void attemptJoin();
  }, [
    room.loading,
    canEnterChat,
    room.isBlockedFromCommunity,
    partnerId,
    isBusiness,
    joinStatus,
    attemptJoin,
  ]);

  useEffect(() => {
    if (canEnterChat || room.isHost || joinStatus === 'failed' || room.loading || !partnerId) return;
    const timer = window.setTimeout(() => setJoinStatus('failed'), 12000);
    return () => window.clearTimeout(timer);
  }, [canEnterChat, room.isHost, joinStatus, room.loading, partnerId]);

  useEffect(() => {
    if (!useMobileFullscreen) return undefined;
    const { detach } = attachChatShellToVisualViewport(() => containerRef.current);
    return detach;
  }, [useMobileFullscreen]);

  const closeChat = goBackFromCommunity;

  const shellClass = [
    'chat-room-container',
    'chat-screen',
    'community-chat-root',
    'community-chat-swipe-shell',
    useMobileFullscreen ? 'community-chat-fullscreen' : '',
    room.bannerVisible === false ? 'community-chat-root--no-banner' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const zoneThemeId = room.zoneThemeId || 'stage';
  const zoneThemeInlineStyle = room.zoneThemeInlineStyle;
  const guestFrameBackground = room.guestFrameBackground;

  const guestFrameShellAttrs = useMemo(
    () =>
      getCommunityGuestFrameShellAttributes({
        background: guestFrameBackground,
      }),
    [guestFrameBackground]
  );

  const guestFrameBackgroundStyle = useMemo(
    () => buildCommunityGuestFrameBackgroundStyle(guestFrameBackground),
    [guestFrameBackground]
  );

  const shellInlineStyle = useMemo(
    () => ({ ...zoneThemeInlineStyle, ...guestFrameBackgroundStyle, ...chatThemeStyle }),
    [zoneThemeInlineStyle, guestFrameBackgroundStyle, chatThemeStyle]
  );

  let shellContent;

  const renderJoinGate = (title, description, action = null) => (
    <div
      ref={containerRef}
      className={`${shellClass} community-chat-join-gate`}
      data-cchat-zone-theme={zoneThemeId}
      data-chat-theme={chatThemeId}
      style={{ ...zoneThemeInlineStyle, ...chatThemeStyle }}
    >
      <button
        type="button"
        className="header-close-btn community-chat-fullscreen__close"
        onClick={closeChat}
        aria-label={t('close', 'Close')}
      >
        <FaTimes size={18} />
      </button>
      <AppText as="h2" style={{ margin: '0 0 10px', fontSize: '1.15rem' }}>{title}</AppText>
      {description ? (
        <AppText as="p" style={{ margin: '0 0 16px', opacity: 0.85, maxWidth: '320px', lineHeight: 1.5 }}>
          {description}
        </AppText>
      ) : null}
      {action}
      <button
        type="button"
        onClick={closeChat}
        className="community-chat-join-gate__back"
      >
        {t('go_back', 'Go back')}
      </button>
    </div>
  );

  if (room.loading && !canEnterChat) {
    shellContent = (
      <div
        ref={containerRef}
        className={shellClass}
        data-cchat-zone-theme={zoneThemeId}
        style={{
          ...zoneThemeInlineStyle,
          justifyContent: 'center',
          alignItems: 'center',
          color: 'var(--text-primary)',
        }}
      >
        <button
          type="button"
          className="header-close-btn community-chat-fullscreen__close"
          onClick={closeChat}
          aria-label={t('close', 'Close')}
        >
          <FaTimes size={18} />
        </button>
        {t('inbox_loading', 'Loadingâ€¦')}
      </div>
    );
  } else if (!canEnterChat) {
    if (room.isBlockedFromCommunity) {
      shellContent = renderJoinGate(
        t('community_chat_unavailable', 'This community is not available'),
        t('community_chat_blocked_hint', 'You cannot access this chat room right now.')
      );
    } else if (isBusiness) {
      shellContent = renderJoinGate(
        t('community_chat_business_title', 'Business accounts'),
        t('business_cannot_join_community', 'Business accounts cannot join other communities.')
      );
    } else if (joinStatus === 'failed') {
      shellContent = renderJoinGate(
        t('community_chat_join_retry_title', 'Could not open chat right now'),
        t(
          'community_chat_join_retry_hint',
          'This is not a problem with your account. Tap try again â€” you can chat with other members once you are in.'
        ),
        <button
          type="button"
          onClick={() => setJoinStatus('idle')}
          style={{
            padding: '12px 20px',
            borderRadius: '14px',
            border: 'none',
            background: 'var(--brand-primary)',
            color: 'var(--text-on-brand)',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          {t('try_again', 'Try again')}
        </button>
      );
    } else {
      shellContent = renderJoinGate(
        t('community_chat_joining', 'Opening community chatâ€¦'),
        t(
          'community_chat_joining_hint',
          'Hang tight â€” you will be able to chat with other members in a moment.'
        )
      );
    }
  } else {
    shellContent = (
      <div
        ref={containerRef}
        dir="ltr"
        className={shellClass}
        data-cchat-zone-theme={zoneThemeId}
        data-chat-theme={chatThemeId}
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
              style={{
                width: '40px',
                height: '40px',
                minWidth: '40px',
                minHeight: '40px',
                marginInlineEnd: '10px',
              }}
            />
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                flex: 1,
                minWidth: 0,
              }}
            >
              <AppText
                as="h1"
                className="header-title"
                style={{
                  fontSize: '16px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%',
                }}
              >
                {room.partner?.display_name || t('community_chat', 'Community Chat')}
              </AppText>
              <AppText
                as="span"
                className="header-subtitle"
                style={{ fontSize: '12px', color: 'var(--text-muted)' }}
              >
                {room.partner?.communityMembers?.length || 0} {t('members', 'members')}
              </AppText>
            </div>
          </div>
          <div className="community-chat-header__actions">
            {room.isHost ? (
              <CommunityChatCastLauncher partnerId={partnerId} disabled={room.loading} />
            ) : null}
            <ChatThemePicker value={chatThemeId} onChange={setChatThemeId} />
            <CommunityChatBannerToggle
              checked={room.bannerVisible !== false}
              disabled={room.bannerVisibleSaving || room.bannerToggleDisabled}
              personal={!room.isHost}
              onChange={(visible) => room.setCommunityChatBannerVisible(visible)}
            />
            {!room.isHost && !isBusiness ? (
              <CommunityChatLeaveButton
                partnerId={partnerId}
                partnerName={room.partner?.display_name}
                onLeft={closeChat}
              />
            ) : null}
          </div>
        </header>

        {isDesktopShell ? (
          <CommunityFullChatView room={room} />
        ) : (
          <CommunityChatSwipePager room={room} />
        )}
      </div>
    );
  }

  if (useMobileFullscreen && typeof document !== 'undefined') {
    return createPortal(shellContent, document.body);
  }
  return shellContent;
}

