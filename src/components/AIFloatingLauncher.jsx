import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaMagic, FaTimes } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import AIGenerateBar from './AIGenerateBar';
import './AIFloatingLauncher.css';

/**
 * Inline “open AI” control + floating dialog (bottom sheet / modal).
 * Invitation pages: text-only via AIGenerateBar → /api/ai/generate.
 * Cover images use MagicCoverGeneratePanel in the media/gallery section.
 *
 * @param {{
 *   postType: 'regular_post' | 'featured_post' | 'animated_post' | 'invitation',
 *   subType?: 'public' | 'private' | 'date',
 *   onTextSuccess: (data: Record<string, unknown>, meta?: Record<string, unknown>) => void,
 *   buildContextPrompt?: () => string,
 *   multimodalMode?: boolean,
 *   defaultAspectRatio?: '1:1' | '9:16',
 *   disabled?: boolean,
 *   compact?: boolean,
 *   className?: string,
 *   invitationVenue?: { venueType?: string, venueName?: string },
 *   datingAiContext?: { inviteeId?: string, date?: string, time?: string, venueDetails?: Record<string, unknown> },
 *   disabledHint?: string,
 * }} props
 */
export default function AIFloatingLauncher({
    postType,
    subType,
    onTextSuccess,
    buildContextPrompt,
    multimodalMode = false,
    defaultAspectRatio = '1:1',
    disabled = false,
    compact = false,
    className = '',
    invitationVenue,
    datingAiContext,
    disabledHint,
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    const close = useCallback(() => setOpen(false), []);

    const openSheet = useCallback(() => {
        if (disabled) return;
        setOpen(true);
    }, [disabled]);

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

    const sheet = open ? (
        <div className="ai-floating-sheet__backdrop" role="presentation" onClick={close}>
            <div
                className="ai-floating-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="ai-floating-sheet-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="ai-floating-sheet__handle" aria-hidden />
                <header className="ai-floating-sheet__header">
                    <h2 id="ai-floating-sheet-title" className="ai-floating-sheet__title">
                        <FaMagic aria-hidden />
                        {t('ai_floating_sheet_title', 'مساعد الذكاء الاصطناعي')}
                    </h2>
                    <button
                        type="button"
                        className="ai-floating-sheet__close ios-tap-target"
                        onClick={close}
                        aria-label={t('close', 'إغلاق')}
                    >
                        <FaTimes aria-hidden />
                    </button>
                </header>

                <div className="ai-floating-sheet__body">
                    <AIGenerateBar
                        postType={postType}
                        subType={subType}
                        onSuccess={(data, meta) => {
                            onTextSuccess(data, meta);
                            close();
                        }}
                        buildContextPrompt={buildContextPrompt}
                        multimodalMode={multimodalMode}
                        defaultAspectRatio={defaultAspectRatio}
                        disabled={disabled}
                        embedded
                        invitationVenue={invitationVenue}
                        datingAiContext={datingAiContext}
                        disabledHint={disabledHint}
                    />
                </div>
            </div>
        </div>
    ) : null;

    return (
        <div
            className={`ai-floating-launcher${compact ? ' ai-floating-launcher--compact' : ''}${className ? ` ${className}` : ''}`}
        >
            <button
                type="button"
                className="ai-floating-launcher__trigger ios-tap-target"
                onClick={openSheet}
                disabled={disabled}
                aria-haspopup="dialog"
                aria-expanded={open}
            >
                <FaMagic className="ai-floating-launcher__trigger-icon" aria-hidden />
                {t('ai_floating_open_btn', 'توليد بالذكاء الاصطناعي')}
            </button>
            {typeof document !== 'undefined' ? createPortal(sheet, document.body) : null}
        </div>
    );
}
