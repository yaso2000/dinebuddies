import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    FaCopy,
    FaSignOutAlt,
    FaLinkedin,
    FaWhatsapp,
    FaCog,
    FaFacebook,
    FaTwitter,
    FaTelegram,
    FaEnvelope,
    FaShareAlt,
} from 'react-icons/fa';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { isAffiliateAgent } from '../../utils/accountRole';
import { getAffiliateEmailSignInHref } from '../../utils/affiliateAuthRoutes';
import { getReferralLink } from '../../utils/referralLink';
import AppRouteLoading from '../../components/AppRouteLoading';
import './AffiliateDashboard.css';

const FUNCTIONS_REGION = 'us-central1';

function formatMoneyCents(cents, currency = 'usd') {
    const n = Number(cents);
    if (!Number.isFinite(n)) return '—';
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: String(currency || 'usd').toUpperCase(),
        }).format(n / 100);
    } catch {
        return `${(n / 100).toFixed(2)} ${String(currency || '').toUpperCase()}`;
    }
}

function commissionRowDate(entry) {
    const ts = entry?.createdAt;
    if (ts && typeof ts.toDate === 'function') {
        try {
            return ts.toDate().toLocaleString();
        } catch {
            /* fall through */
        }
    }
    return '—';
}

function buildLinkedInShareUrl(url) {
    return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}

function buildWhatsAppShareUrl(text, url) {
    const body = `${text}\n${url}`.trim();
    return `https://wa.me/?text=${encodeURIComponent(body)}`;
}

function buildFacebookShareUrl(url, quote) {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(quote)}`;
}

function buildTwitterShareUrl(text, url) {
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

function buildTelegramShareUrl(text, url) {
    return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

function buildMailtoShareUrl(subject, body) {
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Privacy-friendly preview for dashboard (not a security boundary). */
function maskPaypalEmail(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return '';
    const at = s.indexOf('@');
    const local = s.slice(0, at);
    const domain = s.slice(at + 1);
    const vis = local.length <= 2 ? `${local[0] || ''}••` : `${local.slice(0, 2)}•••`;
    return `${vis}@${domain}`;
}

function AffiliateDashboardInner() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { userProfile, signOut, currentUser } = useAuth();
    const emailVerified = currentUser?.emailVerified === true;
    const [commissionRows, setCommissionRows] = useState([]);

    useEffect(() => {
        const uid = currentUser?.uid;
        if (!uid) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const q = query(
                    collection(db, 'users', uid, 'commissions_history'),
                    orderBy('createdAt', 'desc'),
                    limit(50)
                );
                const snap = await getDocs(q);
                if (cancelled) return;
                setCommissionRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            } catch (e) {
                console.warn('[AffiliateDashboard] commissions_history:', e?.code, e?.message);
                if (!cancelled) setCommissionRows([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [currentUser?.uid]);

    const referralCode = (userProfile?.referral_code || '').trim();
    const linkFromProfile = (userProfile?.referral_link || '').trim();
    const shareUrl = useMemo(() => {
        if (referralCode) return getReferralLink(referralCode);
        if (linkFromProfile) return linkFromProfile;
        return '';
    }, [linkFromProfile, referralCode]);

    useEffect(() => {
        if (!currentUser?.uid || !emailVerified) return;
        if (referralCode) return;
        let cancelled = false;
        (async () => {
            try {
                const fn = httpsCallable(getFunctions(app, FUNCTIONS_REGION), 'ensureMyAffiliateReferralCode');
                await fn({});
            } catch (e) {
                if (!cancelled) {
                    console.warn('[AffiliateDashboard] ensureMyAffiliateReferralCode', e?.code, e?.message);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [currentUser?.uid, emailVerified, referralCode]);

    const totalClicks =
        typeof userProfile?.total_clicks === 'number' && Number.isFinite(userProfile.total_clicks)
            ? userProfile.total_clicks
            : 0;

    const pendingReferrals =
        typeof userProfile?.pending_referrals_count === 'number' && Number.isFinite(userProfile.pending_referrals_count)
            ? Math.max(0, userProfile.pending_referrals_count)
            : 0;

    const balanceCents =
        typeof userProfile?.current_balance === 'number' && Number.isFinite(userProfile.current_balance)
            ? Math.max(0, userProfile.current_balance)
            : 0;

    const lifetimeEarnedCents =
        typeof userProfile?.total_earned === 'number' && Number.isFinite(userProfile.total_earned)
            ? Math.max(0, userProfile.total_earned)
            : 0;

    const pendingPayoutsCents =
        typeof userProfile?.pending_payouts === 'number' && Number.isFinite(userProfile.pending_payouts)
            ? Math.max(0, Math.floor(userProfile.pending_payouts))
            : 0;

    const [payoutLoading, setPayoutLoading] = useState(false);

    const displayName =
        userProfile?.display_name || userProfile?.displayName || userProfile?.name || t('affiliate_partner', 'Partner');

    const requestPayout = async () => {
        if (!emailVerified) {
            showToast(t('affiliate_verify_to_share', 'Verify your email to use your referral link.'), 'error');
            return;
        }
        setPayoutLoading(true);
        try {
            const fn = httpsCallable(getFunctions(app, FUNCTIONS_REGION), 'requestAffiliatePayout');
            await fn({});
            showToast(t('affiliate_payout_submitted', 'Withdrawal request submitted.'), 'success');
        } catch (err) {
            const fnMsg =
                err?.code && String(err.code).startsWith('functions/') && typeof err.message === 'string'
                    ? err.message.trim()
                    : '';
            showToast(
                fnMsg || t('affiliate_payout_failed', 'Could not submit payout request.'),
                'error'
            );
        } finally {
            setPayoutLoading(false);
        }
    };

    const copyLink = async () => {
        if (!emailVerified) {
            showToast(t('affiliate_verify_to_share', 'Verify your email to use your referral link.'), 'error');
            return;
        }
        if (!shareUrl) {
            showToast(t('affiliate_link_not_ready', 'Your referral link is still being generated. Try again in a moment.'), 'error');
            return;
        }
        try {
            await navigator.clipboard.writeText(shareUrl);
            showToast(t('affiliate_link_copied', 'Referral link copied to clipboard.'), 'success');
        } catch {
            showToast(t('affiliate_copy_failed', 'Could not copy. Select the link and copy manually.'), 'error');
        }
    };

    const shareText = t('affiliate_share_default_text', 'Join me on DineBuddies:');

    const paypalRaw = String(userProfile?.affiliate_paypal_email || '').trim();
    const paypalMasked = maskPaypalEmail(paypalRaw);
    const addrLine = String(userProfile?.affiliate_address || '').trim();
    const city = String(userProfile?.affiliate_city || '').trim();
    const country = String(userProfile?.affiliate_country || '').trim();
    const locationLine = [city, country].filter(Boolean).join(', ');
    const payoutBasicsOk =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalRaw) && addrLine.length >= 3 && Boolean(city) && Boolean(country);

    const nativeShare = async () => {
        if (!emailVerified) {
            showToast(t('affiliate_verify_to_share', 'Verify your email to use your referral link.'), 'error');
            return;
        }
        if (!shareUrl) {
            showToast(t('affiliate_link_not_ready', 'Your referral link is still being generated. Try again in a moment.'), 'error');
            return;
        }
        if (typeof navigator !== 'undefined' && navigator.share) {
            try {
                await navigator.share({
                    title: 'DineBuddies',
                    text: `${shareText}\n${shareUrl}`,
                    url: shareUrl,
                });
            } catch {
                /* user cancelled */
            }
        } else {
            await copyLink();
        }
    };

    return (
        <div className="affiliate-shell">
            <div className="affiliate-dash">
                <header className="affiliate-header">
                    <div>
                        <h1>
                            {t('affiliate_dashboard_welcome', 'Welcome')}, {displayName}
                        </h1>
                        <p className="affiliate-sub">
                            {t('affiliate_dashboard_sub', 'Track your reach and share your personal invite link.')}
                        </p>
                    </div>
                    <div className="affiliate-header-actions">
                        <Link to="/affiliate/settings" className="affiliate-btn affiliate-btn--secondary">
                            <FaCog aria-hidden />
                            {t('affiliate_settings_short', 'Settings')}
                        </Link>
                        <Link to="/affiliate" className="affiliate-btn affiliate-btn--ghost">
                            {t('affiliate_back_home', 'Back to home')}
                        </Link>
                        <button type="button" className="affiliate-btn affiliate-btn--secondary" onClick={() => signOut('/affiliate')}>
                            <FaSignOutAlt aria-hidden />
                            {t('logout', 'Log out')}
                        </button>
                    </div>
                </header>

                {!emailVerified ? (
                    <div
                        className="affiliate-card"
                        style={{
                            marginBottom: 20,
                            borderColor: 'rgba(234, 179, 8, 0.45)',
                            background: 'rgba(234, 179, 8, 0.08)',
                        }}
                    >
                        <strong>{t('affiliate_verify_banner_title', 'Verify your email')}</strong>
                        <p className="affiliate-muted" style={{ margin: '8px 0 12px' }}>
                            {t(
                                'affiliate_verify_banner_body',
                                'Confirm your email to view your referral link, share it, and request payouts.'
                            )}
                        </p>
                        <Link to="/verify-email" className="affiliate-btn affiliate-btn--primary">
                            {t('affiliate_verify_banner_cta', 'Go to email verification')}
                        </Link>
                    </div>
                ) : null}

                <section
                    className="affiliate-card affiliate-dash-payout-card"
                    aria-labelledby="affiliate-dash-payout-title"
                    style={{ marginBottom: 20 }}
                >
                    <h2 id="affiliate-dash-payout-title" style={{ margin: '0 0 8px', fontSize: '1.05rem', fontWeight: 800 }}>
                        {t('affiliate_dash_payout_title', 'Payout & mailing details')}
                    </h2>
                    <p className="affiliate-muted" style={{ margin: '0 0 14px' }}>
                        {t(
                            'affiliate_dash_payout_sub',
                            'PayPal and your address are required before withdrawals can be processed. You can edit them anytime.'
                        )}
                    </p>
                    <dl className="affiliate-dash-dl">
                        <div>
                            <dt>{t('affiliate_dash_paypal_label', 'PayPal')}</dt>
                            <dd dir="ltr">{paypalMasked || t('affiliate_dash_paypal_missing', 'Not set — add in Settings')}</dd>
                        </div>
                        <div>
                            <dt>{t('affiliate_dash_location_label', 'City & country')}</dt>
                            <dd>{locationLine || t('affiliate_dash_location_missing', 'Not set — pick a place in Settings')}</dd>
                        </div>
                        <div>
                            <dt>{t('affiliate_dash_address_label', 'Mailing address')}</dt>
                            <dd>
                                {addrLine
                                    ? addrLine.length > 120
                                        ? `${addrLine.slice(0, 120)}…`
                                        : addrLine
                                    : t('affiliate_dash_address_missing', 'Not set — add in Settings')}
                            </dd>
                        </div>
                    </dl>
                    {!payoutBasicsOk ? (
                        <p className="affiliate-muted" style={{ margin: '12px 0 0', fontSize: '0.82rem' }}>
                            {t(
                                'affiliate_dash_payout_incomplete',
                                'Add a valid PayPal email, full mailing address, and city & country in Settings to be payout-ready.'
                            )}
                        </p>
                    ) : null}
                    <Link
                        to="/affiliate/settings"
                        className="affiliate-btn affiliate-btn--secondary"
                        style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}
                    >
                        {t('affiliate_dash_edit_payout', 'Edit in Settings')}
                    </Link>
                </section>

                <section className="affiliate-grid-stats" aria-label={t('affiliate_stats_section', 'Performance summary')}>
                    <article className="affiliate-stat-card">
                        <div className="affiliate-stat-label">{t('affiliate_stat_clicks', 'Total clicks')}</div>
                        <div className="affiliate-stat-value">{totalClicks}</div>
                        <div className="affiliate-stat-hint">{t('affiliate_stat_clicks_hint', 'Visits on your referral link (updates in real time).')}</div>
                    </article>
                    <article className="affiliate-stat-card">
                        <div className="affiliate-stat-label">{t('affiliate_stat_pending', 'Pending referrals')}</div>
                        <div className="affiliate-stat-value">{pendingReferrals}</div>
                        <div className="affiliate-stat-hint">
                            {t('affiliate_stat_pending_hint', 'Users you referred who signed up but have not yet triggered a commission.')}
                        </div>
                    </article>
                    <article className="affiliate-stat-card">
                        <div className="affiliate-stat-label">{t('affiliate_stat_earnings', 'Earnings')}</div>
                        <div className="affiliate-stat-value">{formatMoneyCents(lifetimeEarnedCents)}</div>
                        <div className="affiliate-stat-hint">
                            {t('affiliate_stat_balance_line', 'Available for payout: {{amount}}', {
                                amount: formatMoneyCents(balanceCents),
                            })}
                        </div>
                        {pendingPayoutsCents > 0 ? (
                            <div className="affiliate-stat-hint" style={{ marginTop: 8 }}>
                                {t('affiliate_stat_pending_payout_line', 'Pending withdrawal: {{amount}}', {
                                    amount: formatMoneyCents(pendingPayoutsCents),
                                })}
                            </div>
                        ) : null}
                        {emailVerified && balanceCents > 0 ? (
                            <button
                                type="button"
                                className="affiliate-btn affiliate-btn--primary"
                                style={{ marginTop: 14, width: '100%' }}
                                disabled={payoutLoading}
                                onClick={requestPayout}
                            >
                                {payoutLoading
                                    ? t('affiliate_auth_submitting', 'Please wait…')
                                    : t('affiliate_payout_request', 'Request withdrawal')}
                            </button>
                        ) : null}
                    </article>
                </section>

                <section className="affiliate-marketing" aria-labelledby="affiliate-marketing-title">
                    <h2 id="affiliate-marketing-title">{t('affiliate_marketing_title', 'Your referral link')}</h2>
                    <p className="affiliate-marketing-p">
                        {t(
                            'affiliate_marketing_body',
                            'Share this URL anywhere you promote DineBuddies. Clicks are counted when someone opens your link.'
                        )}
                    </p>
                    {referralCode ? (
                        <div className="affiliate-code-pill" dir="ltr">
                            {t('affiliate_code_label', 'Code')}: {referralCode}
                        </div>
                    ) : (
                        <p className="affiliate-muted" style={{ marginBottom: 12 }}>
                            {t('affiliate_code_generating', 'Your unique code is being created… Refresh in a few seconds if it does not appear.')}
                        </p>
                    )}
                    <div className="affiliate-link-box">
                        <input
                            className="affiliate-link-input"
                            readOnly
                            value={shareUrl || t('affiliate_link_placeholder', 'Link will appear here')}
                            aria-label={t('affiliate_referral_url', 'Referral URL')}
                        />
                        <button type="button" className="affiliate-btn affiliate-btn--primary" onClick={copyLink} disabled={!shareUrl}>
                            <FaCopy aria-hidden />
                            {t('affiliate_copy_link', 'Copy link')}
                        </button>
                    </div>
                    <p className="affiliate-muted" style={{ margin: '0 0 10px', fontSize: '0.78rem', fontWeight: 700 }}>
                        {t('affiliate_share_more', 'Share on')}
                    </p>
                    <div className="affiliate-share-grid">
                        {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
                            <button
                                type="button"
                                className="affiliate-btn affiliate-btn--secondary"
                                onClick={nativeShare}
                                disabled={!shareUrl}
                            >
                                <FaShareAlt aria-hidden />
                                {t('affiliate_share_native', 'Share…')}
                            </button>
                        ) : null}
                        <a
                            className="affiliate-btn affiliate-btn--secondary"
                            href={shareUrl ? buildWhatsAppShareUrl(shareText, shareUrl) : undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-disabled={!shareUrl}
                            onClick={(e) => {
                                if (!shareUrl) e.preventDefault();
                            }}
                        >
                            <FaWhatsapp aria-hidden />
                            WhatsApp
                        </a>
                        <a
                            className="affiliate-btn affiliate-btn--secondary"
                            href={shareUrl ? buildFacebookShareUrl(shareUrl, shareText) : undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-disabled={!shareUrl}
                            onClick={(e) => {
                                if (!shareUrl) e.preventDefault();
                            }}
                        >
                            <FaFacebook aria-hidden />
                            Facebook
                        </a>
                        <a
                            className="affiliate-btn affiliate-btn--secondary"
                            href={shareUrl ? buildTwitterShareUrl(shareText, shareUrl) : undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-disabled={!shareUrl}
                            onClick={(e) => {
                                if (!shareUrl) e.preventDefault();
                            }}
                        >
                            <FaTwitter aria-hidden />
                            X / Twitter
                        </a>
                        <a
                            className="affiliate-btn affiliate-btn--secondary"
                            href={shareUrl ? buildLinkedInShareUrl(shareUrl) : undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-disabled={!shareUrl}
                            onClick={(e) => {
                                if (!shareUrl) e.preventDefault();
                            }}
                        >
                            <FaLinkedin aria-hidden />
                            LinkedIn
                        </a>
                        <a
                            className="affiliate-btn affiliate-btn--secondary"
                            href={shareUrl ? buildTelegramShareUrl(shareText, shareUrl) : undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-disabled={!shareUrl}
                            onClick={(e) => {
                                if (!shareUrl) e.preventDefault();
                            }}
                        >
                            <FaTelegram aria-hidden />
                            Telegram
                        </a>
                        <a
                            className="affiliate-btn affiliate-btn--secondary"
                            href={
                                shareUrl
                                    ? buildMailtoShareUrl(
                                          t('affiliate_marketing_title', 'Your referral link'),
                                          `${shareText}\n\n${shareUrl}`
                                      )
                                    : undefined
                            }
                            aria-disabled={!shareUrl}
                            onClick={(e) => {
                                if (!shareUrl) e.preventDefault();
                            }}
                        >
                            <FaEnvelope aria-hidden />
                            {t('affiliate_share_email', 'Email')}
                        </a>
                    </div>
                </section>

                <section aria-labelledby="affiliate-activity-title">
                    <h2 id="affiliate-activity-title" style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 12px' }}>
                        {t('affiliate_activity_title', 'Referral activity')}
                    </h2>
                    <div className="affiliate-table-wrap">
                        <table className="affiliate-table">
                            <thead>
                                <tr>
                                    <th>{t('affiliate_col_date', 'Date')}</th>
                                    <th>{t('affiliate_col_event', 'Event')}</th>
                                    <th>{t('affiliate_col_detail', 'Detail')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {commissionRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="affiliate-muted" style={{ padding: '20px 16px' }}>
                                            {t(
                                                'affiliate_table_empty',
                                                'Commission events appear here when a referred user subscribes to a business plan.'
                                            )}
                                        </td>
                                    </tr>
                                ) : (
                                    commissionRows.map((row) => (
                                        <tr key={row.id}>
                                            <td>{commissionRowDate(row)}</td>
                                            <td>
                                                {row.type === 'business_subscription'
                                                    ? t('affiliate_event_business_sub', 'Business subscription')
                                                    : String(row.type || '—')}
                                            </td>
                                            <td dir="ltr">
                                                {formatMoneyCents(row.amountCents, row.currency)}
                                                {row.referredUserId
                                                    ? ` · ${t('affiliate_col_user', 'User')}: ${String(row.referredUserId).slice(0, 8)}…`
                                                    : ''}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
}

export default function AffiliateDashboard() {
    const { currentUser, userProfile, loading, profileServerSynced } = useAuth();

    if (loading) {
        return <AppRouteLoading variant="session" fullViewport />;
    }

    if (!currentUser) {
        return <Navigate to={getAffiliateEmailSignInHref('/affiliate/dashboard')} replace />;
    }

    // Wait for first server-backed profile snapshot so new signups are not sent home
    // while Firestore still shows a stale non-agent role from cache.
    if (!profileServerSynced) {
        return <AppRouteLoading variant="session" fullViewport />;
    }

    if (!userProfile || !isAffiliateAgent(userProfile)) {
        return <Navigate to="/" replace />;
    }

    return <AffiliateDashboardInner />;
}
