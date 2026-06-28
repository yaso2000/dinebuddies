import React from 'react';
import { FaMagic } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import './AdminAiControls.css';

export default function AdminAiIconButton({
  loading = false,
  disabled = false,
  open = false,
  title,
  onClick,
  ariaLabel,
}) {
  const { t } = useTranslation();
  const label =
    ariaLabel ||
    title ||
    t('admin_ai_action', 'AI assist');

  return (
    <button
      type="button"
      className={`admin-ai-icon-btn${open ? ' db-btn--lime' : ''}`}
      disabled={disabled || loading}
      onClick={onClick}
      title={title || label}
      aria-label={label}
      aria-expanded={open ? 'true' : 'false'}
    >
      {loading ? <span className="admin-ai-icon-btn__spinner" aria-hidden /> : <FaMagic aria-hidden />}
    </button>
  );
}
