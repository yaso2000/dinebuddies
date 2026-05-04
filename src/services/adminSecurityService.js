import app from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(app, 'us-central1');

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
        call('createNotification', payload),

    /** Resend email campaign — audience filters match adminEmailCampaign.js */
    previewEmailCampaign: (filters) =>
        call('adminPreviewEmailCampaign', filters),

    sendEmailCampaign: (payload) =>
        call('adminSendEmailCampaign', payload),

    getDashboardStats: () => call('adminGetDashboardStats', {}),

    setReportStatus: (reportId, status) =>
        call('adminSetReportStatus', { reportId, status }),
};

export const consumeOfferCredit = () => call('consumeOfferCredit', {});
