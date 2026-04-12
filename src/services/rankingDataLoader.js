/**
 * Loads ranked Elite businesses (same data as Rankings page, Elite-only).
 * Used by sidebar (top 3) and business profile (rank position).
 */
import { collection, query, where, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { attachRankingScores } from './businessRankingService';

const BATCH = 10;
const MAX_LOAD = 20;

export async function loadRankedEliteBusinesses(opts = {}) {
    const { limit: topN = MAX_LOAD } = opts;
    const q = query(
        collection(db, 'public_profiles'),
        where('profileType', '==', 'business'),
        where('businessPublic.isPublished', '==', true),
        limit(topN)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map(d => {
        const data = d.data();
        const info = data.businessPublic || {};
        const tierFromPublic = (data.subscriptionTier || 'free').toString().toLowerCase();
        return {
            id: d.id,
            uid: d.id,
            name: info.businessName || data.displayName || 'Business',
            image: info.coverImage || data.avatarUrl || null,
            subscriptionTier: tierFromPublic,
            businessPublic: {
                city: info.city || '',
                country: info.country || '',
                state: info.state || '',
                region: info.region || '',
                address: info.address || '',
                coverImage: info.coverImage
            },
            businessInfo: {}
        };
    });
    const ids = list.map(b => b.id);
    const statsById = {};

    // guests cannot read users/* — avoid permission-denied spam in console
    const canReadUsers = !!auth.currentUser;
    if (canReadUsers) {
        for (let i = 0; i < ids.length; i += BATCH) {
            const chunk = ids.slice(i, i + BATCH);
            const userSnaps = await Promise.all(chunk.map(id => getDoc(doc(db, 'users', id)).catch(() => null)));
            userSnaps.forEach((s, idx) => {
                const id = chunk[idx];
                if (!s || !s.exists()) return;
                const d = s.data();
                const biz = d.businessInfo || {};
                const members = Array.isArray(d.communityMembers) ? d.communityMembers.length : (biz.memberCount ?? 0);
                const tier = (d.subscriptionTier || 'free').toString().toLowerCase();
                statsById[id] = {
                    profileViews: Number(biz.profileViews) || 0,
                    profileLikes: Number(biz.profileLikes) || 0,
                    profileShares: Number(biz.profileShares) || 0,
                    memberCount: Number(members) || 0,
                    totalInvitations: Number(biz.totalInvitations) || 0,
                    rating: 0,
                    reviewCount: 0,
                    subscriptionTier: tier
                };
            });
        }
    }

    const reviewsRef = collection(db, 'reviews');
    for (let i = 0; i < ids.length; i += BATCH) {
        const chunk = ids.slice(i, i + BATCH);
        const [sp, sf, sr] = await Promise.all([
            getDocs(query(reviewsRef, where('partnerId', 'in', chunk), limit(100))).catch(() => ({ docs: [] })),
            getDocs(query(reviewsRef, where('profileId', 'in', chunk), limit(100))).catch(() => ({ docs: [] })),
            getDocs(query(reviewsRef, where('restaurantId', 'in', chunk), limit(100))).catch(() => ({ docs: [] }))
        ]);
        const allReviews = [...sp.docs, ...sf.docs, ...sr.docs].map(d => d.data());
        chunk.forEach(id => {
            const reviews = allReviews.filter(r => r.partnerId === id || r.profileId === id || r.restaurantId === id);
            const count = reviews.length;
            const total = reviews.reduce((s, r) => s + (r.rating || 0), 0);
            if (!statsById[id]) statsById[id] = { profileViews: 0, profileLikes: 0, profileShares: 0, memberCount: 0, totalInvitations: 0, rating: 0, reviewCount: 0, subscriptionTier: 'free' };
            statsById[id].rating = count > 0 ? total / count : 0;
            statsById[id].reviewCount = count;
        });
    }

    list.forEach(b => {
        b.subscriptionTier = statsById[b.id]?.subscriptionTier || b.subscriptionTier || 'free';
    });
    const eliteOnly = list.filter(b => (b.subscriptionTier || '').toLowerCase() === 'elite');
    const withScores = attachRankingScores(eliteOnly, statsById);
    const sorted = [...withScores].sort((a, b) => (b.rankingScore ?? 0) - (a.rankingScore ?? 0));
    return sorted.slice(0, topN);
}
