/**
 * Migration Script: role 'partner' → 'business' + remove accountType
 * Run: node scripts/migrate_roles.js
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

async function migrateRoles() {
    try {
        console.log('\n🚀 Starting migration...\n');

        const allSnap = await getDocs(collection(db, 'users'));
        console.log(`📦 Total users found: ${allSnap.size}\n`);

        let updatedRole = 0;
        let removedAccountType = 0;

        for (const docSnap of allSnap.docs) {
            const data = docSnap.data();
            const updates = {};

            // Case 1: old role 'partner' → 'business'
            if (data.role === 'partner') {
                updates.role = 'business';
                updatedRole++;
            }

            // Case 2: has accountType field → remove it
            if (data.accountType !== undefined) {
                updates.accountType = deleteField();
                removedAccountType++;
            }

            if (Object.keys(updates).length > 0) {
                try {
                    await updateDoc(doc(db, 'users', docSnap.id), updates);
                    const name = data.display_name || data.displayName || docSnap.id;
                    const changes = [];
                    if (updates.role) changes.push(`role: '${data.role}' → 'business'`);
                    if (updates.accountType !== undefined) changes.push('accountType removed');
                    console.log(`  ✅ ${name}  |  ${changes.join(', ')}`);
                } catch (e) {
                    console.error(`  ❌ Failed for ${docSnap.id}:`, e.message);
                }
            }
        }

        console.log(`\n────────────────────────────────`);
        console.log(`✅ role 'partner' → 'business': ${updatedRole} accounts`);
        console.log(`🗑  accountType removed:         ${removedAccountType} accounts`);
        console.log(`────────────────────────────────`);
        console.log('🎉 Migration complete!\n');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    }
}

migrateRoles();
