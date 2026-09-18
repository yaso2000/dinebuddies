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
import { normalizeLookingFor } from '../constants/personalInviteCategories';
import { normalizeInvitePreference } from '../constants/privateProfileOptions';
import { resolveProfileAvatarUrl, resolveProfileCoverUrl, resolveSwipeProfilePhotoUrl } from './profileGallery';

import { DEFAULT_PROFILE_COVER_FALLBACK } from '../constants/defaultProfileMedia';

export const USER_DIRECTORY_DEFAULT_COVER = DEFAULT_PROFILE_COVER_FALLBACK;

/** Neutral portrait fallback for people swipe cards (never food/venue). */
export const USER_DIRECTORY_DEFAULT_SWIPE_PHOTO =
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=540&h=960&fit=crop';

export const USER_DIRECTORY_PAGE_SIZE = 24;

/**
 * Build a member-directory card row from the PUBLIC projection only.
 * Privacy: never reads users/{uid} of another member — so email and the precise
 * GPS trail never reach the client. Location is the coarse `userPublic.geo` (~1 km).
 * @param {object} publicDoc `{ id, ...public_profiles data }`
 */
export function mapDirectoryUser(publicDoc) {
    const base = mapPublicProfileDocToUserShape(publicDoc) || {};
    const uid = publicDoc.id;
    const up = publicDoc.userPublic || {};

    // Media resolvers expect a user-like shape; feed them the public fields.
    const mediaShape = {
        profileGallery: Array.isArray(up.profileGallery) ? up.profileGallery : [],
        directoryCoverIndex: up.directoryCoverIndex ?? 0,
        cover_photo: up.coverPhotoUrl || null,
        coverPhotoUrl: up.coverPhotoUrl || null,
        photo_url: base.photo_url,
        photoURL: base.photoURL,
        avatarUrl: base.avatarUrl,
        avatar: base.avatar,
    };

    const geo = up.geo && typeof up.geo === 'object' ? up.geo : null;

    return {
        id: uid,
        ...base,
        // Server-verified "real photo" flag (photo soft-gate).
        avatarIsRealPhoto: publicDoc.avatarIsRealPhoto === true,
        coverPhotoUrl:
            resolveProfileCoverUrl(mediaShape) || USER_DIRECTORY_DEFAULT_COVER,
        swipePhotoUrl:
            resolveSwipeProfilePhotoUrl(mediaShape) ||
            resolveProfileAvatarUrl(mediaShape) ||
            USER_DIRECTORY_DEFAULT_SWIPE_PHOTO,
        profileGallery: Array.isArray(up.profileGallery) ? up.profileGallery.slice(0, 3) : [],
        directoryCoverIndex: up.directoryCoverIndex ?? 0,
        bio: String(up.bio || '').slice(0, 120),
        age: typeof up.age === 'number' && up.age > 0 ? up.age : null,
        ageRange: up.ageCategory || '',
        ageCategory: up.ageCategory || '',
        favoritePlaces: [],
        city: up.city || '',
        country: up.country || '',
        countryCode: up.countryCode || '',
        diningPersona: Array.isArray(up.diningPersona) ? up.diningPersona.slice(0, 3) : [],
        joinReasons: Array.isArray(up.joinReasons) ? up.joinReasons.slice(0, 2) : [],
        lookingFor: normalizeLookingFor(up.lookingFor).slice(0, 3),
        invitePreference: normalizeInvitePreference(up.invitePreference),
        gender: base.gender || null,
        // TasteScope icon + compatibility ring — from the public projection.
        tasteTitleId: up.tasteScope?.titleId || null,
        tasteVisibility: up.tasteScope?.visibility || 'public',
        tasteAnswers: up.tasteScope?.answers || null,
        profileType: 'user',
        role: publicDoc.accountRole || 'user',
        accountRole: publicDoc.accountRole || 'user',
        isOnline: up.isOnline === true,
        cardTheme: up.cardTheme && typeof up.cardTheme === 'object' ? up.cardTheme : null,
        // Coarse proximity (~1 km) for distance sort — never precise coordinates.
        ...(geo ? { lat: geo.lat, lng: geo.lng } : {}),
    };
}

/** Fetch PUBLIC projections by id (never the private users/{uid} docs). */
async function fetchPublicProfilesByIds(ids) {
    const map = new Map();
    const unique = [...new Set((ids || []).filter(Boolean))];
    for (let i = 0; i < unique.length; i += 10) {
        const chunk = unique.slice(i, i + 10);
        try {
            const snap = await getDocs(
                query(
                    collection(db, 'public_profiles'),
                    where(documentId(), 'in', chunk),
                    limit(chunk.length)
                )
            );
            snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
        } catch (err) {
            console.warn('[userDirectory] public_profiles batch fetch failed', err);
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

    const users = candidates
        .map((publicDoc) => {
            if (!isConsumerDirectoryMember(publicDoc, null)) return null;
            return mapDirectoryUser(publicDoc);
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
    // Enrich from the PUBLIC projection (full card fields) — not users/{uid}.
    const publicMap = await fetchPublicProfilesByIds(ids);
    return rows
        .map((row) => {
            const publicDoc = publicMap.get(row.id);
            if (publicDoc) {
                if (!isConsumerDirectoryMember(publicDoc, null)) return null;
                return mapDirectoryUser(publicDoc);
            }
            // Fallback: build a minimal card from the search row alone (no users read).
            const publicShape = {
                id: row.id,
                profileType: row.profileType || 'user',
                displayName: row.displayName || row.display_name,
                avatarUrl: row.photoURL || row.photo_url,
                accountRole: row.accountRole,
                searchable: row.searchable,
                userPublic: {},
            };
            if (!isConsumerDirectoryMember(publicShape, null)) return null;
            return mapDirectoryUser(publicShape);
        })
        .filter(Boolean);
}
