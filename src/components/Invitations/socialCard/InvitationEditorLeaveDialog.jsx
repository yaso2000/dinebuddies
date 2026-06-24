import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Save / discard / cancel when leaving private or private invite editors.
 */import { AppText } from "../../base";
export default function InvitationEditorLeaveDialog({
  open,
  saving = false,
  onSave,
  onDiscard,
  onCancel,
  questionKey = 'social_editor_leave_question',
  questionDefault = 'Save your changes before leaving?'
}) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div
      className="invitation-preview-leave-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-label={t('studio_close_title', 'Save your work?')}>
      
            <div
        className="invitation-preview-leave-dialog__backdrop"
        onClick={() => !saving && onCancel?.()} />
      
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
            onClick={onSave}
            disabled={saving}>
            
                        {saving ? t('saving', 'Saving…') : t('save_changes', 'Save Changes')}
                    </button>
                    <button
            type="button"
            className="invitation-preview-leave-dialog__btn invitation-preview-leave-dialog__btn--discard"
            onClick={onDiscard}
            disabled={saving}>
            
                        {t('editor_leave_dont_save', "Don't save")}
                    </button>
                    <button
            type="button"
            className="invitation-preview-leave-dialog__btn invitation-preview-leave-dialog__btn--cancel"
            onClick={onCancel}
            disabled={saving}>
            
                        {t('cancel', 'Cancel')}
                    </button>
                </div>
            </div>
        </div>);

}