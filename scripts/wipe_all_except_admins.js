/**
 * تنظيف كامل: حذف كل المحتوى ما عدا حسابات الأدمن.
 * يحذف: البوستات، الستوري، الدعوات (العامة والخاصة)، المحادثات، الإشعارات، المراجعات، التقارير، العروض، والمستخدمين غير الأدمن.
 *
 * تشغيل تجريبي (بدون حذف):  node scripts/wipe_all_except_admins.js
 * تنفيذ فعلي:                 node scripts/wipe_all_except_admins.js --execute
 */

import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DRY_RUN = !process.argv.includes('--execute');

function initAdmin() {
    if (admin.apps.length > 0) return;
    const cwd = process.cwd();
    const keyPaths = [
        path.join(cwd, 'service-account-key.json'),
        path.join(cwd, 'serviceAccountKey.json'),
        path.join(__dirname, '..', 'service-account-key.json'),
        path.join(__dirname, '..', 'serviceAccountKey.json')
    ];
    for (const keyPath of keyPaths) {
        try {
            const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
            admin.initializeApp({ credential: admin.credential.cert(key) });
            return;
        } catch (_) {}
    }
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp();
        return;
    }
    throw new Error('Firebase Admin: ضع service-account-key.json أو اضبط GOOGLE_APPLICATION_CREDENTIALS');
}

initAdmin();
const db = admin.firestore();

const BATCH_SIZE = 500;

async function deleteCollection(ref, label) {
    const snap = await ref.get();
    if (snap.empty) return 0;
    const docs = snap.docs;
    let deleted = 0;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = docs.slice(i, i + BATCH_SIZE);
        chunk.forEach((d) => batch.delete(d.ref));
        if (!DRY_RUN) await batch.commit();
        deleted += chunk.length;
    }
    console.log('  ' + label + ': ' + deleted);
    return deleted;
}

async function deleteSubcollectionThenDoc(docRef, subcollectionId, label) {
    const subRef = docRef.collection(subcollectionId);
    const subSnap = await subRef.get();
    if (!subSnap.empty) {
        const batch = db.batch();
        subSnap.docs.forEach((d) => batch.delete(d.ref));
        if (!DRY_RUN) await batch.commit();
    }
    if (!DRY_RUN) await docRef.delete();
    return (subSnap.size || 0) + 1;
}

async function deleteCollectionWithSubcollection(collectionId, subcollectionId, label) {
    const ref = db.collection(collectionId);
    const snap = await ref.get();
    if (snap.empty) {
        console.log('  ' + label + ': 0');
        return 0;
    }
    let total = 0;
    for (const doc of snap.docs) {
        total += await deleteSubcollectionThenDoc(doc.ref, subcollectionId, label + '/' + doc.id);
    }
    console.log('  ' + label + ': ' + total + ' (docs + sub)');
    return total;
}

async function wipe() {
    console.log('');
    console.log(DRY_RUN ? '[تجريبي - لا حذف فعلي] تنظيف كل شيء ما عدا الأدمن' : '[تنفيذ] تنظيف كل شيء ما عدا الأدمن');
    console.log('');

    let totalDeleted = 0;

    const topLevelCollections = [
        'communityPosts',
        'stories',
        'notifications',
        'reviews',
        'reports',
        'partner_notifications',
        'system_messages',
        'offers',
        'active_offers',
        'special_offers',
        'public_profiles',
        'audit_log',
        'posts',
        'user_subscriptions'
    ];
    // لا نحذف: subscriptionPlans, creditPacks (إعدادات التطبيق)

    for (const coll of topLevelCollections) {
        try {
            const n = await deleteCollection(db.collection(coll), coll);
            totalDeleted += n;
        } catch (e) {
            console.log('  ' + coll + ': خطأ ' + e.message);
        }
    }

    console.log('  invitations + messages...');
    try {
        const invRef = db.collection('invitations');
        const invSnap = await invRef.get();
        let invCount = 0;
        for (const doc of invSnap.docs) {
            invCount += await deleteSubcollectionThenDoc(doc.ref, 'messages', 'invitations');
        }
        console.log('  invitations: ' + invCount);
        totalDeleted += invCount;
    } catch (e) {
        console.log('  invitations: خطأ ' + e.message);
    }

    console.log('  private_invitations + messages...');
    try {
        const privRef = db.collection('private_invitations');
        const privSnap = await privRef.get();
        let privCount = 0;
        for (const doc of privSnap.docs) {
            privCount += await deleteSubcollectionThenDoc(doc.ref, 'messages', 'private_invitations');
        }
        console.log('  private_invitations: ' + privCount);
        totalDeleted += privCount;
    } catch (e) {
        console.log('  private_invitations: خطأ ' + e.message);
    }

    console.log('  conversations + messages...');
    try {
        const convRef = db.collection('conversations');
        const convSnap = await convRef.get();
        let convCount = 0;
        for (const doc of convSnap.docs) {
            convCount += await deleteSubcollectionThenDoc(doc.ref, 'messages', 'conversations');
        }
        console.log('  conversations: ' + convCount);
        totalDeleted += convCount;
    } catch (e) {
        console.log('  conversations: خطأ ' + e.message);
    }

    console.log('  communities (وثائق فرعية)...');
    try {
        const commRef = db.collection('communities');
        const commSnap = await commRef.get();
        let commCount = 0;
        for (const doc of commSnap.docs) {
            const msgRef = doc.ref.collection('messages');
            const msgSnap = await msgRef.get();
            if (!msgSnap.empty) {
                const batch = db.batch();
                msgSnap.docs.forEach((d) => batch.delete(d.ref));
                if (!DRY_RUN) await batch.commit();
                commCount += msgSnap.size;
            }
            if (!DRY_RUN) await doc.ref.delete();
            commCount += 1;
        }
        console.log('  communities: ' + commCount);
        totalDeleted += commCount;
    } catch (e) {
        console.log('  communities: خطأ ' + e.message);
    }

    console.log('  users (غير الأدمن فقط)...');
    try {
        const usersSnap = await db.collection('users').get();
        const toDelete = usersSnap.docs.filter((d) => {
            const data = d.data();
            return data.role !== 'admin';
        });
        for (const doc of toDelete) {
            const subcollections = ['reviews', 'preferences', 'messages'];
            for (const sub of subcollections) {
                try {
                    const subRef = doc.ref.collection(sub);
                    const subSnap = await subRef.get();
                    if (!subSnap.empty) {
                        const batch = db.batch();
                        subSnap.docs.forEach((d) => batch.delete(d.ref));
                        if (!DRY_RUN) await batch.commit();
                    }
                } catch (_) {}
            }
            if (!DRY_RUN) await doc.ref.delete();
        }
        console.log('  users (محذوف): ' + toDelete.length + ' (متبقي: أدمن فقط)');
        totalDeleted += toDelete.length;
    } catch (e) {
        console.log('  users: خطأ ' + e.message);
    }

    console.log('');
    console.log('إجمالي الوثائق المحذوفة (أو التي ستُحذف): ' + totalDeleted);
    if (DRY_RUN) {
        console.log('');
        console.log('لتطبيق الحذف فعلياً شغّل: node scripts/wipe_all_except_admins.js --execute');
    }
    console.log('');
    process.exit(0);
}

wipe().catch((e) => {
    console.error('فشل: ' + e.message);
    process.exit(1);
});
