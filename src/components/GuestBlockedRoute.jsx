import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { goToLogin } from '../utils/goToLogin';
import AppRouteLoading from './AppRouteLoading';

/**
 * Blocks guest users from accessing protected routes.
 * Uses the unified `isGuest` flag from AuthContext — no dual checks needed.
 */
const GuestBlockedRoute = ({ children }) => {
    const { currentUser, isGuest, loading } = useAuth();
    const location = useLocation();
    /** `/verify-email` sits outside `Layout` — needs a full-viewport loader like other auth shells. */
    const loadingFullViewport = location.pathname === '/verify-email';

    useEffect(() => {
        if (loading) return;
        if (!currentUser || isGuest) goToLogin({ replace: true });
    }, [loading, currentUser, isGuest]);

    // Under `Layout`, session wait is handled there — a second spinner here caused a different
    // width/column feel. Only full-viewport routes (e.g. /verify-email outside Layout) need it.
    if (loading) {
        if (loadingFullViewport) {
            return <AppRouteLoading variant="session" fullViewport />;
        }
        return null;
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
