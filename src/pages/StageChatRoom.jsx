import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FaDoorClosed, FaDoorOpen, FaSignOutAlt, FaTimes } from 'react-icons/fa';
import CommunityChatSwipePager from '../components/community/CommunityChatSwipePager';
import CommunityFullChatView from '../components/community/CommunityFullChatView';
import CommunityChatHeaderMenu from '../components/community/CommunityChatHeaderMenu';
import UserAvatar from '../components/UserAvatar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useStageChatRoom } from '../hooks/useStageChatRoom';
import { useProfileGiftPicker } from '../hooks/useProfileGiftPicker';
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
  const location = useLocation();
  const { isBusiness, currentUser, userProfile } = useAuth();
  const { showToast } = useToast();
  const room = useStageChatRoom(stageId);
  const { openGiftPicker, giftModal } = useProfileGiftPicker();
  const bootstrapHostId = location.state?.stageHostId || null;
  const justCreated = Boolean(location.state?.stageJustCreated);
  const uid = currentUser?.uid || userProfile?.id || null;
  const isBootstrapHost = Boolean(
    uid && ((justCreated && stageId) || (bootstrapHostId && uid === bootstrapHostId))
  );
  const canEnterChat = room.isMember || room.isHost || isBootstrapHost;
  const containerRef = useRef(null);
  const isDesktopShell = useDesktopShell();
  const { goBack: goBackFromStage } = useAppBackNavigation({ fallback: '/stages' });
  const useMobileFullscreen = !isDesktopShell;
  const { themeId: chatThemeId, setThemeId: setChatThemeId, themeStyle: chatThemeStyle } = useChatTheme();
  const [leaving, setLeaving] = useState(false);
  const [joining, setJoining] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);

  const stageVisibility =
    String(room.partner?.visibility || 'private').toLowerCase() === 'public'
      ? 'public'
      : 'private';
  const hostId = room.partner?.hostId || room.partner?.ownerId || null;
  const followsHost = useMemo(() => {
    if (!hostId) return false;
    const following = Array.isArray(userProfile?.following) ? userProfile.following : [];
    return following.includes(hostId);
  }, [hostId, userProfile?.following]);
  const wasInvited = useMemo(() => {
    const invited = Array.isArray(room.partner?.invitedIds) ? room.partner.invitedIds : [];
    const uid = currentUser?.uid || userProfile?.id || userProfile?.uid;
    return Boolean(uid && invited.includes(uid));
  }, [room.partner?.invitedIds, currentUser?.uid, userProfile?.id, userProfile?.uid]);
  const canRequestJoin =
    !canEnterChat &&
    !room.isBlockedFromCommunity &&
    !isBusiness &&
    !room.isStageClosed &&
    (stageVisibility === 'public' || followsHost || wasInvited);

  const openGiftToHost = useCallback(() => {
    if (room.isHost || !hostId) return;
    openGiftPicker({
      id: hostId,
      display_name:
        room.partner?.display_name ||
        room.partner?.hostDisplayName ||
        t('stage_chat', 'Stage'),
    });
  }, [hostId, openGiftPicker, room.isHost, room.partner, t]);

  const roomWithGifts = useMemo(() => {
    const base =
      room.partner || !isBootstrapHost
        ? room
        : {
            ...room,
            isHost: true,
            isMember: true,
            partner: {
              id: stageId,
              hostId: uid,
              ownerId: uid,
              display_name: t('stage_chat', 'Stage'),
              memberIds: uid ? [uid] : [],
              communityMembers: uid ? [uid] : [],
              visibility: 'public',
              status: 'active',
              communityChatBannerVisible: true,
            },
          };
    if (base.isHost || !canEnterChat) return base;
    return {
      ...base,
      onSendGiftToHost: openGiftToHost,
    };
  }, [room, canEnterChat, openGiftToHost, isBootstrapHost, stageId, uid, t]);

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

  // Host "close" only leaves the screen — the Stage stays live until the 24h TTL.
  const handleExitStageUi = () => {
    closeChat();
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
      // Legacy soft-closed rooms can still be reopened; new UX never soft-closes.
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
          id: 'exit',
          label: t('stage_exit_ui', 'Leave screen'),
          icon: <FaDoorClosed size={15} aria-hidden />,
          onClick: handleExitStageUi,
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

  const handleJoin = async () => {
    setJoining(true);
    try {
      await callMembership('join');
      showToast(t('stage_joined_toast', 'You joined the Stage.'), 'success');
    } catch (err) {
      console.error('[StageChatRoom] join', err);
      const raw = String(err?.message || '');
      const msg = raw.replace(/^Firebase: | \(functions\/.*\)\.?$/g, '').trim();
      showToast(msg || t('stage_join_failed', 'Could not join this Stage.'), 'error');
    } finally {
      setJoining(false);
    }
  };

  const renderJoinGate = (title, description, { showJoin = false } = {}) => (
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
      {showJoin ? (
        <button
          type="button"
          onClick={() => void handleJoin()}
          className="community-chat-join-gate__back"
          disabled={joining}
          style={{ marginBottom: 10 }}
        >
          {joining ? t('joining', 'Joining…') : t('stage_join', 'Join Stage')}
        </button>
      ) : null}
      <button type="button" onClick={closeChat} className="community-chat-join-gate__back">
        {t('go_back', 'Go back')}
      </button>
    </div>
  );

  let shellContent;

  // Enter as soon as membership/host is known — do not wait forever on Firestore.
  if (room.loading && !canEnterChat && !room.loadError) {
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
  } else if (room.loadError && !canEnterChat) {
    shellContent = renderJoinGate(
      t('stage_chat_unavailable', 'This Stage is not available'),
      t(
        'stage_load_failed_hint',
        'Could not load this Stage. Check your connection and try again.'
      )
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
    } else if (room.isStageClosed) {
      shellContent = renderJoinGate(
        t('stage_status_closed', 'Closed'),
        t('stage_join_closed_hint', 'This Stage is closed right now. Try again when the host reopens it.')
      );
    } else if (canRequestJoin) {
      shellContent = renderJoinGate(
        room.partner?.display_name || t('stage_chat', 'Stage'),
        stageVisibility === 'public'
          ? t('stage_join_public_hint', 'This Stage is public. Join to enter the chat.')
          : t('stage_join_followers_hint', 'This Stage is for followers of the host. Join to enter.'),
        { showJoin: true }
      );
    } else {
      shellContent = renderJoinGate(
        t('stage_chat_followers_only', 'Followers only'),
        t(
          'stage_chat_followers_only_hint',
          'Follow the host to join this private Stage, or ask them for an invite.'
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
          <CommunityFullChatView room={roomWithGifts} />
        ) : (
          <CommunityChatSwipePager room={roomWithGifts} />
        )}
        {giftModal}
      </div>
    );
  }

  if (useMobileFullscreen && typeof document !== 'undefined') {
    return createPortal(shellContent, document.body);
  }
  return shellContent;
}
