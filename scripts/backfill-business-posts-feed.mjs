/**
 * One-time: mirror published featured + motion posts into communityPosts.
 * Run: node scripts/backfill-business-posts-feed.mjs
 * Requires GOOGLE_APPLICATION_CREDENTIALS or firebase admin login.
 */
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
    const featuredSnap = await db
        .collection('featured_posts')
        .where('status', '==', 'published')
        .limit(500)
        .get();

    let featuredSynced = 0;
    for (const docSnap of featuredSnap.docs) {
        const data = docSnap.data() || {};
        const partnerId = data.partnerId;
        if (!partnerId) continue;

        const existing = await db
            .collection('communityPosts')
            .where('featuredPostId', '==', docSnap.id)
            .limit(1)
            .get();
        if (!existing.empty) continue;

        const titleText = String(data.title?.text ?? data.title ?? '').trim();
        const descText = String(data.description?.text ?? data.description ?? '').trim();
        const contentText = [titleText, descText].filter(Boolean).join('\n\n') || titleText;

        await db.collection('communityPosts').add({
            type: 'elite_slide',
            source: 'featured_post',
            featuredPostId: docSnap.id,
            authorId: partnerId,
            partnerId,
            content: contentText,
            status: 'published',
            likes: [],
            comments: [],
            reposts: [],
            publishedAt: data.publishedAt || data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
            createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        featuredSynced += 1;
    }

    const motionSnap = await db
        .collection('business_motion_posts')
        .where('status', '==', 'published')
        .limit(500)
        .get();

    let motionSynced = 0;
    for (const docSnap of motionSnap.docs) {
        const m = docSnap.data() || {};
        const ownerId = m.ownerId;
        if (!ownerId) continue;

        const existing = await db
            .collection('communityPosts')
            .where('motionPostId', '==', docSnap.id)
            .limit(1)
            .get();
        if (!existing.empty) continue;

        const content = m.content && typeof m.content === 'object' ? m.content : {};
        const title = String(content.title || '').trim();
        const description = String(content.description || '').trim();
        const contentText = [title, description].filter(Boolean).join('\n\n') || title;
        const imageUrl = String(m.media?.imageUrl || '').trim();

        await db.collection('communityPosts').add({
            type: 'motion_post',
            source: 'smart_post_studio',
            motionPostId: docSnap.id,
            authorId: ownerId,
            businessId: m.businessId || ownerId,
            content: contentText,
            mediaUrl: imageUrl || null,
            mediaType: imageUrl ? 'image' : null,
            status: 'published',
            motionPostSnapshot: m,
            likes: [],
            comments: [],
            reposts: [],
            publishedAt: m.publishedAt || admin.firestore.FieldValue.serverTimestamp(),
            createdAt: m.createdAt || admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        motionSynced += 1;
    }

    console.log(`Backfill done. featured=${featuredSynced}, motion=${motionSynced}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
