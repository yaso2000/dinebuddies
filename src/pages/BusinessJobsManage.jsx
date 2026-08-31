import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import BusinessJobsManager from '../components/business/BusinessJobsManager';
import { AppText } from '../components/base';

/**
 * Standalone business jobs console (post jobs + review applications), split out
 * of the dashboard like BusinessInboxManage.
 */
export default function BusinessJobsManage() {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { currentUser } = useAuth();
    const BackIcon = i18n.dir() === 'rtl' ? FaArrowRight : FaArrowLeft;

    if (!currentUser?.uid) return null;

    return (
        <div className="page-container" style={{ padding: '1rem', maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem' }}>
                <button
                    type="button"
                    onClick={() => navigate('/business-dashboard')}
                    aria-label={t('back', 'Back')}
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-main)', cursor: 'pointer', flexShrink: 0 }}>
                    <BackIcon />
                </button>
                <AppText as="h2" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {t('jobs_manage_page_title', 'Jobs & applications')}
                </AppText>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '1.5rem' }}>
                <BusinessJobsManager />
            </div>
        </div>
    );
}
