import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
const LazyEmojiPicker = lazy(() => import('emoji-picker-react'));

// Emoji picker is for DESKTOP only.
// Mobile users have native emoji keyboard built-in.
const isMobile = typeof window !== 'undefined' && (
    'ontouchstart' in window || window.matchMedia('(pointer: coarse)').matches
);

const EmojiPickerPortal = ({ open, onClose, onEmojiClick, anchorRef }) => {
    const pickerRef = useRef(null);

    // Never render on mobile — prevents keyboard/picker conflict entirely
    const shouldRender = open && !isMobile;

    // Close on outside click (desktop only)
    useEffect(() => {
        if (!shouldRender) return;
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
    }, [shouldRender, onClose, anchorRef]);

    if (!shouldRender) return null;

    return createPortal(
        <div
            ref={pickerRef}
            style={{
                position: 'fixed',
                bottom: '70px',
                left: '8px',
                zIndex: 999999,
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
            }}
        >
            {/* Close button */}
            <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                background: '#1f2937',
                padding: '4px 8px',
            }}>
                <button
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

            <Suspense fallback={<div style={{ width: 300, height: 380, background: '#111827' }} />}>
                <LazyEmojiPicker
                    onEmojiClick={(emojiData) => {
                        onEmojiClick(emojiData);
                        // Stay open — user can pick multiple emojis
                    }}
                    theme="dark"
                    width={300}
                    height={380}
                    previewConfig={{ showPreview: false }}
                />
            </Suspense>
        </div>,
        document.body
    );
};

export { isMobile };
export default EmojiPickerPortal;
