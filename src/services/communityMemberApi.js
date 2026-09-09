/**
 * Community member verification — the business scans a member's QR and this
 * confirms (server-side) the token belongs to an active member of their community
 * before a discount/offer is applied.
 */
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';

const REGION = 'us-central1';

/** QR payload shape: DBM1:<partnerId>:<qrToken>. Returns null if it isn't ours. */
export function parseMembershipQrPayload(raw) {
  const text = String(raw || '').trim();
  const parts = text.split(':');
  if (parts.length !== 3 || parts[0] !== 'DBM1') return null;
  const partnerId = parts[1].trim();
  const qrToken = parts[2].trim();
  if (!partnerId || !/^[a-f0-9]{20,64}$/.test(qrToken)) return null;
  return { partnerId, qrToken };
}

/**
 * @param {{ partnerId: string, qrToken: string }} args
 * @returns {Promise<{ ok: boolean, reason?: string, memberNumber?: number|null,
 *   memberId?: string|null, memberName?: string|null, memberAvatar?: string|null,
 *   joinedAt?: number|null, status?: string }>}
 */
export async function verifyCommunityMember({ partnerId, qrToken }) {
  const fn = httpsCallable(getFunctions(app, REGION), 'verifyCommunityMember');
  const { data } = await fn({ partnerId, qrToken });
  return data || { ok: false, reason: 'error' };
}
