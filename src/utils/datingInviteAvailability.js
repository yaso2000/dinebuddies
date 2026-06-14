import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';

/** User accepts dating invitations (opt-out via `availableForDating === false`). */
export function isUserAvailableForDating(user) {
    if (!user || typeof user !== 'object') return false;
    const profileType = String(user.profileType || '').toLowerCase();
    if (profileType === 'business') return false;
    const role = String(user.role || '').toLowerCase();
    if (role === 'business' || role === 'admin' || role === 'guest') return false;
    if (user.isBusiness === true) return false;
    return user.availableForDating !== false;
}

/** Load role / dating opt-out from users docs (batched, max 10 per query). */
export async function fetchDatingEligibilityByUserIds(ids) {
    const map = new Map();
    const unique = [...new Set((ids || []).filter(Boolean))];
    for (let i = 0; i < unique.length; i += 10) {
        const chunk = unique.slice(i, i + 10);
        try {
            const snap = await getDocs(
                query(collection(db, 'users'), where(documentId(), 'in', chunk))
            );
            snap.docs.forEach((d) => {
                const data = d.data() || {};
                const role = String(data.role || '').toLowerCase();
                map.set(d.id, {
                    role: data.role,
                    isBusiness: data.isBusiness === true || role === 'business',
                    availableForDating: data.availableForDating,
                    profileType:
                        data.isBusiness === true || role === 'business' ? 'business' : 'user',
                });
            });
        } catch (err) {
            console.warn('[fetchDatingEligibilityByUserIds]', err);
        }
    }
    return map;
}

export function mergeDatingEligibility(user, fieldsMap) {
    if (!user?.id) return user;
    const fields = fieldsMap?.get(user.id);
    return fields ? { ...user, ...fields } : user;
}

/** @param {object | null | undefined} user */
export function getDatingInviteeDisplayName(user) {
    if (!user) return '';
    return (
        user.display_name ||
        user.displayName ||
        user.name ||
        ''
    ).trim();
}
