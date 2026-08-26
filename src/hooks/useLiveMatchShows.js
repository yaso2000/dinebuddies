import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

/**
 * Live "Match or Not" shows for the stories rail. Public shows to everyone, plus
 * private shows the viewer hosts or is invited to. Followed hosts first, newest.
 */
export function useLiveMatchShows({ enabled = true, cap = 8 } = {}) {
  const { currentUser, userProfile, isGuest } = useAuth();
  const uid = currentUser?.uid || null;
  const [rows, setRows] = useState([]);
  const active = enabled && !!uid && !isGuest;

  useEffect(() => {
    if (!active) { setRows([]); return undefined; }
    const q = query(collection(db, 'match_shows'), where('status', '==', 'live'), limit(40));
    return onSnapshot(q, (snap) => setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setRows([]));
  }, [active]);

  const following = useMemo(
    () => new Set(Array.isArray(userProfile?.following) ? userProfile.following.map(String) : []),
    [userProfile?.following]
  );

  const shows = useMemo(() => {
    const visible = rows.filter((s) => s.status === 'live'
      && (s.open === true || s.hostId === uid || (Array.isArray(s.invitedIds) && s.invitedIds.includes(uid))));
    const ms = (s) => (s.createdAt?.toMillis?.() ?? 0);
    visible.sort((a, b) => {
      const fa = following.has(String(a.hostId)) ? 1 : 0;
      const fb = following.has(String(b.hostId)) ? 1 : 0;
      if (fa !== fb) return fb - fa;
      return ms(b) - ms(a);
    });
    return visible.slice(0, cap);
  }, [rows, following, uid, cap]);

  return { shows };
}
