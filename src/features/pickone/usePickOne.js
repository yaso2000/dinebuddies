/**
 * Pick One — last results + persistence to the user document.
 * Free and unlimited (no credits, no daily cap). See PICKONE_SPEC.md §6.
 */
import { useCallback } from 'react';
import { doc, increment, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

export function usePickOne() {
  const { currentUser, userProfile } = useAuth();
  const results = userProfile?.pickOne || {};

  /** Last stored result for a list ({ championId, runnerUpId, seed, plays } | null). */
  const lastResult = useCallback((listId) => results?.[listId] || null, [results]);

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

  return { lastResult, saveResult, signedIn: Boolean(currentUser?.uid) };
}

export default usePickOne;
