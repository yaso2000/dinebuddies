import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaTrash, FaArrowLeft, FaExclamationTriangle, FaCog, FaEnvelope } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { goToLogin } from '../utils/goToLogin';
import { AppText } from "../components/base";

const listStyle = (i18n) => ({
  paddingLeft: i18n.language === 'ar' ? '0' : '1.5rem',
  paddingRight: i18n.language === 'ar' ? '1.5rem' : '0',
  marginBottom: '0.5rem'
});

const AccountDeletionRequest = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isLoggedIn = !!currentUser;

  return (
    <div
      style={{
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        padding: '20px',
        paddingBottom: '100px',
        color: 'var(--text-main)',
        maxWidth: '900px',
        margin: '0 auto',
        textAlign: i18n.language === 'ar' ? 'right' : 'left',
        lineHeight: '1.6',
        boxSizing: 'border-box'
      }}>
      
            <button
        onClick={() => navigate(-1)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          marginBottom: '20px',
          fontFamily: 'inherit'
        }}>
        
                <FaArrowLeft style={{ transform: i18n.language === 'ar' ? 'rotate(180deg)' : 'none' }} /> {t('back')}
            </button>

            <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          marginBottom: '40px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '20px'
        }}>
        
                <FaTrash size={40} color="var(--primary)" />
                <div>
                    <AppText as="h1" style={{ margin: 0, fontSize: '2rem', fontWeight: '900' }}>
                        {t('account_deletion_request', 'Account Deletion Request')}
                    </AppText>
                    <AppText as="p" style={{ margin: '0.25rem 0 0', opacity: 0.6 }}>
                        {t('last_updated', 'Last Updated')}: March 8, 2025
                    </AppText>
                </div>
            </div>

            <AppText as="p" style={{ marginBottom: '1rem' }}>
                {t('account_deletion_intro', 'You can request permanent deletion of your DineBuddies account at any time. This page explains what is removed and how to proceed.')}
            </AppText>

            <section style={{ marginBottom: '2rem' }}>
                <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FaExclamationTriangle /> {t('what_happens', 'What happens when you delete')}
                </AppText>
                <AppText as="p">{t('account_deletion_irreversible', 'Account deletion is permanent and cannot be undone.')}</AppText>
                <AppText as="p"><strong>{t('we_will_remove', 'We will remove:')}</strong></AppText>
                <ul style={listStyle(i18n)}>
                    <li>{t('deletion_profile', 'Your profile and account data')}</li>
                    <li>{t('deletion_invitations', 'Your dining invitations and related content')}</li>
                    <li>{t('deletion_messages', 'Your messages and chat history')}</li>
                    <li>{t('deletion_preferences', 'Your preferences and settings')}</li>
                </ul>
                <AppText as="p" style={{ marginTop: '1rem' }}>
                    {t('deletion_backups', 'Deleted accounts may remain in backups for a limited period in accordance with our Privacy Policy.')}
                </AppText>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                    {t('how_to_delete', 'How to delete your account')}
                </AppText>
                {isLoggedIn ?
        <>
                        <AppText as="p" style={{ marginBottom: '1rem' }}>
                            {t('delete_from_settings', 'You are signed in. To permanently delete your account, go to Settings and use the "Delete Account" option. You will be asked to confirm before the deletion is processed.')}
                        </AppText>
                        <button
            onClick={() => navigate('/settings')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 24px',
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '1rem'
            }}>
            
                            <FaCog /> {t('go_to_settings', 'Go to Settings')}
                        </button>
                    </> :

        <>
                        <AppText as="p" style={{ marginBottom: '1rem' }}>
                            {t('delete_need_login', 'You need to be signed in to delete your account. Sign in, then go to Settings and use "Delete Account".')}
                        </AppText>
                        <button
            onClick={() => goToLogin()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 24px',
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '1rem'
            }}>
            
                            {t('log_in', 'Log in')}
                        </button>
                    </>
        }
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FaEnvelope /> {t('contact_support', 'Contact support')}
                </AppText>
                <AppText as="p">
                    {t('deletion_contact_intro', 'If you cannot access your account or need help with deletion, contact us and we will process your request in line with our policies.')}
                </AppText>
                <AppText as="p"><strong>{t('email', 'Email')}:</strong> support@dinebuddies.com</AppText>
                <AppText as="p"><strong>{t('website', 'Website')}:</strong> https://dinebuddies.com</AppText>
            </section>

            <div
        style={{
          marginTop: '2.5rem',
          padding: '1.5rem',
          background: 'var(--bg-card)',
          borderRadius: '20px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
        }}>
        
                <AppText as="p" style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>
                    {t('last_updated', 'Last Updated')}: March 8, 2025
                </AppText>
            </div>
        </div>);

};

export default AccountDeletionRequest;