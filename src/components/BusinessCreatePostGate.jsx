import React, { Suspense, lazy, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { isBusinessUser } from '../utils/accountRole';
import AppRouteLoading from './AppRouteLoading';

const SmartPostStudio = lazy(() => import('../pages/business/SmartPostStudio'));
const CreatePost = lazy(() => import('../pages/CreatePost'));

function readBusinessNavHint(uid) {
    if (!uid) return false;
    try {
        return sessionStorage.getItem('dineb_biz_uid') === uid;
    } catch {
        return false;
    }
}

/**
 * Business accounts → Smart Post Studio; others → legacy create post.
 * Waits for profile hydrate so CreatePost never flashes for business users.
 */
export default function BusinessCreatePostGate() {
    const { currentUser, userProfile, loading, profileServerSynced, isBusiness } = useAuth();

    const businessNavHint = useMemo(
        () => readBusinessNavHint(currentUser?.uid),
        [currentUser?.uid]
    );

    const preferStudio = isBusiness || isBusinessUser(userProfile) || businessNavHint;

    if (loading) {
        return <AppRouteLoading variant="profile" fullViewport />;
    }

    if (currentUser && !profileServerSynced) {
        return <AppRouteLoading variant="profile" fullViewport />;
    }

    return (
        <Suspense fallback={<AppRouteLoading variant="route" fullViewport />}>
            {preferStudio ? <SmartPostStudio /> : <CreatePost />}
        </Suspense>
    );
}
