import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase/config';
import app from '../firebase/config';

const functions = getFunctions(app, 'us-central1');
const call = (name) => httpsCallable(functions, name);

/**
 * Live business Food-Trivia state for a Stage. Watches the stage doc for the
 * active trivia game id, then the game doc itself. Peek-proof: only reads the
 * game doc (server writes the correct answer into the reveal after each round).
 */
export function useStageTrivia(stageId) {
  const [gameId, setGameId] = useState(null);
  const [game, setGame] = useState(null);

  useEffect(() => {
    if (!stageId) { setGameId(null); return undefined; }
    return onSnapshot(
      doc(db, 'stages', stageId),
      (snap) => setGameId(snap.exists() ? (snap.data()?.activeTriviaGameId || null) : null),
      () => setGameId(null)
    );
  }, [stageId]);

  useEffect(() => {
    if (!gameId) { setGame(null); return undefined; }
    return onSnapshot(
      doc(db, 'trivia_games', gameId),
      (snap) => setGame(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      () => setGame(null)
    );
  }, [gameId]);

  const start = useCallback((roundCount) => call('startTriviaGame')({ stageId, roundCount }).then((r) => r.data), [stageId]);
  const submit = useCallback((round, optionIndex) => call('submitTriviaAnswer')({ gameId, round, optionIndex }), [gameId]);
  const advance = useCallback(() => call('advanceTriviaGame')({ gameId }), [gameId]);
  const end = useCallback(() => call('endTriviaGame')({ gameId }), [gameId]);
  const generate = useCallback((topic, count) => call('generateTriviaQuestions')({ topic, count }).then((r) => r.data), []);

  // A finished game still points from the stage briefly; treat finished as active-for-display.
  const active = !!game && game.status !== 'finished' ? game : (game && game.status === 'finished' ? game : null);
  return { game: active, gameId, start, submit, advance, end, generate };
}
