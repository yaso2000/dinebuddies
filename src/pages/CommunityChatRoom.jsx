import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { FaSignOutAlt, FaTimes } from 'react-icons/fa';
import CommunityChatSwipePager from '../components/community/CommunityChatSwipePager';
import CommunityFullChatView from '../components/community/CommunityFullChatView';
import CommunityChatHeaderMenu from '../components/community/CommunityChatHeaderMenu';
import MessageActionsToolbar from '../components/chat/MessageActionsToolbar';
import ForwardMessageModal from '../components/chat/ForwardMessageModal';
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
import { useConfirm } from '../context/ConfirmContext';

export default function CommunityChatRoom() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { partnerId } = useParams();
  const { isBusiness } = useAuth();
  const { joinCommunity, leaveCommunity, currentUser: inviteUser } = useInvitations();
  const room = useCommunityChatRoom(partnerId);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [selectedMessageOptions, setSelectedMessageOptions] = useState(null);
  const [forwardMessage, setForwardMessage] = useState(null);
  const handleSelectMessage = useCallback((message, options) => {
    setSelectedMessage(message);
    setSelectedMessageOptions(options);
  }, []);
  const roomWithSelect = useMemo(
    () => ({ ...room, onSelectMessage: handleSelectMessage }),
    [room, handleSelectMessage]
  );
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
  const [leavingCommunity, setLeavingCommunity] = useState(false);
  const joinAttemptRef = useRef(false);

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

  const handleLeaveCommunity = useCallback(async () => {
    const name = room.partner?.display_name || t('community_chat', 'Community Chat');
    if (
      !(await confirm({ message: `${t('Are you sure you want to leave', 'Are you sure you want to leave')} ${name}?`, tone: 'danger' }))
    ) {
      return;
    }
    setLeavingCommunity(true);
    try {
      const success = await leaveCommunity(partnerId);
      if (success) closeChat();
    } catch (error) {
      console.error('[CommunityChatRoom] leave', error);
    } finally {
      setLeavingCommunity(false);
    }
  }, [closeChat, leaveCommunity, partnerId, room.partner?.display_name, t]);

  const headerMenuActions = useMemo(() => {
    if (room.isHost || isBusiness) return [];
    return [
      {
        id: 'leave',
        label: t('Leave Community', 'Leave Community'),
        icon: <FaSignOutAlt size={15} aria-hidden />,
        danger: true,
        disabled: leavingCommunity,
        onClick: handleLeaveCommunity,
      },
    ];
  }, [handleLeaveCommunity, isBusiness, leavingCommunity, room.isHost, t]);

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
    () => ({ ...zoneThemeInlineStyle, ...guestFrameBackgroundStyle }),
    [zoneThemeInlineStyle, guestFrameBackgroundStyle]
  );

  let shellContent;

  const renderJoinGate = (title, description, action = null) => (
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

  if (room.loading && (!canEnterChat || !room.partner)) {
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
        {...guestFrameShellAttrs}
        style={shellInlineStyle}
      >
        {selectedMessage ? (
          <MessageActionsToolbar
            onBack={() => {
              setSelectedMessage(null);
              setSelectedMessageOptions(null);
            }}
            canReply={selectedMessageOptions?.canReply}
            onReply={() => {
              selectedMessageOptions?.onReply?.();
              setSelectedMessage(null);
              setSelectedMessageOptions(null);
            }}
            isStarred={selectedMessageOptions?.isStarred}
            onToggleStar={selectedMessageOptions?.onToggleStar}
            canDelete={selectedMessageOptions?.canDelete}
            onDelete={() => {
              selectedMessageOptions?.onDelete?.();
              setSelectedMessage(null);
              setSelectedMessageOptions(null);
            }}
            canForward
            onForward={() => {
              setForwardMessage(selectedMessage);
              setSelectedMessage(null);
              setSelectedMessageOptions(null);
            }}
            onCopy={
              selectedMessage?.text
                ? () => {
                    navigator.clipboard?.writeText(selectedMessage.text).catch(() => {});
                    setSelectedMessage(null);
                    setSelectedMessageOptions(null);
                  }
                : undefined
            }
            moreActions={selectedMessageOptions?.moreActions || []}
          />
        ) : (
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
            <CommunityChatHeaderMenu
              bannerChecked={room.bannerVisible !== false}
              bannerDisabled={room.bannerVisibleSaving || room.bannerToggleDisabled}
              bannerPersonal={!room.isHost}
              onBannerChange={(visible) => room.setCommunityChatBannerVisible(visible)}
              actions={headerMenuActions}
            />
          </div>
        </header>
        )}

        {isDesktopShell ? (
          <CommunityFullChatView room={roomWithSelect} />
        ) : (
          <CommunityChatSwipePager room={roomWithSelect} />
        )}
        <ForwardMessageModal
          open={Boolean(forwardMessage)}
          message={forwardMessage}
          onClose={() => setForwardMessage(null)}
        />
      </div>
    );
  }

  if (useMobileFullscreen && typeof document !== 'undefined') {
    return createPortal(shellContent, document.body);
  }
  return shellContent;
}

