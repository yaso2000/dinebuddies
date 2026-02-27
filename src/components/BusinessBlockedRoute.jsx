import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Protected Route - Blocks business/partner accounts
 * Business accounts will be redirected to home page
 */
const BusinessBlockedRoute = ({ children }) => {
    const { userProfile, loading, isBusiness } = useAuth();

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

    if (isBusiness) {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default BusinessBlockedRoute;
