import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

/**
 * Live "Who suits you?" (مَن يناسبك؟) posts for the stories rail. Posts stay live
 * for 24h; we drop any that have expired client-side. Followed owners first, then
 * newest. The viewer's own live post is included so they can reopen their results.
 */
export function useLiveSuitabilityPosts({ enabled = true, cap = 8 } = {}) {
  const { currentUser, userProfile, isGuest } = useAuth();
  const uid = currentUser?.uid || null;
  const [rows, setRows] = useState([]);
  const active = enabled && !!uid && !isGuest;

  useEffect(() => {
    if (!active) { setRows([]); return undefined; }
    const q = query(collection(db, 'suitability_posts'), where('status', '==', 'live'), limit(40));
    return onSnapshot(
      q,
      (snap) => setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setRows([])
    );
  }, [active]);

  const following = useMemo(
    () => new Set(Array.isArray(userProfile?.following) ? userProfile.following.map(String) : []),
    [userProfile?.following]
  );

  const posts = useMemo(() => {
    const now = Date.now();
    // Only OTHER people's live cards — never the viewer's own (they see their own
    // results on the dedicated post page, reopened from the "+" create menu).
    const visible = rows.filter(
      (p) => p.status === 'live' && p.ownerId !== uid && (p.expiresAt?.toMillis?.() ?? 0) > now
    );
    const ms = (p) => (p.createdAt?.toMillis?.() ?? 0);
    visible.sort((a, b) => {
      const fa = following.has(String(a.ownerId)) ? 1 : 0;
      const fb = following.has(String(b.ownerId)) ? 1 : 0;
      if (fa !== fb) return fb - fa;
      return ms(b) - ms(a);
    });
    return visible.slice(0, cap);
  }, [rows, following, cap, uid]);

  return { posts };
}
