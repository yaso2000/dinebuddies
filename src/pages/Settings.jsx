import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { getSafeAvatar } from '../utils/avatarUtils';
import { useTranslation } from 'react-i18next';
import { auth, db } from '../firebase/config';
import { doc, deleteDoc } from 'firebase/firestore';
import { FaArrowLeft, FaUser, FaEnvelope, FaLock, FaBell, FaShieldAlt, FaSignOutAlt, FaTrash, FaStore, FaChevronRight, FaFileContract, FaMoon, FaSun, FaUsers, FaDownload, FaQuestionCircle, FaBan, FaCrown, FaCreditCard, FaFileInvoice, FaWallet, FaBullhorn, FaUserClock, FaChild, FaHeart } from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext';
import './Settings.css';
import { goToLogin } from '../utils/goToLogin';
import AppBackButton from '../components/AppBackButton';
import { APP_HOME_PATH } from '../utils/appRouteShell';
import { normalizeBusinessTier, getBusinessSubscriptionAccess } from '../utils/businessSubscription';
import { BUSINESS_PAID_PLAN_DISPLAY } from '../config/stripeCommerce';
import {
  getLanguageFlag,
  getLanguageNativeLabel,
  resolveLanguageCode } from
'../constants/languageOptions';
import { getSpendableCredits } from '../utils/walletCredits';
import { getRuntime } from '../platform/runtime';
import { AppText, AppTextInput } from "../components/base";

const BUSINESS_PAID_MONTHLY_USD = Number(String(BUSINESS_PAID_PLAN_DISPLAY.priceLabel).replace(/[^\d.]/g, '')) || 29;

const Settings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, userProfile, deactivateMyAccount, requestAccountDeletion, isBusiness, signOut } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const { t, i18n } = useTranslation();
  const { isDark, toggleTheme } = useTheme();
  const currentLanguageCode = resolveLanguageCode(i18n.language);
  const currentLanguageFlag = getLanguageFlag(currentLanguageCode);
  const currentLanguageLabel = getLanguageNativeLabel(currentLanguageCode, t);

  const [deleting, setDeleting] = useState(false);
  const [freezing, setFreezing] = useState(false);

  // Native (Capacitor) app is already installed — the PWA "install" row is web-only.
  const isNativeApp = getRuntime().isNative;
  const isStandalone = isNativeApp || window.matchMedia('(display-mode: standalone)').matches;
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  useEffect(() => {
    if (location.state?.passwordUpdated) {
      showToast(t('password_updated_success', 'Password updated successfully!'), 'success');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, showToast, t]);

  const handleInstallApp = async () => {
    if (window.__deferredInstallPrompt) {
      window.__deferredInstallPrompt.prompt();
      const { outcome } = await window.__deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') window.__deferredInstallPrompt = null;
    } else if (isIOS) {
      showToast(t('pwa_install_ios_toast', 'Tap the Share button ↗️ then "Add to Home Screen"'), 'info');
    } else {
      showToast(t('pwa_install_android_toast', 'Open this page in Chrome and tap ⋮ then "Add to Home Screen"'), 'info');
    }
  };

  // No redirect: show same Settings page on desktop (responsive); business uses dashboard for other things


  const handleLogout = async () => {
    // Guard against accidental sign-outs (raised in closed testing feedback).
    const ok = await confirm({
      title: t('logout_confirm_title', 'Log out?'),
      message: t('logout_confirm_message', 'You will need to sign in again to use your account.'),
      confirmLabel: t('logout', 'Log Out'),
      cancelLabel: t('cancel', 'Cancel'),
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await signOut('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      showToast(t('logout_failed', 'Failed to log out. Please try again.'), 'error');
    }
  };

  // Freeze (deactivate): hide the account entirely; data + credits preserved.
  const handleFreezeAccount = async () => {
    const ok = await confirm({
      title: t('freeze_account_title', 'Freeze account'),
      message: t(
        'freeze_account_message',
        'Your profile will be hidden from everyone. Your data and credits stay safe — log back in any time to reactivate.'
      ),
      confirmLabel: t('freeze_account_cta', 'Freeze account'),
      cancelLabel: t('cancel', 'Cancel'),
      tone: 'danger',
    });
    if (!ok) return;
    try {
      setFreezing(true);
      await deactivateMyAccount();
      await signOut('/login');
    } catch (error) {
      console.error('[freezeAccount]', error);
      showToast(t('freeze_account_failed', 'Could not freeze account. Please try again.'), 'error');
      setFreezing(false);
    }
  };

  // Delete: 30-day grace (hidden now, purged after 30 days unless the user logs back in).
  const handleDeleteAccount = async () => {
    const credits = getSpendableCredits(userProfile);
    const creditsWarn =
      credits > 0
        ? '\n\n' +
          t('delete_credits_warning', {
            defaultValue: '⚠️ You have {{n}} credits that will be permanently lost.',
            n: credits,
          })
        : '';
    const ok = await confirm({
      title: t('delete_account_confirm', 'Delete Account'),
      message:
        t(
          'delete_account_soft_message',
          'Your account will be hidden now and permanently deleted after 30 days. Log in any time within 30 days to cancel and restore everything.'
        ) + creditsWarn,
      confirmLabel: t('delete_account_confirm', 'Delete Account'),
      cancelLabel: t('cancel', 'Cancel'),
      tone: 'danger',
    });
    if (!ok) return;
    try {
      setDeleting(true);
      await requestAccountDeletion();
      await signOut('/login');
    } catch (error) {
      console.error('[requestAccountDeletion]', error);
      showToast(t('failed_delete_account', 'Failed to delete account. Please try again.'), 'error');
      setDeleting(false);
    }
  };

  const settingsSections = [
  {
    title: t('settings_account', 'Account'),
    items: [
    {
      icon: <FaEnvelope />,
      label: t('email', 'Email'),
      value: currentUser?.email || 'Not set',
      onClick: () => navigate('/settings/email'),
      color: '#3b82f6'
    },
    {
      icon: <FaLock />,
      label: t('password', 'Password'),
      value: '••••••••',
      onClick: () => navigate('/settings/password'),
      color: '#8b5cf6'
    }]

  },
  {
    title: t('settings_preferences', 'Preferences'),
    items: [
    {
      icon: <FaBell />,
      label: t('notifications', 'Notifications'),
      value: t('enabled', 'Enabled'),
      onClick: () => navigate('/settings/notifications'),
      color: '#f59e0b'
    },
    {
      flag: currentLanguageFlag,
      label: t('language', 'Language'),
      value: currentLanguageLabel,
      onClick: () => navigate('/settings/language'),
      color: '#10b981'
    },
    {
      icon: isDark ? <FaMoon /> : <FaSun />,
      label: t('appearance', 'Appearance'),
      value: isDark ? t('dark_mode', 'Dark Mode') : t('light_mode', 'Light Mode'),
      onClick: toggleTheme,
      color: isDark ? '#8b5cf6' : '#f59e0b'
    },
    ...(!isStandalone ? [{
      icon: <FaDownload />,
      label: t('install_app', 'Install App'),
      value: isIOS ? t('install_ios_desc', 'Tap Share → Add to Home Screen') : t('install_android_desc', 'Add to your home screen'),
      onClick: handleInstallApp,
      color: '#E86E2E'
    }] : [])]

  },
  {
    title: t('settings_privacy', 'Privacy & Security'),
    items: [
    // Personal privacy (age/dating/visibility) does not apply to a business —
    // a business only shows or hides its listing (from the dashboard).
    ...(!isBusiness ? [{
      icon: <FaShieldAlt />,
      label: t('privacy_settings', 'Privacy Settings'),
      value: t('public', 'Public'),
      onClick: () => navigate('/settings/privacy'),
      color: '#06b6d4'
    }] : []),
    {
      icon: <FaBan />,
      label: t('settings_blocked_users', 'Blocked users'),
      value:
      Array.isArray(userProfile?.blockedUserIds) && userProfile.blockedUserIds.length > 0 ?
      String(userProfile.blockedUserIds.length) :
      t('none', 'None'),
      onClick: () => navigate('/settings/blocked-users'),
      color: '#b91c1c'
    },
    // Declined social invitations — consumer-only.
    ...(!isBusiness ? [{
      icon: <FaUserClock />,
      label: t('settings_declined_invitations', 'Declined invitations'),
      onClick: () => navigate('/settings/declined-invitations'),
      color: '#8b5cf6'
    }] : [])]

  },
  {
    title: t('settings_about', 'About & Legal'),
    items: [
    {
      icon: <FaQuestionCircle />,
      label: t('help_and_support', 'Help & Support'),
      onClick: () => navigate('/support'),
      color: '#eab308'
    },
    {
      icon: <FaShieldAlt />,
      label: t('privacy_policy', 'Privacy Policy'),
      onClick: () => navigate('/privacy'),
      color: '#10b981'
    },
    {
      icon: <FaFileContract />,
      label: t('terms_of_service', 'Terms of Service'),
      onClick: () => navigate('/terms'),
      color: '#3b82f6'
    },
    {
      icon: <FaUsers />,
      label: t('community_guidelines', 'Community Guidelines'),
      onClick: () => navigate('/guidelines'),
      color: '#8b5cf6'
    },
    {
      icon: <FaChild />,
      label: t('child_safety_standards', 'Child Safety Standards'),
      onClick: () => navigate('/child-safety'),
      color: '#f97316'
    },
    {
      icon: <FaTrash />,
      label: t('account_deletion_request', 'Account Deletion Request'),
      onClick: () => navigate('/account-deletion'),
      color: '#ef4444'
    }]

  }];


  // Add Business Profile link for business accounts
  if (isBusiness) {
    const bizTier = getBusinessSubscriptionAccess(userProfile?.subscriptionTier);
    settingsSections.unshift({
      title: t('business', 'Business'),
      items: [
      {
        icon: <FaStore />,
        label: t('my_business_profile', 'My Business Profile'),
        value: t('view_edit_inline', 'View & edit inline'),
        onClick: () => navigate(`/business/${currentUser?.uid}`),
        color: '#f97316'
      },
      {
        icon: <FaBullhorn />,
        label: t('business_member_notifications', 'Member alerts & offers'),
        value: bizTier.canUseMemberNotifications ?
        t('enabled', 'Enabled') :
        t('paid_plan', 'Paid'),
        onClick: () => navigate('/business-dashboard/inbox'),
        color: '#ec4899'
      }]

    });
  }


  // Business: subscription + billing (matches prod: Business plan, payment, billing) + Dine Credits wallet
  if (isBusiness) {
    const normalizedBiz = normalizeBusinessTier(userProfile?.subscriptionTier);
    const isPaidBiz = normalizedBiz === 'paid';
    const planValue = isPaidBiz ?
    t('settings_business_plan_value_paid', 'Paid (${{amount}}/mo)', {
      amount: BUSINESS_PAID_MONTHLY_USD
    }) :
    t('settings_business_plan_value_free', 'Free');

    settingsSections.unshift({
      title: t('subscription_billing', 'Subscription & Billing'),
      items: [
      {
        icon: <FaCrown />,
        label: t('settings_business_plan_row', 'Business plan'),
        value: planValue,
        onClick: () => navigate('/settings/subscription'),
        color: '#f59e0b',
        badge: isPaidBiz ? null : t('upgrade_available', 'Upgrade Available')
      },
      {
        icon: <FaCreditCard />,
        label: t('payment_method', 'Payment Method'),
        value: userProfile?.paymentMethod || t('not_set', 'Not set'),
        onClick: () => navigate('/settings/payment'),
        color: '#3b82f6'
      },
      {
        icon: <FaFileInvoice />,
        label: t('billing_history', 'Billing History'),
        value: '',
        onClick: () => navigate('/settings/billing'),
        color: '#10b981'
      }]

    });
    settingsSections.splice(1, 0, {
      title: t('dine_credits_section', 'Dine Credits'),
      items: [
      {
        icon: <FaWallet />,
        label: t('wallet', 'Wallet'),
        value: '',
        onClick: () => navigate('/settings/credits'),
        color: '#0ea5e9'
      }]

    });
  }

  if (!isBusiness) {
    const creditTotal = getSpendableCredits(userProfile);
    settingsSections.unshift({
      title: t('subscription_billing', 'Subscription & Billing'),
      items: [
      {
        icon: '💎',
        label: t('dine_credits', 'Dine Credits'),
        value: String(creditTotal),
        onClick: () => navigate('/settings/credits'),
        color: '#0ea5e9'
      },
      {
        icon: <FaCreditCard />,
        label: t('payment_methods', 'Payment Methods'),
        value: t('view_inline', 'View'),
        onClick: () => navigate('/settings/payment-methods'),
        color: '#8b5cf6'
      }]

    });
  }

  // Check if user is guest (unified flag)
  const isGuest = userProfile?.isGuest || false;


  // Guest View - Prompt to Sign In
  if (isGuest) {
    return (
      <div className="page-container" style={{ paddingBottom: '100px' }}>
                {/* Header */}
                <header className="app-header sticky-header-glass">
                    <AppBackButton fallback={APP_HOME_PATH} />
                    <AppText as="h3" style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>
                        ⚙️ {t('settings_title_page', 'Settings')}
                    </AppText>
                    <div style={{ width: '40px' }}></div>
                </header>

                {/* Guest Message Card */}
                <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '2rem'
        }}>
                    <div className="ui-prompt ui-prompt--standalone" style={{
            background: 'linear-gradient(135deg, var(--primary), var(--luxury-gold))',
            border: 'none',
            boxShadow: 'var(--shadow-premium)',
            padding: '2.5rem'
          }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>👤</div>
                        <AppText as="h2" className="ui-prompt__title" style={{ color: 'white', fontSize: '1.5rem' }}>
                            {t('guest_mode', 'Guest Mode')}
                        </AppText>
                        <AppText as="p" className="ui-prompt__desc" style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '2rem' }}>
                            {t('guest_mode_desc', 'You\'re browsing as a guest. Sign in to access all settings and personalize your experience!')}
                        </AppText>
                        <button
              onClick={() => goToLogin()}
              className="ui-btn ui-btn--primary"
              style={{ width: '100%', marginBottom: '0.75rem', background: 'white', color: 'var(--primary)' }}>

                            {t('sign_in_up', 'Sign In / Sign Up')}
                        </button>
                        <button
              onClick={() => navigate('/')}
              className="ui-btn ui-btn--ghost"
              style={{ width: '100%', borderColor: 'white', color: 'white' }}>

                            {t('continue_browsing', 'Continue Browsing')}
                        </button>
                    </div>

                    {/*Guest-only Language Setting */}
                    <div style={{
            marginTop: '2rem',
            width: '100%',
            maxWidth: '400px'
          }}>
                        <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              overflow: 'hidden'
            }}>
                            <div
                onClick={() => navigate('/settings/language')}
                style={{
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  cursor: 'pointer'
                }}>

                                <div className="settings-row-icon settings-row-icon--flag">
                                    <AppText as="span" className="settings-row-flag" aria-hidden>
                                        {currentLanguageFlag}
                                    </AppText>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: '700', marginBottom: '2px' }}>{t('welcome_language', 'Language')}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{currentLanguageLabel}</div>
                                </div>
                                <FaChevronRight className="settings-row-chevron" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>);

  }

  return (
    <div className="page-container settings-page-responsive" style={{ paddingBottom: '100px' }}>
            {/* Responsive wrapper: same layout as mobile, centered on desktop with max-width */}
            <div className="settings-page-inner">
            {/* Minimal Header */}
            <div className="settings-header">
                <AppBackButton className="settings-back-btn" fallback={APP_HOME_PATH} />
                <AppText as="h2" className="settings-title">{t('settings_title_page', 'Settings')}</AppText>
            </div>

            {/* User Info Card */}
            <div className="settings-user-card">
                <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: getSafeAvatar(userProfile) ?
            `url(${getSafeAvatar(userProfile)})` :
            'linear-gradient(135deg, var(--primary), #f97316)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: '3px solid var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            color: 'white',
            fontWeight: '800'
          }}>
                    {!getSafeAvatar(userProfile) &&
            (userProfile?.displayName || userProfile?.display_name || 'U')[0].toUpperCase()
            }
                </div>
                <div style={{ flex: 1 }}>
                    <AppText as="h2" className="settings-user-name">
                        {userProfile?.displayName || userProfile?.display_name || 'User'}
                    </AppText>
                    <AppText as="p" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                        {currentUser?.email}
                    </AppText>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                        {isBusiness &&
              <div className="settings-badge-pill settings-badge-pill--business">
                                {t('business_account_badge', 'Business Account')}
                            </div>
              }
                        {isBusiness && normalizeBusinessTier(userProfile?.subscriptionTier) === 'paid' &&
              <div className="settings-badge-pill settings-badge-pill--tier-paid">
                                {t('biz_plan_paid_name', 'Paid Business')}
                            </div>
              }
                        {isBusiness && normalizeBusinessTier(userProfile?.subscriptionTier) === 'free' &&
              <div className="settings-badge-pill settings-badge-pill--tier-free">
                                {t('biz_plan_free_name', 'Free Business')}
                            </div>
              }
                    </div>
                </div>
            </div>

            {/* Settings Sections */}
            {settingsSections.map((section, sectionIndex) =>
        <div key={sectionIndex} className="settings-section">
                    <AppText as="h3" className="settings-section-title">{section.title}</AppText>
                    <div className="settings-section-card ui-card">
                        {section.items.map((item, itemIndex) =>
            <button
              type="button"
              key={itemIndex}
              onClick={item.onClick}
              className="settings-row">

                                <div
                className={`settings-row-icon${
                item.flag ? ' settings-row-icon--flag' : ''}`
                }
                style={
                item.flag ?
                undefined :
                {
                  background: `${item.color}15`,
                  color: item.color
                }
                }>

                                    {item.flag ?
                <AppText as="span" className="settings-row-flag" aria-hidden>
                                            {item.flag}
                                        </AppText> :

                item.icon
                }
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{
                  fontWeight: '700',
                  marginBottom: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                                        {item.label}
                                        {item.badge &&
                  <AppText as="span" style={{
                    padding: '2px 8px',
                    background: 'linear-gradient(135deg, #fbbf24, #f97316)',
                    borderRadius: '8px',
                    fontSize: '0.65rem',
                    fontWeight: '800',
                    color: 'white',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px'
                  }}>
                                                {item.badge}
                                            </AppText>
                  }
                                    </div>
                                    {item.value &&
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            {item.value}
                                        </div>
                }
                                </div>

                                <FaChevronRight className="settings-row-chevron" />
                            </button>
            )}
                    </div>
                </div>
        )}

            {/* Danger Zone */}
                <div className="settings-section">
                    <AppText as="h3" className="settings-section-title settings-section-title--danger">{t('danger_zone', 'Danger Zone')}</AppText>
                    <div className="settings-section-card ui-card">
                    {/* Logout */}
                    <div
              onClick={handleLogout}
              className="settings-row settings-row--danger">

                        <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
                color: '#ef4444'
              }}>
                            <FaSignOutAlt />
                        </div>
                        <div style={{ flex: 1, fontWeight: '700', color: '#ef4444' }}>
                            {t('logout')}
                        </div>
                        <FaChevronRight className="settings-row-chevron settings-row-chevron--danger" />
                    </div>

                    {/* Freeze (deactivate) account — reversible, hides everything */}
                    <div
              onClick={() => { if (!freezing && !deleting) handleFreezeAccount(); }}
              className="settings-row settings-row--danger">

                        <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(234, 179, 8, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
                color: '#eab308'
              }}>
                            <FaUserClock />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '700', color: '#eab308', marginBottom: '2px' }}>
                                {t('freeze_account_title', 'Freeze account')}
                            </div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                {t('freeze_account_row_desc', 'Hide your profile temporarily — reactivate any time.')}
                            </div>
                        </div>
                        {freezing ?
              <div style={{ width: '20px', height: '20px', border: '2px solid #eab308', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> :
              <FaChevronRight className="settings-row-chevron" />
              }
                    </div>

                    {/* Delete Account — 30-day scheduled deletion */}
                    <div
              onClick={() => { if (!deleting && !freezing) handleDeleteAccount(); }}
              className="settings-row settings-row--danger">

                        <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
                color: '#ef4444'
              }}>
                            <FaTrash />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '700', color: '#ef4444', marginBottom: '2px' }}>
                                {t('delete_account_confirm', 'Delete Account')}
                            </div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                {t('delete_account_row_desc', 'Scheduled after 30 days — cancel by logging back in.')}
                            </div>
                        </div>
                        {deleting ?
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid #ef4444',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} /> :

              <FaChevronRight className="settings-row-chevron settings-row-chevron--danger" />
              }
                    </div>
                </div>
            </div>

            {/* App Version */}
            <div className="settings-version">{t('app_version', 'DineBuddies v1.0.0')}</div>
            </div>
        </div>);

};

export default Settings;