import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppShellLoading from './AppShellLoading';
import { isAdminIdentity } from '../utils/adminAccess';
import { resolveSignedInHomePath } from '../utils/accountKind';
import { isAuthBootstrapPending } from '../utils/authBootstrap';
import {
    canConsumerEnterApp,
    shouldForceCompleteProfileRedirect,
    shouldSkipConsumerProfileCompletion,
} from '../utils/consumerProfileComplete';
import { needsConsumerEmailVerification } from '../utils/emailVerification';

/**
 * Blocks app routes only while Firebase Auth resolves.
 * Never paint /complete-profile from a stale/partial cache before profileServerSynced —
 * that flash is what completed users see on every cold start.
 */
export default function AuthRoutingGate() {
    const location = useLocation();
    const { currentUser, userProfile, loading, profileServerSynced, isGuest } = useAuth();

    const pathNorm = (location.pathname || '/').replace(/\/$/, '') || '/';
    const onCompleteProfile = pathNorm === '/complete-profile';

    if (isAuthBootstrapPending({ loading })) {
        return <AppShellLoading variant="session" />;
    }

    if (!currentUser || isGuest) {
        return <Outlet />;
    }

    if (isAdminIdentity(currentUser, userProfile)) {
        if (onCompleteProfile) {
            return <Navigate to="/admin/users" replace />;
        }
        return <Outlet />;
    }

    if (userProfile && shouldSkipConsumerProfileCompletion(userProfile)) {
        if (onCompleteProfile) {
            return (
                <Navigate
                    to={resolveSignedInHomePath(currentUser, userProfile, { isGuest })}
                    replace
                />
            );
        }
        return <Outlet />;
    }

    // Profile still hydrating: never force incomplete → /complete-profile.
    // Firestore cache often has OAuth displayName but missing gender/age.
    if (!profileServerSynced) {
        if (userProfile && canConsumerEnterApp(userProfile)) {
            if (onCompleteProfile) {
                return (
                    <Navigate
                        to={resolveSignedInHomePath(currentUser, userProfile, { isGuest })}
                        replace
                    />
                );
            }
            return <Outlet />;
        }
        if (onCompleteProfile) {
            return <AppShellLoading variant="profile" />;
        }
        return <Outlet />;
    }

    if (userProfile && needsConsumerEmailVerification(currentUser, userProfile)) {
        if (pathNorm !== '/verify-email') {
            return <Navigate to="/verify-email" replace state={{ from: location }} />;
        }
        return <Outlet />;
    }

    if (!userProfile) {
        return <Outlet />;
    }

    if (
        shouldForceCompleteProfileRedirect({
            profileServerSynced,
            profile: userProfile,
        })
    ) {
        if (!onCompleteProfile) {
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

    if (onCompleteProfile) {
        return (
            <Navigate
                to={resolveSignedInHomePath(currentUser, userProfile, { isGuest })}
                replace
            />
        );
    }

    return <Outlet />;
}
