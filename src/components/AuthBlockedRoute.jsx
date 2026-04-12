import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Blocks auth routes from flashing global spinner; lets login shells mount while Firestore resolves.
 */
const AuthBlockedRoute = ({ children }) => {
    const { currentUser, isGuest, loading, userProfile, isBusiness } = useAuth();
    const location = useLocation();
    const path = location.pathname;

    const isAuthShell =
        path === '/login' ||
        path === '/business/login' ||
        path === '/business/signup';

    if (loading && !isAuthShell) {
        return (
            <div
                style={{
                    height: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--bg-body)',
                }}
            >
                <div className="spinner" />
            </div>
        );
    }

    if (isAuthShell) {
        return children;
    }

    const guestModeActive =
        typeof localStorage !== 'undefined' && localStorage.getItem('guestMode') === 'true';

    const roleLc = String(userProfile?.role || '').toLowerCase();
    const profileLooksGuest =
        userProfile?.isGuest === true ||
        roleLc === 'guest' ||
        userProfile?.uid === 'guest' ||
        userProfile?.id === 'guest';

    const isFullyLoggedInNonGuest =
        Boolean(currentUser) &&
        !isGuest &&
        Boolean(userProfile) &&
        !profileLooksGuest &&
        !guestModeActive;

    if (isFullyLoggedInNonGuest) {
        if (isBusiness || userProfile?.pendingBusinessRegistration) {
            return <Navigate to={`/business/${currentUser.uid}`} replace />;
        }
        return <Navigate to="/" replace />;
    }

    return children;
};

export default AuthBlockedRoute;
