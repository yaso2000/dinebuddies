import {
    collection,
    documentId,
    getDocs,
    limit,
    orderBy,
    query,
    startAfter,
    where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { isConsumerDirectoryMember } from './consumerDirectory';
import { mapPublicProfileDocToUserShape } from './publicProfileMap';
import { resolveProfileAvatarUrl, resolveProfileCoverUrl, resolveSwipeProfilePhotoUrl } from './profileGallery';

export const USER_DIRECTORY_DEFAULT_COVER =
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&h=600&fit=crop';

/** Neutral portrait fallback for dating swipe cards (never food/venue). */
export const USER_DIRECTORY_DEFAULT_SWIPE_PHOTO =
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=540&h=960&fit=crop';

export const USER_DIRECTORY_PAGE_SIZE = 24;

/**
 * @param {object} publicDoc `{ id, ...data }`
 * @param {object | null} userDoc
 */
export function mapDirectoryUser(publicDoc, userDoc = null) {
    const base = mapPublicProfileDocToUserShape(publicDoc) || {};
    const uid = publicDoc.id;
    const u = userDoc || {};
    const userPublic = publicDoc.userPublic || {};

    return {
        id: uid,
        ...base,
        email: u.email || null,
        coverPhotoUrl:
            resolveProfileCoverUrl(u) || USER_DIRECTORY_DEFAULT_COVER,
        swipePhotoUrl:
            resolveSwipeProfilePhotoUrl(u) ||
            resolveProfileAvatarUrl(u) ||
            USER_DIRECTORY_DEFAULT_SWIPE_PHOTO,
        profileGallery: Array.isArray(u.profileGallery) ? u.profileGallery : [],
        directoryCoverIndex: u.directoryCoverIndex ?? 0,
        bio: String(u.bio || u.shortBio || '').slice(0, 120),
        ageRange: u.ageRange || u.ageCategory || '',
        city: userPublic.city || u.city || '',
        country: userPublic.country || u.country || '',
        diningPersona: Array.isArray(u.diningPersona) ? u.diningPersona.slice(0, 3) : [],
        joinReasons: Array.isArray(u.joinReasons) ? u.joinReasons.slice(0, 2) : [],
        availableForPrivateInvite: u.availableForPrivateInvite,
        gender: u.gender || null,
        profileType: 'user',
        role: u.role || publicDoc.accountRole || 'user',
        accountRole: publicDoc.accountRole || u.role || 'user',
    };
}

/** @param {string[]} ids */
async function fetchUsersByIds(ids) {
    const map = new Map();
    const unique = [...new Set((ids || []).filter(Boolean))];
    for (let i = 0; i < unique.length; i += 10) {
        const chunk = unique.slice(i, i + 10);
        try {
            const snap = await getDocs(
                query(
                    collection(db, 'users'),
                    where(documentId(), 'in', chunk),
                    limit(chunk.length)
                )
            );
            snap.docs.forEach((d) => map.set(d.id, d.data()));
        } catch (err) {
            console.warn('[userDirectory] users batch fetch failed', err);
        }
    }
    return map;
}

/**
 * Paginated browse — consumer diners from `public_profiles`, admin/business filtered out.
 */
export async function fetchUserDirectoryPage({
    excludeUid,
    pageSize = USER_DIRECTORY_PAGE_SIZE,
    lastDoc = null,
} = {}) {
    const constraints = [
        where('profileType', '==', 'user'),
        orderBy('updatedAt', 'desc'),
        limit(pageSize),
    ];
    if (lastDoc) {
        constraints.push(startAfter(lastDoc));
    }

    const snap = await getDocs(query(collection(db, 'public_profiles'), ...constraints));
    const candidates = [];

    snap.forEach((d) => {
        const data = { id: d.id, ...d.data() };
        if (excludeUid && d.id === excludeUid) return;
        candidates.push(data);
    });

    const usersMap = await fetchUsersByIds(candidates.map((c) => c.id));
    const users = candidates
        .map((publicDoc) => {
            const userDoc = usersMap.get(publicDoc.id) || null;
            if (!isConsumerDirectoryMember(publicDoc, userDoc)) return null;
            return mapDirectoryUser(publicDoc, userDoc);
        })
        .filter(Boolean);

    return {
        users,
        lastDoc: snap.docs[snap.docs.length - 1] || null,
        hasMore: snap.docs.length >= pageSize,
    };
}

/**
 * Enrich search result rows with full profile fields for directory cards.
 * @param {object[]} rows
 */
export async function enrichDirectorySearchResults(rows) {
    const ids = rows.map((r) => r.id).filter(Boolean);
    const usersMap = await fetchUsersByIds(ids);
    return rows
        .map((row) => {
            const userDoc = usersMap.get(row.id) || row;
            const publicShape = {
                id: row.id,
                profileType: row.profileType || 'user',
                displayName: row.displayName || row.display_name,
                avatarUrl: row.photoURL || row.photo_url,
                accountRole: row.accountRole,
                searchable: row.searchable,
                userPublic: {},
            };
            if (!isConsumerDirectoryMember(publicShape, userDoc)) return null;
            return mapDirectoryUser(publicShape, userDoc);
        })
        .filter(Boolean);
}
