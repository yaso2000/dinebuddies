import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdminIdentity } from '../utils/adminAccess';
import { resolveSignedInHomePath, resolveAccountKind, ACCOUNT_KIND } from '../utils/accountKind';

const CONSUMER_ONLY_PATHS = new Set(['/complete-profile', '/verify-email']);

/**
 * Keeps account kinds in separate shells: business / affiliate / staff leave consumer-only routes.
 * Profile completion routing is handled by AuthRoutingGate (runs earlier).
 */
export default function AccountShellGate() {
    const location = useLocation();
    const { currentUser, userProfile, loading, isGuest } = useAuth();

    if (loading) {
        return null;
    }

    if (!currentUser || isGuest) {
        return <Outlet />;
    }

    if (isAdminIdentity(currentUser, userProfile)) {
        return <Outlet />;
    }

    const pathNorm = (location.pathname || '/').replace(/\/$/, '') || '/';
    const kind = resolveAccountKind(userProfile, { isGuest });

    if (kind === ACCOUNT_KIND.BUSINESS || kind === ACCOUNT_KIND.AFFILIATE || kind === ACCOUNT_KIND.STAFF) {
        if (CONSUMER_ONLY_PATHS.has(pathNorm)) {
            return (
                <Navigate
                    to={resolveSignedInHomePath(currentUser, userProfile)}
                    replace
                    state={{ from: location }}
                />
            );
        }
    }

    return <Outlet />;
}
