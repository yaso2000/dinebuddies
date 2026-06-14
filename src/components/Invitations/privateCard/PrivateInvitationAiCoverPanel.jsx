import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaCheck, FaMagic, FaRedo, FaTimes } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../context/ToastContext';
import { resolveAiGeneratedCoverPreview } from '../../../services/mediaService';
import MagicCoverGeneratePanel from '../MagicCoverGeneratePanel';
import '../../AIFloatingLauncher.css';
import './PrivateInvitationAiCoverPanel.css';

/**
 * Floating AI cover generator for private / dating invitation editors.
 * After generation: preview + Use / Retry / Close.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   subType?: 'private' | 'date',
 *   buildBrief?: () => string,
 *   onUseImage: (url: string) => void,
 *   disabled?: boolean,
 * }} props
 */
export default function PrivateInvitationAiCoverPanel({
    open,
    onClose,
    subType = 'private',
    buildBrief,
    onUseImage,
    disabled = false,
}) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [previewDisplayUrl, setPreviewDisplayUrl] = useState(null);
    const [previewRemoteUrl, setPreviewRemoteUrl] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const revokePreviewRef = useRef(null);
    const previewSeqRef = useRef(0);

    const revokePreviewBlob = useCallback(() => {
        revokePreviewRef.current?.();
        revokePreviewRef.current = null;
    }, []);

    const resetPreview = useCallback(() => {
        previewSeqRef.current += 1;
        revokePreviewBlob();
        setPreviewDisplayUrl(null);
        setPreviewRemoteUrl(null);
        setPreviewLoading(false);
    }, [revokePreviewBlob]);

    const close = useCallback(() => {
        onClose?.();
    }, [onClose]);

    useEffect(() => {
        if (!open) {
            resetPreview();
        }
    }, [open, resetPreview]);

    useEffect(() => {
        return () => {
            revokePreviewBlob();
        };
    }, [revokePreviewBlob]);

    useEffect(() => {
        if (!open) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') close();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, close]);

    const resolvePreview = useCallback(
        async (url, seq) => {
            setPreviewLoading(true);
            revokePreviewBlob();
            setPreviewDisplayUrl(null);
            setPreviewRemoteUrl(url);

            try {
                const resolved = await resolveAiGeneratedCoverPreview(url);
                if (seq !== previewSeqRef.current) {
                    resolved.revokeDisplay?.();
                    return;
                }
                setPreviewDisplayUrl(resolved.displayUrl);
                setPreviewRemoteUrl(resolved.remoteUrl);
                revokePreviewRef.current = resolved.revokeDisplay || null;
            } catch (err) {
                console.error('[PrivateInvitationAiCoverPanel] preview resolve failed:', err);
                if (seq === previewSeqRef.current) {
                    setPreviewRemoteUrl(null);
                    showToast(
                        t('private_cover_ai_preview_failed', {
                            defaultValue:
                                'The cover was generated but the preview could not load. Try again in a moment.',
                        }),
                        'error'
                    );
                }
            } finally {
                if (seq === previewSeqRef.current) {
                    setPreviewLoading(false);
                }
            }
        },
        [revokePreviewBlob, showToast, t]
    );

    const handlePreviewReady = useCallback(
        (url) => {
            if (!url) return;
            const seq = ++previewSeqRef.current;
            resolvePreview(url, seq);
        },
        [resolvePreview]
    );

    const handlePreviewImgError = useCallback(() => {
        if (!previewRemoteUrl || previewLoading) return;
        const seq = ++previewSeqRef.current;
        resolvePreview(previewRemoteUrl, seq);
    }, [previewRemoteUrl, previewLoading, resolvePreview]);

    const handleUse = useCallback(() => {
        if (!previewRemoteUrl) return;
        onUseImage?.(previewRemoteUrl);
        resetPreview();
        close();
    }, [previewRemoteUrl, onUseImage, resetPreview, close]);

    const handleRetry = useCallback(() => {
        resetPreview();
    }, [resetPreview]);

    const showReview = previewLoading || Boolean(previewDisplayUrl);
    const showGenerate = !showReview;

    if (!open || typeof document === 'undefined') {
        return null;
    }

    const sheet = (
        <div className="ai-floating-sheet__backdrop" role="presentation" onClick={close}>
            <div
                className="ai-floating-sheet private-ai-cover-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="private-ai-cover-sheet-title"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="ai-floating-sheet__header">
                    <h2 id="private-ai-cover-sheet-title" className="ai-floating-sheet__title">
                        <FaMagic aria-hidden />
                        {t('magic_cover_panel_title', { defaultValue: 'Optional AI cover' })}
                    </h2>
                    <button
                        type="button"
                        className="ai-floating-sheet__close ios-tap-target"
                        onClick={close}
                        aria-label={t('close')}
                    >
                        <FaTimes aria-hidden />
                    </button>
                </header>

                <div className="ai-floating-sheet__body private-ai-cover-sheet__body">
                    {showReview ? (
                        <div className="private-ai-cover-sheet__review">
                            <p className="private-ai-cover-sheet__review-label">
                                {t('magic_cover_preview_heading', {
                                    defaultValue: 'Preview — not applied yet',
                                })}
                            </p>
                            <div
                                className={`private-ai-cover-sheet__preview-wrap${previewLoading ? ' private-ai-cover-sheet__preview-wrap--loading' : ''}`}
                            >
                                {previewLoading ? (
                                    <div className="private-ai-cover-sheet__preview-loading" aria-busy="true">
                                        <span className="ai-generate-bar__spinner" aria-hidden />
                                        <span>{t('ai_generate_loading')}</span>
                                    </div>
                                ) : previewDisplayUrl ? (
                                    <img
                                        src={previewDisplayUrl}
                                        alt=""
                                        className="private-ai-cover-sheet__preview-img"
                                        draggable={false}
                                        onError={handlePreviewImgError}
                                    />
                                ) : null}
                            </div>
                            {!previewLoading && previewDisplayUrl ? (
                                <p className="private-ai-cover-sheet__review-hint">
                                    {t('magic_cover_discard_credits_note', {
                                        defaultValue:
                                            'Discarding does not refund credits — they were already charged when generation succeeded.',
                                    })}
                                </p>
                            ) : null}
                            <div className="private-ai-cover-sheet__actions">
                                <button
                                    type="button"
                                    className="private-ai-cover-sheet__btn private-ai-cover-sheet__btn--primary ios-tap-target"
                                    onClick={handleUse}
                                    disabled={previewLoading || !previewDisplayUrl}
                                >
                                    <FaCheck aria-hidden />
                                    {t('private_cover_ai_use_image', { defaultValue: 'Use as cover' })}
                                </button>
                                <button
                                    type="button"
                                    className="private-ai-cover-sheet__btn private-ai-cover-sheet__btn--secondary ios-tap-target"
                                    onClick={handleRetry}
                                    disabled={previewLoading}
                                >
                                    <FaRedo aria-hidden />
                                    {t('private_cover_ai_retry', { defaultValue: 'Try again' })}
                                </button>
                                <button
                                    type="button"
                                    className="private-ai-cover-sheet__btn private-ai-cover-sheet__btn--ghost ios-tap-target"
                                    onClick={close}
                                >
                                    {t('close')}
                                </button>
                            </div>
                        </div>
                    ) : null}

                    {showGenerate ? (
                        <MagicCoverGeneratePanel
                            subType={subType}
                            buildBrief={buildBrief}
                            onImageGenerated={handlePreviewReady}
                            disabled={disabled}
                            requireVenue={false}
                            embedded
                            aspectRatio="9:16"
                        />
                    ) : null}
                </div>
            </div>
        </div>
    );

    return createPortal(sheet, document.body);
}
