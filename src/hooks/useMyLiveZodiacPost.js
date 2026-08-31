import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

/**
 * The viewer's OWN live "Guess my sign?" card (if any). The owner never sees their
 * card in the guessing deck/rail, so this powers the dedicated "Your card" entry.
 * Returns null when there is no live card.
 */
export function useMyLiveZodiacPost() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid || null;
  const [activeId, setActiveId] = useState(null);
  const [post, setPost] = useState(null);

  useEffect(() => {
    if (!uid) { setActiveId(null); return undefined; }
    return onSnapshot(
      doc(db, 'users', uid),
      (snap) => setActiveId(snap.exists() ? snap.data()?.zodiacActivePostId || null : null),
      () => setActiveId(null)
    );
  }, [uid]);

  useEffect(() => {
    if (!uid || !activeId) { setPost(null); return undefined; }
    return onSnapshot(
      doc(db, 'zodiac_posts', activeId),
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
