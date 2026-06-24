import React from 'react';
import { Navigate } from 'react-router-dom';
import DesktopLanding from '../pages/DesktopLanding';
import AppRouteLoading from '../components/AppRouteLoading';
import AppShellLoading from '../components/AppShellLoading';
import { useAuth } from '../context/AuthContext';
import { resolveSignedInHomePath } from '../utils/accountKind';
import { peekPostLogoutRedirect } from '../utils/localDevAuth';

function isDesktopShell() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(min-width: 1024px)').matches;
}

/** `/` — landing for guests; signed-in users are routed by AuthRoutingGate + resolveSignedInHomePath. */
const HomeRouter = () => {
    const { currentUser, userProfile, isGuest } = useAuth();

    if (peekPostLogoutRedirect()) {
        return <Navigate to="/login" replace />;
    }

    if (currentUser && userProfile) {
        return <Navigate to={resolveSignedInHomePath(currentUser, userProfile, { isGuest })} replace />;
    }

    if (currentUser && !userProfile) {
        return isDesktopShell() ? <AppShellLoading variant="profile" /> : <AppRouteLoading variant="profile" fullViewport />;
    }

    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
        return <Navigate to="/posts-feed" replace />;
    }
    return <DesktopLanding />;
};

export default HomeRouter;
