import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

/**
 * Live "Real or AI?" posts for the stories rail + deck. Only OTHER people's live
 * cards (never the viewer's own — they can't guess their own). 24h TTL; expired
 * dropped client-side. Followed owners first, then newest.
 */
export function useLiveRealOrAiPosts({ enabled = true, cap = 30 } = {}) {
  const { currentUser, userProfile, isGuest } = useAuth();
  const uid = currentUser?.uid || null;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const active = enabled && !!uid && !isGuest;

  useEffect(() => {
    if (!active) { setRows([]); setLoading(false); return undefined; }
    setLoading(true);
    const q = query(collection(db, 'realornai_posts'), where('status', '==', 'live'), limit(60));
    return onSnapshot(
      q,
      (snap) => { setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); },
      () => { setRows([]); setLoading(false); }
    );
  }, [active]);

  const following = useMemo(
    () => new Set(Array.isArray(userProfile?.following) ? userProfile.following.map(String) : []),
    [userProfile?.following]
  );
  const blocked = useMemo(
    () => new Set(Array.isArray(userProfile?.blockedUserIds) ? userProfile.blockedUserIds.map(String) : []),
    [userProfile?.blockedUserIds]
  );

  const posts = useMemo(() => {
    const now = Date.now();
    const visible = rows.filter(
      (p) => p.status === 'live' && p.ownerId !== uid && !blocked.has(String(p.ownerId)) && (p.expiresAt?.toMillis?.() ?? 0) > now
    );
    const ms = (p) => (p.createdAt?.toMillis?.() ?? 0);
    visible.sort((a, b) => {
      const fa = following.has(String(a.ownerId)) ? 1 : 0;
      const fb = following.has(String(b.ownerId)) ? 1 : 0;
      if (fa !== fb) return fb - fa;
      return ms(b) - ms(a);
    });
    return visible.slice(0, cap);
  }, [rows, following, blocked, cap, uid]);

  return { posts, loading };
}
