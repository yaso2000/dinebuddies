import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { goToLogin } from '../utils/goToLogin';

/**
 * Blocks guest users from accessing protected routes.
 * Uses the unified `isGuest` flag from AuthContext — no dual checks needed.
 */
const GuestBlockedRoute = ({ children }) => {
    const { currentUser, isGuest, loading } = useAuth();

    useEffect(() => {
        if (loading) return;
        if (!currentUser || isGuest) goToLogin({ replace: true });
    }, [loading, currentUser, isGuest]);

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)' }}>
                <div className="spinner" />
            </div>
        );
    }

    if (!currentUser || isGuest) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                …
            </div>
        );
    }

    return children;
};

export default GuestBlockedRoute;
