import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaPenAlt, FaTimes } from 'react-icons/fa';
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
 *   iconOnly?: boolean,
 *   className?: string,
 *   invitationVenue?: { venueType?: string, venueName?: string },
 *   privateAiContext?: import('../utils/privateAiRequestPayload.js').DatingAiContext,
 *   getPrivateAiContext?: () => import('../utils/privateAiRequestPayload.js').DatingAiContext | undefined,
 *   disabledHint?: string,
 * }} props
 */import { AppText } from "./base";
export default function AIFloatingLauncher({
  postType,
  subType,
  onTextSuccess,
  buildContextPrompt,
  multimodalMode = false,
  defaultAspectRatio = '1:1',
  disabled = false,
  compact = false,
  iconOnly = false,
  className = '',
  invitationVenue,
  privateAiContext,
  getPrivateAiContext,
  disabledHint
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

  const sheet = open ?
  <div className="ai-floating-sheet__backdrop" role="presentation" onClick={close}>
            <div
      className="ai-floating-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-floating-sheet-title"
      onClick={(e) => e.stopPropagation()}>

                <div className="ai-floating-sheet__handle" aria-hidden />
                <header className="ai-floating-sheet__header">
                    <AppText as="h2" id="ai-floating-sheet-title" className="ai-floating-sheet__title ai-floating-sheet__title--text">
                        <FaPenAlt aria-hidden />
                        {t('ai_floating_sheet_title')}
                    </AppText>
                    <button
          type="button"
          className="ai-floating-sheet__close ios-tap-target"
          onClick={close}
          aria-label={t('close')}>

                        <FaTimes aria-hidden />
                    </button>
                </header>

                <div className="ai-floating-sheet__body">
                    <AIGenerateBar
          postType={postType}
          subType={subType}
          onSuccess={(data, meta) => {
            const applied = onTextSuccess(data, meta);
            if (applied !== false) {
              window.setTimeout(() => close(), 400);
            }
          }}
          buildContextPrompt={buildContextPrompt}
          multimodalMode={multimodalMode}
          defaultAspectRatio={defaultAspectRatio}
          disabled={disabled}
          embedded
          invitationVenue={invitationVenue}
          privateAiContext={privateAiContext}
          getPrivateAiContext={getPrivateAiContext}
          disabledHint={disabledHint} />

                </div>
            </div>
        </div> :
  null;

  return (
    <div
      className={`ai-floating-launcher ai-floating-launcher--text-brand${compact ? ' ai-floating-launcher--compact' : ''}${iconOnly ? ' ai-floating-launcher--icon' : ''}${className ? ` ${className}` : ''}`}>

            <button
        type="button"
        className="ai-floating-launcher__trigger ios-tap-target"
        onClick={openSheet}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('ai_floating_open_btn')}
        title={t('ai_floating_open_btn')}>

                <FaPenAlt className="ai-floating-launcher__trigger-icon" aria-hidden />
                {!iconOnly ? t('ai_floating_open_btn') : null}
            </button>
            {disabledHint ?
      <AppText as="p" className="ai-floating-launcher__hint" role="status">
                    {disabledHint}
                </AppText> :
      null}
            {typeof document !== 'undefined' ? createPortal(sheet, document.body) : null}
        </div>);

}