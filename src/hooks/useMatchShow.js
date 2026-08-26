import { useEffect, useMemo, useState, useCallback } from 'react';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase/config';
import app from '../firebase/config';
import { useAuth } from '../context/AuthContext';

const functions = getFunctions(app, 'us-central1');
const call = (name) => httpsCallable(functions, name);

/** Live "Match or Not" show state + host/viewer actions. */
export function useMatchShow(showId) {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid || null;
  const [show, setShow] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!showId) { setLoading(false); return undefined; }
    setLoading(true);
    const unsub = onSnapshot(doc(db, 'match_shows', showId),
      (snap) => { setShow(snap.exists() ? { id: snap.id, ...snap.data() } : null); setLoading(false); },
      () => setLoading(false));
    return unsub;
  }, [showId]);

  useEffect(() => {
    if (!showId) { setApplicants([]); return undefined; }
    const q = query(collection(db, 'match_shows', showId, 'applicants'), orderBy('appliedAt', 'asc'));
    return onSnapshot(q, (snap) => setApplicants(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setApplicants([]));
  }, [showId]);

  const isHost = !!show && show.hostId === uid;
  const myApplication = useMemo(() => applicants.find((a) => a.uid === uid) || null, [applicants, uid]);
  const queue = useMemo(() => applicants.filter((a) => a.status === 'queued'), [applicants]);
  const pair = show?.currentPair || null;
  const onStage = !!pair && (uid === pair.a?.uid || uid === pair.b?.uid);

  const apply = useCallback((profile) => call('applyToMatchShow')({ showId, ...profile }), [showId]);
  const generateIntro = useCallback((hints) => call('generateMatchIntro')(hints).then((r) => r.data), []);
  const withdraw = useCallback(() => call('withdrawMatchApplication')({ showId }), [showId]);
  const selectPair = useCallback((uidA, uidB) => call('selectMatchPair')({ showId, uidA, uidB }), [showId]);
  const vote = useCallback((v) => call('voteMatch')({ showId, vote: v }), [showId]);
  const reveal = useCallback(() => call('revealMatch')({ showId }), [showId]);
  const nextPair = useCallback(() => call('nextMatchPair')({ showId }), [showId]);
  const end = useCallback(() => call('endMatchShow')({ showId }), [showId]);

  return { show, applicants, queue, loading, uid, isHost, myApplication, pair, onStage, apply, generateIntro, withdraw, selectPair, vote, reveal, nextPair, end };
}

export const matchShowApi = {
  create: (opts = {}) => call('createMatchShow')(opts).then((r) => r.data),
};
