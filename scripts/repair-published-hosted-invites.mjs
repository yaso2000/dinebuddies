/**
 * One-off repair: invitations published on Cloud Function but reverted to draft
 * by the legacy client sync (copied stale private_invitations draft over social_invitations).
 *
 * Usage: $env:NODE_OPTIONS="--use-system-ca"; node scripts/repair-published-hosted-invites.mjs
 */
import dotenv from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdminCertConfig } from '../api/_firebaseAdmin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
dotenv.config({ path: resolve(root, '.env') });

if (!getApps().length) {
    initializeApp({ credential: cert(getFirebaseAdminCertConfig()) });
}

const db = getFirestore();

async function main() {
    const notifSnap = await db
        .collection('notifications')
        .where('type', '==', 'social_invitation')
        .limit(500)
        .get();

    const ids = [
        ...new Set(
            notifSnap.docs
                .map((d) => d.data()?.invitationId)
                .filter((id) => typeof id === 'string' && id)
        ),
    ];

    let repaired = 0;
    for (const id of ids) {
        const socialRef = db.collection('social_invitations').doc(id);
        const socialSnap = await socialRef.get();
        if (!socialSnap.exists) continue;
        const social = socialSnap.data() || {};
        if (social.status === 'published' && social.publishedAt) continue;

        const legacySnap = await db.collection('private_invitations').doc(id).get();
        const legacy = legacySnap.exists ? legacySnap.data() || {} : null;
        const source = legacy?.publishedAt ? legacy : null;

        if (!source) {
            // Notification exists but neither collection marked published — restore minimal publish flags.
            await socialRef.set(
                {
                    status: 'published',
                    publishedAt: social.publishedAt || FieldValue.serverTimestamp(),
                    externalInviteEnabled: true,
                },
                { merge: true }
            );
            repaired += 1;
            console.log('[repair] restored published flags:', id);
            continue;
        }

        await socialRef.set(
            {
                status: 'published',
                publishedAt: source.publishedAt,
                shareToken: source.shareToken || social.shareToken || null,
                externalInviteEnabled: source.externalInviteEnabled !== false,
                invitedFriends: source.invitedFriends || social.invitedFriends || [],
                rsvps: source.rsvps || social.rsvps || {},
            },
            { merge: true }
        );
        repaired += 1;
        console.log('[repair] synced from private_invitations:', id);
    }

    console.log(`[repair] Done. Repaired ${repaired} invitation(s).`);
}

main().catch((err) => {
    console.error('[repair] FAILED:', err.message || err);
    process.exit(1);
});
