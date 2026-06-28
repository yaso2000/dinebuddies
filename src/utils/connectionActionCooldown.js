import {
  doc,
  getDoc,
  setDoc,
  deleteField,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/** 24 hours after cancel — refollow / re-like blocked until then. */
export const CONNECTION_REFOLLOW_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const COLLECTION = 'connection_action_cooldowns';

export function getConnectionCooldownDocId(viewerId, targetId) {
  return `${viewerId}_${targetId}`;
}

export function getConnectionCooldownRef(viewerId, targetId) {
  return doc(db, COLLECTION, getConnectionCooldownDocId(viewerId, targetId));
}

export function timestampToMs(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value === 'number') return value;
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return null;
}

export function getCooldownBlock(cancelledAtMs, nowMs = Date.now()) {
  if (!cancelledAtMs) return { blocked: false };
  const retryAtMs = cancelledAtMs + CONNECTION_REFOLLOW_COOLDOWN_MS;
  if (nowMs >= retryAtMs) return { blocked: false };
  return { blocked: true, cancelledAtMs, retryAtMs };
}

export function formatConnectionCooldownTimes(cancelledAtMs, retryAtMs, locale) {
  const opts = { dateStyle: 'medium', timeStyle: 'short' };
  return {
    cancelledAt: new Date(cancelledAtMs).toLocaleString(locale, opts),
    retryAt: new Date(retryAtMs).toLocaleString(locale, opts),
  };
}

export function buildFollowCooldownToast(i18n, cancelledAtMs, retryAtMs) {
  const { cancelledAt, retryAt } = formatConnectionCooldownTimes(
    cancelledAtMs,
    retryAtMs,
    i18n?.language
  );
  return i18n.t('follow_refollow_cooldown', {
    cancelledAt,
    retryAt,
    defaultValue: `You unfollowed at ${cancelledAt}. You can follow again after ${retryAt} (24 hours after unfollowing).`,
  });
}

export function buildLikeCooldownToast(i18n, cancelledAtMs, retryAtMs) {
  const { cancelledAt, retryAt } = formatConnectionCooldownTimes(
    cancelledAtMs,
    retryAtMs,
    i18n?.language
  );
  return i18n.t('like_relike_cooldown', {
    cancelledAt,
    retryAt,
    defaultValue: `You removed your like at ${cancelledAt}. You can like again after ${retryAt} (24 hours after removing it).`,
  });
}

export function showFollowCooldownWarning(showPersistentWarning, i18n, cancelledAtMs, retryAtMs) {
  showPersistentWarning({
    title: i18n.t('follow_refollow_warning_title', 'Cannot follow again yet'),
    message: buildFollowCooldownToast(i18n, cancelledAtMs, retryAtMs),
  });
}

export function showLikeCooldownWarning(showPersistentWarning, i18n, cancelledAtMs, retryAtMs) {
  showPersistentWarning({
    title: i18n.t('like_relike_warning_title', 'Cannot like again yet'),
    message: buildLikeCooldownToast(i18n, cancelledAtMs, retryAtMs),
  });
}

async function readCooldownField(viewerId, targetId, field) {
  const snap = await getDoc(getConnectionCooldownRef(viewerId, targetId));
  if (!snap.exists()) return null;
  return timestampToMs(snap.data()?.[field]);
}

export async function checkFollowRefollowAllowed(viewerId, targetId) {
  if (!viewerId || !targetId || viewerId === targetId) {
    return { ok: false, reason: 'invalid' };
  }
  const cancelledAtMs = await readCooldownField(viewerId, targetId, 'followCancelledAt');
  const block = getCooldownBlock(cancelledAtMs);
  if (block.blocked) {
    return { ok: false, reason: 'cooldown', ...block };
  }
  return { ok: true };
}

export async function checkLikeRelikeAllowed(viewerId, targetId) {
  if (!viewerId || !targetId || viewerId === targetId) {
    return { ok: false, reason: 'invalid' };
  }
  const cancelledAtMs = await readCooldownField(viewerId, targetId, 'likeCancelledAt');
  const block = getCooldownBlock(cancelledAtMs);
  if (block.blocked) {
    return { ok: false, reason: 'cooldown', ...block };
  }
  return { ok: true };
}

export async function recordFollowCancelled(viewerId, targetId) {
  if (!viewerId || !targetId || viewerId === targetId) return;
  await setDoc(
    getConnectionCooldownRef(viewerId, targetId),
    {
      viewerId,
      targetId,
      followCancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function recordLikeCancelled(viewerId, targetId) {
  if (!viewerId || !targetId || viewerId === targetId) return;
  await setDoc(
    getConnectionCooldownRef(viewerId, targetId),
    {
      viewerId,
      targetId,
      likeCancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function clearFollowCooldown(viewerId, targetId) {
  if (!viewerId || !targetId || viewerId === targetId) return;
  await setDoc(
    getConnectionCooldownRef(viewerId, targetId),
    {
      followCancelledAt: deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function clearLikeCooldown(viewerId, targetId) {
  if (!viewerId || !targetId || viewerId === targetId) return;
  await setDoc(
    getConnectionCooldownRef(viewerId, targetId),
    {
      likeCancelledAt: deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
