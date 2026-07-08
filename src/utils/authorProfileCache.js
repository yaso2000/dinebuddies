import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { mapPublicProfileDocToUserShape } from './publicProfileMap';
import { getSafeAvatar } from './avatarUtils';

/**
 * Shared cache + in-flight de-duplication for feed author profiles.
 *
 * The feed renders many PostCards that often reference the same authors. Without
 * this, each card issued its own `getDoc(public_profiles/{id})` (plus a possible
 * `users/{id}` read) on mount — an N+1 read storm. This memoizes resolved authors
 * and coalesces concurrent requests for the same id into a single Firestore read.
 */
const resolvedCache = new Map();
const inFlight = new Map();

function cacheKey(authorId, canReadUsers) {
    return `${authorId}::${canReadUsers ? 'u' : 'p'}`;
}

async function loadAuthorProfile(authorId, canReadUsers) {
    // public_profiles is readable by everyone; users/{id} only when signed in.
    const pubSnap = await getDoc(doc(db, 'public_profiles', authorId));
    if (pubSnap.exists()) {
        const mapped = mapPublicProfileDocToUserShape(pubSnap.data());
        if (mapped) {
            const mappedAvatar = getSafeAvatar(mapped);
            const needsUsersLookup = !mapped.avatarUrl || mappedAvatar.startsWith('data:image/svg+xml');
            if (needsUsersLookup && canReadUsers) {
                try {
                    const userSnap = await getDoc(doc(db, 'users', authorId));
                    if (userSnap.exists()) {
                        const ud = userSnap.data();
                        const userAvatar = getSafeAvatar(ud);
                        if (!userAvatar.startsWith('data:image/svg+xml')) {
                            return {
                                ...mapped,
                                photo_url: ud.photo_url || ud.photoURL,
                                photoURL: ud.photoURL || ud.photo_url,
                                avatarUrl: ud.photo_url || ud.photoURL || ud.avatar,
                                avatar: ud.avatar || ud.photo_url || ud.photoURL,
                                gender: ud.gender ?? mapped.gender,
                            };
                        }
                    }
                } catch {
                    /* keep public profile row */
                }
            }
            return mapped;
        }
    }
    // Sync lag / missing projection: signed-in clients may still read users/{id}.
    if (canReadUsers) {
        const userSnap = await getDoc(doc(db, 'users', authorId));
        if (userSnap.exists()) return userSnap.data();
    }
    return null;
}

/**
 * Resolve an author profile shape, reusing cached/in-flight results.
 * @param {string} authorId
 * @param {{ canReadUsers?: boolean }} [opts]
 * @returns {Promise<Record<string, unknown> | null>}
 */
export function fetchAuthorProfile(authorId, { canReadUsers = false } = {}) {
    if (!authorId) return Promise.resolve(null);
    const key = cacheKey(authorId, canReadUsers);
    if (resolvedCache.has(key)) return Promise.resolve(resolvedCache.get(key));
    if (inFlight.has(key)) return inFlight.get(key);

    const promise = loadAuthorProfile(authorId, canReadUsers)
        .then((result) => {
            resolvedCache.set(key, result);
            inFlight.delete(key);
            return result;
        })
        .catch((err) => {
            inFlight.delete(key);
            if (err?.code !== 'permission-denied') {
                console.warn('author profile fetch:', err?.message || err);
            }
            return null;
        });
    inFlight.set(key, promise);
    return promise;
}

/** Drop a cached author (e.g. after the viewer edits their own profile). */
export function invalidateAuthorProfile(authorId) {
    resolvedCache.delete(cacheKey(authorId, true));
    resolvedCache.delete(cacheKey(authorId, false));
}
