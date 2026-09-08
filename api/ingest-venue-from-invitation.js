/**
 * POST /api/ingest-venue-from-invitation
 * Body: { invitationId, placeId }
 *
 * User-driven growth loop: when someone publishes an invitation hosted at a
 * Google venue that is NOT yet in DineBuddies, we ingest that venue into the
 * directory (as an admin-owned virtual business) so it becomes a permanent,
 * free asset that appears in the map, the directory and future searches.
 *
 * Anti-abuse: the caller must be authenticated, must OWN the invitation, the
 * invitation must actually reference this placeId, and the place must resolve
 * to one of the app's five categories. So users can only ingest venues they
 * legitimately used — never arbitrary businesses.
 */
import { getFirestore } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from './_firebaseAdmin.js';
import { requireAuth } from './_auth.js';
import { fetchGooglePlaceMinimal } from './_googlePlacesMinimal.js';
import { resolveAllowedVenueCategory } from './_googlePlacesHours.js';
import {
  findExistingByGooglePlaceId,
  ingestVirtualBusinessFromGoogle,
} from './_virtualBusinessIngest.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const auth = await requireAuth(req);
  if (!auth.ok) {
    return res.status(auth.status || 401).json({ error: auth.error, code: auth.code });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const invitationId = String(body.invitationId || '').trim();
  const placeId = String(body.placeId || '').trim();
  if (!invitationId || !placeId || placeId.length < 10) {
    return res.status(400).json({ error: 'invitationId and a valid placeId are required' });
  }

  try {
    ensureFirebaseAdmin();
    const db = getFirestore();

    // 1) Verify the invitation exists, belongs to the caller, and references this place.
    const invRef = db.collection('invitations').doc(invitationId);
    const invSnap = await invRef.get();
    if (!invSnap.exists) {
      return res.status(404).json({ error: 'Invitation not found' });
    }
    const inv = invSnap.data() || {};
    if (String(inv.authorId || '') !== auth.uid) {
      return res.status(403).json({ error: 'Not your invitation', code: 'not-owner' });
    }
    if (String(inv.placeId || '') !== placeId) {
      return res.status(400).json({ error: 'placeId does not match the invitation', code: 'place-mismatch' });
    }
    if (inv.restaurantId) {
      return res.status(200).json({ ok: true, status: 'already-linked', restaurantId: inv.restaurantId });
    }

    // 2) Dedup — if the place is already in the directory, just link it.
    const existing = await findExistingByGooglePlaceId(placeId);
    if (existing) {
      const linkedId = existing.doc.id;
      await invRef.update({ restaurantId: linkedId, isDineBuddiesVenue: true });
      return res.status(200).json({ ok: true, status: 'linked-existing', restaurantId: linkedId });
    }

    // 3) Fetch details + category gate (flexible: any type among the five).
    const details = await fetchGooglePlaceMinimal(placeId, {});
    const category = resolveAllowedVenueCategory(details.categories);
    if (!category) {
      return res.status(422).json({
        ok: false,
        code: 'unsupported-category',
        error: 'Venue is not one of the supported categories',
      });
    }

    // 4) Ingest as an admin-owned virtual business (same pipeline as admin import).
    const publishDetails = { ...details, googlePlaceId: placeId, businessType: category };
    let docId;
    try {
      const result = await ingestVirtualBusinessFromGoogle(publishDetails);
      docId = result.docId;
    } catch (err) {
      if (err && err.code === 'place-already-exists' && err.docId) {
        docId = err.docId;
      } else {
        throw err;
      }
    }

    // 5) Tag provenance (best-effort) + link the invitation to the new venue.
    try {
      await db.collection('restaurants').doc(docId).set(
        {
          source: 'user_ingested',
          ingestedByUid: auth.uid,
          ingestedFromInvitationId: invitationId,
        },
        { merge: true }
      );
    } catch (tagErr) {
      console.warn('[ingest-venue-from-invitation] provenance tag failed', docId, tagErr?.message || tagErr);
    }
    await invRef.update({ restaurantId: docId, isDineBuddiesVenue: true });

    return res.status(200).json({ ok: true, status: 'ingested', restaurantId: docId, category });
  } catch (err) {
    console.error('[ingest-venue-from-invitation]', placeId, err);
    return res.status(500).json({ error: 'Ingest failed' });
  }
}
