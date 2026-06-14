import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { getBusinessSubscriptionAccess } from '../../utils/businessSubscription';

/**
 * Blocks paid-only business surfaces (dashboard, Smart Post Studio, etc.).
 */
export default function BusinessPaidFeatureGate({
    titleKey = 'biz_plan_paid_gate_title',
    titleDefault = 'Paid Business feature',
    hintKey = 'biz_plan_paid_gate_hint',
    hintDefault = 'Upgrade to unlock this tool.',
    children,
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const access = getBusinessSubscriptionAccess(userProfile?.subscriptionTier);

    if (access.isPaid) {
        return children;
    }

    return (
        <div
            className="page-container"
            style={{
                padding: '2rem 1.25rem',
                minHeight: '70vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <div
                className="ui-card"
                style={{
                    maxWidth: 420,
                    width: '100%',
                    padding: '2rem 1.5rem',
                    textAlign: 'center',
                }}
            >
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>👑</div>
                <h2 style={{ margin: '0 0 10px', fontSize: '1.2rem', fontWeight: 800 }}>
                    {t(titleKey, titleDefault)}
                </h2>
                <p style={{ margin: '0 0 20px', fontSize: '0.92rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                    {t(hintKey, hintDefault)}
                </p>
                <button
                    type="button"
                    className="ui-btn ui-btn--primary"
                    style={{ width: '100%', fontWeight: 800 }}
                    onClick={() => navigate('/settings/subscription')}
                >
                    {t('biz_plan_upgrade_cta', 'Upgrade to Paid')} →
                </button>
            </div>
        </div>
    );
}
