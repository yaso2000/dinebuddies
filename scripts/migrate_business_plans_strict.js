/**
 * Strict business plan cleanup migration.
 * - Normalizes users.subscriptionTier for business accounts to only: free, professional, elite.
 * - Removes businessInfo.subscriptionTier, businessInfo.tier, businessInfo.subscriptionPlan.
 * Run: node scripts/migrate_business_plans_strict.js
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, deleteField } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const VALID_BUSINESS_TIERS = ['free', 'professional', 'elite'];

function normalizeBusinessTier(value) {
    if (!value || typeof value !== 'string') return 'free';
    const t = value.toLowerCase().trim();
    if (VALID_BUSINESS_TIERS.includes(t)) return t;
    if (t === 'premium') return 'elite';
    if (t === 'basic' || t === 'pro') return 'professional';
    return 'free';
}

async function migrate() {
    try {
        console.log('\n🚀 Business plans strict migration (free, professional, elite only)\n');

        const snap = await getDocs(collection(db, 'users'));
        let updated = 0;
        let skipped = 0;

        for (const docSnap of snap.docs) {
            const data = docSnap.data();
            const isBusiness = data.accountType === 'business' || data.role === 'business';
            if (!isBusiness) {
                skipped++;
                continue;
            }

            const rootTier = data.subscriptionTier;
            const fromInfo = data.businessInfo?.subscriptionTier ?? data.businessInfo?.tier ?? data.businessInfo?.subscriptionPlan;
            const source = rootTier ?? fromInfo;
            const normalized = normalizeBusinessTier(source);

            const updates = {};
            if (normalized !== rootTier) {
                updates.subscriptionTier = normalized;
            }
            if (data.businessInfo?.subscriptionTier !== undefined) {
                updates['businessInfo.subscriptionTier'] = deleteField();
            }
            if (data.businessInfo?.tier !== undefined) {
                updates['businessInfo.tier'] = deleteField();
            }
            if (data.businessInfo?.subscriptionPlan !== undefined) {
                updates['businessInfo.subscriptionPlan'] = deleteField();
            }

            if (Object.keys(updates).length === 0) {
                skipped++;
                continue;
            }

            try {
                await updateDoc(doc(db, 'users', docSnap.id), updates);
                updated++;
                const name = data.display_name || data.businessInfo?.businessName || docSnap.id;
                const parts = [];
                if (updates.subscriptionTier) parts.push(`subscriptionTier → ${updates.subscriptionTier}`);
                if (updates['businessInfo.subscriptionTier']) parts.push('removed businessInfo.subscriptionTier');
                if (updates['businessInfo.tier']) parts.push('removed businessInfo.tier');
                if (updates['businessInfo.subscriptionPlan']) parts.push('removed businessInfo.subscriptionPlan');
                console.log(`  ✅ ${name}  |  ${parts.join(', ')}`);
            } catch (e) {
                console.error(`  ❌ ${docSnap.id}:`, e.message);
            }
        }

        console.log(`\n────────────────────────────────`);
        console.log(`✅ Business accounts updated: ${updated}`);
        console.log(`⏭  Skipped (non-business or already clean): ${skipped}`);
        console.log(`────────────────────────────────`);
        console.log('🎉 Migration complete.\n');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    }
}

migrate();
