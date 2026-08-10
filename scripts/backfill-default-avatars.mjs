/**
 * Backfill a default initials avatar for consumer accounts that have no photo.
 * Mirrors the app's existing runtime fallback (src/utils/avatarUtils.js
 * buildInitialsAvatarDataUri) but persists it to Firestore instead of
 * generating it at render time, so "no profile without a photo" holds
 * everywhere (share cards, directory cards, swipe cards, etc.).
 *
 * Dry-run by default — pass --execute to actually write.
 *
 * Usage:
 *   node scripts/backfill-default-avatars.mjs            # dry-run, prints summary
 *   node scripts/backfill-default-avatars.mjs --execute   # writes for real
 */
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from '../api/_firebaseAdmin.js';

dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const EXECUTE = process.argv.includes('--execute');
const PAGE_SIZE = 200;
const WRITE_CHUNK = 400;

function hasExistingPhoto(data) {
    return Boolean(
        String(data.avatarUrl || '').trim() ||
        String(data.avatar || '').trim() ||
        String(data.avatar_url || '').trim() ||
        String(data.photoURL || '').trim() ||
        String(data.photo_url || '').trim()
    );
}

function isBusinessAccount(data) {
    const role = String(data.role || '').toLowerCase();
    const accountType = String(data.accountType || '').toLowerCase();
    const businessInfo = data.businessInfo && typeof data.businessInfo === 'object' ? data.businessInfo : null;
    return role === 'business' || role === 'partner' || accountType === 'business' || Boolean(businessInfo && Object.keys(businessInfo).length > 0);
}

/** Same output shape as buildInitialsAvatarDataUri() in src/utils/avatarUtils.js. */
function buildInitialsAvatarDataUri(name, { size = 150, background = '7c3aed' } = {}) {
    const label = String(name || 'U').trim();
    const initials =
        label
            .split(/\s+/)
            .map((part) => part[0])
            .filter(Boolean)
            .join('')
            .toUpperCase()
            .slice(0, 2) || 'U';
    const fontSize = Math.round(size * 0.37);
    const safeInitials = initials.replace(/[<>&"']/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect fill="#${background}" width="${size}" height="${size}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="700" fill="#fff">${safeInitials}</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Same output shape as getDefaultAvatar() in src/utils/avatarUtils.js — silhouette when no usable name. */
function buildDefaultAvatarDataUri(name) {
    const label = name == null ? '' : String(name).trim();
    if (label && label !== 'User' && label !== 'Member') {
        return buildInitialsAvatarDataUri(label);
    }
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect fill="%238b5cf6" width="150" height="150"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="60" fill="white"%3E%F0%9F%91%A4%3C/text%3E%3C/svg%3E';
}

async function main() {
    ensureFirebaseAdmin();
    const db = getFirestore();

    console.log(EXECUTE ? 'Running in EXECUTE mode — writes will be committed.' : 'Running in DRY-RUN mode — no writes. Pass --execute to apply.');

    const summary = { scanned: 0, skippedBusiness: 0, alreadyHasPhoto: 0, backfilled: 0, errors: 0 };
    let pending = [];
    let lastId = null;

    const flushPending = async () => {
        if (!pending.length) return;
        if (EXECUTE) {
            let batch = db.batch();
            let inBatch = 0;
            for (const { ref, patch } of pending) {
                batch.set(ref, patch, { merge: true });
                inBatch += 1;
                if (inBatch >= WRITE_CHUNK) {
                    await batch.commit();
                    batch = db.batch();
                    inBatch = 0;
                }
            }
            if (inBatch > 0) await batch.commit();
        }
        pending = [];
    };

    for (;;) {
        let q = db.collection('users').orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
        if (lastId) q = q.startAfter(lastId);
        const snap = await q.get();
        if (snap.empty) break;

        for (const doc of snap.docs) {
            summary.scanned += 1;
            try {
                const data = doc.data() || {};
                if (isBusinessAccount(data)) {
                    summary.skippedBusiness += 1;
                    continue;
                }
                if (hasExistingPhoto(data)) {
                    summary.alreadyHasPhoto += 1;
                    continue;
                }
                const name = data.displayName || data.display_name || data.nickname || '';
                const dataUri = buildDefaultAvatarDataUri(name);
                console.log(`[${EXECUTE ? 'backfill' : 'would-backfill'}] ${doc.id} (${name || 'no name'})`);
                pending.push({
                    ref: doc.ref,
                    patch: {
                        avatar: dataUri,
                        avatarUrl: dataUri,
                        photo_url: dataUri,
                        photoURL: dataUri,
                        avatarIsGeneratedDefault: true,
                    },
                });
                summary.backfilled += 1;
                if (pending.length >= WRITE_CHUNK) await flushPending();
            } catch (err) {
                console.error(`[error] ${doc.id}`, err instanceof Error ? err.message : err);
                summary.errors += 1;
            }
        }

        lastId = snap.docs[snap.docs.length - 1].id;
        if (snap.size < PAGE_SIZE) break;
    }

    await flushPending();

    console.log('Done.', summary);
    if (!EXECUTE && summary.backfilled > 0) {
        console.log(`\nDry-run only — re-run with --execute to write ${summary.backfilled} default avatar(s).`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
