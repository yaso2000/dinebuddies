import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppShellLoading from './AppShellLoading';
import { isAdminIdentity } from '../utils/adminAccess';
import { resolveSignedInHomePath } from '../utils/accountKind';
import { isAuthBootstrapPending } from '../utils/authBootstrap';
import {
    canConsumerEnterApp,
    shouldSkipConsumerProfileCompletion,
} from '../utils/consumerProfileComplete';
import { needsConsumerEmailVerification } from '../utils/emailVerification';

/**
 * Blocks app routes until Firebase auth + server profile sync finish.
 * Then routes consumers: incomplete → /complete-profile, complete → app shell.
 */
export default function AuthRoutingGate() {
    const location = useLocation();
    const { currentUser, userProfile, loading, profileServerSynced, isGuest } = useAuth();

    const pathNorm = (location.pathname || '/').replace(/\/$/, '') || '/';

    if (
        isAuthBootstrapPending({ loading, currentUser, isGuest, profileServerSynced })
    ) {
        return <AppShellLoading variant="session" fullViewport />;
    }

    if (!currentUser || isGuest) {
        return <Outlet />;
    }

    if (isAdminIdentity(currentUser, userProfile)) {
        if (pathNorm === '/complete-profile') {
            return <Navigate to="/admin/users" replace />;
        }
        return <Outlet />;
    }

    if (userProfile && shouldSkipConsumerProfileCompletion(userProfile)) {
        if (pathNorm === '/complete-profile') {
            return (
                <Navigate
                    to={resolveSignedInHomePath(currentUser, userProfile, { isGuest })}
                    replace
                />
            );
        }
        return <Outlet />;
    }

    if (needsConsumerEmailVerification(currentUser, userProfile)) {
        if (pathNorm !== '/verify-email') {
            return <Navigate to="/verify-email" replace state={{ from: location }} />;
        }
        return <Outlet />;
    }

    const profileComplete = canConsumerEnterApp(userProfile);

    if (!profileComplete) {
        if (pathNorm !== '/complete-profile') {
            return (
                <Navigate
                    to="/complete-profile"
                    replace
                    state={{ from: location }}
                />
            );
        }
        return <Outlet />;
    }

    if (pathNorm === '/complete-profile') {
        return (
            <Navigate
                to={resolveSignedInHomePath(currentUser, userProfile, { isGuest })}
                replace
            />
        );
    }

    return <Outlet />;
}
