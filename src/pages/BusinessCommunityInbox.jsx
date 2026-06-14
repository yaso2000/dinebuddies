import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import BusinessFeedbackInbox from '../components/BusinessFeedbackInbox';
import BusinessDashboardShell from '../components/BusinessDashboardShell';
import './MyCommunity.css';

export default function BusinessCommunityInbox() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { userProfile } = useAuth();
    const isBusinessAccount = userProfile?.isBusiness;

    useEffect(() => {
        if (userProfile && !isBusinessAccount) navigate('/');
    }, [userProfile, isBusinessAccount, navigate]);

    if (!isBusinessAccount) return null;

    return (
        <BusinessDashboardShell title={t('biz_dashboard_inbox', 'Complaints & Suggestions')}>
            <BusinessFeedbackInbox />
        </BusinessDashboardShell>
    );
}
