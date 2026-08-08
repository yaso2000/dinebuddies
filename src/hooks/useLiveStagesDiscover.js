import { useCallback, useEffect, useRef, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';
import { useAuth } from '../context/AuthContext';

function readViewerCoords(userProfile) {
  const lat = Number(userProfile?.coordinates?.lat);
  const lng = Number(userProfile?.coordinates?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }
  return null;
}

/**
 * Live/open Stage directory for the mic hub (search + friends/all + nearest-first).
 * Uses setStageMembership(list_live) — that callable already has public invoker IAM.
 */
export function useLiveStagesDiscover({ filter = 'all', search = '', enabled = true } = {}) {
  const { currentUser, userProfile } = useAuth();
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);
  const reqIdRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled || !currentUser?.uid) {
      setStages([]);
      setLoading(false);
      return;
    }
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const coords = readViewerCoords(userProfile);
      const functions = getFunctions(app, 'us-central1');
      const setStageMembership = httpsCallable(functions, 'setStageMembership');
      const result = await setStageMembership({
        action: 'list_live',
        filter: filter === 'friends' ? 'friends' : 'all',
        search: String(search || '').trim().slice(0, 80),
        ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      });
      if (reqId !== reqIdRef.current) return;
      const list = Array.isArray(result?.data?.stages) ? result.data.stages : [];
      setStages(list);
    } catch (err) {
      if (reqId !== reqIdRef.current) return;
      console.error('[useLiveStagesDiscover]', err);
      setError(err);
      setStages([]);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [
    enabled,
    currentUser?.uid,
    filter,
    search,
    userProfile?.coordinates?.lat,
    userProfile?.coordinates?.lng,
  ]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void refresh();
    }, search ? 280 : 0);
    return () => clearTimeout(handle);
  }, [refresh, search]);

  return { stages, loading, error, refresh };
}
