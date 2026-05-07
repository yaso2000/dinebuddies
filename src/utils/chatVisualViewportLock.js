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
 */

function isAppleWebKitTouch() {
    if (typeof navigator === 'undefined') return false;
    if (/iP(hone|ad|od)/.test(navigator.userAgent)) return true;
    return /\bMacintosh\b/.test(navigator.userAgent) && typeof document !== 'undefined' && 'ontouchend' in document;
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
 * @param {{ onViewportChange?: (vv: typeof window.visualViewport) => void }} [options]
 * @returns {() => void} detach
 */
export function attachChatShellToVisualViewport(getContainer, options = {}) {
    const { onViewportChange } = options;
    if (!isPhoneLikeChatShell()) {
        return () => {};
    }

    const getRoot = () => (typeof getContainer === 'function' ? getContainer() : getContainer);
    const vv = window.visualViewport;

    const sync = () => {
        const el = getRoot();
        if (!el) return;
        const innerH = window.innerHeight;
        const innerW = window.innerWidth;

        if (isAppleWebKitTouch()) {
            const h = Math.max(1, Math.min(vv.height, innerH));
            el.style.left = '0px';
            el.style.right = '0px';
            el.style.top = '0px';
            el.style.width = '100%';
            el.style.height = `${Math.round(h)}px`;
            el.style.bottom = 'auto';
        } else {
            const w = Math.max(1, Math.min(vv.width, innerW - vv.offsetLeft));
            const h = Math.max(1, Math.min(vv.height, innerH - vv.offsetTop));
            el.style.left = `${vv.offsetLeft}px`;
            el.style.top = `${vv.offsetTop}px`;
            el.style.width = `${w}px`;
            el.style.height = `${h}px`;
            el.style.right = 'auto';
            el.style.bottom = 'auto';
        }
        if (onViewportChange) onViewportChange(vv);
    };

    vv.addEventListener('resize', sync);
    sync();

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

    return function detach() {
        vv.removeEventListener('resize', sync);
        if (onVVScroll) {
            vv.removeEventListener('scroll', onVVScroll);
        }
        const el = getRoot();
        if (el) {
            for (const prop of GEOMETRY_PROPS) {
                el.style[prop] = '';
            }
        }
        unlockScroll();
    };
}
