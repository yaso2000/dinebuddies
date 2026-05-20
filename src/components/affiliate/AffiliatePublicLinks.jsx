import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaHandshake } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { isAffiliateAgent } from '../../utils/accountRole';

function AffiliateLinkRow({ isAgent, showDashboard = true }) {
    const { t } = useTranslation();
    const { currentUser } = useAuth();

    return (
        <>
            {showDashboard && isAgent && currentUser ? (
                <Link to="/affiliate/dashboard" className="affiliate-promo-btn affiliate-promo-btn--primary">
                    {t('home_affiliate_dashboard', 'Partner dashboard')}
                </Link>
            ) : null}
            <Link to="/affiliate/login?next=/affiliate/dashboard" className="affiliate-promo-btn">
                {t('home_affiliate_portal', 'Affiliate sign-in')}
            </Link>
            {!isAgent ? (
                <Link to="/affiliate/signup" className="affiliate-promo-btn affiliate-promo-btn--outline">
                    {t('home_affiliate_signup', 'Become a partner')}
                </Link>
            ) : null}
        </>
    );
}

/** Visible button bar — desktop landing, posts feed, invitations home. */
export function AffiliatePromoBar({ className = '' }) {
    const { t } = useTranslation();
    const { currentUser, userProfile } = useAuth();
    const isAgent = isAffiliateAgent(userProfile);

    return (
        <section
            className={`affiliate-promo-bar ${className}`.trim()}
            aria-label={t('affiliate_links_aria', 'Affiliate program')}
        >
            <div className="affiliate-promo-bar__label">
                <FaHandshake aria-hidden />
                <span>{t('affiliate_program_title', 'Partner program')}</span>
            </div>
            <div className="affiliate-promo-bar__actions">
                <AffiliateLinkRow isAgent={isAgent} />
            </div>
        </section>
    );
}

/** Desktop sidebar card with partner buttons. */
export function AffiliateDesktopHomeLinks({ className = '' }) {
    const { t } = useTranslation();
    const { currentUser, userProfile } = useAuth();
    const isAgent = isAffiliateAgent(userProfile);

    return (
        <nav
            className={`affiliate-desktop-links ds-affiliate-widget ${className}`.trim()}
            aria-label={t('affiliate_links_aria', 'Affiliate program')}
        >
            <div className="affiliate-desktop-links__title">
                <FaHandshake aria-hidden />
                <span>{t('affiliate_program_title', 'Partner program')}</span>
            </div>
            <div className="affiliate-promo-bar__actions affiliate-promo-bar__actions--stack">
                <AffiliateLinkRow isAgent={isAgent} />
            </div>
        </nav>
    );
}

