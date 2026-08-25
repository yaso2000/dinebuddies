import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

/**
 * Joinable group games for the stories rail. Shows public lobbies to everyone,
 * plus private lobbies the viewer is invited to (or hosts). Ranked: games from
 * people you follow first, then newest. Capped for the rail.
 */
export function useLiveGamesDiscover({ enabled = true, cap = 12 } = {}) {
  const { currentUser, userProfile, isGuest } = useAuth();
  const uid = currentUser?.uid || null;
  const [rows, setRows] = useState([]);

  const active = enabled && !!uid && !isGuest;

  useEffect(() => {
    if (!active) { setRows([]); return undefined; }
    const q = query(collection(db, 'group_games'), where('status', '==', 'lobby'), limit(60));
    const unsub = onSnapshot(
      q,
      (snap) => setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setRows([])
    );
    return unsub;
  }, [active]);

  const following = useMemo(
    () => new Set(Array.isArray(userProfile?.following) ? userProfile.following.map(String) : []),
    [userProfile?.following]
  );

  const games = useMemo(() => {
    const visible = rows.filter((g) => {
      if (g.status !== 'lobby') return false;
      if (g.open === true) return true; // public
      if (g.hostId === uid) return true; // my own private
      return Array.isArray(g.invitedIds) && g.invitedIds.includes(uid); // invited
    });
    const ms = (g) => (g.createdAt?.toMillis?.() ?? 0);
    visible.sort((a, b) => {
      const fa = following.has(String(a.hostId)) ? 1 : 0;
      const fb = following.has(String(b.hostId)) ? 1 : 0;
      if (fa !== fb) return fb - fa;            // followed hosts first
      return ms(b) - ms(a);                     // then newest
    });
    return visible.slice(0, cap);
  }, [rows, following, uid, cap]);

  return { games };
}
