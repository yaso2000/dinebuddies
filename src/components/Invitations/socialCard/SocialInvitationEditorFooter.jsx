import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaTimes, FaSave, FaEye } from 'react-icons/fa';
import './SocialInvitationEditorFooter.css';

/**
 * Editor actions: close, save draft, preview — shown together at the bottom of create flows.
 */
export default function SocialInvitationEditorFooter({
    onClose,
    onSave,
    onPreview,
    busy = false,
    saveDisabled = false,
    previewDisabled = false,
    variant = 'private',
}) {
    const { t } = useTranslation();
    const isDating = variant === 'dating';

    return (
        <div
            className={`private-invitation-editor-footer${isDating ? ' private-invitation-editor-footer--private' : ''}`}
        >
            <button
                type="button"
                className="private-invitation-editor-footer__btn private-invitation-editor-footer__btn--close"
                onClick={onClose}
                disabled={busy}
            >
                <FaTimes aria-hidden />
                {t('close_editor', { defaultValue: 'Close' })}
            </button>
            <button
                type="button"
                className="private-invitation-editor-footer__btn private-invitation-editor-footer__btn--save"
                onClick={onSave}
                disabled={busy || saveDisabled}
            >
                <FaSave aria-hidden />
                {busy ? t('processing') : t('save_invitation_draft', { defaultValue: 'Save invitation' })}
            </button>
            <button
                type="button"
                className="private-invitation-editor-footer__btn private-invitation-editor-footer__btn--preview"
                onClick={onPreview}
                disabled={busy || previewDisabled}
            >
                <FaEye aria-hidden />
                {busy ? t('processing') : t('preview_invitation')}
            </button>
        </div>
    );
}
