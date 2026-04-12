import {
    collection,
    query,
    where,
    orderBy,
    documentId,
    limit,
    startAfter,
    endBefore,
    limitToLast,
    getDocs,
    getDoc,
    doc,
    getCountFromServer,
} from 'firebase/firestore';

export const ADMIN_USERS_PAGE_SIZE = 25;

/** Map Firestore docs to { id, ...data } */
export function docsToRows(snap) {
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Browse users with stable pagination (order by document id). Does not load the full collection.
 * @param {import('firebase/firestore').Firestore} db
 * @param {{ roleFilter: string, cursorLast: import('@firebase/firestore').DocumentSnapshot | null }} opts
 */
export function buildUsersBrowseQuery(db, { roleFilter, cursorLast }) {
    const col = collection(db, 'users');
    const pagePlus = ADMIN_USERS_PAGE_SIZE + 1;

    if (roleFilter && roleFilter !== 'all') {
        if (cursorLast) {
            return query(
                col,
                where('role', '==', roleFilter),
                orderBy(documentId()),
                startAfter(cursorLast),
                limit(pagePlus)
            );
        }
        return query(col, where('role', '==', roleFilter), orderBy(documentId()), limit(pagePlus));
    }

    if (cursorLast) {
        return query(col, orderBy(documentId()), startAfter(cursorLast), limit(pagePlus));
    }
    return query(col, orderBy(documentId()), limit(pagePlus));
}

/**
 * Previous page: documents before `firstVisible` (first doc on current page).
 */
export function buildUsersBrowseQueryPrev(db, { roleFilter, firstVisible }) {
    const col = collection(db, 'users');
    const pagePlus = ADMIN_USERS_PAGE_SIZE + 1;
    const order = orderBy(documentId());

    if (roleFilter && roleFilter !== 'all') {
        return query(
            col,
            where('role', '==', roleFilter),
            order,
            endBefore(firstVisible),
            limitToLast(pagePlus)
        );
    }
    return query(col, order, endBefore(firstVisible), limitToLast(pagePlus));
}

/**
 * Search: exact UID, exact email (email / authEmail), or prefix on display_name.
 */
export async function searchUsers(db, raw) {
    const term = raw.trim();
    if (!term) return [];

    const merged = new Map();

    // Firebase Auth UIDs are typically 28 chars; allow 20+ alphanumerics
    if (/^[A-Za-z0-9]{20,}$/.test(term)) {
        const d = await getDoc(doc(db, 'users', term));
        if (d.exists()) {
            return [{ id: d.id, ...d.data() }];
        }
    }

    const lower = term.toLowerCase();
    if (lower.includes('@')) {
        const [e1, e2] = await Promise.all([
            getDocs(query(collection(db, 'users'), where('email', '==', lower))),
            getDocs(query(collection(db, 'users'), where('authEmail', '==', lower))),
        ]);
        e1.forEach((d) => merged.set(d.id, { id: d.id, ...d.data() }));
        e2.forEach((d) => merged.set(d.id, { id: d.id, ...d.data() }));
        return [...merged.values()];
    }

    const snap = await getDocs(
        query(
            collection(db, 'users'),
            where('display_name', '>=', term),
            where('display_name', '<=', `${term}\uf8ff`),
            limit(40)
        )
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Browse business accounts — paginated by document id.
 * @param {{ cursorLast: *, filterBanned: boolean | null }} opts — if filterBanned true, only banned businesses
 */
export function buildBusinessBrowseQuery(db, { cursorLast, filterBanned }) {
    const col = collection(db, 'users');
    const pagePlus = ADMIN_USERS_PAGE_SIZE + 1;

    if (filterBanned) {
        if (cursorLast) {
            return query(
                col,
                where('role', '==', 'business'),
                where('banned', '==', true),
                orderBy(documentId()),
                startAfter(cursorLast),
                limit(pagePlus)
            );
        }
        return query(col, where('role', '==', 'business'), where('banned', '==', true), orderBy(documentId()), limit(pagePlus));
    }

    if (cursorLast) {
        return query(col, where('role', '==', 'business'), orderBy(documentId()), startAfter(cursorLast), limit(pagePlus));
    }
    return query(col, where('role', '==', 'business'), orderBy(documentId()), limit(pagePlus));
}

export function buildBusinessBrowseQueryPrev(db, { firstVisible, filterBanned }) {
    const col = collection(db, 'users');
    const pagePlus = ADMIN_USERS_PAGE_SIZE + 1;

    if (filterBanned) {
        return query(
            col,
            where('role', '==', 'business'),
            where('banned', '==', true),
            orderBy(documentId()),
            endBefore(firstVisible),
            limitToLast(pagePlus)
        );
    }
    return query(col, where('role', '==', 'business'), orderBy(documentId()), endBefore(firstVisible), limitToLast(pagePlus));
}

/** Exact email / UID for businesses (no full collection scan) */
export async function searchBusinesses(db, raw) {
    const term = raw.trim();
    if (!term) return [];

    if (/^[A-Za-z0-9]{20,}$/.test(term)) {
        const d = await getDoc(doc(db, 'users', term));
        if (d.exists() && d.data()?.role === 'business') {
            return [{ id: d.id, ...d.data() }];
        }
        return [];
    }

    const lower = term.toLowerCase();
    if (lower.includes('@')) {
        const merged = new Map();
        const [e1, e2] = await Promise.all([
            getDocs(query(collection(db, 'users'), where('email', '==', lower))),
            getDocs(query(collection(db, 'users'), where('authEmail', '==', lower))),
        ]);
        [e1, e2].forEach((snap) =>
            snap.docs.forEach((d) => {
                const data = d.data();
                if (data?.role === 'business') {
                    merged.set(d.id, { id: d.id, ...data });
                }
            })
        );
        return [...merged.values()];
    }

    return [];
}

/**
 * Aggregate stats without loading all user docs.
 */
export async function fetchUserStats(db) {
    const col = collection(db, 'users');
    const [totalSnap, bizSnap, teamSnap, userSnap] = await Promise.all([
        getCountFromServer(col),
        getCountFromServer(query(col, where('role', '==', 'business'))),
        getCountFromServer(query(col, where('role', 'in', ['admin', 'staff', 'support']))),
        getCountFromServer(query(col, where('role', '==', 'user'))),
    ]);
    return {
        total: totalSnap.data().count,
        businesses: bizSnap.data().count,
        team: teamSnap.data().count,
        usersRoleUser: userSnap.data().count,
    };
}

export async function fetchBusinessStats(db) {
    const col = collection(db, 'users');
    const [totalBiz, bannedBiz] = await Promise.all([
        getCountFromServer(query(col, where('role', '==', 'business'))),
        getCountFromServer(query(col, where('role', '==', 'business'), where('banned', '==', true))),
    ]);
    return {
        totalBusiness: totalBiz.data().count,
        bannedBusiness: bannedBiz.data().count,
    };
}
