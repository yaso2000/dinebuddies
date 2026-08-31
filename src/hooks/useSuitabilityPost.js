import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase/config';
import app from '../firebase/config';
import { useAuth } from '../context/AuthContext';

const functions = getFunctions(app, 'us-central1');
const call = (name) => httpsCallable(functions, name);

/** Live "Who suits you?" (مَن يناسبك؟) post state + the viewer's own vote. */
export function useSuitabilityPost(postId) {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid || null;
  const [post, setPost] = useState(null);
  const [myVote, setMyVote] = useState(null); // archetype id the viewer picked, or null
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postId) { setLoading(false); return undefined; }
    setLoading(true);
    return onSnapshot(doc(db, 'suitability_posts', postId),
      (snap) => { setPost(snap.exists() ? { id: snap.id, ...snap.data() } : null); setLoading(false); },
      () => setLoading(false));
  }, [postId]);

  useEffect(() => {
    if (!postId || !uid) { setMyVote(null); return undefined; }
    return onSnapshot(doc(db, 'suitability_posts', postId, 'votes', uid),
      (snap) => setMyVote(snap.exists() ? String(snap.data()?.archetype || '') || null : null),
      () => setMyVote(null));
  }, [postId, uid]);

  const isOwner = !!post && post.ownerId === uid;
  const vote = useCallback((archetype) => call('voteSuitability')({ postId, archetype }), [postId]);
  const end = useCallback(() => call('endSuitabilityPost')({ postId }), [postId]);

  return { post, myVote, loading, uid, isOwner, vote, end };
}

export const suitabilityApi = {
  create: (opts = {}) => call('createSuitabilityPost')(opts).then((r) => r.data),
};
