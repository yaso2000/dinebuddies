import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    DEFAULT_MOBILE_EMOJI_PANEL_HEIGHT,
    MOBILE_EMOJI_SHEET_ANIM_MS,
    getEmojiPickerAnchorStyle,
    isTouchOrCoarsePointer,
} from '../utils/emojiInputMode';

export { isTouchOrCoarsePointer, shouldUseAppEmojiPicker } from '../utils/emojiInputMode';

const LazyEmojiPicker = lazy(() => import('emoji-picker-react'));

// Height-transition duration for the mobile sheet growing/shrinking in and
// out of the composer's flex flow — roughly matches a native keyboard's own
// show/hide animation so the two don't visually fight each other.
const SHEET_ANIM_MS = MOBILE_EMOJI_SHEET_ANIM_MS;

/**
 * 1:1 + invitation chat emoji picker only (its sole two consumers). Desktop
 * renders a small popup anchored to the trigger button (portaled to body,
 * position:fixed). Mobile renders in-flow, as a normal child right after the
 * composer — the composer's wrapper is a column flexbox, so this panel just
 * pushes the composer up and shrinks the message list above it exactly like
 * adding any other flex child would, with zero manual height/position math
 * and zero coordination with the keyboard-tracking code. Its height animates
 * between 0 and the target height so switching to/from the OS keyboard reads
 * as one smooth slide instead of an instant layout jump.
 */
const EmojiPickerPortal = ({ open, onClose, onEmojiClick, anchorRef, panelHeight, forceMobile }) => {
    const pickerRef = useRef(null);
    // `forceMobile` lets callers that already know they're in the phone chat
    // shell (via viewport-width checks, proven reliable elsewhere in this
    // feature) skip pointer-type detection entirely — some WebViews report
    // touch/coarse-pointer media queries unreliably, which otherwise flips
    // this into the small desktop popup on an actual phone.
    const isMobile = forceMobile != null ? forceMobile : isTouchOrCoarsePointer();
    const [anchorStyle, setAnchorStyle] = useState(() =>
        getEmojiPickerAnchorStyle(anchorRef?.current)
    );

    // Mobile sheet mount/expand state — kept mounted a little past `open`
    // going false so the shrink transition has time to play before unmount.
    const [sheetMounted, setSheetMounted] = useState(isMobile && open);
    const [sheetExpanded, setSheetExpanded] = useState(false);
    const closeTimerRef = useRef(null);

    useEffect(() => {
        if (!isMobile) return undefined;
        if (open) {
            clearTimeout(closeTimerRef.current);
            setSheetMounted(true);
            // Snap straight to full height instead of animating from 0 —
            // handleChatEmojiToggle already delays closing the real keyboard
            // until this has painted, so growing slowly here would reopen the
            // exact gap that ordering was meant to close (panel not yet at
            // full size while the keyboard is already collapsing).
            setSheetExpanded(true);
            return undefined;
        }
        // handleChatEmojiToggle already holds off flipping `open` to false
        // until the real keyboard has had time to fully rise, so by the time
        // we get here the keyboard is already occupying the slot — the fade
        // below is purely cosmetic, not covering for a still-rising keyboard.
        setSheetExpanded(false);
        closeTimerRef.current = setTimeout(() => setSheetMounted(false), SHEET_ANIM_MS);
        return () => clearTimeout(closeTimerRef.current);
    }, [open, isMobile]);

    useEffect(() => {
        if (!open || isMobile) return undefined;

        const syncPosition = () => {
            setAnchorStyle(getEmojiPickerAnchorStyle(anchorRef?.current));
        };

        syncPosition();
        window.addEventListener('resize', syncPosition);
        window.addEventListener('scroll', syncPosition, true);
        return () => {
            window.removeEventListener('resize', syncPosition);
            window.removeEventListener('scroll', syncPosition, true);
        };
    }, [open, isMobile, anchorRef]);

    useEffect(() => {
        if (!open || isMobile) return undefined;
        const handleOutside = (e) => {
            const clickedAnchor = anchorRef?.current?.contains(e.target);
            const clickedPicker = pickerRef.current?.contains(e.target);
            if (!clickedAnchor && !clickedPicker) {
                onClose();
            }
        };
        const id = setTimeout(() => {
            document.addEventListener('mousedown', handleOutside);
        }, 0);
        return () => {
            clearTimeout(id);
            document.removeEventListener('mousedown', handleOutside);
        };
    }, [open, isMobile, onClose, anchorRef]);

    if (isMobile ? !sheetMounted : !open) return null;

    // Cap the sheet to a keyboard-sized fraction of the viewport. Some iOS WebViews
    // report an over-large keyboard height via visualViewport, which without a cap
    // makes the emoji sheet fill most of the screen; a real keyboard is ~35–45% tall,
    // so 48% stays above Android's (accurately measured) keyboard without clipping it.
    const rawEmojiHeight = Math.round(panelHeight || DEFAULT_MOBILE_EMOJI_PANEL_HEIGHT);
    const emojiHeightCap =
        typeof window !== 'undefined' && window.innerHeight
            ? Math.round(window.innerHeight * 0.48)
            : 360;
    const mobileHeight = Math.max(220, Math.min(rawEmojiHeight, emojiHeightCap));

    const pickerBody = (
        <Suspense fallback={<div style={{ width: '100%', height: isMobile ? mobileHeight : 380, background: '#111827' }} />}>
            <div className="custom-emoji-picker-wrapper">
                <style>{`
                    .custom-emoji-picker-wrapper .epr-category-nav {
                        display: none !important;
                    }
                    .custom-emoji-picker-wrapper .epr-emoji-category-label {
                        display: none !important;
                    }
                `}</style>
                <LazyEmojiPicker
                    onEmojiClick={(emojiData) => {
                        onEmojiClick(emojiData);
                    }}
                    theme="dark"
                    width="100%"
                    height={isMobile ? mobileHeight : 380}
                    previewConfig={{ showPreview: false }}
                />
            </div>
        </Suspense>
    );

    if (isMobile) {
        // In-flow — no portal, no position:fixed. Sits as the last child of
        // the composer's column-flex wrapper (.chat-footer-stack). Height
        // snaps instantly rather than animating: handleChatEmojiToggle
        // already sequences the open/close of this panel against the real
        // keyboard's own show/hide so the two surfaces swap without ever
        // both being mid-collapse — an animated height here would reopen
        // that gap by making the panel lag behind its own state flip. Only
        // opacity animates, for a soft appearance that doesn't affect layout.
        return (
            <div
                ref={pickerRef}
                className="emoji-picker-portal emoji-picker-portal--sheet"
                style={{
                    flexShrink: 0,
                    width: '100%',
                    height: sheetExpanded ? `${mobileHeight}px` : '0px',
                    overflow: 'hidden',
                    opacity: sheetExpanded ? 1 : 0,
                    transition: `opacity ${SHEET_ANIM_MS}ms ease`,
                }}
            >
                {pickerBody}
            </div>
        );
    }

    return createPortal(
        <div
            ref={pickerRef}
            className="emoji-picker-portal"
            style={{
                ...anchorStyle,
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
            }}
        >
            <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                background: '#1f2937',
                padding: '4px 8px',
            }}>
                <button
                    type="button"
                    onClick={onClose}
                    style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        color: 'white',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        lineHeight: 1,
                    }}
                    title="Close"
                >✕</button>
            </div>
            {pickerBody}
        </div>,
        document.body
    );
};

export default EmojiPickerPortal;
