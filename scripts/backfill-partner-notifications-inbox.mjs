/**
 * Mirror existing partner_notifications into notifications (for business in-app + push).
 * Run: node scripts/backfill-partner-notifications-inbox.mjs
 */
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// SECURITY: admin credentials must NEVER come from public/ (that folder is
// web-served and would leak the key). Prefer GOOGLE_APPLICATION_CREDENTIALS,
// then a gitignored root service-account-key.json, then application default.
function resolveAdminCredential() {
    const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (envPath && existsSync(envPath)) {
        return admin.credential.cert(JSON.parse(readFileSync(envPath, 'utf8')));
    }
    const rootKey = join(__dirname, '..', 'service-account-key.json');
    if (existsSync(rootKey)) {
        return admin.credential.cert(JSON.parse(readFileSync(rootKey, 'utf8')));
    }
    return admin.credential.applicationDefault();
}

if (!admin.apps.length) {
    admin.initializeApp({ credential: resolveAdminCredential() });
}
const db = admin.firestore();

async function main() {
    const snap = await db.collection('partner_notifications').limit(500).get();
    let written = 0;
    let skipped = 0;

    for (const docSnap of snap.docs) {
        const data = docSnap.data() || {};
        const restaurantId = data.restaurantId;
        if (!restaurantId) {
            skipped += 1;
            continue;
        }

        const inboxRef = db.collection('notifications').doc(`partner_${docSnap.id}`);
        const existing = await inboxRef.get();
        if (existing.exists) {
            skipped += 1;
            continue;
        }

        let actionUrl = data.actionUrl || '/business-dashboard';
        if (data.invitationId && data.type === 'new_booking') {
            actionUrl = `/invitation/${data.invitationId}`;
        } else if (data.type === 'business_feedback') {
            actionUrl = '/business-dashboard#business-notifications';
        }

        await inboxRef.set({
            userId: restaurantId,
            type: data.type || 'new_booking',
            title: data.title || 'Notification',
            message: data.message || '',
            actionUrl,
            invitationId: data.invitationId || null,
            fromUserId: data.senderId || null,
            fromUserName: data.fromUserName || null,
            fromUserAvatar: data.fromUserAvatar || null,
            senderId: data.senderId || null,
            senderName: data.fromUserName || null,
            senderAvatar: data.fromUserAvatar || null,
            metadata: { partnerNotificationId: docSnap.id, partnerId: restaurantId },
            read: data.read === true,
            createdAt: data.timestamp || data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        });
        written += 1;
    }

    console.log(`Done. written=${written}, skipped=${skipped}, scanned=${snap.size}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
