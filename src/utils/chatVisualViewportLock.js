/**
 * Phone chat: shrink the shell above the keyboard using `visualViewport`.
 *
 * - **Android (Chrome):** use `offsetLeft` / `offsetTop` + `vv.width` / `vv.height` (matches how
 *   Chrome maps the visual viewport — same pattern as your working Android screenshot).
 * - **Apple WebKit:** `offsetTop` often pushes the whole shell down, leaving a void under the
 *   status bar; pin `top: 0`, `left: 0`, `width: 100%`, and only set `height = vv.height` so the
 *   shell fills from the top of the layout viewport to the top of the keyboard band.
 *
 * Inner layout stays flex: header flex-shrink-0, body flex:1 min-height:0, footer flex-shrink-0.
 * On iOS, also handle `visualViewport` **scroll** (rubber-band / pan): reset document scroll and
 * re-apply `sync` so the shell does not “slide away” under the status bar when the user drags.
 * On Android, pin shell height while the composer input stays focused so send taps do not bounce
 * the keyboard open/closed.
 */

export function isAppleWebKitTouch() {
    if (typeof navigator === 'undefined') return false;
    if (/iP(hone|ad|od)/.test(navigator.userAgent)) return true;
    return /\bMacintosh\b/.test(navigator.userAgent) && typeof document !== 'undefined' && 'ontouchend' in document;
}

function isAndroidTouch() {
    if (typeof navigator === 'undefined') return false;
    return /Android/i.test(navigator.userAgent) && !isAppleWebKitTouch();
}

function isPhoneLikeChatShell() {
    if (typeof window === 'undefined' || !window.visualViewport) return false;
    if (!window.matchMedia('(max-width: 1023px)').matches) return false;
    if (window.matchMedia('(min-width: 600px) and (min-height: 600px)').matches) return false;
    return true;
}

export function shouldApplyChatVisualViewportLock() {
    return isPhoneLikeChatShell();
}

const GEOMETRY_PROPS = ['left', 'top', 'right', 'bottom', 'width', 'height'];

const COMPOSER_ROOT_SELECTOR =
    '.community-composer-bar, .community-main-chat__composer, .input-area, .chat-footer-stack, .chat-input-area';

const COMPOSER_FIELD_SELECTOR =
    'input.message-input, textarea.message-input, .community-main-chat__input';

function isComposerField(el) {
    if (!el || typeof el.matches !== 'function') return false;
    try {
        return el.matches(COMPOSER_FIELD_SELECTOR);
    } catch {
        return false;
    }
}

function isInsideComposerRoot(el) {
    return Boolean(el?.closest?.(COMPOSER_ROOT_SELECTOR));
}

function isKeyboardOpenByViewport(vv) {
    if (!vv) return false;
    return window.innerHeight - vv.height > 100;
}

/** Resolved safe-area insets (px) for pinning the shell above the home indicator. */
let safeAreaProbe;
function readSafeAreaInsetsPx() {
    if (typeof document === 'undefined') {
        return { top: 0, right: 0, bottom: 0, left: 0 };
    }
    if (!safeAreaProbe) {
        safeAreaProbe = document.createElement('div');
        safeAreaProbe.setAttribute('aria-hidden', 'true');
        safeAreaProbe.style.cssText =
            'position:fixed;visibility:hidden;pointer-events:none;inset:0;padding:' +
            'env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) ' +
            'env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);';
        document.documentElement.appendChild(safeAreaProbe);
    }
    const cs = getComputedStyle(safeAreaProbe);
    return {
        top: parseFloat(cs.paddingTop) || 0,
        right: parseFloat(cs.paddingRight) || 0,
        bottom: parseFloat(cs.paddingBottom) || 0,
        left: parseFloat(cs.paddingLeft) || 0,
    };
}

function lockPageScroll() {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOB = document.body.style.overscrollBehavior;
    const prevHtmlOB = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';
    return function unlockPageScroll() {
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overflow = prevHtmlOverflow;
        document.body.style.overscrollBehavior = prevBodyOB;
        document.documentElement.style.overscrollBehavior = prevHtmlOB;
    };
}

/**
 * @param {() => HTMLElement | null} getContainer
 * @param {{
 *   onViewportChange?: (vv: typeof window.visualViewport) => void;
 *   getShellHeightOverride?: () => number | null;
 * }} [options] getShellHeightOverride — during emoji↔keyboard, pin shell height (avoids whole-chat reflow).
 * @returns {{ detach: () => void; sync: () => void }}
 */
export function attachChatShellToVisualViewport(getContainer, options = {}) {
    const { onViewportChange, getShellHeightOverride } = options;
    if (!isPhoneLikeChatShell()) {
        const noop = () => {};
        return { detach: noop, sync: noop };
    }

    const getRoot = () => (typeof getContainer === 'function' ? getContainer() : getContainer);
    const vv = window.visualViewport;
    const androidCompose = isAndroidTouch();
    let androidPinnedShellHeight = null;

    const sync = () => {
        const el = getRoot();
        if (!el) return;
        el.classList.add('chat-vv-shell');
        const innerH = window.innerHeight;
        const innerW = window.innerWidth;

        const overrideRaw = typeof getShellHeightOverride === 'function' ? getShellHeightOverride() : null;
        const override =
            overrideRaw != null && Number.isFinite(overrideRaw) ? Math.round(overrideRaw) : null;

        const keyboardOpen = isKeyboardOpenByViewport(vv);
        const { bottom: sab } = readSafeAreaInsetsPx();

        if (isAppleWebKitTouch()) {
            let h = Math.max(1, Math.min(vv.height, innerH));
            if (override != null) h = Math.max(1, Math.min(override, innerH));
            el.style.left = '0px';
            el.style.right = '0px';
            el.style.width = '100%';
            el.style.top = '0px';

            if (keyboardOpen) {
                // Shrink above the keyboard; home indicator is covered by the keyboard band.
                el.style.bottom = 'auto';
                el.style.height = `${Math.round(h)}px`;
                el.style.maxHeight = `${Math.round(h)}px`;
            } else {
                // Pin above the home indicator instead of a fixed height that clips the composer.
                el.style.bottom = `${Math.round(sab)}px`;
                el.style.height = 'auto';
                el.style.maxHeight = 'none';
            }
        } else {
            const w = Math.max(1, Math.min(vv.width, innerW - vv.offsetLeft));
            let h = Math.max(1, Math.min(vv.height, innerH - vv.offsetTop));
            if (override != null) h = Math.max(1, Math.min(override, innerH - vv.offsetTop));
            if (
                androidCompose &&
                androidPinnedShellHeight != null &&
                isComposerField(document.activeElement)
            ) {
                h = Math.max(h, androidPinnedShellHeight);
            }

            if (!keyboardOpen && sab > 0) {
                el.style.left = '0px';
                el.style.right = '0px';
                el.style.top = '0px';
                el.style.width = '100%';
                el.style.bottom = `${Math.round(sab)}px`;
                el.style.height = 'auto';
                el.style.maxHeight = 'none';
            } else {
                el.style.left = `${vv.offsetLeft}px`;
                el.style.top = `${vv.offsetTop}px`;
                el.style.width = `${w}px`;
                el.style.height = `${h}px`;
                el.style.maxHeight = `${h}px`;
                el.style.right = 'auto';
                el.style.bottom = 'auto';
            }
        }
        if (onViewportChange) onViewportChange(vv);
    };

    const onComposerFocusIn = (event) => {
        if (!androidCompose || !isComposerField(event.target)) return;
        if (isKeyboardOpenByViewport(vv)) {
            androidPinnedShellHeight = Math.max(
                androidPinnedShellHeight || 0,
                Math.round(vv.height)
            );
        }
        sync();
    };

    const onComposerFocusOut = () => {
        if (!androidCompose) return;
        window.setTimeout(() => {
            const active = document.activeElement;
            if (isComposerField(active) || isInsideComposerRoot(active)) return;
            androidPinnedShellHeight = null;
            sync();
        }, 0);
    };

    vv.addEventListener('resize', sync);
    sync();

    if (androidCompose) {
        document.addEventListener('focusin', onComposerFocusIn);
        document.addEventListener('focusout', onComposerFocusOut);
    }

    let onVVScroll = null;
    if (isAppleWebKitTouch()) {
        let ticking = false;
        onVVScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                ticking = false;
                window.scrollTo(0, 0);
                if (document.documentElement) document.documentElement.scrollTop = 0;
                if (document.body) document.body.scrollTop = 0;
                sync();
            });
        };
        vv.addEventListener('scroll', onVVScroll);
    }

    const unlockScroll = lockPageScroll();

    function detach() {
        vv.removeEventListener('resize', sync);
        if (onVVScroll) {
            vv.removeEventListener('scroll', onVVScroll);
        }
        if (androidCompose) {
            document.removeEventListener('focusin', onComposerFocusIn);
            document.removeEventListener('focusout', onComposerFocusOut);
        }
        androidPinnedShellHeight = null;
        const el = getRoot();
        if (el) {
            el.classList.remove('chat-vv-shell');
            for (const prop of GEOMETRY_PROPS) {
                el.style[prop] = '';
            }
            el.style.maxHeight = '';
        }
        unlockScroll();
    }

    return { detach, sync };
}

/** Keep focus on the composer when tapping send/attach (prevents Android keyboard dismiss). */
export function preventComposerControlBlur(event) {
    event.preventDefault();
}
