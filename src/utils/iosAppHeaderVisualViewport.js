/**
 * iOS Safari / PWA: when the keyboard opens, the layout viewport can shift relative to the
 * visual viewport (`visualViewport.offsetTop` > 0). A `position: fixed; top: 0` header then
 * slides under the status bar. Sync `--ios-vv-header-offset` to `offsetTop` so CSS can use
 * `top: var(--ios-vv-header-offset)`.
 *
 * Important: `visualViewport` also fires `scroll` during rubber-band overscroll when the
 * keyboard is closed. Syncing on every scroll makes the fixed header “bounce” with the pull.
 * We only react to `scroll` while a text field is focused (keyboard / in-field scroll). Resize
 * still runs always (keyboard show/hide). On focus loss we re-sync once so offset resets.
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

    const isLikelyKeyboardFieldFocused = () => {
        const el = document.activeElement;
        if (!el || el === document.body) return false;
        if (el.isContentEditable) return true;
        const tag = el.tagName;
        if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
        if (tag !== 'INPUT') return false;
        const type = String(el.type || '').toLowerCase();
        if (
            type === 'button' ||
            type === 'submit' ||
            type === 'checkbox' ||
            type === 'radio' ||
            type === 'file' ||
            type === 'hidden' ||
            type === 'reset' ||
            type === 'image'
        ) {
            return false;
        }
        return true;
    };

    const onVisualViewportScroll = () => {
        if (!isLikelyKeyboardFieldFocused()) return;
        sync();
    };

    const onFocusOut = () => {
        requestAnimationFrame(sync);
    };

    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', onVisualViewportScroll);
    document.addEventListener('focusout', onFocusOut);
    sync();

    return function detach() {
        vv.removeEventListener('resize', sync);
        vv.removeEventListener('scroll', onVisualViewportScroll);
        document.removeEventListener('focusout', onFocusOut);
        root.style.removeProperty('--ios-vv-header-offset');
    };
}
