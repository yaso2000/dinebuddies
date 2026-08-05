import React from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useAppBackNavigation } from '../hooks/useAppBackNavigation';
import { APP_HOME_PATH } from '../utils/appRouteShell';

/**
 * Standard back control — history back, then home on the page you return to.
 */
export default function AppBackButton({
  fallback = APP_HOME_PATH,
  className = 'back-btn',
  ariaLabel,
  style,
  iconStyle,
  onClick,
  children,
}) {
  const { t } = useTranslation();
  const { goBack } = useAppBackNavigation({ fallback });

  return (
    <button
      type="button"
      className={className}
      style={style}
      aria-label={ariaLabel ?? t('back', 'Back')}
      onClick={onClick ?? goBack}>
      {children ?? (
        <FaArrowLeft style={{ transform: 'rotate(180deg)', ...iconStyle }} aria-hidden />
      )}
    </button>
  );
}
