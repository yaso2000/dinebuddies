import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';

const FUNCTIONS_REGION = 'us-central1';

/** @returns {string} */
export function createGiftIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `gift-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Atomic profile gift send. Server validates amount from catalog when giftId is set.
 * @param {{ recipientId: string, amount: number, giftId?: string, idempotencyKey: string }} params
 */
export async function sendProfileGift({ recipientId, amount, giftId, idempotencyKey }) {
  if (!idempotencyKey || String(idempotencyKey).trim().length < 8) {
    throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  }
  const fn = httpsCallable(getFunctions(app, FUNCTIONS_REGION), 'sendProfileGift');
  const result = await fn({
    recipientId,
    amount,
    giftId: giftId || null,
    idempotencyKey: String(idempotencyKey).trim(),
  });
  return result.data;
}
