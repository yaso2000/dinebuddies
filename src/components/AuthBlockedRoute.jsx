import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Higher Order Component to block authenticated users from accessing specific routes
 * (e.g., Login, Signup, Auth pages)
 */
const AuthBlockedRoute = ({ children }) => {
    const { currentUser, isGuest, loading, userProfile } = useAuth();

    if (loading) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-body)'
            }}>
                <div className="spinner"></div>
            </div>
        );
    }

    // Check if user is fully logged in (not null AND not a guest)
    const isActuallyLoggedIn = currentUser && !isGuest && userProfile?.role !== 'guest';

    if (isActuallyLoggedIn) {
        // Redirect to home if already logged in
        return <Navigate to="/" replace />;
    }

    return children;
};

export default AuthBlockedRoute;
