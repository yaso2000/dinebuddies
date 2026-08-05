import React from 'react';
import { Navigate } from 'react-router-dom';
import AppShellLoading from '../components/AppShellLoading';
import AppEntryIntro, { hasCompletedAppEntryIntro } from '../pages/AppEntryIntro';
import { useAuth } from '../context/AuthContext';
import { resolveSignedInHomePath } from '../utils/accountKind';
import { canConsumerEnterApp } from '../utils/consumerProfileComplete';
import { peekPostLogoutRedirect } from '../utils/localDevAuth';

function isDesktopShell() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(min-width: 1024px)').matches;
}

/** `/` — entry intro for guests; signed-in users go to their home path. */
const HomeRouter = () => {
    const { currentUser, userProfile, profileServerSynced, isGuest } = useAuth();

    if (peekPostLogoutRedirect()) {
        return <Navigate to="/login" replace />;
    }

    if (currentUser && userProfile && !isGuest) {
        // Partial cache often looks incomplete; don't bounce to /complete-profile yet.
        if (!canConsumerEnterApp(userProfile) && !profileServerSynced) {
            if (!isDesktopShell()) {
                return <Navigate to="/posts-feed" replace />;
            }
            return <AppShellLoading variant="profile" />;
        }
        return <Navigate to={resolveSignedInHomePath(currentUser, userProfile, { isGuest })} replace />;
    }

    // Never park mobile on a full-viewport black loading screen while profile hydrates.
    if (currentUser && !userProfile && !isGuest) {
        if (!isDesktopShell()) {
            return <Navigate to="/posts-feed" replace />;
        }
        return <AppShellLoading variant="profile" />;
    }

    if (hasCompletedAppEntryIntro()) {
        return <Navigate to="/posts-feed" replace />;
    }

    return <AppEntryIntro />;
};

export default HomeRouter;
