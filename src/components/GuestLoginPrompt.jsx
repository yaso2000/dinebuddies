import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { goToLogin } from '../utils/goToLogin';
import { AppText } from "./base";

const GuestLoginPrompt = ({ message, icon = '🔒' }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="ui-prompt ui-prompt--standalone">
            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>{icon}</div>
            <AppText as="h3" className="ui-prompt__title" style={{ fontSize: '1.2rem' }}>{t('login_required')}</AppText>
            <AppText as="p" className="ui-prompt__desc">{message || t('create_account_enjoy')}</AppText>
            <button type="button" className="ui-prompt__btn" onClick={() => goToLogin()}>
                {t('login')}
            </button>
        </div>);

};

export default GuestLoginPrompt;