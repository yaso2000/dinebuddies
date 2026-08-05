import app from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(app, 'us-central1');

const LONG_RUNNING_ADMIN_CALLS = new Set([
    'adminGenerateDemoUserImage',
    'adminGenerateDemoUserCharacterPair',
    'adminResetAllCredits',
]);

async function call(name, payload) {
    const opts = LONG_RUNNING_ADMIN_CALLS.has(name) ? { timeout: 540000 } : undefined;
    const fn = httpsCallable(functions, name, opts);
    const res = await fn(payload);
    return res?.data || {};
}

export const adminApi = {
    setUserBanStatus: (targetUid, banned) => call('adminSetUserBanStatus', { targetUid, banned }),
    setUserFreezeStatus: (targetUid, frozen, freezeDays = null) =>
        call('adminSetUserFreezeStatus', { targetUid, frozen, freezeDays }),
    grantFreeCredits: (targetUid, amount, note = '') =>
        call('adminGrantFreeCredits', { targetUid, amount, note }),
    resetAllCredits: (confirmPhrase, dryRun = false) =>
        call('adminResetAllCredits', { confirmPhrase, dryRun }),
    setUserSubscriptionTier: (targetUid, subscriptionTier, isBusinessUser = false) =>
        call('adminSetUserSubscriptionTier', { targetUid, subscriptionTier, isBusinessUser }),
    deletePartner: (targetUid) => call('adminDeletePartner', { targetUid }),
    listInvitations: (opts = {}) => call('adminListInvitations', opts),
    moderateInvitation: (invitationId, action, inviteType = 'public') =>
        call('adminModerateInvitation', { invitationId, action, inviteType }),
    listPosts: (opts = {}) => call('adminListPosts', opts),
    moderatePost: (postId, action = 'delete', source = 'community') =>
        call('adminModeratePost', { postId, action, source }),
    listBusinesses: (opts = {}) => call('adminListBusinesses', opts),
    deleteBusiness: (businessId) => call('adminDeleteBusiness', { businessId }),
    sendMassMessage: (payload) => call('adminSendMassMessage', payload),
    listAnnouncements: (opts = {}) => call('adminListAnnouncements', opts),
    listReports: (opts = {}) => call('adminListReports', opts),
    setReportStatus: (reportId, status) => call('adminSetReportStatus', { reportId, status }),
    listDemoUsers: () => call('adminListDemoUsers', {}),
    listDemoUserProfiles: (payload = {}) => call('adminListDemoUserProfiles', payload),
    createDemoUser: (payload) => call('adminCreateDemoUser', payload),
    suggestDemoUserProfile: (payload) => call('adminSuggestDemoUserProfile', payload),
    generateDemoUserImage: (payload) => call('adminGenerateDemoUserImage', payload),
    generateDemoUserCharacterPair: (payload) =>
        call('adminGenerateDemoUserCharacterPair', payload),
    deleteDemoUser: (payload) => call('adminDeleteDemoUser', payload),
    createDemoUsers: (payload) => call('adminCreateDemoUsers', payload),
    wipeDemoUsers: (payload) => call('adminWipeDemoUsers', payload),
    createDemoPost: (payload) => call('adminCreateDemoPost', payload),
    createDemoPublicInvitation: (payload) => call('adminCreateDemoPublicInvitation', payload),
};
