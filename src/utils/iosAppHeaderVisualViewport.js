/**
 * iOS Safari / PWA: when the keyboard opens, the layout viewport can shift relative to the
 * visual viewport (`visualViewport.offsetTop` > 0). A `position: fixed; top: 0` header then
 * slides under the status bar. Sync `--ios-vv-header-offset` to `offsetTop` on resize only.
 *
 * Do NOT mirror `offsetTop` on `visualViewport` scroll — rubber-band overscroll at page ends
 * changes offsetTop and drags the fixed app header down. Reset document scroll on vv scroll
 * (same idea as chatVisualViewportLock).
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

    /** Keyboard open — not rubber-band bounce at scroll edges. */
    const isKeyboardLikelyOpen = () => vv.height < window.innerHeight * 0.82;

    let ticking = false;
    const applyOffset = () => {
        const y = isKeyboardLikelyOpen() ? Math.max(0, Math.round(vv.offsetTop)) : 0;
        root.style.setProperty('--ios-vv-header-offset', `${y}px`);
    };

    const syncFromResize = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            ticking = false;
            applyOffset();
        });
    };

    let scrollTicking = false;
    const onVisualViewportScroll = () => {
        if (scrollTicking) return;
        scrollTicking = true;
        requestAnimationFrame(() => {
            scrollTicking = false;
            window.scrollTo(0, 0);
            if (document.documentElement) document.documentElement.scrollTop = 0;
            if (document.body) document.body.scrollTop = 0;
            if (!isKeyboardLikelyOpen()) {
                root.style.setProperty('--ios-vv-header-offset', '0px');
            } else {
                applyOffset();
            }
        });
    };

    vv.addEventListener('resize', syncFromResize);
    vv.addEventListener('scroll', onVisualViewportScroll);
    syncFromResize();

    return function detach() {
        vv.removeEventListener('resize', syncFromResize);
        vv.removeEventListener('scroll', onVisualViewportScroll);
        root.style.removeProperty('--ios-vv-header-offset');
    };
}
