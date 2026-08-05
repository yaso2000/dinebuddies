import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getEmojiPickerAnchorStyle,
  isTouchOrCoarsePointer,
  shouldUseAppEmojiPicker,
} from '../utils/emojiInputMode';

export { isTouchOrCoarsePointer, shouldUseAppEmojiPicker } from '../utils/emojiInputMode';

const LazyEmojiPicker = lazy(() => import('emoji-picker-react'));

const EmojiPickerPortal = ({ open, onClose, onEmojiClick, anchorRef }) => {
    const pickerRef = useRef(null);
    const [anchorStyle, setAnchorStyle] = useState(() =>
        getEmojiPickerAnchorStyle(anchorRef?.current)
    );

    const shouldRender = open && shouldUseAppEmojiPicker();

    useEffect(() => {
        if (!shouldRender) return undefined;

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
    }, [shouldRender, anchorRef]);

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

            <Suspense fallback={<div style={{ width: 300, height: 380, background: '#111827' }} />}>
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
                        width={300}
                        height={380}
                        previewConfig={{ showPreview: false }}
                    />
                </div>
            </Suspense>
        </div>,
        document.body
    );
};

export default EmojiPickerPortal;
