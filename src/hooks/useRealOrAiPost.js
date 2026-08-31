import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase/config';
import app from '../firebase/config';
import { useAuth } from '../context/AuthContext';

const functions = getFunctions(app, 'us-central1');
const call = (name) => httpsCallable(functions, name);

/** Live "Real or AI?" post state + the viewer's own (final) guess. */
export function useRealOrAiPost(postId) {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid || null;
  const [post, setPost] = useState(null);
  const [myGuess, setMyGuess] = useState(null); // 'real' | 'ai' | null
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postId) { setLoading(false); return undefined; }
    setLoading(true);
    return onSnapshot(doc(db, 'realornai_posts', postId),
      (snap) => { setPost(snap.exists() ? { id: snap.id, ...snap.data() } : null); setLoading(false); },
      () => setLoading(false));
  }, [postId]);

  useEffect(() => {
    if (!postId || !uid) { setMyGuess(null); return undefined; }
    return onSnapshot(doc(db, 'realornai_posts', postId, 'votes', uid),
      (snap) => setMyGuess(snap.exists() ? String(snap.data()?.guess || '') || null : null),
      () => setMyGuess(null));
  }, [postId, uid]);

  const isOwner = !!post && post.ownerId === uid;
  // Returns { guess, truth, correct, tally, voteCount }. Idempotent — a locked
  // guess still returns the reveal, so revisits can show the answer.
  const vote = useCallback((guess) => call('voteRealOrAi')({ postId, guess }).then((r) => r.data), [postId]);
  const end = useCallback(() => call('endRealOrAiPost')({ postId }), [postId]);

  return { post, myGuess, loading, uid, isOwner, vote, end };
}

export const realOrAiApi = {
  create: (opts = {}) => call('createRealOrAiPost')(opts).then((r) => r.data),
};
