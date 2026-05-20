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
import app from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';

const ADMIN_FUNCTIONS_REGION = 'us-central1';

/** Fields on `users` used for admin prefix search (align with `toPublicProfile` in functions). */
const USER_NAME_PREFIX_FIELDS = [
    'display_name',
    'displayName',
    'nickname',
    'name',
    'businessInfo.businessName',
];

/**
 * Distinct lowercase prefixes to try: full string + each word (helps "Smith" find "John Smith").
 * @param {string} lower trimmed lowercase term
 */
function nameSearchPrefixes(lower) {
    const words = lower.split(/\s+/).filter((w) => w.length >= 2);
    const merged = [lower, ...words];
    return [...new Set(merged)].slice(0, 6);
}

export const ADMIN_USERS_PAGE_SIZE = 25;

/** Staff-facing roles (browse “team” tab) */
const TEAM_ROLES = new Set(['admin', 'staff', 'support', 'moderator']);

const CLIENT_SCAN_BATCH = 80;
const CLIENT_SCAN_MAX = 2500;

function matchesClientRoleFilter(data, roleFilter, bannedOnly = false) {
    const r = String(data?.role || '').toLowerCase();
    let ok = false;
    switch (roleFilter) {
        case 'user':
            ok = !r || r === 'user';
            break;
        case 'business':
            ok = r === 'business' || r === 'partner';
            break;
        case 'affiliate_agent':
            ok = r === 'affiliate_agent';
            break;
        case 'team':
            ok = TEAM_ROLES.has(r);
            break;
        case 'all':
        default:
            ok = true;
    }
    if (bannedOnly) return ok && data?.banned === true;
    return ok;
}

/**
 * Client-side paginated browse: scan users by document id (no role== filter).
 * Works when many accounts lack `role` and when adminBrowseUsers is not deployed yet.
 */
async function browseUsersPageClientScan(db, { roleFilter, startAfterId = null, pageSize = ADMIN_USERS_PAGE_SIZE, bannedOnly = false }) {
    const limit = Math.min(Math.max(Number(pageSize) || ADMIN_USERS_PAGE_SIZE, 1), 50);
    const need = limit + 1;
    const filter = roleFilter || 'all';
    const rows = [];
    let cursorId = startAfterId ? String(startAfterId) : null;
    let scanned = 0;

    while (rows.length < need && scanned < CLIENT_SCAN_MAX) {
        let q = query(collection(db, 'users'), orderBy(documentId()), limit(CLIENT_SCAN_BATCH));
        if (cursorId) {
            const cursorSnap = await getDoc(doc(db, 'users', cursorId));
            if (cursorSnap.exists()) {
                q = query(collection(db, 'users'), orderBy(documentId()), startAfter(cursorSnap), limit(CLIENT_SCAN_BATCH));
            }
        }
        const snap = await getDocs(q);
        if (snap.empty) break;
        scanned += snap.size;
        for (const d of snap.docs) {
            cursorId = d.id;
            const data = d.data();
            if (matchesClientRoleFilter(data, filter, bannedOnly === true)) {
                rows.push({ id: d.id, ...data });
                if (rows.length >= need) break;
            }
        }
        if (snap.size < CLIENT_SCAN_BATCH) break;
    }

    const hasNext = rows.length > limit;
    const users = rows.slice(0, limit);
    return {
        users,
        hasNext,
        lastId: users.length ? users[users.length - 1].id : null,
        firstId: users.length ? users[0].id : null,
        source: 'client-scan',
    };
}

/**
 * Paginated browse for admin/staff/support accounts.
 * @param {{ cursorLast: import('@firebase/firestore').DocumentSnapshot | null }} opts
 */
export function buildTeamBrowseQuery(db, { cursorLast }) {
    const col = collection(db, 'users');
    const pagePlus = ADMIN_USERS_PAGE_SIZE + 1;
    const order = orderBy(documentId());
    const teamRoles = [...TEAM_ROLES];
    if (cursorLast) {
        return query(col, where('role', 'in', teamRoles), order, startAfter(cursorLast), limit(pagePlus));
    }
    return query(col, where('role', 'in', teamRoles), order, limit(pagePlus));
}

export function buildTeamBrowseQueryPrev(db, { firstVisible }) {
    const col = collection(db, 'users');
    const pagePlus = ADMIN_USERS_PAGE_SIZE + 1;
    return query(
        col,
        where('role', 'in', [...TEAM_ROLES]),
        orderBy(documentId()),
        endBefore(firstVisible),
        limitToLast(pagePlus)
    );
}

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
 * Search: exact UID, exact email, or name prefix.
 * Prefer Cloud Function `adminSearchUsers` (Admin SDK + Auth email); falls back to client Firestore if unavailable.
 */
/**
 * Paginated browse via Cloud Function (Admin SDK). Falls back to client Firestore on failure.
 * @param {{ roleFilter: string, startAfterId?: string|null, pageSize?: number }} opts
 */
export async function browseUsersPage(db, { roleFilter, startAfterId = null, pageSize = ADMIN_USERS_PAGE_SIZE, bannedOnly = false }) {
    const opts = {
        roleFilter: roleFilter || 'all',
        startAfterId: startAfterId || null,
        pageSize,
        bannedOnly: bannedOnly === true,
    };

    try {
        const fn = httpsCallable(getFunctions(app, ADMIN_FUNCTIONS_REGION), 'adminBrowseUsers');
        const res = await fn({
            roleFilter: opts.roleFilter,
            startAfterId: opts.startAfterId,
            pageSize: opts.pageSize,
            bannedOnly: opts.bannedOnly,
        });
        const users = Array.isArray(res?.data?.users) ? res.data.users : [];
        return {
            users: users.filter((row) => row && typeof row === 'object' && row.id),
            hasNext: !!res?.data?.hasNext,
            lastId: res?.data?.lastId || null,
            firstId: res?.data?.firstId || null,
            source: 'callable',
        };
    } catch (e) {
        const code = e?.code || '';
        const msg = e?.message || String(e);
        console.warn('[browseUsersPage] adminBrowseUsers failed, using client scan', code, msg);
        try {
            return await browseUsersPageClientScan(db, opts);
        } catch (scanErr) {
            const scanMsg = scanErr?.message || String(scanErr);
            console.error('[browseUsersPage] client scan failed', scanMsg);
            const err = new Error(scanMsg);
            err.cause = scanErr;
            err.browseSource = 'failed';
            throw err;
        }
    }
}

function browseSnapToPageResult(snap) {
    const all = snap.docs;
    const hasMore = all.length > ADMIN_USERS_PAGE_SIZE;
    const take = hasMore ? ADMIN_USERS_PAGE_SIZE : all.length;
    const pageDocs = all.slice(0, take);
    const users = pageDocs.map((d) => ({ id: d.id, ...d.data() }));
    return {
        users,
        hasNext: hasMore,
        lastId: users.length ? users[users.length - 1].id : null,
        firstId: users.length ? users[0].id : null,
    };
}

export async function searchUsers(db, raw) {
    const term = String(raw || '').trim();
    if (!term) return [];
    try {
        const fn = httpsCallable(getFunctions(app, ADMIN_FUNCTIONS_REGION), 'adminSearchUsers');
        const res = await fn({ query: term });
        const list = res?.data?.users;
        if (Array.isArray(list)) {
            return list.filter((row) => row && typeof row === 'object' && row.id);
        }
    } catch (e) {
        console.warn('[searchUsers] adminSearchUsers failed, using client Firestore', e?.message || e);
    }
    return searchUsersFirestoreClient(db, term);
}

/**
 * Client-side search (subject to Firestore rules). Prefix queries run independently so one missing index cannot abort all.
 */
async function searchUsersFirestoreClient(db, raw) {
    const term = raw.trim();
    if (!term) return [];

    const merged = new Map();

    if (/^[A-Za-z0-9]{20,}$/.test(term)) {
        const d = await getDoc(doc(db, 'users', term));
        if (d.exists()) {
            return [{ id: d.id, ...d.data() }];
        }
        return [];
    }

    const lower = term.toLowerCase();
    if (lower.includes('@')) {
        const emailTasks = [
            getDocs(query(collection(db, 'users'), where('email', '==', lower))),
            getDocs(query(collection(db, 'users'), where('email', '==', term))),
            getDocs(query(collection(db, 'users'), where('authEmail', '==', lower))),
            getDocs(query(collection(db, 'users'), where('authEmail', '==', term))),
        ];
        const emailSettled = await Promise.allSettled(emailTasks);
        emailSettled.forEach((s) => {
            if (s.status !== 'fulfilled') {
                console.warn('[searchUsers] email query failed', s.reason?.message || s.reason);
                return;
            }
            s.value.docs.forEach((d) => merged.set(d.id, { id: d.id, ...d.data() }));
        });
        return [...merged.values()];
    }

    const pubPrefixes = nameSearchPrefixes(lower);
    const pubSnaps = await Promise.all(
        pubPrefixes.map(async (p) => {
            try {
                return await getDocs(
                    query(
                        collection(db, 'public_profiles'),
                        where('search.displayNameLower', '>=', p),
                        where('search.displayNameLower', '<=', `${p}\uf8ff`),
                        orderBy('search.displayNameLower'),
                        limit(40)
                    )
                );
            } catch (e) {
                console.warn('[searchUsers] public_profiles name search failed', p, e?.message || e);
                return null;
            }
        })
    );
    const pubIds = [...new Set(pubSnaps.filter(Boolean).flatMap((s) => s.docs.map((d) => d.id)))];
    const chunkSize = 15;
    for (let i = 0; i < pubIds.length; i += chunkSize) {
        const chunk = pubIds.slice(i, i + chunkSize);
        const userSnaps = await Promise.all(chunk.map((id) => getDoc(doc(db, 'users', id))));
        userSnaps.forEach((us) => {
            if (us.exists()) merged.set(us.id, { id: us.id, ...us.data() });
        });
    }

    const title =
        term.length > 0 ? term.charAt(0).toUpperCase() + (term.length > 1 ? lower.slice(1) : '') : lower;
    const col = collection(db, 'users');
    const tasks = [];

    for (const seg of nameSearchPrefixes(lower)) {
        const variants =
            seg === lower
                ? [...new Set([term, lower, term.toUpperCase(), title])].filter((v) => v.length >= 1)
                : [seg];
        for (const field of USER_NAME_PREFIX_FIELDS) {
            for (const v of variants) {
                tasks.push(
                    getDocs(query(col, where(field, '>=', v), where(field, '<=', `${v}\uf8ff`), limit(35)))
                );
            }
        }
    }

    const settled = await Promise.allSettled(tasks);
    settled.forEach((s) => {
        if (s.status !== 'fulfilled') {
            console.warn('[searchUsers] users prefix query failed', s.reason?.message || s.reason);
            return;
        }
        s.value.docs.forEach((d) => merged.set(d.id, { id: d.id, ...d.data() }));
    });
    return [...merged.values()].slice(0, 60);
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
