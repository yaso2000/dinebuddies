import React from 'react';
import { Navigate } from 'react-router-dom';
import AppShellLoading from '../components/AppShellLoading';
import AppEntryIntro, { hasCompletedAppEntryIntro } from '../pages/AppEntryIntro';
import { useAuth } from '../context/AuthContext';
import { resolveSignedInHomePath } from '../utils/accountKind';
import { peekPostLogoutRedirect } from '../utils/localDevAuth';

/** `/` — entry intro for guests; signed-in users go to their home path once. */
const HomeRouter = () => {
    const { currentUser, userProfile, profileServerSynced, isGuest, loading } = useAuth();

    if (peekPostLogoutRedirect()) {
        return <Navigate to="/login" replace />;
    }

    // Single settle — never soft-hop to /posts-feed before identity is known
    // (that caused business sessions to flash the consumer feed then bounce).
    if (currentUser && !isGuest) {
        if (loading || !profileServerSynced) {
            return <AppShellLoading variant="profile" />;
        }
        if (userProfile) {
            return (
                <Navigate
                    to={resolveSignedInHomePath(currentUser, userProfile, { isGuest })}
                    replace
                />
            );
        }
        return <AppShellLoading variant="profile" />;
    }

    if (hasCompletedAppEntryIntro()) {
        return <Navigate to="/posts-feed" replace />;
    }

    return <AppEntryIntro />;
};

export default HomeRouter;
