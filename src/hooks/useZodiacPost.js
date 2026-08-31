import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase/config';
import app from '../firebase/config';
import { useAuth } from '../context/AuthContext';

const functions = getFunctions(app, 'us-central1');
const call = (name) => httpsCallable(functions, name);

/** Live "Guess my sign?" card state + the viewer's own (final) guess. */
export function useZodiacPost(postId) {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid || null;
  const [post, setPost] = useState(null);
  const [myGuess, setMyGuess] = useState(null); // sign id | null
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postId) { setLoading(false); return undefined; }
    setLoading(true);
    return onSnapshot(doc(db, 'zodiac_posts', postId),
      (snap) => { setPost(snap.exists() ? { id: snap.id, ...snap.data() } : null); setLoading(false); },
      () => setLoading(false));
  }, [postId]);

  useEffect(() => {
    if (!postId || !uid) { setMyGuess(null); return undefined; }
    return onSnapshot(doc(db, 'zodiac_posts', postId, 'votes', uid),
      (snap) => setMyGuess(snap.exists() ? String(snap.data()?.guess || '') || null : null),
      () => setMyGuess(null));
  }, [postId, uid]);

  const isOwner = !!post && post.ownerId === uid;
  const vote = useCallback((guess) => call('voteZodiac')({ postId, guess }).then((r) => r.data), [postId]);
  const end = useCallback(() => call('endZodiacPost')({ postId }), [postId]);

  return { post, myGuess, loading, uid, isOwner, vote, end };
}

export const zodiacApi = {
  create: (opts = {}) => call('createZodiacPost')(opts).then((r) => r.data),
};
