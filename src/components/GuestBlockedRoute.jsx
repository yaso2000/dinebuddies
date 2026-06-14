import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { buildLoginPath } from '../utils/goToLogin';
import { sanitizeNextPath } from '../utils/safeInternalPath';

/**
 * Blocks guest users from accessing protected routes — redirects to /login with ?next=.
 */
const GuestBlockedRoute = ({ children }) => {
    const { currentUser, isGuest, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)' }}>
                <div className="spinner" />
            </div>
        );
    }

    if (!currentUser || isGuest) {
        const returnPath = sanitizeNextPath(
            `${location.pathname || ''}${location.search || ''}`
        );
        return <Navigate to={buildLoginPath({ returnPath })} replace />;
    }

    return children;
};

export default GuestBlockedRoute;
