import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { mapArchivedInvitationToListItem, sortInvitationsByDateDesc } from '../utils/invitationExpiry';

function mapLegacyArchiveDoc(docSnap) {
    const item = mapArchivedInvitationToListItem(docSnap);
    return { ...item, role: 'host' };
}

/**
 * Read-only archived invitations for a user profile (host + guest entries).
 * Primary: users/{uid}/invitation_archives
 * Legacy fallback: top-level invitation_archives where hostId == uid
 *
 * @param {string | null | undefined} userId
 */
export function useInvitationArchives(userId) {
    const [userArchives, setUserArchives] = useState([]);
    const [legacyArchives, setLegacyArchives] = useState([]);
    const [loading, setLoading] = useState(Boolean(userId));

    useEffect(() => {
        if (!userId) {
            setUserArchives([]);
            setLegacyArchives([]);
            setLoading(false);
            return undefined;
        }

        setLoading(true);
        const userQ = query(
            collection(db, 'users', userId, 'invitation_archives'),
            orderBy('archivedAt', 'desc')
        );
        const unsubUser = onSnapshot(
            userQ,
            (snapshot) => {
                const list = snapshot.docs.map((docSnap) => mapArchivedInvitationToListItem(docSnap));
                setUserArchives(list);
                setLoading(false);
            },
            () => {
                setUserArchives([]);
                setLoading(false);
            }
        );

        const legacyQ = query(
            collection(db, 'invitation_archives'),
            where('hostId', '==', userId)
        );
        const unsubLegacy = onSnapshot(
            legacyQ,
            (snapshot) => {
                setLegacyArchives(snapshot.docs.map(mapLegacyArchiveDoc));
            },
            () => setLegacyArchives([])
        );

        return () => {
            unsubUser();
            unsubLegacy();
        };
    }, [userId]);

    const archives = useMemo(() => {
        const byId = new Map();
        [...legacyArchives, ...userArchives].forEach((item) => {
            const key = `${item.role || 'host'}:${item.id}`;
            if (!byId.has(key)) byId.set(key, item);
        });
        return [...byId.values()].sort(sortInvitationsByDateDesc);
    }, [userArchives, legacyArchives]);

    const hostArchives = useMemo(
        () => archives.filter((a) => a.role !== 'guest'),
        [archives]
    );
    const guestArchives = useMemo(
        () => archives.filter((a) => a.role === 'guest'),
        [archives]
    );

    return { archives, hostArchives, guestArchives, loading };
}

export default useInvitationArchives;
