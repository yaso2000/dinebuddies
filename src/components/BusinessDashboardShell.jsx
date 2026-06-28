import React from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import '../pages/MyCommunity.css';
import { useAppBackNavigation } from '../hooks/useAppBackNavigation';

/**
 * Business dashboard pages: fixed subheader + inner scroll column (mobile swipe scroll).
 */import { AppText } from "./base";
export default function BusinessDashboardShell({ title, icon, onBack, backTo = '/my-community', rightSlot, children }) {
  const { goBack } = useAppBackNavigation({ fallback: backTo });
  const handleBack = () => (onBack ? onBack() : goBack());

  return (
    <div className="page-container my-community-page">
            <header className="my-community-subheader sticky-header-glass">
                <button
          type="button"
          className="back-btn"
          onClick={handleBack}>
          
                    <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
                </button>
                <div className="my-community-subheader__title">
                    {icon ? <AppText as="span" className="my-community-subheader__icon" aria-hidden="true">{icon}</AppText> : null}
                    <AppText as="h3">{title}</AppText>
                </div>
                {rightSlot || <div className="my-community-subheader__spacer" aria-hidden="true" />}
            </header>
            <div className="my-community-scroll">
                <div className="my-community-inner">
                    {children}
                </div>
            </div>
        </div>);

}