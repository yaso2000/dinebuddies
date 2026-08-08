import { useCallback, useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';
import { useAuth } from '../context/AuthContext';

/**
 * Reliable host gate: current non-expired Stage for the signed-in user.
 * Uses setStageMembership(get_my_live) — that callable already has public invoker IAM.
 */
export function useMyLiveStage() {
  const { currentUser } = useAuth();
  const [stageId, setStageId] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(Boolean(currentUser?.uid));

  const refresh = useCallback(async () => {
    if (!currentUser?.uid) {
      setStageId(null);
      setMeta(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
    try {
      const functions = getFunctions(app, 'us-central1');
      const setStageMembership = httpsCallable(functions, 'setStageMembership');
      const result = await setStageMembership({ action: 'get_my_live' });
      const id = result?.data?.stageId || null;
      setStageId(id);
      setMeta(id ? result.data : null);
      return id;
    } catch (err) {
      console.error('[useMyLiveStage]', err);
      setStageId(null);
      setMeta(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    stageId,
    meta,
    loading,
    hasLiveStage: Boolean(stageId),
    refresh,
  };
}
