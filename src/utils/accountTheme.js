import { isBusinessUser } from './accountRole';

/** @typedef {'personal' | 'business' | 'affiliate'} AccountTheme */

const AFFILIATE_PREFIX = '/affiliate';

const BUSINESS_APP_PREFIXES = [
    '/business-dashboard',
    '/business/onboarding',
    '/business/pricing',
    '/signup/business',
    '/business/signup',
    '/business-signup',
];

function readLoginTab(search) {
    const raw = search || '';
    const q = raw.startsWith('?') ? raw.slice(1) : raw;
    return new URLSearchParams(q).get('tab');
}

function hasBusinessSessionHint(userId) {
    try {
        const hint = sessionStorage.getItem('dineb_biz_uid');
        if (!hint) return false;
        return !userId || hint === userId;
    } catch {
        return false;
    }
}

function isOwnBusinessProfilePath(pathname, userId) {
    if (!userId) return false;
    const m = pathname.match(/^\/business\/([^/]+)\/?$/);
    return !!(m && m[1] === userId);
}

/**
 * Resolves whether the UI should use the warm business accent palette or the default personal palette.
 * Route-aware for auth/signup; account-aware everywhere else.
 */
export function resolveAccountTheme({ pathname, search = '', userId, profile, isBusiness }) {
    if (pathname === AFFILIATE_PREFIX || pathname.startsWith(`${AFFILIATE_PREFIX}/`)) {
        return 'affiliate';
    }

    if (pathname === '/login' || pathname.startsWith('/business/login')) {
        return readLoginTab(search) === 'business' ? 'business' : 'personal';
    }

    if (BUSINESS_APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
        return 'business';
    }

    if (isBusiness === true || isBusinessUser(profile)) {
        return 'business';
    }

    if (hasBusinessSessionHint(userId)) {
        return 'business';
    }

    if (isOwnBusinessProfilePath(pathname, userId)) {
        return 'business';
    }

    return 'personal';
}
