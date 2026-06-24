import { useCallback, useEffect, useRef } from 'react';

const HISTORY_STATE_KEY = 'dbCameraOverlay';
const POPSTATE_GRACE_MS = 900;

/**
 * Trap browser/hardware Back while a fullscreen camera overlay is open.
 * Without this, Back pops the SPA route (e.g. create-private → posts-feed).
 */
export function useCameraOverlayHistoryTrap(active, onDeactivate) {
    const pushedRef = useRef(false);
    const openedAtRef = useRef(0);
    const onDeactivateRef = useRef(onDeactivate);
    onDeactivateRef.current = onDeactivate;

    useEffect(() => {
        if (!active) return undefined;

        try {
            window.history.pushState({ [HISTORY_STATE_KEY]: true }, '');
            pushedRef.current = true;
            openedAtRef.current = Date.now();
        } catch {
            pushedRef.current = false;
        }

        const onPopState = () => {
            if (!pushedRef.current) return;

            // Permission sheets on mobile can emit a spurious popstate — re-trap instead of closing.
            if (Date.now() - openedAtRef.current < POPSTATE_GRACE_MS) {
                try {
                    window.history.pushState({ [HISTORY_STATE_KEY]: true }, '');
                    openedAtRef.current = Date.now();
                } catch {
                    /* ignore */
                }
                return;
            }

            pushedRef.current = false;
            onDeactivateRef.current?.();
        };

        window.addEventListener('popstate', onPopState);
        return () => {
            window.removeEventListener('popstate', onPopState);
            // Do not history.back() here — React remounts / tab switches must not navigate away.
            pushedRef.current = false;
        };
    }, [active]);

    const closeOverlay = useCallback(() => {
        if (pushedRef.current) {
            pushedRef.current = false;
            try {
                window.history.back();
            } catch {
                onDeactivateRef.current?.();
            }
            return;
        }
        onDeactivateRef.current?.();
    }, []);

    return closeOverlay;
}
