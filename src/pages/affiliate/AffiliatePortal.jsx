import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import AffiliatePublicRouteAccountGuard from '../../components/AffiliatePublicRouteAccountGuard';
import { isMobileRestrictedShell, subscribeMobileRestrictedShell } from '../../utils/mobileAppShell';
import { getAffiliateEmailSignInHref } from '../../utils/affiliateAuthRoutes';
import './AffiliateDashboard.css';

/** Public entry for partners: sign in then land on the affiliate dashboard. */
export default function AffiliatePortal() {
    const { t } = useTranslation();
    const { currentUser, signOut } = useAuth();
    const [mobileShell, setMobileShell] = useState(() =>
        typeof window !== 'undefined' ? isMobileRestrictedShell() : false
    );

    useEffect(() => {
        setMobileShell(isMobileRestrictedShell());
        return subscribeMobileRestrictedShell(setMobileShell);
    }, []);

    return (
        <AffiliatePublicRouteAccountGuard>
        <div className="affiliate-shell affiliate-shell--center">
            <div className="affiliate-card" style={{ maxWidth: 520 }}>
                <h1 className="affiliate-h1">{t('affiliate_portal_title', 'Affiliate partner sign-in')}</h1>
                <p className="affiliate-muted">
                    {mobileShell
                        ? t(
                              'affiliate_portal_body_mobile',
                              'On your phone, open the app login and use the Business tab with your partner email and password. Creating a new affiliate account requires a desktop browser.'
                          )
                        : t(
                              'affiliate_portal_body',
                              'Affiliate partners use a dedicated email and password flow (no social login). Register once, then sign in from this portal.'
                          )}
                </p>
                <div className="affiliate-row">
                    <Link
                        to={getAffiliateEmailSignInHref('/affiliate/dashboard')}
                        className="affiliate-btn affiliate-btn--primary"
                    >
                        {t('affiliate_portal_cta_login', 'Sign in')}
                    </Link>
                    {mobileShell ? (
                        <p
                            className="affiliate-muted"
                            style={{ margin: 0, fontSize: '0.88rem', textAlign: 'center', maxWidth: 280 }}
                        >
                            {t(
                                'affiliate_portal_signup_desktop_only',
                                'New affiliate accounts can only be created on a computer.'
                            )}
                        </p>
                    ) : (
                        <Link to="/affiliate/signup" className="affiliate-btn affiliate-btn--secondary">
                            {t('affiliate_portal_cta_signup', 'Create affiliate account')}
                        </Link>
                    )}
                    <Link to="/" className="affiliate-btn affiliate-btn--ghost">
                        {t('affiliate_back_home', 'Back to home')}
                    </Link>
                    {currentUser ? (
                        <button type="button" className="affiliate-btn affiliate-btn--ghost" onClick={() => signOut('/affiliate')}>
                            {t('affiliate_portal_sign_out', 'Sign out')}
                        </button>
                    ) : null}
                </div>
                <p className="affiliate-muted" style={{ marginTop: 14, fontSize: '0.82rem' }}>
                    <Link to="/affiliate/sign-out">{t('affiliate_sign_out_escape_link', 'Session stuck? Sign out here')}</Link>
                </p>
            </div>
        </div>
        </AffiliatePublicRouteAccountGuard>
    );
}
