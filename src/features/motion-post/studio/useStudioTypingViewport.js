import { useCallback, useEffect, useRef, useState } from 'react';

/** Mobile / narrow viewports only — desktop has no on-screen keyboard. */
const TYPING_LAYOUT_MQ = '(max-width: 1023px)';

function readTypingLayoutEnabled() {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(TYPING_LAYOUT_MQ).matches;
}

const DEFAULT_OPTIONS = {
    editableSelector: '.sps-preview__editable',
    vvHeightVar: '--sps-vv-h',
    vvTopVar: '--sps-vv-top',
};

/**
 * Keeps the post preview at a stable size while the mobile keyboard is open.
 * On desktop, focus does not change layout or preview size.
 *
 * @param {{ editableSelector?: string; vvHeightVar?: string; vvTopVar?: string }} [options]
 */
export function useStudioTypingViewport(options = {}) {
    const { editableSelector, vvHeightVar, vvTopVar } = { ...DEFAULT_OPTIONS, ...options };
    const pageRef = useRef(null);
    const cardRef = useRef(null);
    const [typingLayoutEnabled, setTypingLayoutEnabled] = useState(readTypingLayoutEnabled);
    const [isTyping, setIsTyping] = useState(false);
    const [previewSize, setPreviewSize] = useState(null);
    const isTypingRef = useRef(false);

    useEffect(() => {
        const mq = window.matchMedia(TYPING_LAYOUT_MQ);
        const sync = () => {
            const enabled = mq.matches;
            setTypingLayoutEnabled(enabled);
            if (!enabled) {
                setIsTyping(false);
                setPreviewSize(null);
            }
        };
        sync();
        mq.addEventListener('change', sync);
        return () => mq.removeEventListener('change', sync);
    }, []);

    const lockPreviewSize = useCallback(() => {
        const card = cardRef.current;
        if (!card) return;
        const rect = card.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 40) return;
        const w = Math.round(rect.width);
        const h = Math.round(rect.height);
        setPreviewSize((prev) =>
            prev ? { w: Math.max(prev.w, w), h: Math.max(prev.h, h) } : { w, h }
        );
    }, []);

    useEffect(() => {
        isTypingRef.current = isTyping;
    }, [isTyping]);

    useEffect(() => {
        if (!typingLayoutEnabled) return undefined;

        const vv = window.visualViewport;
        if (!vv) return undefined;

        const onViewportChange = () => {
            const el = pageRef.current;
            if (el) {
                el.style.setProperty(vvHeightVar, `${vv.height}px`);
                el.style.setProperty(vvTopVar, `${vv.offsetTop}px`);
            }
            if (isTypingRef.current) lockPreviewSize();
        };

        onViewportChange();
        vv.addEventListener('resize', onViewportChange);
        vv.addEventListener('scroll', onViewportChange);
        return () => {
            vv.removeEventListener('resize', onViewportChange);
            vv.removeEventListener('scroll', onViewportChange);
        };
    }, [typingLayoutEnabled, lockPreviewSize, vvHeightVar, vvTopVar]);

    const onTextFocus = useCallback(() => {
        if (!typingLayoutEnabled) return;
        setIsTyping(true);
        requestAnimationFrame(() => {
            requestAnimationFrame(lockPreviewSize);
        });
    }, [typingLayoutEnabled, lockPreviewSize]);

    const onTextBlur = useCallback(() => {
        if (!typingLayoutEnabled) return;
        window.setTimeout(() => {
            const active = document.activeElement;
            if (active?.closest?.(editableSelector)) return;
            setIsTyping(false);
        }, 150);
    }, [typingLayoutEnabled, editableSelector]);

    const resetPreviewLock = useCallback(() => {
        setPreviewSize(null);
    }, []);

    const layoutTypingActive = typingLayoutEnabled && isTyping;

    return {
        pageRef,
        cardRef,
        isTyping: layoutTypingActive,
        previewSize: layoutTypingActive ? previewSize : null,
        onTextFocus,
        onTextBlur,
        resetPreviewLock,
    };
}
