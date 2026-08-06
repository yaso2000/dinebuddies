import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AppText } from '../../base';
import './InvitationEditorLeaveDialog.css';

/**
 * Save / discard / cancel when leaving editors (portaled above tool modals).
 */
export default function InvitationEditorLeaveDialog({
  open,
  saving = false,
  onSave,
  onDiscard,
  onCancel,
  questionKey = 'social_editor_leave_question',
  questionDefault = 'Save your changes before leaving?',
}) {
  const { t } = useTranslation();

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="invitation-preview-leave-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-label={t('studio_close_title', 'Save your work?')}
    >
      <div
        className="invitation-preview-leave-dialog__backdrop"
        onClick={() => {
          if (!saving) onCancel?.();
        }}
      />
      <div className="invitation-preview-leave-dialog__card">
        <AppText as="h3" className="invitation-preview-leave-dialog__title">
          {t('studio_close_title', 'Save your work?')}
        </AppText>
        <AppText as="p" className="invitation-preview-leave-dialog__text">
          {t(questionKey, questionDefault)}
        </AppText>
        <div className="invitation-preview-leave-dialog__actions">
          <button
            type="button"
            className="invitation-preview-leave-dialog__btn invitation-preview-leave-dialog__btn--save"
            onClick={() => onSave?.()}
            disabled={saving}
          >
            {saving ? t('saving', 'Saving…') : t('save_changes', 'Save Changes')}
          </button>
          <button
            type="button"
            className="invitation-preview-leave-dialog__btn invitation-preview-leave-dialog__btn--discard"
            onClick={() => onDiscard?.()}
            disabled={saving}
          >
            {t('editor_leave_dont_save', "Don't save")}
          </button>
          <button
            type="button"
            className="invitation-preview-leave-dialog__btn invitation-preview-leave-dialog__btn--cancel"
            onClick={() => onCancel?.()}
            disabled={saving}
          >
            {t('cancel', 'Cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
