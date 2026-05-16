import React, { useLayoutEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';
import { validateReferralCodeForStorage, syncPendingReferralFromQueryString } from '../utils/pendingReferral';

const FUNCTIONS_REGION = 'us-central1';

/**
 * Landing for shared referral links (/join?ref=AGENT-XXXX).
 * Persists code, records click (waits for callable so navigation does not abort the request), then full-page redirect to /login.
 */
export default function ReferralJoinPage() {
    const { t } = useTranslation();
    const [params] = useSearchParams();
    const refRaw = params.get('ref')?.trim();

    useLayoutEffect(() => {
        let cancelled = false;
        const hardRedirect = (path) => {
            if (typeof window === 'undefined') return;
            window.location.replace(path);
        };

        void (async () => {
            if (!refRaw) {
                hardRedirect('/');
                return;
            }
            const normalized =
                validateReferralCodeForStorage(refRaw) || validateReferralCodeForStorage(refRaw.trim().toUpperCase());
            if (!normalized) {
                hardRedirect('/');
                return;
            }

            syncPendingReferralFromQueryString(`?ref=${encodeURIComponent(normalized)}`);

            const dedupeKey = `dineb_ref_click_sent_${normalized}`;
            let skipClick = false;
            try {
                const v = sessionStorage.getItem(dedupeKey);
                if (v === '1' || v === 'pending') skipClick = true;
                else sessionStorage.setItem(dedupeKey, 'pending');
            } catch {
                /* ignore */
            }

            if (!skipClick) {
                try {
                    const fn = httpsCallable(getFunctions(app, FUNCTIONS_REGION), 'incrementReferralClicks');
                    await fn({ referralCode: normalized });
                    try {
                        sessionStorage.setItem(dedupeKey, '1');
                    } catch {
                        /* ignore */
                    }
                } catch (e) {
                    console.warn('[ReferralJoinPage] incrementReferralClicks:', e?.code, e?.message);
                    try {
                        sessionStorage.removeItem(dedupeKey);
                    } catch {
                        /* ignore */
                    }
                }
            }

            if (!cancelled) {
                hardRedirect(`/login?ref=${encodeURIComponent(refRaw.trim())}`);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [refRaw]);

    return (
        <div className="auth-route-scroll" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            {t('referral_join_redirecting', 'Redirecting…')}
        </div>
    );
}
