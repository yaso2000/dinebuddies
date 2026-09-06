import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppText } from '../components/base';
import { useAuth } from '../context/AuthContext';
import './AppEntryIntro.css';

const INTRO_DONE_KEY = 'dineb_entry_intro_done';
/** How long the animated logo splash shows before the brand/join screen. */
const LOGO_INTRO_MS = 2000;

/**
 * App entry: animated logo splash (brand + bilingual tagline) → brand screen with
 * Join / Guest CTAs → login. No external video (fully owned, no watermarks).
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
  const [phase, setPhase] = useState('logo');
  const [guestBusy, setGuestBusy] = useState(false);

  // Auto-advance the logo splash to the brand/join screen.
  useEffect(() => {
    if (phase !== 'logo') return undefined;
    const timer = setTimeout(() => setPhase('brand'), LOGO_INTRO_MS);
    return () => clearTimeout(timer);
  }, [phase]);

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
      {phase === 'logo' ? (
        <button
          type="button"
          className="app-entry-intro__logo-stage"
          onClick={() => setPhase('brand')}
          aria-label={t('skip', 'Skip')}
        >
          <img
            src="/db-logo.svg"
            alt="DineBuddies"
            className="app-entry-intro__logo app-entry-intro__logo--intro"
            width={150}
            height={150}
          />
        </button>
      ) : (
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
      )}
    </div>
  );
}
