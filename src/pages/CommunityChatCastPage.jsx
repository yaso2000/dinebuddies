import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { FaCompress, FaExpand } from 'react-icons/fa';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useCommunityChatRoom } from '../hooks/useCommunityChatRoom';
import CommunityChatCastView from '../components/community/CommunityChatCastView';
import { signInCommunityChatDisplay } from '../services/communityChatDisplay';
import {
  buildCommunityGuestFrameBackgroundStyle,
  getCommunityGuestFrameShellAttributes,
} from '../constants/communityChatGuestFrameLook';
import { AppText } from '../components/base';
import '../components/community/community-chat-theme.css';
import '../components/community/CommunityChatSwipePager.css';
import '../styles/chatReferenceTheme.css';
import './CommunityChatCastPage.css';

function useWakeLock(enabled) {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.wakeLock) return undefined;

    let lock = null;
    let cancelled = false;

    const requestLock = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        /* unsupported or denied */
      }
    };

    void requestLock();

    const onVisibility = () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      void requestLock();
    };

    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void lock?.release?.();
    };
  }, [enabled]);
}

export default function CommunityChatCastPage() {
  const { t } = useTranslation();
  const { partnerId } = useParams();
  const [searchParams] = useSearchParams();
  const displayKey = searchParams.get('key') || '';
  const [authState, setAuthState] = useState('loading');
  const [authError, setAuthError] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const rootRef = useRef(null);
  const room = useCommunityChatRoom(partnerId);

  useWakeLock(authState === 'ready');

  useEffect(() => {
    if (!partnerId || !displayKey) {
      setAuthState('error');
      setAuthError(t('community_chat_cast_invalid_link', 'This display link is invalid or expired.'));
      return undefined;
    }

    let cancelled = false;
    setAuthState('loading');
    setAuthError('');

    void (async () => {
      try {
        const { customToken } = await signInCommunityChatDisplay(partnerId, displayKey);
        if (cancelled) return;
        await signInWithCustomToken(auth, customToken);
        if (cancelled) return;
        setAuthState('ready');
      } catch (err) {
        if (cancelled) return;
        console.error('[CommunityChatCastPage] display auth', err);
        setAuthState('error');
        setAuthError(
          t(
            'community_chat_cast_auth_failed',
            'Could not connect this screen. Generate a new link from the business chat.'
          )
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [displayKey, partnerId, t]);

  const zoneThemeId = room.zoneThemeId || 'stage';
  const guestFrameShellAttrs = useMemo(
    () =>
      getCommunityGuestFrameShellAttributes({
        background: room.guestFrameBackground,
      }),
    [room.guestFrameBackground]
  );
  const guestFrameBackgroundStyle = useMemo(
    () => buildCommunityGuestFrameBackgroundStyle(room.guestFrameBackground),
    [room.guestFrameBackground]
  );
  const shellStyle = useMemo(
    () => ({ ...room.zoneThemeInlineStyle, ...guestFrameBackgroundStyle }),
    [room.guestFrameBackground, room.zoneThemeInlineStyle]
  );

  const toggleFullscreen = useCallback(async () => {
    const node = rootRef.current;
    if (!node) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFullscreen(false);
      } else {
        await node.requestFullscreen();
        setFullscreen(true);
      }
    } catch {
      /* user gesture required or unsupported */
    }
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  if (authState === 'loading' || (authState === 'ready' && room.loading)) {
    return (
      <div className="community-chat-cast-page community-chat-cast-page--loading">
        <AppText as="p">{t('community_chat_cast_connecting', 'Connecting display…')}</AppText>
      </div>
    );
  }

  if (authState === 'error') {
    return (
      <div className="community-chat-cast-page community-chat-cast-page--error">
        <AppText as="h1">{t('community_chat_cast_title', 'Community chat display')}</AppText>
        <AppText as="p">{authError}</AppText>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="community-chat-cast-page"
      data-cchat-zone-theme={zoneThemeId}
      style={shellStyle}
      {...guestFrameShellAttrs}
    >
      <button
        type="button"
        className="community-chat-cast-page__fullscreen"
        onClick={toggleFullscreen}
        aria-label={
          fullscreen
            ? t('community_chat_cast_exit_fullscreen', 'Exit full screen')
            : t('community_chat_cast_fullscreen', 'Full screen')
        }
      >
        {fullscreen ? <FaCompress aria-hidden /> : <FaExpand aria-hidden />}
      </button>
      <CommunityChatCastView room={room} />
    </div>
  );
}
