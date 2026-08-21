/**
 * Phone chat: shrink the shell above the keyboard using `visualViewport`.
 *
 * - **Android (Chrome):** use `offsetLeft` / `offsetTop` + `vv.width` / `vv.height` (matches how
 *   Chrome maps the visual viewport — same pattern as your working Android screenshot).
 * - **Apple WebKit:** reset scroll; `top = max(offsetTop, safe-area-top)` so the header
 *   never slides under the iPhone status bar when keyboard opens (chat-vv-shell zeroes
 *   CSS padding). `height = vv.height - (top - offsetTop)`, full width.
 *
 * Inner layout stays flex: header flex-shrink-0, body flex:1 min-height:0, footer flex-shrink-0.
 * On iOS, also handle `visualViewport` **scroll** (rubber-band / pan): reset document scroll and
 * re-apply `sync` so the shell does not “slide away” under the status bar when the user drags.
 * On Android, pin shell height while the composer input stays focused so send taps do not bounce
 * the keyboard open/closed. When the keyboard closes, clear inline geometry — stale offsetTop
 * after dismiss otherwise shrinks the shell to the bottom strip and hides the chat header.
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
    'input.message-input, textarea.message-input, .community-main-chat__input, .chat-input-field';

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
    if (window.innerHeight - vv.height > 100) return true;
    // iOS Safari 16.4+ honors <meta ... interactive-widget=resizes-content>
    // (set in index.html) by shrinking window.innerHeight itself when the
    // keyboard opens — the same behavior Android's windowSoftInputMode=
    // "adjustResize" already produces there. Either way, window.innerHeight
    // and visualViewport.height end up nearly equal even with the keyboard
    // genuinely open, so the diff above never trips. Falling back to focus
    // state catches that case and keeps the shell explicitly pinned to the
    // live visualViewport rect instead of trusting CSS fixed-positioning to
    // track a resize WebKit doesn't always repaint against reliably.
    const active = document.activeElement;
    return isComposerField(active) || isInsideComposerRoot(active);
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

function resetDocumentScroll() {
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
}

function setChatKeyboardOpenAttribute(open) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (open) {
        root.setAttribute('data-chat-keyboard-open', 'true');
    } else {
        root.removeAttribute('data-chat-keyboard-open');
    }
}

function clearShellInlineGeometry(el) {
    if (!el) return;
    el.classList.remove('chat-vv-shell');
    for (const prop of GEOMETRY_PROPS) {
        el.style[prop] = '';
    }
    el.style.maxHeight = '';
    el.style.transform = '';
}

function applyVisualViewportShellGeometry(el, vv, innerH, innerW, androidCompose, androidPinnedShellHeight) {
    if (isAppleWebKitTouch()) {
        resetDocumentScroll();
        const offsetTop = Math.max(0, Math.round(vv.offsetTop));
        const safeTop = Math.round(readSafeAreaInsetsPx().top);
        // When keyboard opens, iOS often keeps offsetTop at 0 while chat-vv-shell
        // zeroes CSS safe-area padding — pin top to at least the status-bar inset
        // so the chat header never slides under the system status bar.
        const top = Math.max(offsetTop, safeTop);
        const h = Math.max(1, Math.round(vv.height) - (top - offsetTop));
        el.style.left = '0px';
        el.style.top = `${top}px`;
        el.style.width = '100%';
        el.style.height = `${h}px`;
        el.style.maxHeight = `${h}px`;
        el.style.right = 'auto';
        el.style.bottom = 'auto';
        el.style.transform = '';
        return;
    }

    const w = Math.max(1, Math.min(vv.width, innerW - vv.offsetLeft));
    let h = Math.max(1, Math.min(vv.height, innerH - vv.offsetTop));
    if (
        androidCompose &&
        androidPinnedShellHeight != null &&
        isComposerField(document.activeElement)
    ) {
        h = Math.max(h, androidPinnedShellHeight);
    }
    el.style.left = `${vv.offsetLeft}px`;
    el.style.top = `${vv.offsetTop}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.maxHeight = `${h}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    el.style.transform = '';
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
 * }} [options]
 * @returns {{ detach: () => void; sync: () => void }}
 */
export function attachChatShellToVisualViewport(getContainer, options = {}) {
    const { onViewportChange } = options;
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
        const innerH = window.innerHeight;
        const innerW = window.innerWidth;
        const keyboardOpen = isKeyboardOpenByViewport(vv);

        // Keyboard closed: drop inline geometry so CSS (100dvh + safe-area) owns the shell again.
        // Android Chrome often keeps a stale visualViewport.offsetTop after dismiss; using it shrinks
        // the shell to the bottom band only and hides the in-flow chat header.
        if (!keyboardOpen) {
            clearShellInlineGeometry(el);
            setChatKeyboardOpenAttribute(false);
            resetDocumentScroll();
            if (onViewportChange) onViewportChange(vv);
            return;
        }

        setChatKeyboardOpenAttribute(keyboardOpen);

        el.classList.add('chat-vv-shell');

        // Track the smallest real (post-resize) height seen while the composer stays focused —
        // used as a floor so a stray dip mid-keyboard-animation doesn't bounce the shell taller.
        // Must be the MINIMUM, not the height captured at the focus event itself: at focusin the
        // keyboard hasn't animated in yet, so vv.height there is still the pre-keyboard (full)
        // height — pinning to that stale, too-large value via Math.max previously left the shell
        // sized as if the keyboard weren't open at all, hiding the composer behind it.
        if (androidCompose && isComposerField(document.activeElement)) {
            const observedH = Math.round(Math.min(vv.height, innerH - vv.offsetTop));
            androidPinnedShellHeight =
                androidPinnedShellHeight == null
                    ? observedH
                    : Math.min(androidPinnedShellHeight, observedH);
        }

        applyVisualViewportShellGeometry(el, vv, innerH, innerW, androidCompose, androidPinnedShellHeight);
        if (onViewportChange) onViewportChange(vv);
    };

    const scheduleIosComposerResync = () => {
        const run = () => {
            resetDocumentScroll();
            sync();
        };
        run();
        requestAnimationFrame(run);
        window.setTimeout(run, 50);
        window.setTimeout(run, 120);
        window.setTimeout(run, 280);
    };

    const onComposerFocusIn = (event) => {
        const inComposer =
            isComposerField(event.target) || isInsideComposerRoot(event.target);

        if (isAppleWebKitTouch() && inComposer) {
            scheduleIosComposerResync();
        }

        if (!androidCompose || !isComposerField(event.target)) return;
        // sync() itself now tracks androidPinnedShellHeight (as a running minimum of real,
        // post-resize measurements) — nothing to seed here, since vv.height at this exact
        // instant is still the pre-keyboard height and would only poison it.
        sync();
    };

    const scheduleSyncAfterComposerBlur = () => {
        const runIfComposerBlurred = () => {
            const active = document.activeElement;
            if (isComposerField(active) || isInsideComposerRoot(active)) return;
            if (androidCompose) androidPinnedShellHeight = null;
            sync();
        };
        window.setTimeout(runIfComposerBlurred, 0);
        window.setTimeout(runIfComposerBlurred, 120);
        window.setTimeout(runIfComposerBlurred, 320);
    };

    const onComposerFocusOut = (event) => {
        if (!isComposerField(event.target) && !isInsideComposerRoot(event.target)) return;
        scheduleSyncAfterComposerBlur();
    };

    vv.addEventListener('resize', sync);
    sync();

    // Modern Chrome/Android honors <meta interactive-widget=resizes-content> (index.html) by
    // shrinking window.innerHeight itself when the keyboard opens, rather than only shrinking
    // visualViewport while innerHeight stays tall (the older "overlay" model this file was
    // originally written against). visualViewport's own 'resize' event isn't reliably fired in
    // that mode on every Android build, which left a stale/oversized inline height applied from
    // the focus-triggered sync() (computed before the keyboard finished animating in) with
    // nothing to correct it — the shell never actually shrank. Listening to window resize too
    // means any innerHeight change re-syncs with fresh, correct dimensions either way.
    if (androidCompose) {
        window.addEventListener('resize', sync);
    }

    document.addEventListener('focusin', onComposerFocusIn);
    document.addEventListener('focusout', onComposerFocusOut);

    let onVVScroll = null;
    if (isAppleWebKitTouch() || androidCompose) {
        let ticking = false;
        onVVScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                ticking = false;
                resetDocumentScroll();
                sync();
            });
        };
        vv.addEventListener('scroll', onVVScroll);
    }

    const unlockScroll = lockPageScroll();

    function detach() {
        vv.removeEventListener('resize', sync);
        if (androidCompose) {
            window.removeEventListener('resize', sync);
        }
        if (onVVScroll) {
            vv.removeEventListener('scroll', onVVScroll);
        }
        document.removeEventListener('focusin', onComposerFocusIn);
        document.removeEventListener('focusout', onComposerFocusOut);
        androidPinnedShellHeight = null;
        clearShellInlineGeometry(getRoot());
        setChatKeyboardOpenAttribute(false);
        unlockScroll();
    }

    return { detach, sync };
}

/** Keep focus on the composer when tapping send/attach (prevents Android keyboard dismiss). */
export function preventComposerControlBlur(event) {
    event.preventDefault();
}
