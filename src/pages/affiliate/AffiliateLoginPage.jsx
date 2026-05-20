import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { signInWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { doc, getDoc, getDocFromServer } from 'firebase/firestore';
import app, { db } from '../../firebase/config';
import { useToast } from '../../context/ToastContext';
import { getAuthErrorMessage } from '../../utils/errorMessages';
import { sanitizeNextPath } from '../../utils/safeInternalPath';
import { isAffiliateAgentProfileData } from '../../utils/accountRole';
import './AffiliateDashboard.css';
import AffiliateAuthShell from '../auth/AffiliateAuthShell';

/** Avoid false "not an affiliate" right after auth: local cache can lag behind `users/{uid}` on the server. */
async function fetchAffiliateUserDocForGate(uid) {
    const userRef = doc(db, 'users', uid);
    try {
        const serverSnap = await getDocFromServer(userRef);
        if (serverSnap.exists()) {
            const d = serverSnap.data();
            if (isAffiliateAgentProfileData(d)) return d;
        }
    } catch (e) {
        console.warn('[AffiliateLogin] getDocFromServer:', e?.code || e?.message || e);
    }
    for (let i = 0; i < 14; i += 1) {
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            const d = snap.data();
            if (isAffiliateAgentProfileData(d)) return d;
        }
        await new Promise((r) => setTimeout(r, 220));
    }
    return null;
}

export default function AffiliateLoginPage() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const nextPath = sanitizeNextPath(params.get('next')) || '/affiliate/dashboard';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        const em = email.trim().toLowerCase();
        if (!em || !password) {
            showToast(t('affiliate_auth_err_required', 'Please fill email and password.'), 'error');
            return;
        }
        setLoading(true);
        const auth = getAuth(app);
        try {
            const cred = await signInWithEmailAndPassword(auth, em, password);
            try {
                await cred.user.getIdToken(true);
            } catch {
                /* non-fatal */
            }
            const raw = await fetchAffiliateUserDocForGate(cred.user.uid);
            if (!raw) {
                await signOut(auth);
                showToast(
                    t(
                        'affiliate_login_not_agent',
                        'This login is only for affiliate partners. Use the main app login for personal or business accounts.'
                    ),
                    'error'
                );
                return;
            }
            navigate(nextPath, { replace: true });
        } catch (err) {
            showToast(getAuthErrorMessage(err) || err?.message || t('affiliate_login_failed', 'Sign-in failed.'), 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AffiliateAuthShell>
            <div className="affiliate-card affiliate-auth-card" style={{ maxWidth: 420, width: '100%', margin: '0 auto' }}>
                <h1 className="affiliate-h1">{t('affiliate_login_title', 'Affiliate sign-in')}</h1>
                <p className="affiliate-muted" style={{ marginBottom: 20 }}>
                    {t('affiliate_login_intro', 'Email and password only — no social login on this page.')}
                </p>
                <form className="affiliate-auth-form" onSubmit={onSubmit}>
                    <label className="affiliate-auth-label">{t('affiliate_auth_email', 'Email')}</label>
                    <input
                        className="affiliate-auth-input"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(ev) => setEmail(ev.target.value)}
                        required
                    />
                    <label className="affiliate-auth-label">{t('affiliate_auth_password', 'Password')}</label>
                    <input
                        className="affiliate-auth-input"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(ev) => setPassword(ev.target.value)}
                        required
                    />
                    <button type="submit" className="affiliate-btn affiliate-btn--primary" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
                        {loading ? t('affiliate_auth_submitting', 'Please wait…') : t('affiliate_login_submit', 'Sign in')}
                    </button>
                </form>
                <p className="affiliate-muted" style={{ marginTop: 18, fontSize: '0.9rem' }}>
                    {t('affiliate_auth_no_account', 'New affiliate?')}{' '}
                    <Link to="/affiliate/signup">{t('affiliate_signup_link', 'Create an account')}</Link>
                </p>
                <p style={{ marginTop: 12 }}>
                    <Link to="/login" className="affiliate-muted">
                        {t('affiliate_back_home', 'Back to home')}
                    </Link>
                </p>
                <p className="affiliate-muted" style={{ marginTop: 10, fontSize: '0.82rem' }}>
                    <Link to="/affiliate/sign-out">{t('affiliate_sign_out_escape_link', 'Session stuck? Sign out here')}</Link>
                </p>
            </div>
        </AffiliateAuthShell>
    );
}
