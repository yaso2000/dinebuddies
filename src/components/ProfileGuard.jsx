import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProfileGuard = ({ children }) => {
    const { userProfile, loading, isGuest } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)' }}>Loading...</div>;
    }

    // Guest users should be handled by GuestBlockedRoute, but just in case
    if (isGuest) {
        return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    // Business accounts bypass individual profile checks
    const { isBusiness } = useAuth();
    if (isBusiness) {
        return children;
    }

    // Check if profile is complete (Name, Gender, Age Category)
    const isComplete = userProfile?.isProfileComplete || (
        (userProfile?.displayName || userProfile?.display_name || userProfile?.nickname) &&
        userProfile?.gender &&
        (userProfile?.ageCategory || userProfile?.age)
    );

    if (!isComplete) {
        console.log("🔒 Profile incomplete. Redirecting to /complete-profile from:", location.pathname);
        return <Navigate to="/complete-profile" state={{ from: location }} replace />;
    }

    return children;
};

export default ProfileGuard;
