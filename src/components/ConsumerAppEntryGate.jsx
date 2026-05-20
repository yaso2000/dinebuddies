import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppShellLoading from './AppShellLoading';
import { isAdminIdentity } from '../utils/adminAccess';
import { shouldSkipConsumerProfileCompletion } from '../utils/consumerProfileComplete';

/**
 * Login-time gate only: incomplete consumer accounts cannot reach HomeRouter / Layout.
 * While Firestore hydrates we show loading — never flash /complete-profile until status is "blocked".
 */
export default function ConsumerAppEntryGate() {
    const location = useLocation();
    const { currentUser, userProfile, loading, isGuest, consumerEntryStatus } = useAuth();

    if (loading) {
        return <AppShellLoading variant="session" fullViewport />;
    }

    if (!currentUser || isGuest) {
        return <Outlet />;
    }

    if (isAdminIdentity(currentUser, userProfile)) {
        return <Outlet />;
    }

    if (userProfile && shouldSkipConsumerProfileCompletion(userProfile)) {
        return <Outlet />;
    }

    if (consumerEntryStatus === 'pending') {
        return <AppShellLoading variant="profile" fullViewport />;
    }

    if (consumerEntryStatus === 'blocked') {
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
