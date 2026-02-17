import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const GuestBlockedRoute = ({ children }) => {
    const { currentUser, userProfile, isGuest, loading } = useAuth();

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

    // Check both potential flags for guest status
    const isGuestUser = isGuest || userProfile?.accountType === 'guest' || userProfile?.role === 'guest';

    // Strictly block if:
    // 1. No user is logged in (currentUser is null) -> catches both guests and logged-out users
    // 2. OR the user is explicitly identified as a guest
    if (!currentUser || isGuestUser) {
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default GuestBlockedRoute;
