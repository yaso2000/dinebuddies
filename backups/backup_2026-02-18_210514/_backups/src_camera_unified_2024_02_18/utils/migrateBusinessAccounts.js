import { collection, getDocs, updateDoc, doc, deleteField } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Migration Script: Business Account Restructure
 * 
 * هذا السكريبت ينقل:
 * - businessInfo.businessName → display_name
 * - businessInfo.logoImage → photo_url
 * - ويحذف الحقول المكررة من businessInfo
 */

async function migrateBusinessAccounts() {
    console.log('🚀 Starting Business Accounts Migration...\n');

    try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);

        let total = 0;
        let migrated = 0;
        let skipped = 0;
        let errors = 0;

        for (const userDoc of snapshot.docs) {
            const data = userDoc.data();

            // فقط حسابات Business
            if (data.accountType === 'business' && data.businessInfo) {
                total++;
                const updates = {};
                let needsUpdate = false;

                console.log(`\n📋 Processing: ${userDoc.id}`);
                console.log(`   Current display_name: ${data.display_name || 'N/A'}`);
                console.log(`   businessInfo.businessName: ${data.businessInfo.businessName || 'N/A'}`);

                // 1. نقل businessName → display_name (إذا لم يكن موجود)
                if (data.businessInfo.businessName) {
                    if (!data.display_name || data.display_name === data.email?.split('@')[0]) {
                        updates.display_name = data.businessInfo.businessName;
                        needsUpdate = true;
                        console.log(`   ✅ Will set display_name: ${data.businessInfo.businessName}`);
                    } else {
                        console.log(`   ⏭️  display_name already exists: ${data.display_name}`);
                    }
                }

                // 2. نقل logoImage → photo_url (إذا لم يكن موجود)
                if (data.businessInfo.logoImage) {
                    if (!data.photo_url) {
                        updates.photo_url = data.businessInfo.logoImage;
                        needsUpdate = true;
                        console.log(`   ✅ Will set photo_url: ${data.businessInfo.logoImage.substring(0, 50)}...`);
                    } else {
                        console.log(`   ⏭️  photo_url already exists`);
                    }
                }

                // 3. حذف الحقول المكررة من businessInfo
                if (data.businessInfo.businessName) {
                    updates['businessInfo.businessName'] = deleteField();
                    needsUpdate = true;
                    console.log(`   🗑️  Will delete businessInfo.businessName`);
                }

                if (data.businessInfo.logoImage) {
                    updates['businessInfo.logoImage'] = deleteField();
                    needsUpdate = true;
                    console.log(`   🗑️  Will delete businessInfo.logoImage`);
                }

                // تطبيق التحديثات
                if (needsUpdate) {
                    try {
                        await updateDoc(doc(db, 'users', userDoc.id), updates);
                        migrated++;
                        console.log(`   ✅ MIGRATED successfully!`);
                    } catch (error) {
                        errors++;
                        console.error(`   ❌ ERROR:`, error.message);
                    }
                } else {
                    skipped++;
                    console.log(`   ⏭️  No migration needed (already up to date)`);
                }
            }
        }

        console.log('\n\n📊 Migration Summary:');
        console.log('═══════════════════════════════════');
        console.log(`Total Business Accounts: ${total}`);
        console.log(`✅ Migrated: ${migrated}`);
        console.log(`⏭️  Skipped: ${skipped}`);
        console.log(`❌ Errors: ${errors}`);
        console.log('═══════════════════════════════════\n');

        if (migrated > 0) {
            console.log('🎉 Migration completed successfully!');
            console.log('ℹ️  Please verify the data in Firebase Console.');
        } else if (total === 0) {
            console.log('ℹ️  No business accounts found to migrate.');
        } else {
            console.log('ℹ️  All accounts are already up to date.');
        }

        return {
            success: true,
            total,
            migrated,
            skipped,
            errors
        };

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// إذا كنت تريد تشغيل السكريبت مباشرة
if (typeof window !== 'undefined') {
    window.migrateBusinessAccounts = migrateBusinessAccounts;
    console.log('💡 Migration function loaded!');
    console.log('   Run: migrateBusinessAccounts()');
}

export default migrateBusinessAccounts;
