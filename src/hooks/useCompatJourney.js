import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

/**
 * Client side of the Compatibility Journey between the current user and
 * `otherUserId`. Subscribes to the journey doc, loads the question bank, and
 * exposes the start/submit callables + a helper to read the user's own answers.
 */
export function useCompatJourney(otherUserId) {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid || null;
  const journeyId = useMemo(
    () => (uid && otherUserId ? [uid, otherUserId].sort().join('_') : null),
    [uid, otherUserId]
  );
  const [journey, setJourney] = useState(null);
  const [journeyLoading, setJourneyLoading] = useState(true);
  const [questionsById, setQuestionsById] = useState({});
  const functions = useMemo(() => getFunctions(app, 'us-central1'), []);

  useEffect(() => {
    if (!journeyId) { setJourneyLoading(false); return; }
    const unsub = onSnapshot(
      doc(db, 'compat_journeys', journeyId),
      (s) => { setJourney(s.exists() ? { id: s.id, ...s.data() } : null); setJourneyLoading(false); },
      (err) => { console.error('compat journey', err); setJourneyLoading(false); }
    );
    return () => unsub();
  }, [journeyId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'compat_questions'), where('active', '==', true)));
        if (!alive) return;
        const map = {};
        snap.forEach((d) => { map[d.id] = { id: d.id, ...d.data() }; });
        setQuestionsById(map);
      } catch (e) { console.error('compat questions load', e); }
    })();
    return () => { alive = false; };
  }, []);

  const start = async () => (await httpsCallable(functions, 'startCompatJourney')({ otherUserId }))?.data;
  const submit = async (level, answers) =>
    (await httpsCallable(functions, 'submitCompatAnswers')({ journeyId, level, answers }))?.data;
  const fetchMyAnswers = async (level) => {
    if (!journeyId || !uid) return null;
    const s = await getDoc(doc(db, 'compat_journeys', journeyId, 'answers', `${level}_${uid}`));
    return s.exists() ? (s.data().answers || {}) : null;
  };

  return { uid, journeyId, journey, journeyLoading, questionsById, start, submit, fetchMyAnswers };
}
