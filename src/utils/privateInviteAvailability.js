import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

/** User accepts private invites (opt-out via `availableForPrivateInvite === false`). */
export function isUserAvailableForPrivateInvite(user) {
    if (!user || typeof user !== 'object') return false;
    const profileType = String(user.profileType || '').toLowerCase();
    if (profileType === 'business') return false;
    const role = String(user.role || '').toLowerCase();
    if (role === 'business' || role === 'admin' || role === 'guest') return false;
    if (user.isBusiness === true) return false;
    return user.availableForPrivateInvite !== false;
}

/** Load role / dating opt-out from user docs (per-doc get — allowed for signed-in clients). */
export async function fetchPrivateInviteEligibilityByUserIds(ids) {
    const map = new Map();
    const unique = [...new Set((ids || []).filter(Boolean))];
    await Promise.all(
        unique.map(async (userId) => {
            try {
                const snap = await getDoc(doc(db, 'users', userId));
                if (!snap.exists()) return;
                const data = snap.data() || {};
                const role = String(data.role || '').toLowerCase();
                map.set(userId, {
                    role: data.role,
                    isBusiness: data.isBusiness === true || role === 'business',
                    availableForPrivateInvite: data.availableForPrivateInvite,
                    profileType:
                        data.isBusiness === true || role === 'business' ? 'business' : 'user',
                });
            } catch (err) {
                console.warn('[fetchPrivateInviteEligibilityByUserIds]', userId, err);
            }
        })
    );
    return map;
}

export function mergePrivateInviteEligibility(user, fieldsMap) {
    if (!user?.id) return user;
    const fields = fieldsMap?.get(user.id);
    return fields ? { ...user, ...fields } : user;
}

/** @param {object | null | undefined} user */
export function getPrivateInviteeDisplayName(user) {
    if (!user || typeof user !== 'object') return '';
    return (
        user.display_name ||
        user.displayName ||
        user.name ||
        user.username ||
        ''
    ).trim();
}
