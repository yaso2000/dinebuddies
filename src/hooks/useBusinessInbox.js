import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

/**
 * The user side of the Business Inbox: the business↔user threads addressed to
 * the current user (feedback/support today; offers & announcements later).
 * Kept separate from personal user-to-user chat on purpose.
 */
export function useBusinessInbox() {
  const { currentUser } = useAuth();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid) { setThreads([]); setLoading(false); return; }
    const q = query(collection(db, 'business_feedback'), where('userId', '==', uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => {
        const ta = (a.lastMessageAt || a.createdAt)?.toMillis?.() || 0;
        const tb = (b.lastMessageAt || b.createdAt)?.toMillis?.() || 0;
        return tb - ta;
      });
      setThreads(data);
      setLoading(false);
    }, (err) => { console.error('business inbox load', err); setLoading(false); });
    return () => unsub();
  }, [currentUser?.uid]);

  const unreadCount = threads.reduce((n, t) => n + (t.unreadForUser ? 1 : 0), 0);
  return { threads, loading, unreadCount };
}
