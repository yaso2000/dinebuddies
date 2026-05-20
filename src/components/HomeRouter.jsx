import React from 'react';
import { Navigate } from 'react-router-dom';
import DesktopLanding from '../pages/DesktopLanding';
import AppRouteLoading from '../components/AppRouteLoading';
import AppShellLoading from '../components/AppShellLoading';

function isDesktopShell() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(min-width: 1024px)').matches;
}
import { useAuth } from '../context/AuthContext';
import { isBusinessUser, isAffiliateAgent } from '../utils/accountRole';
import { needsConsumerEmailVerification } from '../utils/emailVerification';
import { isAdminIdentity, shouldLandOnAdminDashboard } from '../utils/adminAccess';

const HomeRouter = () => {
    const { currentUser, userProfile, loading } = useAuth();

    const businessHomeDest = () => '/business-dashboard';

    // Wait for auth + profile listener — Firebase often reports currentUser=null briefly while
    // persistence restores. The old guard only did (currentUser && loading), so on mobile we fell
    // through to Navigate → /posts-feed before the session existed (breaking / and any redirect to /).
    if (loading) {
        return isDesktopShell() ? <AppShellLoading variant="session" /> : <AppRouteLoading variant="session" fullViewport />;
    }

    // Signed in but Firestore profile not yet: keep loading until Firestore resolves (avoids wrong redirects near 768px).
    if (currentUser && !userProfile) {
        if (isAdminIdentity(currentUser, null)) {
            return <Navigate to="/admin/users" replace />;
        }
        return isDesktopShell() ? <AppShellLoading variant="profile" /> : <AppRouteLoading variant="profile" fullViewport />;
    }

    if (currentUser && userProfile) {
        if (shouldLandOnAdminDashboard(currentUser, userProfile)) {
            return <Navigate to="/admin/users" replace />;
        }
        if (needsConsumerEmailVerification(currentUser, userProfile)) {
            return <Navigate to="/verify-email" replace />;
        }
        if (isBusinessUser(userProfile)) {
            if (userProfile.pendingBusinessRegistration && currentUser.uid) {
                return <Navigate to="/business/onboarding" replace />;
            }
            return <Navigate to={businessHomeDest()} replace />;
        }
        if (isAffiliateAgent(userProfile)) {
            return <Navigate to="/affiliate/dashboard" replace />;
        }

        return <Navigate to="/posts-feed" replace />;
    }

    // Signed-out: desktop shows marketing landing; narrow viewports open the app shell (original mobile behavior).
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
        return <Navigate to="/posts-feed" replace />;
    }
    return <DesktopLanding />;
};

export default HomeRouter;
