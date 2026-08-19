import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaDownload, FaTimes } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { isIOS } from '../services/notificationService';
import { getRuntime } from '../platform/runtime';

function dismissKey(uid) {
  return `db:installBannerDismissed:${uid}`;
}

function isStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

/**
 * General, dismissible "Install the app" bar shown after login — direct one-tap
 * install on Android/Desktop Chrome/Edge, Add-to-Home-Screen steps on iOS.
 */
const InstallAppBanner = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { currentUser, userProfile, isGuest } = useAuth();
  const opaqueSurface = isDark ? '#1e1e2e' : '#ffffff';
  const [dismissed, setDismissed] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(window.__deferredInstallPrompt || null);
  const [installing, setInstalling] = useState(false);

  const uid = currentUser?.uid || currentUser?.id;

  useEffect(() => {
    if (!uid) return undefined;
    try {
      setDismissed(localStorage.getItem(dismissKey(uid)) === 'true');
    } catch {
      setDismissed(false);
    }
    return undefined;
  }, [uid]);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      window.__deferredInstallPrompt = e;
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!currentUser || !userProfile || isGuest || dismissed || isStandaloneMode()) return null;
  if (getRuntime().isNative) return null;

  const iosDevice = isIOS();

  const handleDismiss = () => {
    setDismissed(true);
    if (uid) {
      try {
        localStorage.setItem(dismissKey(uid), 'true');
      } catch {
        /* ignore */
      }
    }
  };

  const handleInstall = async () => {
    const ev = deferredPrompt || window.__deferredInstallPrompt;
    if (!ev) return;
    setInstalling(true);
    try {
      await ev.prompt();
      const { outcome } = await ev.userChoice;
      window.__deferredInstallPrompt = null;
      setDeferredPrompt(null);
      if (outcome === 'accepted') handleDismiss();
    } catch {
      /* ignore */
    } finally {
      setInstalling(false);
    }
  };

  const desc = iosDevice
    ? t('install_banner_ios_desc', 'Tap Share ↗️ then "Add to Home Screen" for the full app experience.')
    : deferredPrompt
      ? t('install_banner_install_desc', 'Faster loading and a smoother experience — install with one tap.')
      : t('install_banner_generic_desc', 'Open the browser menu (⋮) and choose "Add to Home Screen".');

  return (
    <div
      style={{
        backgroundColor: opaqueSurface,
        backgroundImage: 'linear-gradient(135deg, rgba(232, 110, 46, 0.18), rgba(139, 92, 246, 0.1))',
        border: '1px solid rgba(232, 110, 46, 0.4)',
        borderLeft: '4px solid #E86E2E',
        margin: '16px 16px 0 16px',
        padding: '14px 16px',
        borderRadius: '14px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '12px',
        position: 'sticky',
        top: 0,
        zIndex: 100050,
        isolation: 'isolate',
        pointerEvents: 'auto',
        boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
      }}
    >
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
        <div
          style={{
            background: 'rgba(232, 110, 46, 0.15)',
            padding: '10px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <FaDownload style={{ color: '#E86E2E', fontSize: '1.15rem' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>
            {t('install_banner_title', 'Install DineBuddies')}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</div>
          {!iosDevice && deferredPrompt ? (
            <button
              type="button"
              disabled={installing}
              onClick={handleInstall}
              style={{
                marginTop: '10px',
                padding: '9px 16px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #E86E2E, #f59e0b)',
                color: '#fff',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: installing ? 'wait' : 'pointer',
                opacity: installing ? 0.8 : 1,
              }}
            >
              {installing ? t('installing', 'Installing…') : t('install_app', 'Install App')}
            </button>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: '6px',
          borderRadius: '50%',
          flexShrink: 0,
        }}
        title={t('dismiss', 'Dismiss')}
      >
        <FaTimes size={16} />
      </button>
    </div>
  );
};

export default InstallAppBanner;
