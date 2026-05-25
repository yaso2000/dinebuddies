/**
 * Hide the fixed bottom tab bar while the on-screen keyboard is open (mobile / narrow).
 * Uses focus tracking + visualViewport shrink detection.
 */

const FOCUSABLE =
    'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]), textarea, select, [contenteditable="true"]';

function isMobileShell() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 1023px)').matches;
}

function isFocusableField(el) {
    if (!el || typeof el.matches !== 'function') return false;
    try {
        return el.matches(FOCUSABLE);
    } catch {
        return false;
    }
}

function activeFocusableField() {
    const ae = document.activeElement;
    return isFocusableField(ae) ? ae : null;
}

/** Keyboard band visible via visualViewport (iOS + Android). */
function isKeyboardOpenByViewport() {
    const vv = window.visualViewport;
    if (!vv) return false;
    const gap = window.innerHeight - vv.height;
    return gap > 100;
}

function setKeyboardOpen(open) {
    const root = document.documentElement;
    if (open) {
        root.setAttribute('data-keyboard-open', 'true');
        root.style.setProperty('--keyboard-open', '1');
    } else {
        root.removeAttribute('data-keyboard-open');
        root.style.setProperty('--keyboard-open', '0');
    }
}

/**
 * @returns {() => void} detach
 */
export function attachHideBottomNavOnKeyboard() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return () => {};
    }

    let rafId = 0;

    const sync = () => {
        if (!isMobileShell()) {
            setKeyboardOpen(false);
            return;
        }
        const open = Boolean(activeFocusableField()) || isKeyboardOpenByViewport();
        setKeyboardOpen(open);
    };

    const scheduleSync = () => {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(sync);
    };

    const onFocusIn = (e) => {
        if (isFocusableField(e.target)) scheduleSync();
    };

    const onFocusOut = () => {
        window.setTimeout(scheduleSync, 80);
    };

    const mq = window.matchMedia('(max-width: 1023px)');
    const onMq = () => scheduleSync();

    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    window.visualViewport?.addEventListener('resize', scheduleSync);
    window.visualViewport?.addEventListener('scroll', scheduleSync);
    window.addEventListener('resize', scheduleSync);
    if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', onMq);
    } else if (typeof mq.addListener === 'function') {
        mq.addListener(onMq);
    }

    scheduleSync();

    return () => {
        cancelAnimationFrame(rafId);
        document.removeEventListener('focusin', onFocusIn, true);
        document.removeEventListener('focusout', onFocusOut, true);
        window.visualViewport?.removeEventListener('resize', scheduleSync);
        window.visualViewport?.removeEventListener('scroll', scheduleSync);
        window.removeEventListener('resize', scheduleSync);
        if (typeof mq.removeEventListener === 'function') {
            mq.removeEventListener('change', onMq);
        } else if (typeof mq.removeListener === 'function') {
            mq.removeListener(onMq);
        }
        setKeyboardOpen(false);
    };
}
