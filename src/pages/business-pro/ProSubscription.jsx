import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../../firebase/config';
import { FaCheck, FaExternalLinkAlt } from 'react-icons/fa';
import { BUSINESS_PAID_PLAN_DISPLAY } from '../../config/stripeCommerce';
import {
    BUSINESS_FREE_PLAN_FEATURE_KEYS,
    BUSINESS_PAID_PLAN_FEATURE_KEYS,
    normalizeBusinessTier,
} from '../../utils/businessSubscription';
import { useToast } from '../../context/ToastContext';
import StripeTestModeBanner from '../../components/StripeTestModeBanner';

const ProSubscription = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { userProfile } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(null);
    const [portalLoading, setPortalLoading] = useState(false);

    const normalized = normalizeBusinessTier(userProfile?.subscriptionTier);
    const isPaid = normalized === 'paid';
    const isFree = normalized === 'free';

    const billingReturnUrl = `${window.location.origin}${location.pathname || '/settings/subscription'}`;

    const handleUpgrade = async () => {
        setLoading('paid');
        try {
            const functions = getFunctions(app, 'us-central1');
            const createBusinessCheckout = httpsCallable(functions, 'createBusinessSubscriptionCheckout');
            const result = await createBusinessCheckout({
                planName: t('biz_plan_paid_name', BUSINESS_PAID_PLAN_DISPLAY.name),
                successUrl: `${window.location.origin}/payment-success`,
                cancelUrl: billingReturnUrl,
            });
            if (result.data?.url) window.location.href = result.data.url;
        } catch (e) {
            console.error('Checkout error:', e);
            showToast(
                t('biz_plan_checkout_error', 'Could not start checkout: ') + (e.message || String(e)),
                'error'
            );
        } finally {
            setLoading(null);
        }
    };

    const handleManageBilling = async () => {
        setPortalLoading(true);
        try {
            const functions = getFunctions(app, 'us-central1');
            const createPortalSession = httpsCallable(functions, 'createPortalSession');
            const result = await createPortalSession({ returnUrl: billingReturnUrl });
            if (result.data?.url) window.location.href = result.data.url;
            else showToast(t('biz_plan_portal_no_url', 'Could not open billing portal.'), 'error');
        } catch (e) {
            console.error('Portal error:', e);
            showToast(t('biz_plan_portal_error', 'Could not open billing: ') + (e.message || String(e)), 'error');
        } finally {
            setPortalLoading(false);
        }
    };

    const paidPriceLabel = `${BUSINESS_PAID_PLAN_DISPLAY.priceLabel}${BUSINESS_PAID_PLAN_DISPLAY.periodLabel}`;

    const bannerBorder = isPaid ? 'color-mix(in srgb, var(--primary) 45%, transparent)' : 'var(--border-color)';
    const bannerBg = isPaid
        ? 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 16%, transparent), color-mix(in srgb, var(--primary) 8%, transparent))'
        : 'var(--hover-overlay)';

    const planCard = (key, { titleKey, titleDefault, priceLabel, features, tierKey }) => {
        const current = tierKey === 'free' ? isFree : isPaid;
        const isPaidCard = tierKey === 'paid';
        const showUpgradeOnPaidCard = isFree && isPaidCard;

        return (
            <div
                key={key}
                style={{
                    background: current ? 'color-mix(in srgb, var(--primary) 10%, var(--bg-card))' : 'var(--bg-card)',
                    border: `2px solid ${current ? 'var(--primary)' : 'var(--border-color)'}`,
                    borderRadius: 16,
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 4 }}>
                        {t(titleKey, titleDefault)}
                    </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                    <span style={{ fontSize: '2.2rem', fontWeight: 900, color: current ? 'var(--primary)' : 'var(--text-main)' }}>
                        {priceLabel}
                    </span>
                    {isPaidCard && (
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginInlineStart: 6 }}>
                            / {t('month', 'month')}
                        </span>
                    )}
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {features.map(([fk, def]) => (
                        <li key={fk} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            <FaCheck style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 2 }} />
                            {t(fk, def)}
                        </li>
                    ))}
                </ul>

                {current ? (
                    <button
                        type="button"
                        className="ui-btn"
                        disabled
                        style={{
                            padding: '12px',
                            fontSize: '0.875rem',
                            cursor: 'default',
                            background: isPaidCard ? 'linear-gradient(135deg, var(--primary), #ea580c)' : 'var(--bg-muted, #1e293b)',
                            color: isPaidCard ? '#fff' : 'var(--text-muted)',
                            border: 'none',
                            fontWeight: 800,
                            opacity: isPaidCard ? 1 : 0.95,
                        }}
                    >
                        {t('biz_plan_btn_current', 'Current Plan')}
                    </button>
                ) : showUpgradeOnPaidCard ? (
                    <button
                        type="button"
                        onClick={handleUpgrade}
                        disabled={loading === 'paid'}
                        className="ui-btn ui-btn--primary"
                        style={{
                            padding: '12px',
                            fontSize: '0.875rem',
                            fontWeight: 800,
                            opacity: loading === 'paid' ? 0.65 : 1,
                        }}
                    >
                        {loading === 'paid' ? t('loading', 'Loading...') : `${t('biz_plan_upgrade_cta', 'Upgrade to Paid')} →`}
                    </button>
                ) : (
                    <button
                        type="button"
                        className="ui-btn ui-btn--secondary"
                        disabled
                        style={{ padding: '12px', fontSize: '0.875rem', cursor: 'default', opacity: 0.85 }}
                    >
                        {t('biz_plan_btn_not_current', 'Not current')}
                    </button>
                )}
            </div>
        );
    };

    return (
        <div>
            <StripeTestModeBanner />
            <div
                style={{
                    background: bannerBg,
                    border: `1px solid ${bannerBorder}`,
                    borderRadius: 16,
                    padding: '24px 28px',
                    marginBottom: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 16,
                }}
            >
                <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {t('biz_plan_current_label', 'Current Plan')}
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: isPaid ? 'var(--primary)' : 'var(--text-muted)' }}>
                        {isPaid ? t('biz_plan_paid_name', 'Paid Business') : t('biz_plan_free_name', 'Free Business')}
                    </div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: 8, maxWidth: 420, lineHeight: 1.45 }}>
                        {isPaid ? (
                            <>
                                {paidPriceLabel}
                                {t(
                                    'biz_plan_paid_banner_suffix',
                                    '/month — full manual feature set. Buy Dine Credits for AI.'
                                )}
                            </>
                        ) : (
                            t(
                                'biz_plan_free_banner_desc',
                                'Core profile and community. Motion limits apply; AI uses Dine Credits.'
                            )
                        )}
                    </div>
                </div>
                {isPaid && (
                    <button
                        type="button"
                        className="ui-btn ui-btn--secondary"
                        onClick={handleManageBilling}
                        disabled={portalLoading}
                        style={{ padding: '10px 18px', gap: 8, fontSize: '0.875rem' }}
                    >
                        <FaExternalLinkAlt size={12} /> {portalLoading ? t('loading', 'Loading...') : t('biz_plan_manage_billing', 'Manage billing')}
                    </button>
                )}
            </div>

            <h3
                style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    marginBottom: 16,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                }}
            >
                {t('biz_plan_compare_heading', 'Plans')}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
                {planCard('free', {
                    titleKey: 'biz_plan_free_name',
                    titleDefault: 'Free Business',
                    priceLabel: '$0',
                    features: BUSINESS_FREE_PLAN_FEATURE_KEYS,
                    tierKey: 'free',
                })}
                {planCard('paid', {
                    titleKey: 'biz_plan_paid_name',
                    titleDefault: 'Paid Business',
                    priceLabel: paidPriceLabel,
                    features: BUSINESS_PAID_PLAN_FEATURE_KEYS,
                    tierKey: 'paid',
                })}
            </div>

            <p style={{ marginTop: 24, fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                {t('biz_plan_credits_lead', 'Need AI?')}{' '}
                <button
                    type="button"
                    onClick={() => navigate('/settings/credits')}
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: 'var(--primary)',
                        fontWeight: 800,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        font: 'inherit',
                    }}
                >
                    {t('biz_plan_credits_link', 'Open Dine Credits wallet')}
                </button>
            </p>
        </div>
    );
};

export default ProSubscription;
