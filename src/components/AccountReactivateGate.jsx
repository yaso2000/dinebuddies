import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { goToLogin } from '../utils/goToLogin';

/**
 * Full-screen gate shown when a signed-in user returns to a frozen (deactivated)
 * or pending-deletion account. Returning is the reactivation signal (TikTok-style):
 * the user explicitly reactivates (cancels the scheduled deletion) or logs out.
 */
function formatPurgeDate(scheduledPurgeAt, lang) {
    try {
        const d =
            typeof scheduledPurgeAt?.toDate === 'function'
                ? scheduledPurgeAt.toDate()
                : scheduledPurgeAt?.seconds
                  ? new Date(scheduledPurgeAt.seconds * 1000)
                  : null;
        if (!d) return null;
        return d.toLocaleDateString(lang || undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
        return null;
    }
}

export default function AccountReactivateGate() {
    const { t, i18n } = useTranslation();
    const { currentUser, isGuest, accountState, userProfile, restoreMyAccount, signOut } = useAuth();
    const { showToast } = useToast();
    const [busy, setBusy] = useState(false);

    const closed = accountState === 'deactivated' || accountState === 'pending_deletion';
    if (!currentUser || isGuest || !closed) return null;

    const pendingDeletion = accountState === 'pending_deletion';
    const purgeDate = formatPurgeDate(userProfile?.scheduledPurgeAt, i18n.language);

    const handleReactivate = async () => {
        setBusy(true);
        try {
            await restoreMyAccount();
            showToast(t('account_reactivated', 'Welcome back — your account is active again.'), 'success');
        } catch (err) {
            console.error('[AccountReactivateGate] reactivate', err);
            showToast(t('account_reactivate_failed', 'Could not reactivate. Please try again.'), 'error');
            setBusy(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut('/login');
        } catch {
            goToLogin();
        }
    };

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100000,
                background: 'rgba(4, 6, 14, 0.92)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'calc(env(safe-area-inset-top, 0px) + 20px) 20px calc(env(safe-area-inset-bottom, 0px) + 20px)',
            }}>
            <div
                style={{
                    width: '100%',
                    maxWidth: 420,
                    background: 'var(--bg-card, #111b2e)',
                    color: 'var(--text-main, #f8fafc)',
                    borderRadius: 20,
                    border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                    padding: '28px 22px',
                    textAlign: 'center',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                }}>
                <div style={{ fontSize: '2.4rem', marginBottom: 10 }}>{pendingDeletion ? '🗓️' : '💤'}</div>
                <h2 style={{ margin: '0 0 10px', fontSize: '1.3rem', fontWeight: 800 }}>
                    {pendingDeletion
                        ? t('account_pending_deletion_title', 'Your account is scheduled for deletion')
                        : t('account_deactivated_title', 'Your account is deactivated')}
                </h2>
                <p style={{ margin: '0 0 22px', fontSize: '0.95rem', lineHeight: 1.55, color: 'var(--text-muted, #94a3b8)' }}>
                    {pendingDeletion
                        ? purgeDate
                            ? t('account_pending_deletion_desc_date', {
                                  defaultValue:
                                      'It will be permanently deleted on {{date}}, along with your credits. Reactivate now to cancel and restore everything.',
                                  date: purgeDate,
                              })
                            : t('account_pending_deletion_desc', 'It will be permanently deleted after the grace period, along with your credits. Reactivate now to cancel and restore everything.')
                        : t('account_deactivated_desc', 'Your profile is hidden from everyone. Reactivate to make it visible again — your data and credits are safe.')}
                </p>

                <button
                    type="button"
                    onClick={handleReactivate}
                    disabled={busy}
                    style={{
                        width: '100%',
                        padding: '13px 16px',
                        borderRadius: 12,
                        border: 'none',
                        background: 'linear-gradient(135deg, var(--primary, #f97316), #f59e0b)',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: '1rem',
                        cursor: busy ? 'default' : 'pointer',
                        opacity: busy ? 0.7 : 1,
                    }}>
                    {busy
                        ? t('please_wait', 'Please wait…')
                        : pendingDeletion
                          ? t('account_cancel_deletion_cta', 'Cancel deletion & reactivate')
                          : t('account_reactivate_cta', 'Reactivate my account')}
                </button>

                <button
                    type="button"
                    onClick={handleLogout}
                    disabled={busy}
                    style={{
                        width: '100%',
                        marginTop: 12,
                        padding: '11px 16px',
                        borderRadius: 12,
                        border: '1px solid var(--border-color, rgba(255,255,255,0.14))',
                        background: 'transparent',
                        color: 'var(--text-main, #f8fafc)',
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                    }}>
                    {t('logout', 'Log out')}
                </button>
            </div>
        </div>
    );
}
