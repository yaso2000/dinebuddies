import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import DesktopLanding from '../pages/DesktopLanding';
import { useAuth } from '../context/AuthContext';
import { isBusinessUser } from '../utils/accountRole';
import { needsConsumerEmailVerification } from '../utils/emailVerification';

const HomeRouter = () => {
    const { currentUser, userProfile, loading } = useAuth();
    const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' ? window.innerWidth <= 768 : false
    );

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const businessHomeDest = () => {
        if (typeof window === 'undefined') return '/business-dashboard';
        return window.innerWidth >= 1024 ? '/business-pro' : '/business-dashboard';
    };

    // Wait for auth + profile listener — Firebase often reports currentUser=null briefly while
    // persistence restores. The old guard only did (currentUser && loading), so on mobile we fell
    // through to Navigate → /posts-feed before the session existed (breaking / and any redirect to /).
    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
                <div style={{ width: 38, height: 38, border: '4px solid var(--border-color)', borderTop: '4px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    if (currentUser && userProfile) {
        if (isBusinessUser(userProfile)) {
            // If they are a business but haven't finished signup, go to their new profile page
            if (userProfile.pendingBusinessRegistration && currentUser.uid) {
                return <Navigate to="/business/onboarding" replace />;
            }
            // Normal business goes to dashboard
            return <Navigate to={businessHomeDest()} replace />;
        }
        if (needsConsumerEmailVerification(currentUser, userProfile)) {
            return <Navigate to="/verify-email" replace />;
        }
        // Normal user goes to feed
        return <Navigate to="/posts-feed" replace />;
    }

    // Default for anyone else (guests/loading-finished-no-user)
    if (isMobile) {
        return <Navigate to="/posts-feed" replace />;
    }

    return <DesktopLanding />;
};

export default HomeRouter;
