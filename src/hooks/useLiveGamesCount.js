import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, limit } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Count of currently live group games (joinable lobbies + in-progress), for the
 * header games badge. Open to everyone, so this is a global live count.
 */
export function useLiveGamesCount({ enabled = true } = {}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) { setCount(0); return undefined; }
    const q = query(
      collection(db, 'group_games'),
      where('status', 'in', ['lobby', 'active']),
      limit(100)
    );
    const unsub = onSnapshot(
      q,
      (snap) => setCount(snap.size),
      () => setCount(0)
    );
    return unsub;
  }, [enabled]);

  return count;
}
