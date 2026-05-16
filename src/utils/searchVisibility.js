import { isAffiliateAgentProfileData } from './accountRole';
import { isAdminIdentity, isAdminPanelStaffRole } from './adminAccess';

const HIDE_ROLES = new Set([
    'business',
    'partner',
    'admin',
    'staff',
    'support',
    'guest',
    'moderator',
    'affiliate_agent',
]);

/**
 * `/search` and directory APIs: omit admins, affiliate agents, staff, guests, and business accounts
 * from the **people** column (businesses use separate rows).
 *
 * @param {Record<string, unknown>|null|undefined} data — Firestore `users` doc or merged search row
 * @param {string} [id] — uid when missing on `data.id`
 * @returns {boolean} true = do not show in consumer search
 */
export function shouldHideUserFromPublicDirectorySearch(data, id) {
    if (!data || typeof data !== 'object') return true;
    const uid = String(id || data.id || data.uid || '');
    const role = String(data.role || '').toLowerCase();
    if (HIDE_ROLES.has(role)) return true;
    if (data.isGuest === true) return true;
    const profile = { ...data, id: uid, uid };
    if (isAffiliateAgentProfileData(profile)) return true;
    if (isAdminPanelStaffRole(profile)) return true;
    if (isAdminIdentity(null, profile)) return true;
    return false;
}
