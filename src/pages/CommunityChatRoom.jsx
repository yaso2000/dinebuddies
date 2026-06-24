import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { FaTimes } from 'react-icons/fa';
import CommunityChatSwipePager from '../components/community/CommunityChatSwipePager';
import CommunityFullChatView from '../components/community/CommunityFullChatView';
import UserAvatar from '../components/UserAvatar';
import { useCommunityChatRoom } from '../hooks/useCommunityChatRoom';
import { useDesktopShell } from '../hooks/useDesktopShell';
import { attachChatShellToVisualViewport, isAppleWebKitTouch } from '../utils/chatVisualViewportLock';
import './CommunityChatRoom.css';
import '../components/community/community-chat-theme.css';
import '../components/community/CommunityChatSwipePager.css';
import { AppText } from '../components/base';

export default function CommunityChatRoom() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { partnerId } = useParams();
  const room = useCommunityChatRoom(partnerId);
  const containerRef = useRef(null);
  const isDesktopShell = useDesktopShell();
  const useMobileFullscreen = !isDesktopShell;

  useEffect(() => {
    if (!useMobileFullscreen) return undefined;
    const { detach, sync } = attachChatShellToVisualViewport(() => containerRef.current);

    const resyncForComposer = (event) => {
      if (!isAppleWebKitTouch()) return;
      const target = event.target;
      if (!target?.closest?.('.community-main-chat__composer, .community-composer-bar, .community-main-chat__input')) {
        return;
      }
      requestAnimationFrame(() => {
        sync();
        window.setTimeout(sync, 120);
      });
    };

    document.addEventListener('focusin', resyncForComposer);
    return () => {
      document.removeEventListener('focusin', resyncForComposer);
      detach();
    };
  }, [useMobileFullscreen]);

  const closeChat = () => navigate('/messages?tab=communities');

  const shellClass = [
    'chat-room-container',
    'chat-screen',
    'community-chat-root',
    'community-chat-swipe-shell',
    useMobileFullscreen ? 'community-chat-fullscreen' : '',
  ]
    .filter(Boolean)
    .join(' ');

  let shellContent;

  if (room.loading) {
    shellContent = (
      <div
        ref={containerRef}
        className={shellClass}
        style={{ justifyContent: 'center', alignItems: 'center', color: 'var(--text-primary)' }}
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
  } else if (!room.isMember) {
    shellContent = (
      <div
        ref={containerRef}
        className={shellClass}
        style={{ justifyContent: 'center', alignItems: 'center', color: 'var(--text-primary)' }}
      >
        <button
          type="button"
          className="header-close-btn community-chat-fullscreen__close"
          onClick={closeChat}
          aria-label={t('close', 'Close')}
        >
          <FaTimes size={18} />
        </button>
        <AppText as="h2">{t('access_denied', 'Access denied')}</AppText>
        <button
          type="button"
          onClick={closeChat}
          style={{ padding: '10px', marginTop: '10px' }}
        >
          {t('go_back', 'Go back')}
        </button>
      </div>
    );
  } else {
    shellContent = (
      <div ref={containerRef} dir="ltr" className={shellClass}>
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
              style={{
                width: '40px',
                height: '40px',
                minWidth: '40px',
                minHeight: '40px',
                flexShrink: 0,
                marginInlineEnd: '10px',
                objectFit: 'cover',
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
