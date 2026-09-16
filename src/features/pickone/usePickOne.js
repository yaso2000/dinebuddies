/**
 * Pick One — last results + persistence to the user document.
 * Free and unlimited (no credits, no daily cap). See PICKONE_SPEC.md §6.
 */
import { useCallback } from 'react';
import { doc, increment, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

const RETAKE_MS = 7 * 24 * 60 * 60 * 1000; // a category can be replayed once a week

function playedAtMs(r) {
  const s = r?.playedAt?.seconds ?? r?.playedAt?._seconds ?? 0;
  return s ? s * 1000 : 0;
}

export function usePickOne() {
  const { currentUser, userProfile } = useAuth();
  const results = userProfile?.pickOne || {};

  /** Last stored result for a list ({ championId, runnerUpId, seed, plays } | null). */
  const lastResult = useCallback((listId) => results?.[listId] || null, [results]);

  /** First play is free; after that a category unlocks again a week later. */
  const retakeInfo = useCallback((listId) => {
    const at = playedAtMs(results?.[listId]);
    if (!at) return { canPlay: true, nextAt: 0, playedBefore: false };
    const nextAt = at + RETAKE_MS;
    return { canPlay: Date.now() >= nextAt, nextAt, playedBefore: true };
  }, [results]);

  /** Persist a finished duel. Merge-only; never overwrites other lists. */
  const saveResult = useCallback(async ({ listId, championId, runnerUpId, seed }) => {
    const uid = currentUser?.uid;
    if (!uid || !listId || !championId) return { ok: false };
    try {
      await updateDoc(doc(db, 'users', uid), {
        [`pickOne.${listId}.championId`]: championId,
        [`pickOne.${listId}.runnerUpId`]: runnerUpId || null,
        [`pickOne.${listId}.seed`]: seed ?? null,
        [`pickOne.${listId}.playedAt`]: serverTimestamp(),
        [`pickOne.${listId}.plays`]: increment(1),
      });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }, [currentUser]);

  /**
   * Remove a favorite from display WITHOUT resetting the weekly cooldown:
   * clears the champion but keeps playedAt, so deleting can't be used to
   * replay early (anti-cheat). It disappears from the public profile because
   * the projection only mirrors entries that still have a championId.
   */
  const deleteFavorite = useCallback(async (listId) => {
    const uid = currentUser?.uid;
    if (!uid || !listId) return { ok: false };
    try {
      await updateDoc(doc(db, 'users', uid), {
        [`pickOne.${listId}.championId`]: null,
        [`pickOne.${listId}.runnerUpId`]: null,
      });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }, [currentUser]);

  return { lastResult, retakeInfo, saveResult, deleteFavorite, signedIn: Boolean(currentUser?.uid) };
}

export default usePickOne;
