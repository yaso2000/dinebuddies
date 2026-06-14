import React, { Suspense, lazy, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isBusinessUser } from '../utils/accountRole';
import BusinessPaidFeatureGate from './business/BusinessPaidFeatureGate';
import AppRouteLoading from './AppRouteLoading';

const SmartPostStudio = lazy(() => import('../pages/business/SmartPostStudio'));

function readBusinessNavHint(uid) {
    if (!uid) return false;
    try {
        return sessionStorage.getItem('dineb_biz_uid') === uid;
    } catch {
        return false;
    }
}

/**
 * `/create-post` is business-only → Smart Post Studio (motion post).
 * Regular users compose at the top of `/posts-feed` (InlinePostEditor).
 */
export default function BusinessCreatePostGate() {
    const location = useLocation();
    const { currentUser, userProfile, loading, profileServerSynced, isBusiness } = useAuth();

    const businessNavHint = useMemo(
        () => readBusinessNavHint(currentUser?.uid),
        [currentUser?.uid]
    );

    const isBusinessAccount = isBusiness || isBusinessUser(userProfile) || businessNavHint;

    if (loading) {
        return <AppRouteLoading variant="profile" fullViewport />;
    }

    if (currentUser && !profileServerSynced) {
        return <AppRouteLoading variant="profile" fullViewport />;
    }

    if (!isBusinessAccount) {
        return <Navigate to="/posts-feed" replace state={location.state} />;
    }

    return (
        <BusinessPaidFeatureGate
            titleKey="biz_plan_motion_paid_only"
            titleDefault="Smart Post (motion) requires Paid Business"
            hintKey="biz_plan_motion_paid_hint"
            hintDefault="Upgrade to create and publish motion posts."
        >
            <Suspense fallback={<AppRouteLoading variant="route" fullViewport />}>
                <SmartPostStudio />
            </Suspense>
        </BusinessPaidFeatureGate>
    );
}
