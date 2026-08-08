import React, { useEffect, useRef } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';
import { validateReferralCodeForStorage } from '../utils/pendingReferral';

const FUNCTIONS_REGION = 'us-central1';

/**
 * Landing for shared referral links (/join?ref=AGENT-XXXX).
 * Persists code for later signup flows; records a server-side click (rate-limited); forwards to login.
 */
export default function ReferralJoinPage() {
    const [params] = useSearchParams();
    const refRaw = params.get('ref')?.trim();
    const clickOnce = useRef(false);

    useEffect(() => {
        if (!refRaw) return;
        const normalized =
            validateReferralCodeForStorage(refRaw) || validateReferralCodeForStorage(refRaw.trim().toUpperCase());
        try {
            if (normalized) {
                sessionStorage.setItem('dineb_pending_referral', normalized);
            }
        } catch {
            /* ignore */
        }
    }, [refRaw]);

    useEffect(() => {
        const code = validateReferralCodeForStorage(refRaw);
        if (!code || clickOnce.current) return;
        const dedupeKey = `dineb_ref_click_sent_${code}`;
        try {
            if (sessionStorage.getItem(dedupeKey) === '1') return;
        } catch {
            /* ignore */
        }
        clickOnce.current = true;
        (async () => {
            try {
                const fn = httpsCallable(getFunctions(app, FUNCTIONS_REGION), 'incrementReferralClicks');
                await fn({ referralCode: code });
                try {
                    sessionStorage.setItem(dedupeKey, '1');
                } catch {
                    /* ignore */
                }
            } catch (e) {
                console.warn('[ReferralJoinPage] incrementReferralClicks:', e?.code, e?.message);
            }
        })();
    }, [refRaw]);

    if (!refRaw) {
        return <Navigate to="/" replace />;
    }

    return <Navigate to={`/login?ref=${encodeURIComponent(refRaw.trim())}`} replace />;
}
