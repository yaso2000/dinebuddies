import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Blocks guest users from accessing protected routes.
 * Uses the unified `isGuest` flag from AuthContext — no dual checks needed.
 */
const GuestBlockedRoute = ({ children }) => {
    const { currentUser, isGuest, loading } = useAuth();

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)' }}>
                <div className="spinner" />
            </div>
        );
    }

    if (!currentUser || isGuest) {
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default GuestBlockedRoute;
