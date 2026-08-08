/**
 * Desktop sidebar: featured directory businesses.
 * Prefer Paid tier; fill remaining slots with free published businesses.
 * Selection is shuffled so it changes on each page load / refresh.
 */
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { normalizeBusinessTier } from '../utils/businessSubscription';
import { loadBusinessRankingStatsMap } from './businessRankingStats';

const POOL_LIMIT = 60;

function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
    return arr;
}

function mapPublicProfileDoc(d) {
    const data = d.data() || {};
    const info = data.businessPublic || {};
    return {
        id: d.id,
        uid: d.id,
        name: info.businessName || data.displayName || 'Business',
        image: info.coverImage || data.avatarUrl || null,
        subscriptionTier: String(data.subscriptionTier || 'free').toLowerCase(),
        city: info.city || data.city || '',
        businessPublic: {
            city: info.city || '',
            country: info.country || '',
            coverImage: info.coverImage || null,
        },
    };
}

/**
 * @param {{ count?: number }} [opts]
 * @returns {Promise<Array>}
 */
export async function loadFeaturedDirectoryBusinesses(opts = {}) {
    const count = Math.max(1, Math.min(12, Number(opts.count) || 4));

    const q = query(
        collection(db, 'public_profiles'),
        where('profileType', '==', 'business'),
        where('businessPublic.isPublished', '==', true),
        limit(POOL_LIMIT)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map(mapPublicProfileDoc);
    if (!list.length) return [];

    const statsById = await loadBusinessRankingStatsMap(list.map((b) => b.id));
    list.forEach((b) => {
        b.subscriptionTier =
            statsById[b.id]?.subscriptionTier || b.subscriptionTier || 'free';
        b.isPaid = normalizeBusinessTier(b.subscriptionTier) === 'paid';
    });

    const paid = shuffleInPlace(list.filter((b) => b.isPaid));
    const free = shuffleInPlace(list.filter((b) => !b.isPaid));

    const picked = [];
    const seen = new Set();
    for (const b of [...paid, ...free]) {
        if (seen.has(b.id)) continue;
        seen.add(b.id);
        picked.push(b);
        if (picked.length >= count) break;
    }
    return picked;
}
