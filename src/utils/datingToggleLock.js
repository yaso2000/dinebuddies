import { timestampToMs } from './connectionActionCooldown';

/** A new account gets one day to get the dating switch right. */
export const DATING_TOGGLE_GRACE_MS = 24 * 60 * 60 * 1000;
/** After that grace window, each change locks the switch for a week. */
export const DATING_TOGGLE_LOCK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Account age comes from Firebase Auth, which always has it — users/{uid} has no
 * reliable creation stamp.
 */
export function readAccountCreatedMs(authUser, profile) {
  const fromAuth = authUser?.metadata?.creationTime;
  if (fromAuth) {
    const ms = Date.parse(fromAuth);
    if (!Number.isNaN(ms)) return ms;
  }
  return timestampToMs(profile?.createdAt) ?? timestampToMs(profile?.created_at) ?? null;
}

/**
 * Whether the "open to dating" switch may be changed right now.
 *
 * Flipping it changes which people see a heart and which relationship a pair can
 * form, so it is not something to toggle back and forth — one change a week
 * once the account has settled.
 *
 * @param {{ authUser?: object, profile?: object, nowMs?: number }} args
 * @returns {{ locked: boolean, inGrace: boolean, changedAtMs?: number, retryAtMs?: number, graceEndsAtMs?: number }}
 */
export function getDatingToggleLock({ authUser, profile, nowMs = Date.now() } = {}) {
  const createdMs = readAccountCreatedMs(authUser, profile);
  if (createdMs != null && nowMs < createdMs + DATING_TOGGLE_GRACE_MS) {
    return { locked: false, inGrace: true, graceEndsAtMs: createdMs + DATING_TOGGLE_GRACE_MS };
  }

  const changedMs = timestampToMs(profile?.openToDatingChangedAt);
  if (changedMs != null && nowMs < changedMs + DATING_TOGGLE_LOCK_MS) {
    return {
      locked: true,
      inGrace: false,
      changedAtMs: changedMs,
      retryAtMs: changedMs + DATING_TOGGLE_LOCK_MS,
    };
  }

  return { locked: false, inGrace: false };
}

/**
 * Explains why the switch is stuck, and when it frees up.
 *
 * @param {(key: string, opts?: object) => string} t
 * @param {{ retryAtMs?: number }} lock
 * @param {string} [locale]
 */
export function datingToggleLockMessage(t, lock, locale) {
  const retryAt = lock?.retryAtMs
    ? new Date(lock.retryAtMs).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
    : '';
  return t('dating_toggle_locked_message', {
    retryAt,
    defaultValue: `You can change this again after ${retryAt}. The setting can only be changed once a week.`,
  });
}
