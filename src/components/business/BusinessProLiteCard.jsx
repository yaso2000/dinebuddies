import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaBolt, FaCheck, FaSpinner, FaCoins } from 'react-icons/fa';
import { useToast } from '../../context/ToastContext';
import { BUSINESS_PRO_LITE, isBusinessProLiteActive } from '../../utils/businessSubscription';
import { activateBusinessProLiteWithCredits } from '../../services/businessProLite';
import { AppText } from '../base';

/** Feature i18n keys unlocked by the Pro-Lite pass (delivery, offers, Stage). */
const LITE_FEATURE_KEYS = [
    ['pro_lite_feat_delivery', 'Delivery & ordering links'],
    ['pro_lite_feat_offers', 'Special offers (profile + swipe card)'],
    ['pro_lite_feat_stage', '24-hour Stage live room'],
];

function spendableCredits(profile) {
    return Math.max(0, Math.floor(Number(profile?.paidCredits) || 0)) + Math.max(0, Math.floor(Number(profile?.savedCredits) || 0));
}

function formatUntil(profile) {
    const v = profile?.businessProLiteUntil;
    const d = v?.toDate ? v.toDate() : v?.seconds ? new Date(v.seconds * 1000) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    try {
        return d.toLocaleDateString();
    } catch {
        return '';
    }
}

/**
 * Credit "Pro Lite" pass card on the business subscription page — pay-on-demand
 * alternative to the full $29 plan; unlocks delivery links, special offers and
 * Stage for 30 days by spending Dine Credits. Coexists with the full plan.
 */
export default function BusinessProLiteCard({ userProfile, isFullPaid }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [busy, setBusy] = useState(false);

    const cost = BUSINESS_PRO_LITE.creditCost;
    const balance = spendableCredits(userProfile);
    const active = isBusinessProLiteActive(userProfile?.businessProLiteUntil);
    const until = formatUntil(userProfile);
    const enough = balance >= cost;

    const handleActivate = async () => {
        if (!enough) {
            navigate('/settings/credits');
            return;
        }
        setBusy(true);
        try {
            const res = await activateBusinessProLiteWithCredits();
            if (res?.ok) {
                showToast(t('pro_lite_activated', 'Pro Lite activated for {{days}} days.', { days: BUSINESS_PRO_LITE.durationDays }), 'success');
            } else {
                showToast(t('pro_lite_failed', 'Could not activate Pro Lite. Please try again.'), 'error');
            }
        } catch (err) {
            const code = String(err?.code || '');
            const msg = String(err?.message || '');
            if (code === 'functions/failed-precondition' || msg.includes('INSUFFICIENT_CREDITS')) {
                showToast(t('pro_lite_insufficient', 'You do not have enough credits. Top up to continue.'), 'error');
                navigate('/settings/credits');
            } else {
                showToast(t('pro_lite_failed', 'Could not activate Pro Lite. Please try again.'), 'error');
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{
            border: '1px solid var(--border-color)', borderRadius: '18px', padding: '20px',
            background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '11px', background: 'rgba(245,158,11,0.14)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FaBolt />
                    </div>
                    <div>
                        <AppText as="h3" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-main)' }}>{t('pro_lite_title', 'Pro Lite — pay with credits')}</AppText>
                        <AppText as="span" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('pro_lite_subtitle', 'Pay on demand · no monthly commitment')}</AppText>
                    </div>
                </div>
                <div style={{ textAlign: 'end' }}>
                    <AppText as="div" style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-main)' }}>{cost.toLocaleString()} {t('credits', 'credits')}</AppText>
                    <AppText as="span" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('pro_lite_period', '/ {{days}} days', { days: BUSINESS_PRO_LITE.durationDays })}</AppText>
                </div>
            </div>

            {active && (
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#16a34a', background: 'rgba(34,197,94,0.1)', padding: '8px 12px', borderRadius: '10px' }}>
                    {t('pro_lite_active_until', 'Active until {{date}}', { date: until })}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {LITE_FEATURE_KEYS.map(([key, fallback]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        <FaCheck style={{ color: '#16a34a', flexShrink: 0 }} size={13} /> {t(key, fallback)}
                    </div>
                ))}
            </div>

            {!isFullPaid && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <FaCoins size={12} /> {t('pro_lite_balance', 'Your balance: {{n}} credits', { n: balance.toLocaleString() })}
                </div>
            )}

            {isFullPaid ? (
                // Already on the full $29 plan — these features are included; show it
                // for awareness but keep it inactive.
                <div style={{
                    width: '100%', padding: '13px', borderRadius: '14px', textAlign: 'center', fontWeight: 700, fontSize: '0.9rem',
                    background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-color)',
                }}>
                    {t('pro_lite_included', 'Included in your full plan')}
                </div>
            ) : (
                <button
                    type="button"
                    onClick={handleActivate}
                    disabled={busy}
                    style={{
                        width: '100%', padding: '14px', borderRadius: '14px',
                        background: enough ? 'var(--brand-primary)' : 'var(--bg-elevated)',
                        color: enough ? '#fff' : 'var(--text-main)', fontWeight: 800, fontSize: '1rem',
                        cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        border: enough ? 'none' : '1px solid var(--border-color)',
                    }}>
                    {busy ? <FaSpinner className="spin" /> : null}
                    {enough
                        ? active
                            ? t('pro_lite_extend', 'Extend for {{cost}} credits', { cost: cost.toLocaleString() })
                            : t('pro_lite_activate', 'Activate for {{cost}} credits', { cost: cost.toLocaleString() })
                        : t('pro_lite_buy_credits', 'Buy credits to activate')}
                </button>
            )}
        </div>
    );
}
