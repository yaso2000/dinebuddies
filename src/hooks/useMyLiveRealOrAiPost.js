import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

/**
 * The viewer's OWN live "Camera or AI?" card (if any). The owner never sees their
 * card in the guessing deck/rail (they can't guess their own), so this powers the
 * dedicated "Your card / results" entry. Returns null when there is no live card.
 */
export function useMyLiveRealOrAiPost() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid || null;
  const [activeId, setActiveId] = useState(null);
  const [post, setPost] = useState(null);

  // Track the owner's active-card pointer on their user doc.
  useEffect(() => {
    if (!uid) { setActiveId(null); return undefined; }
    return onSnapshot(
      doc(db, 'users', uid),
      (snap) => setActiveId(snap.exists() ? snap.data()?.realOrAiActivePostId || null : null),
      () => setActiveId(null)
    );
  }, [uid]);

  // Subscribe to that card; expose it only while genuinely live (not expired/ended).
  useEffect(() => {
    if (!uid || !activeId) { setPost(null); return undefined; }
    return onSnapshot(
      doc(db, 'realornai_posts', activeId),
      (snap) => {
        if (!snap.exists()) { setPost(null); return; }
        const d = { id: snap.id, ...snap.data() };
        const live = d.status === 'live' && (d.expiresAt?.toMillis?.() ?? 0) > Date.now();
        setPost(live ? d : null);
      },
      () => setPost(null)
    );
  }, [uid, activeId]);

  return { post };
}
