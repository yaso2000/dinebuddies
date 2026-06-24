import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  signOut,
  reload,
  verifyPasswordResetCode } from
'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { auth, db } from '../firebase/config';
import { getAppOriginForEmailActions } from '../utils/emailActionSettings';
import { normalizeUserProfile } from '../utils/userProfileNormalize';
import { isBusinessUser } from '../utils/accountRole';
import { goToLogin } from '../utils/goToLogin';

/**
 * Parses Firebase Auth action query params from ?search and from hash (#/path?mode=...)
 * (some clients put params after #). Also unwraps Firebase `link=` wrapped URLs.
 */import { AppText, AppTextInput } from "../components/base";
function parseAuthActionParams(search, hash) {
  const searchStr = search && search.startsWith('?') ? search.slice(1) : search || '';
  const fromSearch = new URLSearchParams(searchStr);
  let mode = fromSearch.get('mode');
  let oobCode = fromSearch.get('oobCode');
  let continueUrlRaw = fromSearch.get('continueUrl');

  const linkWrapped = fromSearch.get('link');
  if (linkWrapped) {
    try {
      const decoded = decodeURIComponent(linkWrapped);
      const u = new URL(decoded);
      const inner = new URLSearchParams(u.search.replace(/^\?/, ''));
      mode = mode || inner.get('mode');
      oobCode = oobCode || inner.get('oobCode');
      continueUrlRaw = continueUrlRaw || inner.get('continueUrl');
    } catch {

      /* ignore */}
  }

  if (hash && hash.length > 1) {
    const h = hash.startsWith('#') ? hash.slice(1) : hash;
    const queryPart = h.includes('?') ? h.slice(h.indexOf('?') + 1) : h;
    const fromHash = new URLSearchParams(queryPart);
    mode = mode || fromHash.get('mode');
    oobCode = oobCode || fromHash.get('oobCode');
    continueUrlRaw = continueUrlRaw || fromHash.get('continueUrl');
  }
  return { mode, oobCode, continueUrlRaw };
}

/** Resend verification for business signup/login uses continueUrl → /business/login?fromVerify=1 */
function isBusinessEmailVerificationContinueUrl(continueDecoded) {
  if (!continueDecoded) return false;
  try {
    const u = continueDecoded.includes('://') ?
    new URL(continueDecoded) :
    new URL(continueDecoded, typeof window !== 'undefined' ? window.location.origin : 'https://localhost');
    if (
    u.pathname.startsWith('/business/login') ||
    u.pathname.startsWith('/business/signup') ||
    u.pathname.startsWith('/signup/business'))
    {
      return true;
    }
    const q = u.searchParams;
    if (q.get('fromVerify') === '1') return true;
  } catch {
    return false;
  }
  return false;
}

/**
 * Handles Firebase Auth email action links when the project uses a custom Action URL
 * pointing to this route (see Firebase Console → Authentication → Templates).
 * Also register route /__/auth/action — Firebase Hosting often uses that path on custom domains.
 */
const AuthActionHandler = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { mode, oobCode, continueUrlRaw } = useMemo(
    () => parseAuthActionParams(location.search, location.hash),
    [location.search, location.hash]
  );

  const modeNorm = mode ? String(mode).toLowerCase() : '';

  const [status, setStatus] = useState(() => {
    if (modeNorm === 'resetpassword' && oobCode) return 'resetPassword';
    return 'working';
  });
  const [message, setMessage] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const safeContinuePath = () => {
      const fallback = '/';
      if (!continueUrlRaw) return fallback;
      try {
        const decoded = decodeURIComponent(continueUrlRaw);
        const u = new URL(decoded);
        const allowed = getAppOriginForEmailActions();
        if (u.origin === allowed || u.origin === window.location.origin) {
          return `${u.pathname}${u.search}${u.hash}` || fallback;
        }
      } catch {

        /* ignore */}
      return fallback;
    };

    if (modeNorm === 'resetpassword') {
      if (!oobCode) {
        setStatus('error');
        setMessage('This link is invalid or incomplete. Request a new reset email from the sign-in page.');
      } else {
        setStatus('resetPassword');
      }
      return;
    }

    if (!oobCode) {
      setStatus('error');
      setMessage('This link is invalid or incomplete. Request a new email from the app.');
      return;
    }

    if (modeNorm === 'verifyemail') {
      let cancelled = false;
      const continueDecoded = (() => {
        if (!continueUrlRaw) return '';
        try {
          return decodeURIComponent(continueUrlRaw);
        } catch {
          return '';
        }
      })();
      const bizFlow = isBusinessEmailVerificationContinueUrl(continueDecoded);

      (async () => {
        try {
          let verifiedEmail = '';
          try {
            const info = await checkActionCode(auth, oobCode);
            verifiedEmail = String(info?.data?.email || '').trim().toLowerCase();
          } catch {
            /* applyActionCode may still succeed */
          }

          await applyActionCode(auth, oobCode);
          if (cancelled) return;

          if (auth.currentUser) {
            try {
              await reload(auth.currentUser);
            } catch {

              /* still route using latest token when possible */}
          }

          const emailForMirror =
            verifiedEmail ||
            String(auth.currentUser?.email || '').trim().toLowerCase();
          if (emailForMirror) {
            try {
              const fn = httpsCallable(getFunctions(app, 'us-central1'), 'mirrorEmailVerifiedFromAction');
              await fn({ email: emailForMirror });
            } catch (mirrorErr) {
              console.warn('mirrorEmailVerifiedFromAction:', mirrorErr?.message || mirrorErr);
            }
          }

          const uid = auth.currentUser?.uid;
          if (uid && bizFlow) {
            let goProfile = false;
            try {
              const snap = await getDoc(doc(db, 'users', uid));
              if (snap.exists()) {
                const profile = normalizeUserProfile({
                  id: snap.id,
                  uid: snap.id,
                  ...snap.data()
                });
                goProfile = isBusinessUser(profile);
              }
            } catch {
              goProfile = auth.currentUser?.emailVerified === true;
            }
            if (goProfile) {
              navigate(`/business/${uid}`, { replace: true });
              return;
            }
          }

          if (!auth.currentUser && bizFlow) {
            navigate('/business/login?verified=1', { replace: true });
            return;
          }

          navigate(safeContinuePath(), { replace: true });
        } catch (err) {
          if (!cancelled) {
            setStatus('error');
            setMessage(err?.message || 'This link has expired or was already used.');
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    if (modeNorm === 'recoveremail') {
      applyActionCode(auth, oobCode).
      then(() => {
        navigate('/settings/email', { replace: true });
      }).
      catch((err) => {
        setStatus('error');
        setMessage(err?.message || 'Could not recover email.');
      });
      return;
    }

    // Some redirects drop `mode` but keep `oobCode` — treat as reset when the code validates.
    if (!modeNorm && oobCode) {
      let cancelled = false;
      verifyPasswordResetCode(auth, oobCode).
      then(() => {
        if (!cancelled) {
          setStatus('resetPassword');
          setMessage('');
        }
      }).
      catch(() => {
        if (!cancelled) {
          setStatus('error');
          setMessage(
            'This link is invalid or incomplete. Request a new reset or verification email from the app.'
          );
        }
      });
      return () => {
        cancelled = true;
      };
    }

    setStatus('error');
    setMessage('Unsupported action. Open the link from the latest email or use the app.');
  }, [modeNorm, oobCode, continueUrlRaw, navigate]);

  const handlePasswordResetSubmit = async (e) => {
    e.preventDefault();
    if (!oobCode) return;
    if (!newPass || newPass.length < 8) {
      setMessage('Password must be at least 8 characters.');
      return;
    }
    if (newPass !== confirmPass) {
      setMessage('Passwords do not match.');
      return;
    }
    setMessage('');
    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPass);
      try {
        await signOut(auth);
      } catch {

        /* ignore — ensures clean session before login hub */}
      try {
        sessionStorage.removeItem('dineb_password_reset_toast_shown');
        sessionStorage.setItem('dineb_password_reset_ok', '1');
      } catch {

        /* ignore */}
      // Full navigation avoids a stuck /auth/action view or Firebase handler state on mobile WebViews.
      if (typeof window !== 'undefined') {
        const base = window.location.origin;
        window.location.replace(`${base}/login?passwordReset=1`);
      } else {
        goToLogin({ replace: true });
      }
    } catch (err) {
      setMessage(err?.message || 'Could not reset password. Request a new link.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'working') {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-body)',
        color: 'var(--text-main)',
        padding: '1.5rem'
      }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem' }} />
                    <AppText as="p" style={{ fontSize: '0.95rem' }}>Confirming your email…</AppText>
                </div>
            </div>);

  }

  if (status === 'resetPassword') {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-body)',
        color: 'var(--text-main)',
        padding: '1.5rem'
      }}>
                <form
          onSubmit={handlePasswordResetSubmit}
          style={{
            width: '100%',
            maxWidth: 400,
            padding: '1.5rem',
            background: 'var(--bg-card)',
            borderRadius: 16,
            border: '1px solid var(--border-color)'
          }}>

                    <AppText as="h1" style={{ fontSize: '1.25rem', margin: '0 0 0.5rem', fontWeight: 700 }}>Set a new password</AppText>
                    <AppText as="p" style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        Choose a strong password for your DineBuddies account.
                    </AppText>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem' }} htmlFor="new-password">
                        New password
                    </label>
                    <AppTextInput
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={newPass}
            onChange={(ev) => setNewPass(ev.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 0.75rem',
              borderRadius: 10,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-input)',
              color: 'var(--text-main)',
              marginBottom: '0.75rem',
              boxSizing: 'border-box'
            }} />

                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem' }} htmlFor="confirm-password">
                        Confirm password
                    </label>
                    <AppTextInput
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPass}
            onChange={(ev) => setConfirmPass(ev.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 0.75rem',
              borderRadius: 10,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-input)',
              color: 'var(--text-main)',
              marginBottom: '0.75rem',
              boxSizing: 'border-box'
            }} />

                    {message ?
          <AppText as="p" style={{ color: '#f87171', fontSize: '0.88rem', marginBottom: '0.75rem' }}>{message}</AppText> :
          null}
                    <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff',
              fontWeight: 700,
              cursor: submitting ? 'wait' : 'pointer'
            }}>

                        {submitting ? 'Saving…' : 'Update password'}
                    </button>
                </form>
            </div>);

  }

  if (status === 'error') {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-body)',
        color: 'var(--text-main)',
        padding: '1.5rem'
      }}>
                <div style={{
          maxWidth: 400,
          padding: '1.5rem',
          background: 'var(--bg-card)',
          borderRadius: 16,
          border: '1px solid var(--border-color)',
          textAlign: 'center'
        }}>
                    <AppText as="p" style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>{message}</AppText>
                    <button
            type="button"
            onClick={() => goToLogin({ replace: true })}
            style={{
              padding: '0.75rem 1.25rem',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer'
            }}>

                        Sign in
                    </button>
                </div>
            </div>);

  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-body)',
      color: 'var(--text-main)',
      padding: '1.5rem'
    }}>
            <div style={{ textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 1rem' }} />
                <AppText as="p" style={{ fontSize: '0.95rem' }}>Redirecting…</AppText>
            </div>
        </div>);

};

export default AuthActionHandler;