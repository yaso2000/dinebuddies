import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaTimes } from 'react-icons/fa';
import './StudioTextComposerOverlay.css';

const TITLE_MAX = 60;
const BODY_MAX = 180;
/** visualViewport shrink vs layout height — keyboard likely open */
const KEYBOARD_OPEN_THRESHOLD_PX = 120;

/**
 * Mobile plain-text composer: card with title + body, pinned above the on-screen keyboard.
 */
const StudioTextComposerOverlay = forwardRef(function StudioTextComposerOverlay(
    {
        enabled = false,
        open = false,
        activeField = 'title',
        title = '',
        body = '',
        onTitleChange,
        onBodyChange,
        onClose,
        dir = 'ltr',
    },
    ref
) {
    const { t } = useTranslation();
    const shellRef = useRef(null);
    const cardRef = useRef(null);
    const titleRef = useRef(null);
    const bodyRef = useRef(null);
    const [keyboardOpen, setKeyboardOpen] = useState(false);

    const focusField = useCallback((field) => {
        const target = field === 'body' ? bodyRef.current : titleRef.current;
        if (!target) return false;
        try {
            target.focus({ preventScroll: true });
        } catch {
            target.focus();
        }
        return document.activeElement === target;
    }, []);

    useImperativeHandle(ref, () => ({ focusField }), [focusField]);

    const syncViewport = useCallback(() => {
        const shell = shellRef.current;
        const vv = window.visualViewport;
        if (!shell || !vv) return;
        shell.style.top = `${vv.offsetTop}px`;
        shell.style.left = `${vv.offsetLeft}px`;
        shell.style.width = `${vv.width}px`;
        shell.style.height = `${vv.height}px`;

        const layoutH = window.innerHeight;
        const keyboardLikelyOpen =
            layoutH - vv.height - vv.offsetTop > KEYBOARD_OPEN_THRESHOLD_PX;
        setKeyboardOpen(keyboardLikelyOpen);
    }, []);

    useEffect(() => {
        if (!open) {
            setKeyboardOpen(false);
            return undefined;
        }
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    useEffect(() => {
        if (!enabled || !open) return undefined;
        syncViewport();
        const vv = window.visualViewport;
        if (!vv) return undefined;
        const onViewportChange = () => {
            syncViewport();
            const active = document.activeElement;
            if (active === titleRef.current || active === bodyRef.current) {
                active.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
            }
        };
        onViewportChange();
        vv.addEventListener('resize', onViewportChange);
        vv.addEventListener('scroll', onViewportChange);
        return () => {
            vv.removeEventListener('resize', onViewportChange);
            vv.removeEventListener('scroll', onViewportChange);
        };
    }, [enabled, open, syncViewport]);

    const handleApply = useCallback(() => {
        titleRef.current?.blur();
        bodyRef.current?.blur();
        onClose?.();
    }, [onClose]);

    if (!enabled || typeof document === 'undefined') return null;

    const titlePh = t('studio_title_placeholder', 'Write title here');
    const bodyPh = t('studio_body_placeholder', 'Write message here');
    const titleLabel = t('studio_layer_title', 'Title');
    const bodyLabel = t('studio_layer_body', 'Message');

    return createPortal(
        <div
            className={`sps-text-composer${open ? ' is-open' : ''}`}
            role="dialog"
            aria-modal={open}
            aria-hidden={!open}
            aria-label={t('studio_edit_text', 'Edit text')}
            dir={dir}
        >
            <div
                ref={shellRef}
                className={`sps-text-composer__shell${
                    keyboardOpen ? ' sps-text-composer__shell--keyboard' : ''
                }`}
            >
                <div ref={cardRef} className="sps-text-composer__card">
                    <div className="sps-text-composer__header">
                        <span className="sps-text-composer__header-title">
                            {t('studio_edit_text', 'Edit text')}
                        </span>
                        <button
                            type="button"
                            className="sps-text-composer__close"
                            onClick={handleApply}
                            aria-label={t('close', 'Close')}
                        >
                            <FaTimes size={16} aria-hidden />
                        </button>
                    </div>
                    <div className="sps-text-composer__section sps-text-composer__section--title">
                        <label className="sps-text-composer__label" htmlFor="sps-composer-title">
                            {titleLabel}
                        </label>
                        <input
                            ref={titleRef}
                            id="sps-composer-title"
                            type="text"
                            className="sps-text-composer__title"
                            value={title}
                            maxLength={TITLE_MAX}
                            placeholder={titlePh}
                            enterKeyHint="next"
                            autoComplete="off"
                            autoCorrect="on"
                            onChange={(e) => onTitleChange?.(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    focusField('body');
                                }
                            }}
                        />
                    </div>

                    <div className="sps-text-composer__divider" aria-hidden />

                    <div className="sps-text-composer__section sps-text-composer__section--body">
                        <label className="sps-text-composer__label" htmlFor="sps-composer-body">
                            {bodyLabel}
                        </label>
                        <textarea
                            ref={bodyRef}
                            id="sps-composer-body"
                            className="sps-text-composer__body"
                            value={body}
                            maxLength={BODY_MAX}
                            placeholder={bodyPh}
                            rows={3}
                            enterKeyHint="done"
                            autoComplete="off"
                            autoCorrect="on"
                            onChange={(e) => onBodyChange?.(e.target.value)}
                        />
                    </div>

                    <button
                        type="button"
                        className="sps-text-composer__apply"
                        onClick={handleApply}
                    >
                        {t('studio_composer_apply', 'OK')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
});

export default StudioTextComposerOverlay;
