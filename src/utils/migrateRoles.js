/**
 * migrateRoles.js
 * 
 * One-time migration: 
 *  - role: 'partner' → role: 'business'
 *  - Remove legacy accountType field from all user documents
 */

import { collection, getDocs, doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase/config';

const assertDevOnly = () => {
    if (!import.meta.env.DEV) {
        throw new Error('Migration tools are disabled outside development builds.');
    }
};

const migrateRoles = async () => {
    assertDevOnly();
    const results = { total: 0, updatedRole: 0, removedAccountType: 0, errors: 0 };

    try {
        const allSnap = await getDocs(collection(db, 'users'));
        results.total = allSnap.size;
        console.log(`📦 Total users: ${allSnap.size}`);

        for (const docSnap of allSnap.docs) {
            const data = docSnap.data();
            const updates = {};

            // role: 'partner' → 'business'
            if (data.role === 'partner') {
                updates.role = 'business';
                results.updatedRole++;
                console.log(`  🔄 ${data.display_name || docSnap.id}: role 'partner' → 'business'`);
            }

            // Remove legacy accountType field
            if (data.accountType !== undefined) {
                updates.accountType = deleteField();
                results.removedAccountType++;
                console.log(`  🗑  ${data.display_name || docSnap.id}: accountType removed`);
            }

            if (Object.keys(updates).length > 0) {
                try {
                    await updateDoc(doc(db, 'users', docSnap.id), updates);
                } catch (e) {
                    console.error(`  ❌ Error updating ${docSnap.id}:`, e.message);
                    results.errors++;
                }
            }
        }

        console.log('\n✅ Migration summary:');
        console.log(`  role updated: ${results.updatedRole}`);
        console.log(`  accountType removed: ${results.removedAccountType}`);
        console.log(`  errors: ${results.errors}`);

        return { success: true, ...results };
    } catch (error) {
        console.error('❌ Migration failed:', error);
        return { success: false, error: error.message, ...results };
    }
};

export default migrateRoles;
