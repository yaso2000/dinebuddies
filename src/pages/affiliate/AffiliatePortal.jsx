import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isAffiliateAgent } from '../../utils/accountRole';
import AppRouteLoading from '../../components/AppRouteLoading';

/** `/affiliate` — redirect only; app home is `/login`. */
export default function AffiliatePortal() {
    const { currentUser, userProfile, loading, profileServerSynced } = useAuth();
    if (loading || (currentUser && !profileServerSynced)) {
        return <AppRouteLoading variant="session" fullViewport />;
    }

    if (currentUser && isAffiliateAgent(userProfile)) {
        return <Navigate to="/affiliate/dashboard" replace />;
    }

    return <Navigate to="/login" replace />;
}
