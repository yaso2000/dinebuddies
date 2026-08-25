import { useEffect, useState, useCallback, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase/config';
import app from '../firebase/config';
import { useAuth } from '../context/AuthContext';

const functions = getFunctions(app, 'us-central1');
const callFn = (name) => httpsCallable(functions, name);

/**
 * Live group-game state + host/player actions. Peek-proof: this only reads the
 * game doc (server writes the revealed tally after each round); raw picks are
 * never read here.
 */
export function useGroupGame(gameId) {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid || null;
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!gameId) { setLoading(false); return undefined; }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'group_games', gameId),
      (snap) => { setGame(snap.exists() ? { id: snap.id, ...snap.data() } : null); setLoading(false); },
      (err) => { setError(err); setLoading(false); }
    );
    return unsub;
  }, [gameId]);

  const isHost = !!game && game.hostId === uid;
  const isPlayer = !!game && Array.isArray(game.playerIds) && game.playerIds.includes(uid);

  const start = useCallback(() => callFn('startGroupGame')({ gameId }), [gameId]);
  const answer = useCallback((round, optionIndex) => callFn('submitGroupAnswer')({ gameId, round, optionIndex }), [gameId]);
  const advance = useCallback(() => callFn('advanceGroupGame')({ gameId }), [gameId]);
  const restart = useCallback(() => callFn('restartGroupGame')({ gameId }), [gameId]);
  const leave = useCallback(() => callFn('leaveGroupGame')({ gameId }), [gameId]);
  const kick = useCallback((targetId) => callFn('kickGroupPlayer')({ gameId, targetId }), [gameId]);

  const players = useMemo(() => {
    if (!game?.players) return [];
    return (game.playerIds || []).map((pid) => ({ uid: pid, ...(game.players[pid] || {}) }));
  }, [game]);

  return { game, players, loading, error, uid, isHost, isPlayer, start, answer, advance, restart, leave, kick };
}

export const groupGameApi = {
  create: (opts = {}) => callFn('createGroupGame')(opts).then((r) => r.data),
  join: (opts = {}) => callFn('joinGroupGame')(opts).then((r) => r.data),
};
