/**
 * iOS Safari / PWA: when the keyboard opens, the layout viewport can shift relative to the
 * visual viewport (`visualViewport.offsetTop` > 0). A `position: fixed; top: 0` header then
 * slides under the status bar. Sync `--ios-vv-header-offset` to `offsetTop` so CSS can use
 * `top: var(--ios-vv-header-offset)`.
 *
 * @returns {() => void} detach
 */
export function attachIosAppHeaderViewportOffset() {
    if (typeof window === 'undefined' || !window.visualViewport) {
        return () => {};
    }

    const isIos =
        /iP(hone|ad|od)/.test(navigator.userAgent) ||
        (typeof navigator !== 'undefined' &&
            navigator.platform === 'MacIntel' &&
            navigator.maxTouchPoints > 1);

    if (!isIos) {
        return () => {};
    }

    const vv = window.visualViewport;
    const root = document.documentElement;

    let ticking = false;
    const sync = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            ticking = false;
            const y = Math.max(0, Math.round(vv.offsetTop));
            root.style.setProperty('--ios-vv-header-offset', `${y}px`);
        });
    };

    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    sync();

    return function detach() {
        vv.removeEventListener('resize', sync);
        vv.removeEventListener('scroll', sync);
        root.style.removeProperty('--ios-vv-header-offset');
    };
}
