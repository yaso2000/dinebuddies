import { useEffect, useState } from 'react';
import { subscribeBusinessEvents } from '../services/businessEvents';

/**
 * Subscribe to a business's events. Visitors get only upcoming (active,
 * not-ended) events; owners (`includeEnded`) also see past/inactive ones.
 * @param {string} businessId
 * @param {{ includeEnded?: boolean }} [opts]
 */
export function useBusinessEvents(businessId, { includeEnded = false } = {}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(Boolean(businessId));

  useEffect(() => {
    if (!businessId) { setEvents([]); setLoading(false); return undefined; }
    setLoading(true);
    const unsub = subscribeBusinessEvents(
      businessId,
      (rows) => { setEvents(rows); setLoading(false); },
      { includeEnded },
    );
    return unsub;
  }, [businessId, includeEnded]);

  return { events, loading, hasUpcoming: events.some((e) => e.isActive !== false) };
}

export default useBusinessEvents;
