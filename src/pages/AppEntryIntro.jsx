import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaVolumeMute, FaVolumeUp } from 'react-icons/fa';
import { AppText } from '../components/base';
import { useAuth } from '../context/AuthContext';
import './AppEntryIntro.css';

const INTRO_DONE_KEY = 'dineb_entry_intro_done';
const INTRO_VIDEO_SRC = '/videos/never-dine-alone-1.mp4';
const VIDEO_FALLBACK_MS = 45000;

/**
 * App entry: never-dine-alone video → white brand screen with Join / Guest CTAs.
 */
export function hasCompletedAppEntryIntro() {
  try {
    return sessionStorage.getItem(INTRO_DONE_KEY) === '1';
  } catch {
    return false;
  }
}

function markIntroDone() {
  try {
    sessionStorage.setItem(INTRO_DONE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export default function AppEntryIntro() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { continueAsGuest } = useAuth();
  const videoRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  const brandShownRef = useRef(false);
  const showBrandRef = useRef(() => {});
  const [phase, setPhase] = useState('video');
  const [soundOn, setSoundOn] = useState(false);
  const [guestBusy, setGuestBusy] = useState(false);

  useEffect(() => {
    const showBrand = () => {
      if (brandShownRef.current) return;
      brandShownRef.current = true;
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      const video = videoRef.current;
      if (video) {
        try {
          video.pause();
        } catch {
          /* ignore */
        }
      }
      setPhase('brand');
    };

    showBrandRef.current = showBrand;

    const video = videoRef.current;
    if (!video) return undefined;

    const onEnded = () => showBrand();
    const onError = () => showBrand();
    const onLoadedMetadata = () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      const ms = Number.isFinite(video.duration)
        ? Math.min(VIDEO_FALLBACK_MS, Math.max(8000, video.duration * 1000 + 1500))
        : VIDEO_FALLBACK_MS;
      fallbackTimerRef.current = setTimeout(showBrand, ms);
    };

    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);
    video.addEventListener('loadedmetadata', onLoadedMetadata);

    const tryPlayWithSound = async () => {
      video.muted = false;
      video.volume = 1;
      try {
        await video.play();
        setSoundOn(true);
        return;
      } catch {
        /* Autoplay with sound blocked — fall back to muted. */
      }
      video.muted = true;
      try {
        await video.play();
        setSoundOn(false);
      } catch {
        showBrand();
      }
    };

    void tryPlayWithSound();
    fallbackTimerRef.current = setTimeout(showBrand, VIDEO_FALLBACK_MS);

    return () => {
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
  }, []);

  const toggleSound = async () => {
    const video = videoRef.current;
    if (!video || brandShownRef.current) return;
    const next = !soundOn;
    video.muted = !next;
    if (next) video.volume = 1;
    setSoundOn(next);
    if (video.paused) {
      try {
        await video.play();
      } catch {
        /* ignore */
      }
    }
  };

  const finishAndGo = (path) => {
    markIntroDone();
    navigate(path, { replace: true });
  };

  const onJoin = () => finishAndGo('/login');

  const onBrowseAsGuest = async () => {
    if (guestBusy) return;
    setGuestBusy(true);
    try {
      await continueAsGuest();
      finishAndGo('/posts-feed');
    } catch {
      setGuestBusy(false);
    }
  };

  return (
    <div
      className={`app-entry-intro app-entry-intro--${phase}`}
      role="dialog"
      aria-label={t('app_entry_intro_a11y', 'Welcome to DineBuddies')}
    >
      <div
        className={`app-entry-intro__video-stage${
          phase === 'brand' ? ' app-entry-intro__video-stage--exit' : ''
        }`}
        aria-hidden={phase === 'brand'}
      >
        <video
          ref={videoRef}
          className="app-entry-intro__video"
          playsInline
          preload="auto"
        >
          <source src={INTRO_VIDEO_SRC} type="video/mp4" />
        </video>

        {phase === 'video' ? (
          <>
            <button
              type="button"
              className="app-entry-intro__sound"
              onClick={toggleSound}
              aria-pressed={soundOn}
              aria-label={
                soundOn
                  ? t('mute', 'Mute')
                  : t('unmute', 'Unmute')
              }
            >
              {soundOn ? <FaVolumeUp aria-hidden /> : <FaVolumeMute aria-hidden />}
              {!soundOn ? (
                <AppText as="span" className="app-entry-intro__sound-hint">
                  {t('tap_for_sound', 'Tap for sound')}
                </AppText>
              ) : null}
            </button>
            <button
              type="button"
              className="app-entry-intro__skip"
              onClick={() => showBrandRef.current()}
            >
              <AppText as="span">{t('skip', 'Skip')}</AppText>
            </button>
          </>
        ) : null}
      </div>

      {phase === 'brand' ? (
        <div className="app-entry-intro__brand">
          <img
            src="/db-logo.svg"
            alt=""
            className="app-entry-intro__logo"
            width={88}
            height={88}
          />
          <AppText as="h1" className="app-entry-intro__title">
            DineBuddies
          </AppText>
          <AppText as="p" className="app-entry-intro__tag">
            {t('app_tagline', 'Never Dine Alone')}
          </AppText>
          <div className="app-entry-intro__cta-actions">
            <button
              type="button"
              className="app-entry-intro__btn app-entry-intro__btn--primary"
              onClick={onJoin}
            >
              <AppText as="span">{t('join', 'Join')}</AppText>
            </button>
            <button
              type="button"
              className="app-entry-intro__btn app-entry-intro__btn--ghost"
              onClick={onBrowseAsGuest}
              disabled={guestBusy}
            >
              <AppText as="span">
                {t('continue_as_guest', 'Continue as guest')}
              </AppText>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
