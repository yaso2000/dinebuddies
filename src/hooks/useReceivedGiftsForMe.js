import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { getProfileGiftById } from '../constants/profileGifts';

/**
 * Completed profile gifts delivered to the signed-in user (Inbox tab).
 */
export function useReceivedGiftsForMe() {
  const { currentUser, isGuest, loading } = useAuth();
  const viewerUid = currentUser?.uid || currentUser?.id;
  const canLoad = Boolean(viewerUid && !isGuest && !loading);

  const [gifts, setGifts] = useState([]);
  const [synced, setSynced] = useState(!canLoad);

  useEffect(() => {
    if (!canLoad) {
      setGifts([]);
      setSynced(true);
      return undefined;
    }

    setSynced(false);
    const q = query(
      collection(db, 'profile_gifts'),
      where('recipientId', '==', viewerUid),
      where('status', '==', 'completed'),
      orderBy('createdAt', 'desc'),
      limit(40)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((docSnap) => {
          const data = docSnap.data() || {};
          const catalog = getProfileGiftById(data.giftId);
          return {
            id: docSnap.id,
            giftId: data.giftId || null,
            title: catalog?.defaultName || 'Gift',
            sentAmount: data.sentAmount,
            savedAmount: data.savedAmount,
            createdAt: data.deliveredAt || data.createdAt || null,
            senderId: data.senderId,
            senderName: data.senderDisplayName || '',
            sender: { id: data.senderId, display_name: data.senderDisplayName },
            actionUrl: data.senderId ? `/profile/${data.senderId}` : null,
          };
        });
        setGifts(rows);
        setSynced(true);
      },
      (err) => {
        console.warn('[useReceivedGiftsForMe]', err?.message || err);
        setGifts([]);
        setSynced(true);
      }
    );

    return () => unsub();
  }, [canLoad, viewerUid]);

  return { gifts, synced };
}
