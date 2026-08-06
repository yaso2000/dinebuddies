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
 * Blocks guest users from accessing protected routes — redirects to /login with ?next=.
 */
const GuestBlockedRoute = ({ children }) => {
    const { currentUser, isGuest, loading, profileServerSynced } = useAuth();
    const location = useLocation();

    if (
        isAuthBootstrapPending({ loading, currentUser, isGuest, profileServerSynced }) ||
        (!currentUser && hasPendingBusinessSessionHint())
    ) {
        // Same shell as AuthRoutingGate — avoid a second distinct spinner flash.
        return <AppShellLoading variant="session" />;
    }

    if (!currentUser || isGuest) {
        const returnPath = sanitizeNextPath(
            `${location.pathname || ''}${location.search || ''}`
        );
        return <Navigate to={buildLoginPath({ returnPath })} replace />;
    }

    return children;
};

export default GuestBlockedRoute;
