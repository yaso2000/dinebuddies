import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { buildLoginPath } from '../utils/goToLogin';
import { sanitizeNextPath } from '../utils/safeInternalPath';
import { isAuthBootstrapPending } from '../utils/authBootstrap';
import AppShellLoading from './AppShellLoading';

function hasPendingBusinessSessionHint() {
    try {
        return Boolean(sessionStorage.getItem('dineb_biz_uid'));
    } catch {
        return false;
    }
}

/**
 * Blocks guests (→ login) AND business accounts (→ /business-dashboard) from
 * consumer/social routes. Businesses do no social interaction with regular users
 * — no discovery, chat, likes/greetings/gifts, social invitations, or dating.
 */
const BusinessBlockedRoute = ({ children }) => {
    const { currentUser, isGuest, isBusiness, loading, profileServerSynced } = useAuth();
    const location = useLocation();

    if (
        isAuthBootstrapPending({ loading, currentUser, isGuest, profileServerSynced }) ||
        (!currentUser && hasPendingBusinessSessionHint())
    ) {
        return <AppShellLoading variant="session" />;
    }

    if (!currentUser || isGuest) {
        const returnPath = sanitizeNextPath(`${location.pathname || ''}${location.search || ''}`);
        return <Navigate to={buildLoginPath({ returnPath })} replace />;
    }

    if (isBusiness) {
        return <Navigate to="/business-dashboard" replace />;
    }

    return children;
};

export default BusinessBlockedRoute;
