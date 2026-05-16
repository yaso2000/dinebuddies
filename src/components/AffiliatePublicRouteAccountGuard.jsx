import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAffiliateAgent } from '../utils/accountRole';
import { sanitizeNextPath } from '../utils/safeInternalPath';
import AppRouteLoading from './AppRouteLoading';

/**
 * Public /affiliate/* entry pages: keep consumer/business/admin sessions out of the affiliate auth shell.
 * Affiliates already signed in skip the login/signup form and go to the dashboard (or ?next= when allowed).
 *
 * @param {{ children: React.ReactNode, useNextQuery?: boolean, blockRedirect?: boolean }} props
 */
export default function AffiliatePublicRouteAccountGuard({ children, useNextQuery = false, blockRedirect = false }) {
    const { currentUser, userProfile, loading, profileServerSynced, isGuest } = useAuth();
    const [params] = useSearchParams();

    if (blockRedirect) {
        return children;
    }

    if (isGuest || !currentUser) {
        return children;
    }

    if (loading) {
        return <AppRouteLoading variant="session" fullViewport />;
    }

    if (!userProfile || !profileServerSynced) {
        return <AppRouteLoading variant="profile" fullViewport />;
    }

    if (isAffiliateAgent(userProfile)) {
        const to = useNextQuery ? sanitizeNextPath(params.get('next')) || '/affiliate/dashboard' : '/affiliate/dashboard';
        return <Navigate to={to} replace />;
    }

    return <Navigate to="/" replace />;
}
