import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import DesktopLanding from '../pages/DesktopLanding';
import AppRouteLoading from '../components/AppRouteLoading';
import { useAuth } from '../context/AuthContext';
import { isBusinessUser } from '../utils/accountRole';
import { needsConsumerEmailVerification } from '../utils/emailVerification';
import { isAdminIdentity, shouldLandOnAdminDashboard } from '../utils/adminAccess';

const MOBILE_MQ = '(max-width: 768px)';

const HomeRouter = () => {
    const { currentUser, userProfile, loading } = useAuth();
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia(MOBILE_MQ).matches : false
    );

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const mq = window.matchMedia(MOBILE_MQ);
        const onChange = () => setIsMobile(mq.matches);
        onChange();
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    const businessHomeDest = () => '/business-dashboard';

    // Wait for auth + profile listener — Firebase often reports currentUser=null briefly while
    // persistence restores. The old guard only did (currentUser && loading), so on mobile we fell
    // through to Navigate → /posts-feed before the session existed (breaking / and any redirect to /).
    if (loading) {
        return <AppRouteLoading variant="session" />;
    }

    // Signed in but Firestore profile not yet: never use the guest `isMobile` branch below — scrollbar /
    // widths near 768px caused rapid Navigate ↔ DesktopLanding (felt like desktop↔mobile) and wrong /posts-feed.
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
        
        // Consumer (Personal) profile completion layer
        const isComplete = userProfile.isProfileComplete || (
            (userProfile.displayName || userProfile.display_name || userProfile.nickname) &&
            userProfile.gender &&
            (userProfile.ageCategory || userProfile.age)
        );

        if (!isComplete) {
            return <Navigate to="/complete-profile" replace />;
        }

        return <Navigate to="/posts-feed" replace />;
    }

    // Default for anyone else (guests/loading-finished-no-user)
    if (isMobile) {
        return <Navigate to="/posts-feed" replace />;
    }

    return <DesktopLanding />;
};

export default HomeRouter;
