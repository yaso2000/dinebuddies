import { auth } from '../firebase/config';
import { resolveApiUrl } from '../utils/resolveApiUrl';

/**
 * Fire-and-forget: after an invitation is published at a Google venue not yet in
 * DineBuddies, ask the backend to ingest that venue into the directory (as an
 * admin-owned virtual business) so it becomes a permanent free asset.
 *
 * Best-effort by design — any failure is swallowed and never surfaced: the
 * invitation itself is unaffected, and an admin can still import the venue later.
 *
 * @param {{ invitationId: string, placeId: string }} args
 */
export async function requestVenueIngestFromInvitation({ invitationId, placeId } = {}) {
  try {
    const user = auth.currentUser;
    if (!user || !invitationId || !placeId) return;
    const token = await user.getIdToken();
    await fetch(resolveApiUrl('/api/ingest-venue-from-invitation'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ invitationId, placeId }),
      keepalive: true,
    });
  } catch (err) {
    console.warn('[venueIngest] request failed', err?.message || err);
  }
}
