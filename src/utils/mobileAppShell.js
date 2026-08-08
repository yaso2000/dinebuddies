/**
 * Detects the same “mobile shell” the app uses for home routing (narrow viewport)
 * plus installed PWA (standalone). Used for layout/shell detection elsewhere in the app.
 */

const MOBILE_VIEWPORT_MQ = '(max-width: 768px)';
const STANDALONE_MQ = '(display-mode: standalone)';

export function isMobileRestrictedShell() {
    if (typeof window === 'undefined') return false;
    try {
        const narrow = window.matchMedia(MOBILE_VIEWPORT_MQ).matches;
        const standalone = window.matchMedia(STANDALONE_MQ).matches;
        return narrow || standalone;
    } catch {
        return false;
    }
}

/**
 * @param {(restricted: boolean) => void} listener
 * @returns {() => void} unsubscribe
 */
export function subscribeMobileRestrictedShell(listener) {
    if (typeof window === 'undefined') return () => {};
    const mqNarrow = window.matchMedia(MOBILE_VIEWPORT_MQ);
    const mqStandalone = window.matchMedia(STANDALONE_MQ);
    const tick = () => listener(isMobileRestrictedShell());
    tick();
    mqNarrow.addEventListener('change', tick);
    mqStandalone.addEventListener('change', tick);
    return () => {
        mqNarrow.removeEventListener('change', tick);
        mqStandalone.removeEventListener('change', tick);
    };
}
