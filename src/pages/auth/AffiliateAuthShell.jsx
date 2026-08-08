import React from 'react';
import AuthPageChrome from './AuthPageChrome';

/** Affiliate login / signup — same top chrome as main auth (theme, language, brand). */
export default function AffiliateAuthShell({ children }) {
    return (
        <div className="auth-route-scroll affiliate-route-scroll login-hub login-hub-page">
            <div className="login-hub-wrap login-hub-wrap--affiliate">
                <AuthPageChrome accountTab={null} showAffiliateLink={false} />
                <div className="login-hub-card login-hub-card--affiliate">{children}</div>
            </div>
        </div>
    );
}
