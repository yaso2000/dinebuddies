import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppShellLoading from './AppShellLoading';
import { isAdminIdentity } from '../utils/adminAccess';
import { resolveSignedInHomePath } from '../utils/accountKind';
import { isAuthBootstrapPending } from '../utils/authBootstrap';
import {
    hasConsumerEntryOk,
    shouldForceCompleteProfileRedirect,
    shouldSkipConsumerProfileCompletion,
} from '../utils/consumerProfileComplete';
import { needsConsumerEmailVerification } from '../utils/emailVerification';

/**
 * One bootstrap shell for signed-in users until profileServerSynced.
 * Avoids Layout/Suspense/page-loader triple swap on first entry.
 */
export default function AuthRoutingGate() {
    const location = useLocation();
    const { currentUser, userProfile, loading, profileServerSynced, isGuest } = useAuth();

    const pathNorm = (location.pathname || '/').replace(/\/$/, '') || '/';
    const onCompleteProfile = pathNorm === '/complete-profile';

    // Guests / logged-out: only wait on Firebase session resolve.
    if (!currentUser || isGuest) {
        if (loading) {
            return <AppShellLoading variant="session" />;
        }
        return <Outlet />;
    }

    // Signed-in: hold one shell until users/{uid} server sync finishes.
    if (
        isAuthBootstrapPending({
            loading,
            currentUser,
            isGuest,
            profileServerSynced,
        })
    ) {
        // Returning completed consumers stuck on /complete-profile — escape without flash.
        if (onCompleteProfile && hasConsumerEntryOk(currentUser.uid)) {
            return <Navigate to="/posts-feed" replace />;
        }
        return <AppShellLoading variant="session" />;
    }

    // Returning completed consumers: leave /complete-profile before profile hydrates.
    if (onCompleteProfile && hasConsumerEntryOk(currentUser.uid)) {
        const home = resolveSignedInHomePath(currentUser, userProfile, { isGuest });
        return <Navigate to={home === '/complete-profile' ? '/posts-feed' : home} replace />;
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
            uid: currentUser.uid,
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
