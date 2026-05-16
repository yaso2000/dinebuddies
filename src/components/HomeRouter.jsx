import React from 'react';
import { Navigate } from 'react-router-dom';
import DesktopLanding from '../pages/DesktopLanding';
import AppRouteLoading from '../components/AppRouteLoading';
import { useAuth } from '../context/AuthContext';
import { isBusinessUser, isAffiliateAgent } from '../utils/accountRole';
import { needsConsumerEmailVerification } from '../utils/emailVerification';
import { isAdminIdentity, shouldLandOnAdminDashboard } from '../utils/adminAccess';

const HomeRouter = () => {
    const { currentUser, userProfile, loading, profileServerSynced } = useAuth();

    const businessHomeDest = () => '/business-dashboard';

    // Wait for auth + profile listener — Firebase often reports currentUser=null briefly while
    // persistence restores. The old guard only did (currentUser && loading), so on mobile we fell
    // through to Navigate → /posts-feed before the session existed (breaking / and any redirect to /).
    if (loading) {
        return <AppRouteLoading variant="session" />;
    }

    // Signed in but Firestore profile not yet: keep loading until Firestore resolves (avoids wrong redirects near 768px).
    if (currentUser && !userProfile) {
        if (isAdminIdentity(currentUser, null)) {
            return <Navigate to="/admin/dashboard" replace />;
        }
        return <AppRouteLoading variant="profile" />;
    }

    if (currentUser && userProfile) {
        if (shouldLandOnAdminDashboard(currentUser, userProfile)) {
            return <Navigate to="/admin/dashboard" replace />;
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

        // Consumer (Personal) profile completion layer
        const isComplete = userProfile.isProfileComplete || (
            (userProfile.displayName || userProfile.display_name || userProfile.nickname) &&
            userProfile.gender &&
            (userProfile.ageCategory || userProfile.age)
        );

        if (!isComplete) {
            if (!profileServerSynced) {
                return <AppRouteLoading variant="profile" />;
            }
            return <Navigate to="/complete-profile" replace />;
        }

        return <Navigate to="/posts-feed" replace />;
    }

    const guestModeActive =
        typeof localStorage !== 'undefined' && localStorage.getItem('guestMode') === 'true';
    const profileGuest =
        userProfile &&
        (userProfile.isGuest === true || String(userProfile.role || '').toLowerCase() === 'guest');
    if (!currentUser && (guestModeActive || profileGuest)) {
        return <Navigate to="/posts-feed" replace />;
    }

    // Signed-out: mobile — open the main feed (video/posts); desktop — marketing landing.
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
        return <Navigate to="/posts-feed" replace />;
    }
    return <DesktopLanding />;
};

export default HomeRouter;
