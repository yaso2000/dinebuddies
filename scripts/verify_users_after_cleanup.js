/**
 * Read-only verification for users collection after cleanup.
 * لا يقوم بأي تعديل، فقط يقرأ ويطبع تقريراً في الـ console.
 * Run: node scripts/verify_users_after_cleanup.js
 */

import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

    throw new Error(
        'Firebase Admin: ضع service-account-key.json في مجلد المشروع أو اضبط GOOGLE_APPLICATION_CREDENTIALS'
    );
}

initAdmin();
const db = admin.firestore();

const projectId =
    admin.app().options.projectId ||
    process.env.GCLOUD_PROJECT ||
    '(unknown)';

async function run() {
    try {
        console.log('');
        console.log('تقرير تحقق بعد حذف المستخدمين (قراءة فقط)');
        console.log('');

        console.log('1) projectId المتصل به:');
        console.log('   ' + projectId);
        console.log('');

        const snap = await db.collection('users').get();
        const total = snap.size;

        console.log('2) إجمالي عدد الوثائق في users:');
        console.log('   ' + total);
        console.log('');

        const users = [];
        const byRole = {};
        const byAccountType = {};

        snap.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const role = data.role != null && data.role !== '' ? String(data.role) : '(missing)';
            const accountType =
                data.accountType != null && data.accountType !== ''
                    ? String(data.accountType)
                    : '(missing)';

            byRole[role] = (byRole[role] || 0) + 1;
            byAccountType[accountType] = (byAccountType[accountType] || 0) + 1;

            users.push({
                uid: docSnap.id,
                role: data.role ?? '(missing)',
                accountType: data.accountType ?? '(missing)',
                subscriptionTier: data.subscriptionTier ?? '(missing)'
            });
        });

        console.log('3) عدد المستخدمين حسب role:');
        Object.entries(byRole)
            .sort((a, b) => String(a[0]).localeCompare(b[0]))
            .forEach(([role, count]) => {
                console.log('   ' + role + ': ' + count);
            });
        console.log('');

        console.log('4) عدد المستخدمين حسب accountType (للمراجعة فقط):');
        Object.entries(byAccountType)
            .sort((a, b) => String(a[0]).localeCompare(b[0]))
            .forEach(([type, count]) => {
                console.log('   ' + type + ': ' + count);
            });
        console.log('');

        // عرض كل المستخدمين المتبقين (طالما العدد صغير عندك)
        console.log('5) قائمة المستخدمين المتبقين (uid, role, accountType, subscriptionTier):');
        users.forEach((u, i) => {
            console.log(
                '   ' +
                    (i + 1) +
                    ') ' +
                    JSON.stringify(u)
            );
        });
        console.log('');

        // استنتاج بسيط
        console.log('6) ملخص الحالة:');
        if (total === 2) {
            console.log('   يوجد بالضبط 2 مستخدم في قاعدة البيانات (غالباً الادمن والمالك كما ذكرت).');
        } else if (total <= 5) {
            console.log('   عدد المستخدمين المتبقين قليل (<= 5)، راجع القائمة أعلاه للتأكد.');
        } else {
            console.log('   ما زال هناك أكثر من 5 مستخدمين، راجع القائمة والتقسيم حسب role و accountType.');
        }
        console.log('');
        console.log('اكتمل التحقق. لم يتم تعديل أي بيانات.');
        console.log('');

        process.exit(0);
    } catch (err) {
        console.error('فشل التحقق: ' + err.message);
        process.exit(1);
    }
}

run();