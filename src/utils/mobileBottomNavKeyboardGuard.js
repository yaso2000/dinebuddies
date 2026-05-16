/**
 * Mobile layouts where the bottom tab bar stays `position: fixed; bottom: 0` (Layout):
 * on some Android WebViews / Chrome, the layout viewport bottom sits above the soft keyboard,
 * so the bar appears to "float" on top of the keyboard.
 *
 * Toggle `document.body.classList.add('app-mobile-keyboard-open')` only while a **text field**
 * is focused. Using `visualViewport` overlap alone caused false positives on some devices
 * (tab bar stayed `display:none`, making routes like /invitations unreachable from the nav).
 *
 * Chat / community full-screen chat hide the tab bar already — skip via `shouldApply()`.
 */

function isTextLikeElement(el) {
    if (!el || el.nodeType !== 1) return false;
    if (typeof el.closest === 'function' && el.closest('[data-skip-mobile-keyboard-nav]')) return false;
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
}

function isMobileNavShell() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 1023px)').matches;
}

/**
 * @param {() => boolean} shouldApply — e.g. tab bar is mounted (not chat / admin).
 * @returns {() => void} detach
 */
export function attachMobileBottomNavKeyboardGuard(shouldApply) {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
        return () => {};
    }

    let raf = 0;

    const sync = () => {
        if (!isMobileNavShell() || !shouldApply()) {
            document.body.classList.remove('app-mobile-keyboard-open');
            return;
        }
        const active = document.activeElement;
        const textFocus = isTextLikeElement(active);
        document.body.classList.toggle('app-mobile-keyboard-open', Boolean(textFocus));
    };

    const scheduleSync = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(sync);
    };

    const onFocusOut = () => {
        window.setTimeout(sync, 200);
    };

    window.addEventListener('resize', scheduleSync);
    document.addEventListener('focusin', scheduleSync, true);
    document.addEventListener('focusout', onFocusOut, true);

    const mq = window.matchMedia('(max-width: 1023px)');
    const onMq = () => scheduleSync();
    mq.addEventListener('change', onMq);

    scheduleSync();
    requestAnimationFrame(sync);

    return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', scheduleSync);
        document.removeEventListener('focusin', scheduleSync, true);
        document.removeEventListener('focusout', onFocusOut, true);
        mq.removeEventListener('change', onMq);
        document.body.classList.remove('app-mobile-keyboard-open');
    };
}
