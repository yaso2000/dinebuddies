import app from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(app, 'us-central1');

async function call(name, payload) {
    const fn = httpsCallable(functions, name);
    const res = await fn(payload);
    return res?.data || {};
}

export const adminApi = {
    setUserBanStatus: (targetUid, banned) => call('adminSetUserBanStatus', { targetUid, banned }),
    setUserFreezeStatus: (targetUid, frozen, freezeDays = null) =>
        call('adminSetUserFreezeStatus', { targetUid, frozen, freezeDays }),
    grantFreeCredits: (targetUid, amount, note = '') =>
        call('adminGrantFreeCredits', { targetUid, amount, note }),
    listInvitations: (opts = {}) => call('adminListInvitations', opts),
    moderateInvitation: (invitationId, action, inviteType = 'public') =>
        call('adminModerateInvitation', { invitationId, action, inviteType }),
    sendMassMessage: (payload) => call('adminSendMassMessage', payload),
    listAnnouncements: (opts = {}) => call('adminListAnnouncements', opts),
    listReports: (opts = {}) => call('adminListReports', opts),
    setReportStatus: (reportId, status) => call('adminSetReportStatus', { reportId, status }),
};
