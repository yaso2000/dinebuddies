import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AppText } from "./base";

const MOBILE_MAX = '(max-width: 768px)';
const LS_DISMISS = 'installPromptDismissed';

function isStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true);

}

function detectIOS() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPod/i.test(ua)) return true;
  if (/iPad/i.test(ua)) return true;
  // iPadOS 13+ desktop mode
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  return false;
}

/**
 * Mobile-only floating modal: asks to install the PWA for a better experience.
 * - Android (Chrome/Edge): one-tap Install when `beforeinstallprompt` is available.
 * - iOS Safari: short manual steps (no programmatic install).
 */
const InstallPrompt = () => {
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_MAX).matches);
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  /** 'install' = native prompt; 'ios' = manual steps */
  const [mode, setMode] = useState(null);

  const dismissed = useCallback(() => {
    try {
      return localStorage.getItem(LS_DISMISS) === 'true';
    } catch {
      return false;
    }
  }, []);

  const dismissForever = useCallback(() => {
    try {
      localStorage.setItem(LS_DISMISS, 'true');
    } catch {/* ignore */}
    setVisible(false);
    setMode(null);
    setDeferredPrompt(null);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MAX);
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (visible) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return undefined;
  }, [visible]);

  // `beforeinstallprompt` — mostly Android Chrome / Edge (mobile)
  useEffect(() => {
    if (isStandaloneMode() || dismissed() || !isMobile) return undefined;

    if (window.__deferredInstallPrompt && !dismissed()) {
      setDeferredPrompt(window.__deferredInstallPrompt);
      setMode('install');
      setVisible(true);
    }

    const handler = (e) => {
      if (dismissed()) return;
      e.preventDefault();
      window.__deferredInstallPrompt = e;
      setDeferredPrompt(e);
      setMode('install');
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isMobile, dismissed]);

  // iOS: no beforeinstallprompt — show short instructions after a brief delay
  useEffect(() => {
    if (isStandaloneMode() || dismissed() || !isMobile || !detectIOS()) return undefined;

    const t = window.setTimeout(() => {
      if (isStandaloneMode() || dismissed() || !window.matchMedia(MOBILE_MAX).matches) return;
      if (window.__deferredInstallPrompt) return;
      setMode('ios');
      setVisible(true);
    }, 1400);

    return () => window.clearTimeout(t);
  }, [isMobile, dismissed]);

  // Hide when switching to desktop width
  useEffect(() => {
    if (!isMobile && visible) {
      setVisible(false);
      setMode(null);
    }
  }, [isMobile, visible]);

  const handleInstall = async () => {
    const ev = deferredPrompt || window.__deferredInstallPrompt;
    if (!ev) return;
    try {
      await ev.prompt();
      const { outcome } = await ev.userChoice;
      setDeferredPrompt(null);
      window.__deferredInstallPrompt = null;
      setVisible(false);
      setMode(null);
      if (outcome === 'dismissed') {
        try {
          localStorage.setItem(LS_DISMISS, 'true');
        } catch {/* ignore */}
      }
    } catch {
      dismissForever();
    }
  };

  if (!visible || !isMobile || isStandaloneMode()) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)'
      }}
      onClick={dismissForever}
      onKeyDown={(e) => {
        if (e.key === 'Escape') dismissForever();
      }}>
      
            <div
        style={{
          width: '100%',
          maxWidth: '360px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '20px',
          padding: '1.25rem 1.15rem 1.1rem',
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
          animation: 'installModalIn 0.28s ease'
        }}
        onClick={(e) => e.stopPropagation()}>
        
                <style>{`
                    @keyframes installModalIn {
                        from { opacity: 0; transform: scale(0.96) translateY(8px); }
                        to { opacity: 1; transform: scale(1) translateY(0); }
                    }
                `}</style>

                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
                    <img
            src="/icon-light-192.png"
            alt=""
            width={48}
            height={48}
            style={{ borderRadius: '12px', flexShrink: 0 }} />
          
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <AppText as="h2"
            id="install-modal-title"
            style={{
              margin: 0,
              fontSize: '1.05rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              lineHeight: 1.25
            }}>
              
                            {t('install_modal_title', 'Install DineBuddies')}
                        </AppText>
                        <AppText as="p" style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                            {t('install_modal_subtitle', 'Add to your home screen for faster loading and a smoother experience.')}
                        </AppText>
                    </div>
                </div>

                {mode === 'install' && deferredPrompt &&
        <button
          type="button"
          onClick={handleInstall}
          style={{
            width: '100%',
            padding: '0.85rem',
            border: 'none',
            borderRadius: '14px',
            background: 'var(--primary)',
            color: '#fff',
            fontWeight: 800,
            fontSize: '0.95rem',
            cursor: 'pointer',
            marginBottom: '0.65rem'
          }}>
          
                        {t('install_modal_install_cta', 'Install')}
                    </button>
        }

                {mode === 'ios' &&
        <ol
          style={{
            margin: '0 0 0.9rem',
            paddingLeft: '1.2rem',
            fontSize: '0.84rem',
            color: 'var(--text-main)',
            lineHeight: 1.55
          }}>
          
                        <li style={{ marginBottom: '0.45rem' }}>
                            {t('install_modal_ios_step1', 'Tap Share ↗️ (Safari toolbar).')}
                        </li>
                        <li>{t('install_modal_ios_step2', 'Tap “Add to Home Screen”, then Add.')}</li>
                    </ol>
        }

                <button
          type="button"
          onClick={dismissForever}
          style={{
            width: '100%',
            padding: '0.65rem',
            border: 'none',
            borderRadius: '12px',
            background: 'var(--bg-input)',
            color: 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer'
          }}>
          
                    {t('install_modal_not_now', 'Not now')}
                </button>
            </div>
        </div>);

};

export default InstallPrompt;