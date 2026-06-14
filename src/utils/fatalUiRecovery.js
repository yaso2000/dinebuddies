/**
 * Single recovery path for fatal UI failures (React render crashes, chunk load after deploy).
 * Never shows "Recovering" or error copy to users — console log + navigation only.
 */

const CHUNK_RELOAD_KEY = 'dineb_fatal_chunk_reload';
const STUCK_RELOAD_KEY = 'dineb_fatal_stuck_reload';

let recoveryScheduled = false;

export function isChunkLoadError(error) {
    return (
        error?.name === 'ChunkLoadError' ||
        (error?.message &&
            /Failed to fetch dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(
                error.message
            ))
    );
}

import { getPrivateDraftRecoveryCreatePath } from './privateInvitationDraft';

const INVITE_FATAL_RELOAD_KEY = 'dineb_invite_fatal_reload';

/** Invitation flows must never fall back to the social feed after recovery retries. */
function isInvitationFlowPath(pathname = '') {
    const p = String(pathname || '');
    return (
        p.startsWith('/invitation/private/') ||
        p.startsWith('/invite/p/') ||
        p === '/create-dating' ||
        p === '/create-private' ||
        p === '/create' ||
        p.startsWith('/create/')
    );
}

/** Safe route for the current area of the app (full path, no origin). */
export function getFatalUiRecoveryTarget(pathname = '') {
    const p = String(pathname || (typeof window !== 'undefined' ? window.location.pathname : '') || '');
    if (p.startsWith('/affiliate')) return '/affiliate/dashboard';
    if (p.startsWith('/admin')) return '/login';
    if (p.startsWith('/business')) return '/business-dashboard';
    if (p === '/login' || p.startsWith('/login')) return '/login';
    if (p.startsWith('/invitation/private/preview/')) return getPrivateDraftRecoveryCreatePath();
    if (p.startsWith('/invitation/private/')) return p.split('?')[0] || '/invitation/private';
    if (p.startsWith('/invite/p/')) return p.split('?')[0] || '/invite/p';
    if (p.startsWith('/create-dating')) return '/create-dating';
    if (p.startsWith('/create-private')) return '/create-private';
    if (p === '/invitations' || p.startsWith('/invitations/')) return '/invitations';
    if (p === '/create-featured-post') return '/create-featured-post';
    if (p === '/create-post') return '/create-post';
    return '/posts-feed';
}

/**
 * @param {unknown} error
 * @param {{ source?: string }} [options]
 * @returns {boolean} true when a recovery navigation was scheduled
 */
export function recoverFromFatalUiError(error, options = {}) {
    if (typeof window === 'undefined') return false;
    if (recoveryScheduled) return true;
    recoveryScheduled = true;

    const source = options.source || 'app';
    console.error(`[fatalUiRecovery:${source}]`, error);

    if (isChunkLoadError(error)) {
        if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
            sessionStorage.setItem(CHUNK_RELOAD_KEY, 'true');
            window.location.reload();
            return true;
        }
        sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    }

    const target = getFatalUiRecoveryTarget();
    const here = `${window.location.pathname}${window.location.search}`;

    if (here !== target) {
        window.location.replace(target);
        return true;
    }

    if (!sessionStorage.getItem(STUCK_RELOAD_KEY)) {
        sessionStorage.setItem(STUCK_RELOAD_KEY, 'true');
        window.location.reload();
        return true;
    }
    sessionStorage.removeItem(STUCK_RELOAD_KEY);

    if (isInvitationFlowPath(window.location.pathname)) {
        if (!sessionStorage.getItem(INVITE_FATAL_RELOAD_KEY)) {
            sessionStorage.setItem(INVITE_FATAL_RELOAD_KEY, 'true');
            window.location.reload();
            return true;
        }
        sessionStorage.removeItem(INVITE_FATAL_RELOAD_KEY);
        return false;
    }

    if (here !== '/posts-feed') {
        window.location.replace('/posts-feed');
        return true;
    }

    return false;
}

/** Chunk / asset failures that never reach React's error boundary. */
export function installFatalUiRecoveryListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
        if (isChunkLoadError(event?.error)) {
            recoverFromFatalUiError(event.error, { source: 'window.error' });
        }
    });

    window.addEventListener('unhandledrejection', (event) => {
        const reason = event?.reason;
        if (!isChunkLoadError(reason)) return;
        const err = reason instanceof Error ? reason : new Error(String(reason));
        recoverFromFatalUiError(err, { source: 'unhandledrejection' });
    });
}
