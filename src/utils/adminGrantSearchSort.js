/**
 * Rank + sort admin "Grant credits" search hits: best match first, then longer matched prefix,
 * then shorter display label (stable, readable order).
 * @param {Array<Record<string, unknown> & { id?: string }>} users
 * @param {string} rawQuery
 * @returns {typeof users}
 */
export function sortUsersForGrantSearch(users, rawQuery) {
    const q = String(rawQuery || '').trim().toLowerCase();
    if (!Array.isArray(users) || users.length === 0) return [];

    const labelLen = (u) => {
        const s = String(u.display_name || u.displayName || u.email || u.id || '');
        return s.length;
    };

    const commonPrefixLen = (hay, needle) => {
        if (!hay || !needle) return 0;
        let n = 0;
        const max = Math.min(hay.length, needle.length);
        while (n < max && hay.charAt(n) === needle.charAt(n)) n += 1;
        return n;
    };

    const scoreOne = (u) => {
        const email = String(u.email || u.authEmail || '').toLowerCase();
        const id = String(u.id || '');
        const name = String(u.display_name || u.displayName || u.nickname || u.name || '').toLowerCase();
        const biz = String(u.businessInfo?.businessName || '').toLowerCase();

        let score = 0;
        let matchedLen = 0;

        if (email === q) {
            score = 100000;
            matchedLen = q.length;
        } else if (id === q && q.length >= 20) {
            score = 95000;
            matchedLen = q.length;
        } else if (email.startsWith(q)) {
            matchedLen = commonPrefixLen(email, q);
            score = 50000 + matchedLen * 10;
        } else if (name.startsWith(q)) {
            matchedLen = commonPrefixLen(name, q);
            score = 40000 + matchedLen * 10;
        } else if (biz.startsWith(q)) {
            matchedLen = commonPrefixLen(biz, q);
            score = 35000 + matchedLen * 10;
        } else if (email.includes(q)) {
            matchedLen = q.length;
            score = 20000;
        } else if (name.includes(q) || biz.includes(q)) {
            matchedLen = q.length;
            score = 10000;
        } else {
            score = 1;
            matchedLen = 0;
        }

        return { score, matchedLen, labelLen: labelLen(u) };
    };

    return [...users]
        .map((u) => ({ u, ...scoreOne(u) }))
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (b.matchedLen !== a.matchedLen) return b.matchedLen - a.matchedLen;
            if (a.labelLen !== b.labelLen) return a.labelLen - b.labelLen;
            return String(a.u.email || '').localeCompare(String(b.u.email || ''));
        })
        .map((x) => x.u);
}
