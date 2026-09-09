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

/**
 * Broadcast a discount offer to the business's community members (paid feature —
 * the server also enforces the paid gate).
 * @param {{ title: string, description?: string }} args
 * @returns {Promise<{ success: boolean, sent: number }>}
 */
export async function sendCommunityOffer({ title, description, oncePerMember, expiresAt }) {
  const fn = httpsCallable(getFunctions(app, REGION), 'sendCommunityOffer');
  const { data } = await fn({ title, description, oncePerMember, expiresAt });
  return data || { success: false, sent: 0 };
}

/** List the business's own community offers (with redemption counts). */
export async function listCommunityOffers({ activeOnly = false } = {}) {
  const fn = httpsCallable(getFunctions(app, REGION), 'listCommunityOffers');
  const { data } = await fn({ activeOnly });
  return Array.isArray(data?.offers) ? data.offers : [];
}

/** Redeem an offer for the scanned member (one-per-member enforced server-side). */
export async function redeemCommunityOffer({ qrToken, offerId }) {
  const fn = httpsCallable(getFunctions(app, REGION), 'redeemCommunityOffer');
  const { data } = await fn({ qrToken, offerId });
  return data || { ok: false, reason: 'error' };
}
