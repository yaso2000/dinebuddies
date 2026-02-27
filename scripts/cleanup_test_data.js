/**
 * ============================================================
 * DineBuddies - Test Data Cleanup Script
 * ============================================================
 *
 * PURPOSE: Remove all test/demo users and their associated data
 *          from Firebase Auth + Firestore before production launch.
 *
 * USAGE:
 *   node scripts/cleanup_test_data.js            ← DRY RUN (safe preview)
 *   node scripts/cleanup_test_data.js --execute  ← REAL DELETION (irreversible)
 *
 * REQUIREMENTS:
 *   npm install firebase-admin dotenv
 *   Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_KEY env var.
 *
 * ============================================================
 */

const admin = require('firebase-admin');
const path = require('path');

// ─────────────────────────────────────────────
// 1. CONFIGURATION
// ─────────────────────────────────────────────

/**
 * DRY_RUN = true  → only prints what WOULD be deleted (safe, no changes made)
 * DRY_RUN = false → actually deletes data (pass --execute flag to enable)
 */
const DRY_RUN = !process.argv.includes('--execute');

/**
 * GOLDEN_ACCOUNTS: These UIDs (or emails) will NEVER be deleted.
 * Add your QA test account UIDs here before running.
 *
 * How to find a UID:
 *   Firebase Console → Authentication → Users → copy the UID column value
 */
const GOLDEN_ACCOUNTS = new Set([
    // 'UID_OF_QA_ACCOUNT_1',   // e.g. QA Tester – Individual user
    // 'UID_OF_QA_ACCOUNT_2',   // e.g. QA Tester – Business/Partner account
]);

/**
 * Patterns that identify a "test" user.
 * A user matching ANY of these criteria will be queued for deletion.
 */
const TEST_DETECTION_RULES = {
    // Firestore field: isDemo === true
    isDemo: true,

    // Emails containing these substrings (case-insensitive)
    emailSubstrings: [
        '@d.c',          // the demo email domain used in the app
        'test@',
        '@test.',
        'demo@',
        '@demo.',
        'testacc',
        'demouser',
        'fake',
        'dummy',
        'staging',
        'qa@',
        'qa.',
    ],

    // Display names containing these substrings
    nameSubstrings: [
        'test user',
        'demo user',
        'testaccount',
        'fake user',
    ],

    // Roles that indicate a non-real user
    testRoles: ['test', 'demo', 'admin-test'],
};

// ─────────────────────────────────────────────
// 2. FIREBASE ADMIN INITIALIZATION
// ─────────────────────────────────────────────

// Option A: Use a service account JSON file
// Place your service account key file at project root and reference it here.
const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '../service-account-key.json');

try {
    const serviceAccount = require(SERVICE_ACCOUNT_PATH);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'dinebuddies',
    });
} catch (e) {
    // Option B: Use GOOGLE_APPLICATION_CREDENTIALS environment variable
    // Set it to the full path of your service account JSON file before running.
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({
            projectId: 'dinebuddies',
        });
    } else {
        console.error('\n❌ ERROR: No service account found!');
        console.error('   Place service-account-key.json in project root, OR');
        console.error('   set GOOGLE_APPLICATION_CREDENTIALS environment variable.\n');
        console.error('   Download from: Firebase Console → Project Settings → Service accounts\n');
        process.exit(1);
    }
}

const db = admin.firestore();
const authAdmin = admin.auth();

// ─────────────────────────────────────────────
// 3. HELPER UTILITIES
// ─────────────────────────────────────────────

const log = (...args) => console.log(...args);
const warn = (...args) => console.warn('⚠️ ', ...args);
const success = (...args) => console.log('✅', ...args);
const info = (...args) => console.log('ℹ️ ', ...args);

/**
 * Checks whether a Firestore user document belongs to a test account.
 */
function isTestUser(userData, uid) {
    if (GOLDEN_ACCOUNTS.has(uid)) return false;
    if (GOLDEN_ACCOUNTS.has(userData.email)) return false;

    // Check isDemo flag
    if (userData.isDemo === true) return true;

    // Check email patterns
    const email = (userData.email || '').toLowerCase();
    for (const sub of TEST_DETECTION_RULES.emailSubstrings) {
        if (email.includes(sub.toLowerCase())) return true;
    }

    // Check display name patterns
    const name = (userData.display_name || userData.displayName || '').toLowerCase();
    for (const sub of TEST_DETECTION_RULES.nameSubstrings) {
        if (name.includes(sub.toLowerCase())) return true;
    }

    // Check role
    const role = (userData.role || '').toLowerCase();
    if (TEST_DETECTION_RULES.testRoles.includes(role)) return true;

    return false;
}

/**
 * Deletes all documents in a Firestore collection in batches (max 500 per batch).
 */
async function deleteCollection(collectionRef, label) {
    let totalDeleted = 0;
    const snapshot = await collectionRef.get();
    if (snapshot.empty) return 0;

    // Batch deletes in chunks of 500 (Firestore limit)
    const chunks = [];
    let chunk = [];
    snapshot.docs.forEach(doc => {
        chunk.push(doc.ref);
        if (chunk.length === 500) { chunks.push(chunk); chunk = []; }
    });
    if (chunk.length > 0) chunks.push(chunk);

    for (const group of chunks) {
        if (!DRY_RUN) {
            const batch = db.batch();
            group.forEach(ref => batch.delete(ref));
            await batch.commit();
        }
        totalDeleted += group.length;
    }

    return totalDeleted;
}

/**
 * Deletes a single document (and optionally its subcollections) safely.
 */
async function deleteDocument(docRef) {
    if (!DRY_RUN) {
        await docRef.delete();
    }
}

// ─────────────────────────────────────────────
// 4. CLEANUP FUNCTIONS PER COLLECTION
// ─────────────────────────────────────────────

/**
 * Deletes all invitations (and their messages subcollection) created by a test user.
 */
async function cleanupInvitations(testUid, displayName) {
    const q = db.collection('invitations').where('author.id', '==', testUid);
    const snap = await q.get();
    if (snap.empty) return 0;

    let count = 0;
    for (const doc of snap.docs) {
        // Delete messages subcollection first
        const messagesRef = doc.ref.collection('messages');
        const msgCount = await deleteCollection(messagesRef, `invitations/${doc.id}/messages`);
        info(`  [invitations/${doc.id}] → ${msgCount} messages deleted`);

        await deleteDocument(doc.ref);
        count++;
    }
    return count;
}

/**
 * Deletes all chat rooms (and their messages subcollection) created by a test user.
 */
async function cleanupChats(testUid) {
    const q = db.collection('chats').where('createdBy', '==', testUid);
    const snap = await q.get();
    if (snap.empty) return 0;

    let count = 0;
    for (const doc of snap.docs) {
        const messagesRef = doc.ref.collection('messages');
        await deleteCollection(messagesRef, `chats/${doc.id}/messages`);
        await deleteDocument(doc.ref);
        count++;
    }
    return count;
}

/**
 * Deletes all 1-on-1 conversations where the test user is a participant.
 */
async function cleanupConversations(testUid) {
    const q = db.collection('conversations').where('participants', 'array-contains', testUid);
    const snap = await q.get();
    if (snap.empty) return 0;

    let count = 0;
    for (const doc of snap.docs) {
        const messagesRef = doc.ref.collection('messages');
        await deleteCollection(messagesRef, `conversations/${doc.id}/messages`);
        await deleteDocument(doc.ref);
        count++;
    }
    return count;
}

/**
 * Deletes all reviews written by the test user (top-level and subcollection).
 */
async function cleanupReviews(testUid) {
    let count = 0;

    // Top-level /reviews collection
    const q1 = db.collection('reviews').where('fromUserId', '==', testUid);
    const snap1 = await q1.get();
    for (const doc of snap1.docs) {
        await deleteDocument(doc.ref);
        count++;
    }

    // /users/{uid}/reviews subcollection
    const q2 = db.collection('users').doc(testUid).collection('reviews');
    count += await deleteCollection(q2, `users/${testUid}/reviews`);

    return count;
}

/**
 * Deletes all notifications belonging to the test user.
 */
async function cleanupNotifications(testUid) {
    const q = db.collection('notifications').where('userId', '==', testUid);
    const snap = await q.get();
    let count = 0;
    for (const doc of snap.docs) {
        await deleteDocument(doc.ref);
        count++;
    }
    return count;
}

/**
 * Deletes partner_notifications for the test user (business accounts).
 */
async function cleanupPartnerNotifications(testUid) {
    const q = db.collection('partner_notifications').where('restaurantId', '==', testUid);
    const snap = await q.get();
    let count = 0;
    for (const doc of snap.docs) {
        await deleteDocument(doc.ref);
        count++;
    }
    return count;
}

/**
 * Deletes system_messages and reports tied to the test user.
 */
async function cleanupSystemData(testUid) {
    let count = 0;

    const q1 = db.collection('system_messages').where('userId', '==', testUid);
    const snap1 = await q1.get();
    for (const doc of snap1.docs) { await deleteDocument(doc.ref); count++; }

    const q2 = db.collection('reports').where('reportedBy', '==', testUid);
    const snap2 = await q2.get();
    for (const doc of snap2.docs) { await deleteDocument(doc.ref); count++; }

    // Also delete any reports about this test user
    const q3 = db.collection('reports').where('reportedUserId', '==', testUid);
    const snap3 = await q3.get();
    for (const doc of snap3.docs) { await deleteDocument(doc.ref); count++; }

    return count;
}

/**
 * Deletes user preferences subcollection.
 */
async function cleanupPreferences(testUid) {
    const ref = db.collection('users').doc(testUid).collection('preferences');
    return await deleteCollection(ref, `users/${testUid}/preferences`);
}

/**
 * Deletes the user document from Firestore and from Firebase Auth.
 */
async function deleteUserFromAuth(uid) {
    if (!DRY_RUN) {
        try {
            await authAdmin.deleteUser(uid);
        } catch (e) {
            // User might not exist in Firebase Auth (Firestore-only account)
            warn(`Could not delete Auth user ${uid}: ${e.message}`);
        }
    }
}

// ─────────────────────────────────────────────
// 5. MAIN CLEANUP ORCHESTRATOR
// ─────────────────────────────────────────────

async function cleanupTestUser(uid, userData) {
    const name = userData.display_name || userData.displayName || '(no name)';
    const email = userData.email || '(no email)';

    log(`\n  👤 ${name} <${email}> [UID: ${uid}]`);

    const [invitations, chats, conversations, reviews, notifications,
        partnerNotifs, systemData, preferences] = await Promise.all([
            cleanupInvitations(uid, name),
            cleanupChats(uid),
            cleanupConversations(uid),
            cleanupReviews(uid),
            cleanupNotifications(uid),
            cleanupPartnerNotifications(uid),
            cleanupSystemData(uid),
            cleanupPreferences(uid),
        ]);

    log(`     ├─ Invitations:            ${invitations}`);
    log(`     ├─ Chats:                  ${chats}`);
    log(`     ├─ Conversations:          ${conversations}`);
    log(`     ├─ Reviews:                ${reviews}`);
    log(`     ├─ Notifications:          ${notifications}`);
    log(`     ├─ Partner Notifications:  ${partnerNotifs}`);
    log(`     ├─ System/Reports:         ${systemData}`);
    log(`     └─ Preferences:            ${preferences}`);

    // Delete Firestore user doc
    await deleteDocument(db.collection('users').doc(uid));

    // Delete Firebase Auth account
    await deleteUserFromAuth(uid);

    return { invitations, chats, conversations, reviews, notifications, partnerNotifs, systemData, preferences };
}

// ─────────────────────────────────────────────
// 6. ENTRY POINT
// ─────────────────────────────────────────────

async function main() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║        DineBuddies — Test Data Cleanup Script                ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    if (DRY_RUN) {
        console.log('\n🔍 MODE: DRY RUN — No data will be deleted. Just a preview.\n');
        console.log('   To actually delete, run: node scripts/cleanup_test_data.js --execute\n');
    } else {
        console.log('\n🚨 MODE: EXECUTE — DATA WILL BE PERMANENTLY DELETED!\n');
        console.log('   You have 5 seconds to cancel (Ctrl+C)...\n');
        await new Promise(r => setTimeout(r, 5000));
    }

    // ── Step 1: Fetch all Firestore users
    log('📦 Fetching all users from Firestore...');
    const usersSnapshot = await db.collection('users').get();
    log(`   Found ${usersSnapshot.size} total user documents.\n`);

    // ── Step 2: Identify test users
    const testUsers = [];
    const skippedGolden = [];

    for (const docSnap of usersSnapshot.docs) {
        const uid = docSnap.id;
        const data = docSnap.data();

        if (GOLDEN_ACCOUNTS.has(uid) || GOLDEN_ACCOUNTS.has(data.email)) {
            skippedGolden.push({ uid, name: data.display_name, email: data.email });
            continue;
        }

        if (isTestUser(data, uid)) {
            testUsers.push({ uid, data });
        }
    }

    if (skippedGolden.length > 0) {
        log('🥇 Golden Accounts (PROTECTED, will not be deleted):');
        skippedGolden.forEach(u => log(`   • ${u.name} <${u.email}> [${u.uid}]`));
        log('');
    }

    if (testUsers.length === 0) {
        success('No test users found matching the detection rules. Database is already clean!');
        process.exit(0);
    }

    log(`🗑️  Test users to be deleted (${testUsers.length} found):`);

    // ── Step 3: Run cleanup for each test user
    let totals = {
        users: 0, invitations: 0, chats: 0, conversations: 0,
        reviews: 0, notifications: 0, partnerNotifs: 0, systemData: 0, preferences: 0
    };

    for (const { uid, data } of testUsers) {
        const result = await cleanupTestUser(uid, data);
        totals.users++;
        totals.invitations += result.invitations;
        totals.chats += result.chats;
        totals.conversations += result.conversations;
        totals.reviews += result.reviews;
        totals.notifications += result.notifications;
        totals.partnerNotifs += result.partnerNotifs;
        totals.systemData += result.systemData;
        totals.preferences += result.preferences;
    }

    // ── Step 4: Summary
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                        SUMMARY                               ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    log(`  Users deleted:              ${totals.users}`);
    log(`  Invitations deleted:        ${totals.invitations}`);
    log(`  Chats deleted:              ${totals.chats}`);
    log(`  Conversations deleted:      ${totals.conversations}`);
    log(`  Reviews deleted:            ${totals.reviews}`);
    log(`  Notifications deleted:      ${totals.notifications}`);
    log(`  Partner Notifications:      ${totals.partnerNotifs}`);
    log(`  System/Reports deleted:     ${totals.systemData}`);
    log(`  Preferences deleted:        ${totals.preferences}`);

    if (DRY_RUN) {
        console.log('\n⚪ DRY RUN COMPLETE — Nothing was deleted.');
        console.log('   Review the list above, then run with --execute when ready.\n');
    } else {
        console.log('\n🟢 CLEANUP COMPLETE — All test data has been removed!\n');
        console.log('   ⚠️  NOTE: Firebase Auth also does not support auto-increment IDs.');
        console.log('   Firestore uses random document IDs — no reset is needed.\n');
        console.log('   NEXT STEP: Deploy updated Firestore security rules to block test data.\n');
    }
}

main().catch(err => {
    console.error('\n❌ Fatal error during cleanup:', err);
    process.exit(1);
});
