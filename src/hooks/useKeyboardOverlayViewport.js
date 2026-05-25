import { useEffect } from 'react';

const VIEWPORT_META_SELECTOR = 'meta[name="viewport"]';
const OVERLAY_WIDGET = 'interactive-widget=overlays-content';

/**
 * On Android Chrome, `resizes-content` shrinks the whole editor when the keyboard opens.
 * Overlay mode keeps the layout height (iOS-like): keyboard covers the bottom tools only.
 */
export function useKeyboardOverlayViewport(enabled = true) {
    useEffect(() => {
        if (!enabled || typeof document === 'undefined') return undefined;

        const meta = document.querySelector(VIEWPORT_META_SELECTOR);
        if (!meta) return undefined;

        const original = meta.getAttribute('content') || '';

        const next = /\binteractive-widget=/.test(original)
            ? original.replace(/\binteractive-widget=[^,;\s]+/g, OVERLAY_WIDGET)
            : `${original}, ${OVERLAY_WIDGET}`;

        meta.setAttribute('content', next);
        document.documentElement.classList.add('keyboard-overlay-page');

        return () => {
            meta.setAttribute('content', original);
            document.documentElement.classList.remove('keyboard-overlay-page');
        };
    }, [enabled]);
}
