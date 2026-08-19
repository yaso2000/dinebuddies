import { useCallback, useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';
import { useAuth } from '../context/AuthContext';

const FUNCTIONS_REGION = 'us-central1';

function callable(name) {
  return httpsCallable(getFunctions(app, FUNCTIONS_REGION), name);
}

export function usePaymentMethods() {
  const { currentUser } = useAuth();
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState(null);

  const refresh = useCallback(async () => {
    const uid = currentUser?.uid || currentUser?.id;
    if (!uid) {
      setMethods([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await callable('listPaymentMethods')();
      setMethods(Array.isArray(result.data?.methods) ? result.data.methods : []);
    } catch (e) {
      console.error('[usePaymentMethods/refresh]', e);
      setMethods([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid, currentUser?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createSetupIntent = useCallback(async () => {
    const result = await callable('createSetupIntent')();
    return result.data?.clientSecret || null;
  }, []);

  const setDefault = useCallback(
    async (paymentMethodId) => {
      setMutatingId(paymentMethodId);
      try {
        await callable('setDefaultPaymentMethod')({ paymentMethodId });
        await refresh();
      } finally {
        setMutatingId(null);
      }
    },
    [refresh]
  );

  const removeMethod = useCallback(
    async (paymentMethodId) => {
      setMutatingId(paymentMethodId);
      try {
        await callable('deletePaymentMethod')({ paymentMethodId });
        await refresh();
      } finally {
        setMutatingId(null);
      }
    },
    [refresh]
  );

  return {
    methods,
    loading,
    mutatingId,
    refresh,
    createSetupIntent,
    setDefault,
    removeMethod,
  };
}
