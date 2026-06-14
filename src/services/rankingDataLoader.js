/**

 * Loads ranked Paid businesses (same data as Rankings page).

 */

import { normalizeBusinessTier } from '../utils/businessSubscription';

import { collection, query, where, limit, getDocs } from 'firebase/firestore';

import { db } from '../firebase/config';

import { attachRankingScores } from './businessRankingService';

import { loadBusinessRankingStatsMap } from './businessRankingStats';



const MAX_LOAD = 20;



export async function loadRankedPaidBusinesses(opts = {}) {

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

    const statsById = await loadBusinessRankingStatsMap(ids);



    list.forEach(b => {

        b.subscriptionTier = statsById[b.id]?.subscriptionTier || b.subscriptionTier || 'free';

    });

    const paidOnly = list.filter(b => normalizeBusinessTier(b.subscriptionTier) === 'paid');

    const withScores = attachRankingScores(paidOnly, statsById);

    const sorted = [...withScores].sort((a, b) => (b.rankingScore ?? 0) - (a.rankingScore ?? 0));

    return sorted.slice(0, topN);

}

