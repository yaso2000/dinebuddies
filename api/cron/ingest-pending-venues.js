/**
 * Vercel Cron: GET /api/cron/ingest-pending-venues
 *
 * Periodic server-side sweep — the reliable engine of the venue growth loop.
 * Finds published invitations hosted at a Google venue that is not yet in the
 * DineBuddies directory (has a placeId, no restaurantId) and ingests each into
 * the directory as an admin-owned virtual business (category-gated, deduped),
 * then links the invitation. Runs entirely on the server, so it catches every
 * invitation regardless of how it was created — no dependency on the client.
 *
 * Secured with CRON_SECRET: Vercel passes `Authorization: Bearer <CRON_SECRET>`
 * to scheduled invocations when that env var is set.
 */
import { getFirestore } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from '../_firebaseAdmin.js';
import { fetchGooglePlaceMinimal } from '../_googlePlacesMinimal.js';
import { resolveAllowedVenueCategory } from '../_googlePlacesHours.js';
import {
  findExistingByGooglePlaceId,
  ingestVirtualBusinessFromGoogle,
} from '../_virtualBusinessIngest.js';

// Bound the work + Google Place Details calls per run.
const SCAN_LIMIT = 60;
const MAX_INGESTS_PER_RUN = 6;

export default async function handler(req, res) {
  // SECURITY: fail CLOSED. An unset CRON_SECRET previously left this endpoint
  // open to anyone (Google Places quota drain / forced ingestion). Requires the
  // secret to be configured in the deploy env (Vercel).
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(503).json({ error: 'Cron not configured (CRON_SECRET missing)' });
  }
  const header = String(req.headers.authorization || '');
  if (header !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    ensureFirebaseAdmin();
    const db = getFirestore();

    // Invitations with a non-empty placeId (auto-indexed single-field range).
    const snap = await db
      .collection('invitations')
      .where('placeId', '>', '')
      .limit(SCAN_LIMIT)
      .get();

    const summary = { scanned: snap.size, candidates: 0, ingested: 0, linked: 0, skipped: 0, failed: 0, details: [] };

    for (const docSnap of snap.docs) {
      if (summary.ingested >= MAX_INGESTS_PER_RUN) break;
      const inv = docSnap.data() || {};
      const invitationId = docSnap.id;
      const placeId = String(inv.placeId || '').trim();
      if (!placeId || placeId.length < 10 || inv.restaurantId) continue;
      summary.candidates += 1;

      try {
        // Dedup — already in the directory → just link it.
        const existing = await findExistingByGooglePlaceId(placeId);
        if (existing) {
          await docSnap.ref.update({ restaurantId: existing.doc.id, isDineBuddiesVenue: true });
          summary.linked += 1;
          summary.details.push({ invitationId, status: 'linked-existing', restaurantId: existing.doc.id });
          continue;
        }

        // Fetch details + category gate (flexible: any type among the five).
        const details = await fetchGooglePlaceMinimal(placeId, {});
        const category = resolveAllowedVenueCategory(details.categories);
        if (!category) {
          // Mark so we do not re-scan it forever; leave restaurantId null.
          await docSnap.ref.update({ venueIngestSkipped: 'unsupported-category' });
          summary.skipped += 1;
          summary.details.push({ invitationId, status: 'skipped-category' });
          continue;
        }

        const publishDetails = { ...details, googlePlaceId: placeId, businessType: category };
        let restaurantId;
        try {
          const result = await ingestVirtualBusinessFromGoogle(publishDetails);
          restaurantId = result.docId;
        } catch (err) {
          if (err && err.code === 'place-already-exists' && err.docId) {
            restaurantId = err.docId;
          } else {
            throw err;
          }
        }

        try {
          await db.collection('restaurants').doc(restaurantId).set(
            { source: 'user_ingested', ingestedFromInvitationId: invitationId },
            { merge: true }
          );
        } catch { /* best-effort provenance */ }
        await docSnap.ref.update({ restaurantId, isDineBuddiesVenue: true });

        summary.ingested += 1;
        summary.details.push({ invitationId, status: 'ingested', restaurantId, category });
      } catch (err) {
        summary.failed += 1;
        summary.details.push({ invitationId, status: 'failed', error: err?.message || String(err) });
        console.error('[cron/ingest-pending-venues]', invitationId, placeId, err);
      }
    }

    console.info('[cron/ingest-pending-venues]', JSON.stringify({ ...summary, details: undefined }));
    return res.status(200).json({ ok: true, ...summary });
  } catch (err) {
    console.error('[cron/ingest-pending-venues] fatal', err);
    return res.status(500).json({ error: 'Sweep failed' });
  }
}
