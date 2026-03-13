import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

const call = async (name, payload) => {
    const fn = httpsCallable(functions, name);
    const result = await fn(payload);
    return result?.data || {};
};

export const adminSecurityService = {
    setUserBanStatus: (targetUid, banned) =>
        call('adminSetUserBanStatus', { targetUid, banned }),

    setUserRole: (targetUid, role) =>
        call('adminSetUserRole', { targetUid, role }),

    setUserSubscriptionTier: (targetUid, subscriptionTier, isBusinessUser) =>
        call('adminSetUserSubscriptionTier', { targetUid, subscriptionTier, isBusinessUser }),

    cancelUserSubscription: (targetUid) =>
        call('adminCancelUserSubscription', { targetUid }),

    updateBusinessLimits: (targetUid, customLimits, customLimitsExpiry, adminNotes) =>
        call('adminUpdateBusinessLimits', { targetUid, customLimits, customLimitsExpiry, adminNotes }),

    deleteUser: (targetUid) =>
        call('adminDeleteUser', { targetUid }),

    deletePartner: (targetUid) =>
        call('adminDeletePartner', { targetUid }),

    cleanOrphanContent: () =>
        call('adminCleanOrphanContent', {}),

    wipeCommunityContent: () =>
        call('adminWipeCommunityContent', {}),

    createNotification: (payload) =>
        call('createNotification', payload)
};

export const consumeOfferCredit = () => call('consumeOfferCredit', {});
