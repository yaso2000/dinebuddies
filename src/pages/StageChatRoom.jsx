import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FaDoorClosed, FaDoorOpen, FaSignOutAlt, FaTimes } from 'react-icons/fa';
import CommunityChatSwipePager from '../components/community/CommunityChatSwipePager';
import CommunityFullChatView from '../components/community/CommunityFullChatView';
import CommunityChatHeaderMenu from '../components/community/CommunityChatHeaderMenu';
import UserAvatar from '../components/UserAvatar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useStageChatRoom } from '../hooks/useStageChatRoom';
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
import app from '../firebase/config';

export default function StageChatRoom() {
  const { t } = useTranslation();
  const { stageId } = useParams();
  const { isBusiness } = useAuth();
  const { showToast } = useToast();
  const room = useStageChatRoom(stageId);
  const canEnterChat = room.isMember || room.isHost;
  const containerRef = useRef(null);
  const isDesktopShell = useDesktopShell();
  const { goBack: goBackFromStage } = useAppBackNavigation({ fallback: '/stages' });
  const useMobileFullscreen = !isDesktopShell;
  const { themeId: chatThemeId, setThemeId: setChatThemeId, themeStyle: chatThemeStyle } = useChatTheme();
  const [leaving, setLeaving] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);

  useEffect(() => {
    if (!useMobileFullscreen) return undefined;
    const { detach } = attachChatShellToVisualViewport(() => containerRef.current);
    return detach;
  }, [useMobileFullscreen]);

  const closeChat = goBackFromStage;

  const callMembership = async (action) => {
    const functions = getFunctions(app, 'us-central1');
    const setStageMembership = httpsCallable(functions, 'setStageMembership');
    return setStageMembership({ stageId, action });
  };

  const handleLeave = async () => {
    const name = room.partner?.display_name || t('stage_chat', 'Stage');
    if (
      !window.confirm(
        `${t('Are you sure you want to leave', 'Are you sure you want to leave')} ${name}?`
      )
    ) {
      return;
    }
    setLeaving(true);
    try {
      await callMembership('leave');
      closeChat();
    } catch (err) {
      console.error('[StageChatRoom] leave', err);
      showToast(t('stage_leave_failed', 'Could not leave Stage.'), 'error');
    } finally {
      setLeaving(false);
    }
  };

  const handleCloseStage = async () => {
    if (
      !window.confirm(
        t(
          'stage_close_confirm',
          'Close this Stage temporarily? Guests cannot write until you reopen. The room stays available for 24 hours from creation.'
        )
      )
    ) {
      return;
    }
    setLifecycleBusy(true);
    try {
      await callMembership('close_stage');
      showToast(t('stage_closed_toast', 'Stage closed. You can reopen it anytime within 24 hours.'), 'success');
    } catch (err) {
      console.error('[StageChatRoom] close', err);
      showToast(t('stage_close_failed', 'Could not close Stage.'), 'error');
    } finally {
      setLifecycleBusy(false);
    }
  };

  const handleReopenStage = async () => {
    setLifecycleBusy(true);
    try {
      await callMembership('reopen_stage');
      showToast(t('stage_reopened_toast', 'Stage reopened.'), 'success');
    } catch (err) {
      console.error('[StageChatRoom] reopen', err);
      showToast(t('stage_reopen_failed', 'Could not reopen Stage.'), 'error');
    } finally {
      setLifecycleBusy(false);
    }
  };

  const headerMenuActions = (() => {
    if (room.isHost) {
      if (room.isStageClosed) {
        return [
          {
            id: 'reopen',
            label: t('stage_reopen', 'Reopen Stage'),
            icon: <FaDoorOpen size={15} aria-hidden />,
            disabled: lifecycleBusy,
            onClick: handleReopenStage,
          },
        ];
      }
      return [
        {
          id: 'close',
          label: t('stage_close', 'Close Stage'),
          icon: <FaDoorClosed size={15} aria-hidden />,
          danger: true,
          disabled: lifecycleBusy,
          onClick: handleCloseStage,
        },
      ];
    }
    if (!isBusiness) {
      return [
        {
          id: 'leave',
          label: t('leave_stage', 'Leave Stage'),
          icon: <FaSignOutAlt size={15} aria-hidden />,
          danger: true,
          disabled: leaving,
          onClick: handleLeave,
        },
      ];
    }
    return [];
  })();

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

  const renderJoinGate = (title, description) => (
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
      <AppText as="h2" style={{ margin: '0 0 10px', fontSize: '1.15rem' }}>
        {title}
      </AppText>
      {description ? (
        <AppText as="p" style={{ margin: '0 0 16px', opacity: 0.85, maxWidth: '320px', lineHeight: 1.5 }}>
          {description}
        </AppText>
      ) : null}
      <button type="button" onClick={closeChat} className="community-chat-join-gate__back">
        {t('go_back', 'Go back')}
      </button>
    </div>
  );

  let shellContent;

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
        {t('inbox_loading', 'Loading…')}
      </div>
    );
  } else if (!canEnterChat) {
    if (room.isBlockedFromCommunity) {
      shellContent = renderJoinGate(
        t('stage_chat_unavailable', 'This Stage is not available'),
        t('stage_chat_blocked_hint', 'You cannot access this Stage right now.')
      );
    } else if (isBusiness) {
      shellContent = renderJoinGate(
        t('stage_chat_business_title', 'Business accounts'),
        t('stage_business_cannot_join', 'Business accounts cannot join Stage rooms.')
      );
    } else {
      shellContent = renderJoinGate(
        t('stage_chat_invite_only', 'Invite only'),
        t(
          'stage_chat_invite_only_hint',
          'You need a Stage invitation from the host to enter this room.'
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
                {room.partner?.display_name || t('stage_chat', 'Stage')}
              </AppText>
              <AppText
                as="span"
                className="header-subtitle"
                style={{ fontSize: '12px', color: 'var(--text-muted)' }}
              >
                {room.isStageClosed
                  ? t('stage_status_closed', 'Closed')
                  : (() => {
                      const memberCount =
                        room.partner?.communityMembers?.length ||
                        room.participants?.length ||
                        0;
                      const onlineCount = Array.isArray(room.participants)
                        ? room.participants.filter((p) => p?.isOnline).length
                        : 0;
                      return `${t('stage_members_count', '{{count}} members', {
                        count: memberCount,
                      })} · ${t('stage_online_members', '{{count}} online', {
                        count: onlineCount,
                      })}`;
                    })()}
              </AppText>
            </div>
          </div>
          <div className="community-chat-header__actions">
            <CommunityChatHeaderMenu
              themeId={chatThemeId}
              onThemeChange={setChatThemeId}
              bannerChecked={room.bannerVisible !== false}
              bannerDisabled={room.bannerVisibleSaving || room.bannerToggleDisabled}
              bannerPersonal={!room.isHost}
              onBannerChange={(visible) => room.setCommunityChatBannerVisible(visible)}
              actions={headerMenuActions}
            />
          </div>
        </header>

        {room.isStageClosed ? (
          <AppText
            as="div"
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              textAlign: 'center',
              background: 'color-mix(in srgb, var(--brand-primary) 14%, transparent)',
              color: 'var(--text-primary)',
              flexShrink: 0,
            }}
          >
            {room.isHost
              ? t(
                  'stage_closed_banner_host',
                  'Stage is closed. Guests can read but not write. Tap Reopen to continue.'
                )
              : t(
                  'stage_closed_banner_guest',
                  'Stage is temporarily closed by the host. You can still read messages.'
                )}
          </AppText>
        ) : null}

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
