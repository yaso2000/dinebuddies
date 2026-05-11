import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import './AffiliateDashboard.css';

/**
 * Shown when an affiliate opens the dashboard on a viewport / device we treat as non-laptop.
 */
export default function AffiliateUseLaptop() {
    const { t } = useTranslation();
    const { signOut } = useAuth();

    const handleSignOut = () => {
        signOut('/affiliate').catch(() => {
            if (typeof window !== 'undefined') {
                window.location.replace('/affiliate/sign-out');
            }
        });
    };

    return (
        <div className="affiliate-shell affiliate-shell--center">
            <div className="affiliate-card affiliate-card--notice">
                <h1 className="affiliate-h1">{t('affiliate_use_laptop_title', 'Use a laptop or larger screen')}</h1>
                <p className="affiliate-muted">
                    {t(
                        'affiliate_use_laptop_body',
                        'The affiliate dashboard is optimized for desktop browsers. Please open this page on a computer with a wide window (at least 1024px), or use a standard desktop browser.'
                    )}
                </p>
                <div className="affiliate-row">
                    <Link to="/affiliate" className="affiliate-btn affiliate-btn--secondary">
                        {t('affiliate_back_home', 'Back to home')}
                    </Link>
                    <Link to="/affiliate/login?next=/affiliate/dashboard" className="affiliate-btn affiliate-btn--primary">
                        {t('affiliate_try_again_login', 'I am on a laptop — sign in again')}
                    </Link>
                    <button type="button" className="affiliate-btn affiliate-btn--ghost" onClick={handleSignOut}>
                        {t('affiliate_use_laptop_sign_out', 'Sign out')}
                    </button>
                </div>
                <p className="affiliate-muted" style={{ marginTop: 18, fontSize: '0.85rem', lineHeight: 1.5 }}>
                    {t(
                        'affiliate_use_laptop_stuck_hint',
                        'If the page keeps jumping, sign out above, or open /affiliate/sign-out in the address bar (same site) to clear your session.'
                    )}
                </p>
            </div>
        </div>
    );
}
