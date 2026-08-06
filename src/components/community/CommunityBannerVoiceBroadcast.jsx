import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaMicrophone, FaRedoAlt, FaTimes, FaVolumeMute, FaVolumeUp } from 'react-icons/fa';
import { AppText } from '../base';
import { formatDuration } from '../../utils/mediaUtils';
import { BANNER_VOICE_LOCAL_PLAY_EVENT } from '../../utils/bannerVoiceLocalPlay';
import {
  clearBannerVoiceAudioPriority,
  setBannerVoiceAudioPriority,
} from '../../utils/bannerVoiceAudioPriority';
import './CommunityBannerVoiceBroadcast.css';

/**
 * Auto-playing host voice broadcast on the top banner with a pulse visualizer.
 * Plays once by default; host can enable repeat after publish.
 * Host hears via immediate local blob playback after stop (gesture-safe).
 */
export default function CommunityBannerVoiceBroadcast({
  voiceUrl,
  voiceUpdatedAt = 0,
  voiceDurationSec = 0,
  voiceLoop = false,
  isHost = false,
  playbackEnabled = true,
  onClear,
  onToggleLoop,
}) {
  const { t } = useTranslation();
  const audioRef = useRef(null);
  const playedKeyRef = useRef('');
  const localPreviewActiveRef = useRef(false);
  const pendingRemoteUrlRef = useRef('');
  const localObjectUrlRef = useRef('');

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [hasLocalPreview, setHasLocalPreview] = useState(false);

  const url = String(voiceUrl || '').trim();
  const playKey = url ? `${url}|${voiceUpdatedAt || 0}` : '';
  const visible = Boolean(url || hasLocalPreview || playing || needsGesture);

  const revokeLocalObjectUrl = useCallback(() => {
    const localUrl = localObjectUrlRef.current;
    if (localUrl) {
      try {
        URL.revokeObjectURL(localUrl);
      } catch {
        /* ignore */
      }
      localObjectUrlRef.current = '';
    }
  }, []);

  const tryPlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !playbackEnabled) return false;
    if (!audio.getAttribute('src') && !audio.src) return false;
    try {
      audio.muted = muted;
      await audio.play();
      setPlaying(true);
      setNeedsGesture(false);
      return true;
    } catch {
      setNeedsGesture(true);
      setPlaying(false);
      return false;
    }
  }, [muted, playbackEnabled]);

  const playFromSource = useCallback(
    async (sourceUrl, { isLocalPreview = false } = {}) => {
      const audio = audioRef.current;
      const src = String(sourceUrl || '').trim();
      if (!audio || !src || !playbackEnabled) return false;
      audio.pause();
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      audio.src = src;
      audio.currentTime = 0;
      audio.load();
      localPreviewActiveRef.current = Boolean(isLocalPreview);
      setHasLocalPreview(Boolean(isLocalPreview));

      // iOS often rejects play() before the blob/remote buffer is ready.
      await new Promise((resolve) => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          audio.removeEventListener('canplay', done);
          audio.removeEventListener('loadeddata', done);
          resolve();
        };
        audio.addEventListener('canplay', done);
        audio.addEventListener('loadeddata', done);
        window.setTimeout(done, 700);
      });

      return tryPlay();
    },
    [playbackEnabled, tryPlay]
  );

  useEffect(() => {
    if (!playKey || !playbackEnabled) {
      if (!localPreviewActiveRef.current) {
        const audio = audioRef.current;
        if (audio && !hasLocalPreview) {
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
        }
        if (!hasLocalPreview) {
          setPlaying(false);
          setNeedsGesture(false);
          playedKeyRef.current = '';
          pendingRemoteUrlRef.current = '';
        }
      }
      return undefined;
    }

    if (playedKeyRef.current === playKey) return undefined;

    if (isHost && localPreviewActiveRef.current) {
      playedKeyRef.current = playKey;
      pendingRemoteUrlRef.current = url;
      return undefined;
    }

    playedKeyRef.current = playKey;
    pendingRemoteUrlRef.current = '';
    void playFromSource(url, { isLocalPreview: false });
    return undefined;
  }, [hasLocalPreview, isHost, playFromSource, playKey, playbackEnabled, url]);

  useEffect(() => {
    if (!isHost) return undefined;

    const onLocalPlay = (event) => {
      const previewUrl = String(event?.detail?.previewUrl || '').trim();
      if (!previewUrl) return;
      revokeLocalObjectUrl();
      localObjectUrlRef.current = previewUrl;
      pendingRemoteUrlRef.current = url || '';
      void playFromSource(previewUrl, { isLocalPreview: true });
    };

    window.addEventListener(BANNER_VOICE_LOCAL_PLAY_EVENT, onLocalPlay);
    return () => window.removeEventListener(BANNER_VOICE_LOCAL_PLAY_EVENT, onLocalPlay);
  }, [isHost, playFromSource, revokeLocalObjectUrl, url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.muted = muted;
  }, [muted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.loop = Boolean(voiceLoop);
    if (voiceLoop && playbackEnabled && audio.paused && !needsGesture && (audio.src || url)) {
      if (audio.ended || audio.currentTime === 0 || audio.currentTime >= (audio.duration || 0) - 0.05) {
        const nextSrc = pendingRemoteUrlRef.current || url || audio.src;
        if (nextSrc) {
          void playFromSource(nextSrc, { isLocalPreview: false });
        }
      }
    }
  }, [needsGesture, playFromSource, playbackEnabled, url, voiceLoop]);

  useEffect(() => () => revokeLocalObjectUrl(), [revokeLocalObjectUrl]);

  useEffect(() => {
    if (!url && !hasLocalPreview) {
      setBannerVoiceAudioPriority('playback', false);
    }
  }, [hasLocalPreview, url]);

  useEffect(
    () => () => {
      setBannerVoiceAudioPriority('playback', false);
    },
    []
  );

  if (!isHost && !url) return null;

  const handleActivate = () => {
    if (needsGesture || !playing) {
      setMuted(false);
      const nextSrc = pendingRemoteUrlRef.current || url || audioRef.current?.src;
      if (nextSrc && audioRef.current && !playing) {
        void playFromSource(nextSrc, { isLocalPreview: false });
        return;
      }
      void tryPlay();
      return;
    }
    setMuted((prev) => !prev);
  };

  const handleEnded = () => {
    if (voiceLoop) {
      const remote = pendingRemoteUrlRef.current || url;
      localPreviewActiveRef.current = false;
      setHasLocalPreview(false);
      setBannerVoiceAudioPriority('playback', true);
      if (remote) {
        revokeLocalObjectUrl();
        void playFromSource(remote, { isLocalPreview: false });
      }
      return;
    }
    localPreviewActiveRef.current = false;
    setHasLocalPreview(false);
    if (pendingRemoteUrlRef.current && audioRef.current) {
      const remote = pendingRemoteUrlRef.current;
      pendingRemoteUrlRef.current = '';
      audioRef.current.src = remote;
      audioRef.current.load();
      revokeLocalObjectUrl();
    } else {
      revokeLocalObjectUrl();
    }
    setPlaying(false);
    setBannerVoiceAudioPriority('playback', false);
  };

  const handleClear = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    localPreviewActiveRef.current = false;
    setHasLocalPreview(false);
    setPlaying(false);
    revokeLocalObjectUrl();
    clearBannerVoiceAudioPriority();
    void onClear?.();
  };

  return (
    <div
      className={`community-banner-voice${playing ? ' community-banner-voice--playing' : ''}${needsGesture ? ' community-banner-voice--needs-tap' : ''}${muted ? ' community-banner-voice--muted' : ''}${voiceLoop ? ' community-banner-voice--loop' : ''}${visible ? '' : ' community-banner-voice--idle-host'}`}
      role="group"
      aria-label={t('community_banner_voice_label', 'Host voice message')}
      aria-hidden={visible ? undefined : true}
    >
      <audio
        ref={audioRef}
        preload="auto"
        playsInline
        webkit-playsinline="true"
        x-webkit-airplay="allow"
        loop={Boolean(voiceLoop)}
        onPlay={() => {
          setPlaying(true);
          setNeedsGesture(false);
          setBannerVoiceAudioPriority('playback', true);
        }}
        onPause={() => {
          setPlaying(false);
          // Source swaps call pause briefly — only release if truly idle.
          const audio = audioRef.current;
          if (!audio || audio.ended || !audio.src) {
            setBannerVoiceAudioPriority('playback', false);
          }
        }}
        onEnded={handleEnded}
      />

      {visible ? (
        <>
          <button
            type="button"
            className="community-banner-voice__pulse"
            onClick={handleActivate}
            aria-label={
              needsGesture
                ? t('community_banner_voice_tap_to_hear', 'Tap to hear host')
                : muted
                  ? t('community_banner_voice_unmute', 'Unmute host voice')
                  : t('community_banner_voice_mute', 'Mute host voice')
            }
            title={
              needsGesture
                ? t('community_banner_voice_tap_to_hear', 'Tap to hear host')
                : muted
                  ? t('community_banner_voice_unmute', 'Unmute host voice')
                  : t('community_banner_voice_mute', 'Mute host voice')
            }
          >
            <span className="community-banner-voice__ring" aria-hidden />
            <span className="community-banner-voice__ring community-banner-voice__ring--delay" aria-hidden />
            <span className="community-banner-voice__icon" aria-hidden>
              {muted || needsGesture ? <FaVolumeMute size={16} /> : <FaVolumeUp size={16} />}
            </span>
            <span className="community-banner-voice__bars" aria-hidden>
              <span className="community-banner-voice__bar" />
              <span className="community-banner-voice__bar" />
              <span className="community-banner-voice__bar" />
              <span className="community-banner-voice__bar" />
              <span className="community-banner-voice__bar" />
            </span>
          </button>

          <div className="community-banner-voice__meta">
            <FaMicrophone size={11} aria-hidden />
            <AppText as="span">
              {needsGesture
                ? t('community_banner_voice_tap_short', 'Tap to hear')
                : playing
                  ? voiceLoop
                    ? t('community_banner_voice_looping', 'Repeating')
                    : t('community_banner_voice_live', 'Host speaking')
                  : t('community_banner_voice_ready', 'Host voice')}
            </AppText>
            {voiceDurationSec > 0 ? (
              <AppText as="span" className="community-banner-voice__duration">
                {formatDuration(voiceDurationSec)}
              </AppText>
            ) : null}
          </div>

          {isHost ? (
            <div className="community-banner-voice__actions">
              {typeof onToggleLoop === 'function' && url ? (
                <button
                  type="button"
                  className={`community-banner-voice__loop${voiceLoop ? ' community-banner-voice__loop--on' : ''}`}
                  aria-label={
                    voiceLoop
                      ? t('community_banner_voice_loop_disable', 'Stop repeating')
                      : t('community_banner_voice_loop_enable', 'Repeat voice')
                  }
                  title={
                    voiceLoop
                      ? t('community_banner_voice_loop_disable', 'Stop repeating')
                      : t('community_banner_voice_loop_enable', 'Repeat voice')
                  }
                  aria-pressed={Boolean(voiceLoop)}
                  onClick={() => void onToggleLoop(!voiceLoop)}
                >
                  <FaRedoAlt size={13} aria-hidden />
                </button>
              ) : null}
              {typeof onClear === 'function' && url ? (
                <button
                  type="button"
                  className="community-banner-voice__clear"
                  aria-label={t('community_banner_voice_clear', 'Remove voice message')}
                  title={t('community_banner_voice_clear', 'Remove voice message')}
                  onClick={handleClear}
                >
                  <FaTimes size={13} aria-hidden />
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
