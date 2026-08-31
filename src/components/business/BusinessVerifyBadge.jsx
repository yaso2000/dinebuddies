import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheckCircle, FaSpinner, FaGoogle } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
    startGoogleBusinessClaimAuth,
    readGoogleBusinessClaimCallback,
    verifyMyBusiness,
} from '../../services/googleBusinessClaimApi';

/**
 * Google-Business "verified" badge + owner-only verify action.
 *
 * The badge is shown to everyone when the business's `google_business_verified`
 * flag is set. The owner (when not yet verified and the business has a Google
 * placeId) sees a "Verify with Google Business" button that runs the
 * `business.manage` OAuth; on return the server confirms they manage the place
 * and sets the flag. Unverified businesses keep working — they just get no badge.
 */
const FLAG = 'gbp_verify_my_business';

function readVerified(business, businessInfo) {
    const bi = businessInfo || business?.businessInfo || {};
    return !!(bi.google_business_verified || bi.googleBusinessVerified || business?.google_business_verified);
}

function readPlaceId(business, businessInfo) {
    const bi = businessInfo || business?.businessInfo || {};
    return String(bi.placeId || bi.googlePlaceId || business?.placeId || business?.googlePlaceId || '').trim();
}

export default function BusinessVerifyBadge({ business, businessInfo, profileId, isOwner }) {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const { showToast } = useToast();
    const [verifying, setVerifying] = useState(false);
    const [verified, setVerified] = useState(readVerified(business, businessInfo));
    const placeId = readPlaceId(business, businessInfo);

    useEffect(() => {
        setVerified(readVerified(business, businessInfo));
    }, [business, businessInfo]);

    // Handle the business.manage OAuth return (only when WE started it).
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        let flag = null;
        try {
            flag = sessionStorage.getItem(FLAG);
        } catch {
            flag = null;
        }
        if (!flag) return undefined;

        const params = new URLSearchParams(window.location.search);
        const cb = readGoogleBusinessClaimCallback(params);
        if (!cb.gbpClaim) return undefined;

        try {
            sessionStorage.removeItem(FLAG);
        } catch {
            /* ignore */
        }
        // Strip the callback params from the URL.
        try {
            window.history.replaceState({}, '', window.location.pathname);
        } catch {
            /* ignore */
        }

        if (cb.isError) {
            showToast(t('verify_biz_failed', 'Verification could not be completed. Please try again.'), 'error');
            return undefined;
        }
        if (!cb.isConnected || !currentUser) return undefined;

        let cancelled = false;
        (async () => {
            setVerifying(true);
            try {
                const idToken = await currentUser.getIdToken();
                const { ok, data } = await verifyMyBusiness(cb.gbpSession, idToken);
                if (cancelled) return;
                if (ok && data?.verified) {
                    setVerified(true);
                    showToast(t('verify_biz_success', 'Your business is now verified on Google Business.'), 'success');
                } else if (ok && !data?.verified) {
                    showToast(
                        t(
                            'verify_biz_not_manager',
                            "This Google account doesn't manage this business on Google Business. Your account still works — it just won't get the verified badge."
                        ),
                        'info'
                    );
                } else {
                    showToast(data?.message || t('verify_biz_failed', 'Verification could not be completed. Please try again.'), 'error');
                }
            } catch {
                if (!cancelled) showToast(t('verify_biz_failed', 'Verification could not be completed. Please try again.'), 'error');
            } finally {
                if (!cancelled) setVerifying(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [currentUser, showToast, t]);

    const startVerify = async () => {
        if (!placeId) {
            showToast(t('verify_biz_no_place', 'Add your Google Business listing to your profile first.'), 'error');
            return;
        }
        setVerifying(true);
        try {
            try {
                sessionStorage.setItem(FLAG, '1');
            } catch {
                /* ignore */
            }
            const { ok, data } = await startGoogleBusinessClaimAuth({
                restaurantId: placeId,
                googlePlaceId: placeId,
                returnPath: `/business/${profileId}`,
                firebaseUid: currentUser?.uid || null,
            });
            if (ok && data?.authUrl) {
                window.location.assign(data.authUrl);
            } else {
                try {
                    sessionStorage.removeItem(FLAG);
                } catch {
                    /* ignore */
                }
                showToast(data?.message || t('verify_biz_failed', 'Could not start verification. Please try again.'), 'error');
                setVerifying(false);
            }
        } catch {
            try {
                sessionStorage.removeItem(FLAG);
            } catch {
                /* ignore */
            }
            showToast(t('verify_biz_failed', 'Could not start verification. Please try again.'), 'error');
            setVerifying(false);
        }
    };

    if (verified) {
        return (
            <span
                title={t('verify_biz_badge_hint', 'Ownership confirmed via Google Business Profile')}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px',
                    background: 'rgba(59,130,246,0.12)', color: '#2563eb', fontWeight: 800, fontSize: '0.8rem',
                }}>
                <FaCheckCircle /> {t('verify_biz_badge', 'Google Verified')}
            </span>
        );
    }

    if (isOwner && placeId) {
        return (
            <button
                type="button"
                onClick={startVerify}
                disabled={verifying}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '12px',
                    border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-main)',
                    fontWeight: 700, fontSize: '0.85rem', cursor: verifying ? 'not-allowed' : 'pointer',
                }}>
                {verifying ? <FaSpinner className="spin" /> : <FaGoogle />}
                {t('verify_biz_cta', 'Verify with Google Business')}
            </button>
        );
    }

    return null;
}
