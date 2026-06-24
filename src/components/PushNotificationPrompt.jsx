import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  registerPushDeviceFromUserGesture,
  isIOS,
  isStandalonePwa,
  getPushCapabilitySnapshot,
  getDevicePushRegistrationStatus,
  describePushBlocker,
  getLastFcmRegistrationError,
  formatPushRegistrationError,
  warmupPushServiceWorker,
  runPushBootstrapWithRetries } from
'../services/notificationService';
import { useTranslation } from 'react-i18next';
import { FaBell, FaTimes } from 'react-icons/fa';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { AppText } from "./base";

function pushDismissKey(uid) {
  return `db:pushPromptDismissed:${uid}`;
}
function iosHomeHintDismissKey(uid) {
  return `db:iosAddToHomeHintDismissed:${uid}`;
}

/** install | allow | register */
function promptModeForEnv(permission, standalone, effectivelyRegistered) {
  if (isIOS() && !standalone) return 'install';
  if (permission === 'denied') return null;
  if (permission === 'default') return 'allow';
  if (permission === 'granted' && !effectivelyRegistered) return 'register';
  return null;
}

const PushNotificationPrompt = () => {
  const { currentUser, userProfile, isGuest } = useAuth();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptMode, setPromptMode] = useState(null);
  const [enableBusy, setEnableBusy] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [registerDetail, setRegisterDetail] = useState('');
  const [bootstrapReady, setBootstrapReady] = useState(false);

  const refreshPushState = useCallback(async () => {
    if (!currentUser?.uid || isGuest) return;
    const uid = currentUser.uid;
    const permission =
    typeof Notification !== 'undefined' ? Notification.permission : 'unavailable';
    const standalone = isStandalonePwa();
    const status = await getDevicePushRegistrationStatus(uid);
    setTokenCount(status.serverCount);

    const mode = promptModeForEnv(permission, standalone, status.effectivelyRegistered);
    if (!mode) {
      setShowPrompt(false);
      setPromptMode(null);
      return;
    }

    const pushDismissed = localStorage.getItem(pushDismissKey(uid)) === 'true';
    const iosHomeDismissed = localStorage.getItem(iosHomeHintDismissKey(uid)) === 'true';

    if (mode === 'install' && iosHomeDismissed) {
      setShowPrompt(false);
      return;
    }
    if ((mode === 'allow' || mode === 'register') && pushDismissed && status.effectivelyRegistered) {
      setShowPrompt(false);
      return;
    }
    if (mode === 'register' && pushDismissed && !status.effectivelyRegistered) {
      localStorage.removeItem(pushDismissKey(uid));
    }

    setPromptMode(mode);
    setShowPrompt(true);
  }, [currentUser?.uid, isGuest]);

  useEffect(() => {
    if (isGuest || !currentUser?.uid || !userProfile) {
      setBootstrapReady(false);
      return undefined;
    }

    if (import.meta.env.DEV && localStorage.getItem('DEBUG_PUSH') === '1') {
      console.log('[PushDebug]', getPushCapabilitySnapshot(currentUser.uid));
    }

    const uid = currentUser.uid;
    let cancelled = false;
    setBootstrapReady(false);

    if (
    isIOS() &&
    isStandalonePwa() &&
    localStorage.getItem(pushDismissKey(uid)) === 'true' &&
    !localStorage.getItem(iosHomeHintDismissKey(uid)) &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'default')
    {
      localStorage.removeItem(pushDismissKey(uid));
    }

    void (async () => {
      await runPushBootstrapWithRetries(uid);
      if (cancelled) return;
      setBootstrapReady(true);
      await refreshPushState();
    })();

    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      void (async () => {
        await runPushBootstrapWithRetries(uid, [0, 1200]);
        if (!cancelled) await refreshPushState();
      })();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [currentUser?.uid, isGuest, userProfile, refreshPushState]);

  const pushErrorMessage = (reason) => {
    const key = describePushBlocker(reason);
    if (key === 'ios_needs_home_screen') {
      return t(
        'ios_push_settings_hint',
        'On iPhone: Safari → Share → Add to Home Screen, then open DineBuddies from that icon.'
      );
    }
    if (key === 'missing_vapid') {
      return t('push_config_error', 'Push is not configured on this build. Contact support.');
    }
    if (key === 'permission_denied') {
      return t(
        'push_permission_denied_ios',
        'Notifications are blocked. iPhone Settings → Notifications → DineBuddies → Allow.'
      );
    }
    if (key === 'service_worker_not_ready' || reason === 'service_worker_reload') {
      return t(
        'push_sw_not_ready',
        'Almost ready — the app will refresh once, then tap Register again.'
      );
    }
    if (key === 'token_failed' || key === 'token_save_failed') {
      return t(
        'push_token_failed',
        'Could not register this device. Check your connection and try again.'
      );
    }
    return t(
      'push_register_failed',
      'Could not register this device. Open Settings → Notifications and try again.'
    );
  };

  const handleEnable = async () => {
    if (promptMode === 'install') {
      handleDismiss();
      return;
    }

    const uid = currentUser?.uid;
    if (!uid || enableBusy) return;

    setEnableBusy(true);
    setRegisterDetail('');

    try {
      const result = await registerPushDeviceFromUserGesture(uid, {
        requestPermissionIfNeeded: promptMode !== 'register'
      });

      if (result.reason === 'service_worker_reload') {
        return;
      }

      if (!result.ok) {
        const err = result.lastError || getLastFcmRegistrationError();
        const detail = formatPushRegistrationError(err);
        if (detail) setRegisterDetail(detail.slice(0, 160));
        showToast(pushErrorMessage(result.reason), 'error');
        void refreshPushState();
        return;
      }

      const status = await getDevicePushRegistrationStatus(uid);
      setTokenCount(status.serverCount);

      if (status.effectivelyRegistered) {
        localStorage.setItem(pushDismissKey(uid), 'true');
        showToast(
          t('notifications_enabled', 'Push notifications enabled for this device.'),
          'success'
        );
        setShowPrompt(false);
        return;
      }

      showToast(pushErrorMessage('token_save_failed'), 'error');
      setPromptMode('register');
      setShowPrompt(true);
    } catch (error) {
      const detail = formatPushRegistrationError(error);
      setRegisterDetail(detail.slice(0, 160));
      console.error('[FCM] handleEnable exception:', error);
      showToast(t('notifications_failed', 'Failed to enable notifications.'), 'error');
    } finally {
      setEnableBusy(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    const uid = currentUser?.uid;
    if (!uid) return;
    if (promptMode === 'install') {
      localStorage.setItem(iosHomeHintDismissKey(uid), 'true');
    } else {
      localStorage.setItem(pushDismissKey(uid), 'true');
    }
  };

  const openNotificationSettings = () => {
    handleDismiss();
    navigate('/settings/notifications');
  };

  if (!bootstrapReady || !showPrompt || !promptMode) return null;

  const title =
  promptMode === 'install' ?
  t('ios_push_title', 'Install to Get Notifications') :
  promptMode === 'register' ?
  t('push_finish_register_title', 'Finish Push Setup') :
  t('enable_push_title', 'Turn on Notifications');

  const desc =
  promptMode === 'install' ?
  t(
    'ios_push_desc',
    'On iPhone, tap Share below and choose “Add to Home Screen”. Open the app from that icon, then tap Enable again.'
  ) :
  promptMode === 'register' ?
  t(
    'push_finish_register_desc',
    'Notifications are allowed but this device is not registered yet. Tap below to complete setup.'
  ) :
  t(
    'enable_push_desc',
    'Tap Enable — iPhone will ask to allow alerts. Then lock the screen to receive them.'
  );

  const primaryLabel =
  promptMode === 'install' ?
  t('got_it', 'Got it') :
  enableBusy ?
  t('enabling', 'Enabling…') :
  promptMode === 'register' ?
  t('push_finish_register_button', 'Register this device') :
  t('enable', 'Enable');

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '20px',
        right: '20px',
        maxWidth: '400px',
        margin: '0 auto',
        background: 'var(--bg-card)',
        borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        padding: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        border: '1px solid var(--primary)',
        animation: 'slideUp 0.3s ease-out'
      }}>

            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
            style={{
              background: 'var(--hover-overlay)',
              padding: '10px',
              borderRadius: '50%',
              color: 'var(--primary)',
              flexShrink: 0
            }}>

                        <FaBell size={24} />
                    </div>
                    <div>
                        <AppText as="h4" style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', lineHeight: 1.2 }}>
                            {title}
                        </AppText>
                        <AppText as="p" style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                            {desc}
                        </AppText>
                        {promptMode === 'register' && tokenCount === 0 &&
            <AppText as="p" style={{ margin: '8px 0 0', fontSize: '0.78rem', color: '#f59e0b' }}>
                                {t('push_no_device_saved', 'No device token saved on the server yet.')}
                            </AppText>
            }
                        {registerDetail ?
            <AppText as="p" style={{ margin: '6px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {registerDetail}
                            </AppText> :
            null}
                    </div>
                </div>
                <button
          type="button"
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px'
          }}>

                    <FaTimes size={18} />
                </button>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                <button
          type="button"
          onClick={handleDismiss}
          style={{
            flex: 1,
            minWidth: '100px',
            padding: '10px',
            background: 'var(--bg-input)',
            border: 'none',
            borderRadius: '8px',
            color: 'var(--text-main)',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}>

                    {t('not_now', 'Not Now')}
                </button>
                <button
          type="button"
          onPointerDown={() => {
            if (promptMode !== 'install') warmupPushServiceWorker();
          }}
          onTouchStart={() => {
            if (promptMode !== 'install') warmupPushServiceWorker();
          }}
          onClick={promptMode === 'install' ? handleDismiss : () => void handleEnable()}
          disabled={enableBusy && promptMode !== 'install'}
          style={{
            flex: 1,
            minWidth: '100px',
            padding: '10px',
            background: 'var(--primary)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontWeight: 'bold',
            cursor: enableBusy ? 'wait' : 'pointer',
            opacity: enableBusy ? 0.85 : 1
          }}>

                    {primaryLabel}
                </button>
            </div>
            {(promptMode === 'register' || promptMode === 'allow') &&
      <button
        type="button"
        onClick={openNotificationSettings}
        style={{
          width: '100%',
          padding: '8px',
          background: 'transparent',
          border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
          borderRadius: '8px',
          color: 'var(--text-muted)',
          fontSize: '0.82rem',
          cursor: 'pointer'
        }}>

                    {t('open_notification_settings', 'Open notification settings')}
                </button>
      }
        </div>);

};

export default PushNotificationPrompt;