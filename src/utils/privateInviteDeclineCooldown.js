import {
  doc,
  getDoc,
  setDoc,
  deleteField,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { timestampToMs } from './connectionActionCooldown';

/** 7 days after a decline — the sender is blocked from re-inviting that recipient. */
export const PRIVATE_INVITE_DECLINE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const COLLECTION = 'private_invite_declines';

export function getPrivateInviteDeclineDocId(senderId, recipientId) {
  return `${senderId}_${recipientId}`;
}

export function getPrivateInviteDeclineRef(senderId, recipientId) {
  return doc(db, COLLECTION, getPrivateInviteDeclineDocId(senderId, recipientId));
}

/** Can `senderId` publish a new private invitation to `recipientId` right now? */
export async function checkPrivateInviteAllowed(senderId, recipientId) {
  if (!senderId || !recipientId || senderId === recipientId) {
    return { ok: false, reason: 'invalid' };
  }
  const snap = await getDoc(getPrivateInviteDeclineRef(senderId, recipientId));
  if (!snap.exists()) return { ok: true };
  const data = snap.data() || {};
  if (data.unlockedAt) return { ok: true };
  const declinedAtMs = timestampToMs(data.declinedAt);
  if (!declinedAtMs) return { ok: true };
  const retryAtMs = declinedAtMs + PRIVATE_INVITE_DECLINE_COOLDOWN_MS;
  if (Date.now() >= retryAtMs) return { ok: true };
  return { ok: false, reason: 'cooldown', declinedAtMs, retryAtMs };
}

/** Recipient declined a private invitation from senderId — re-arms the 7-day block. */
export async function recordPrivateInviteDecline(senderId, recipientId) {
  if (!senderId || !recipientId || senderId === recipientId) return;
  await setDoc(
    getPrivateInviteDeclineRef(senderId, recipientId),
    {
      senderId,
      recipientId,
      declinedAt: serverTimestamp(),
      unlockedAt: deleteField(),
    },
    { merge: true }
  );
}

/** Recipient manually clears the block on this sender ("Allow again"). */
export async function clearPrivateInviteDeclineCooldown(senderId, recipientId) {
  if (!senderId || !recipientId) return;
  await setDoc(
    getPrivateInviteDeclineRef(senderId, recipientId),
    { unlockedAt: serverTimestamp() },
    { merge: true }
  );
}

/** All senders currently blocked (declined, not yet unlocked) for this recipient — for Settings UI. */
export async function listDeclinedSendersForRecipient(recipientId) {
  if (!recipientId) return [];
  const q = query(collection(db, COLLECTION), where('recipientId', '==', recipientId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((row) => !row.unlockedAt && row.senderId);
}
