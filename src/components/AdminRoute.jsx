import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdminIdentity } from '../utils/adminAccess';
import { auth } from '../firebase/config';
import { AppText } from "./base";

const fullPageSpinner =
<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0817', color: '#94a3b8' }}>
        <div
    style={{
      width: 40,
      height: 40,
      border: '4px solid rgba(148, 163, 184, 0.15)',
      borderTop: '4px solid #E86E2E',
      borderRadius: '50%',
      animation: 'spin 0.9s linear infinite'
    }} />
  
    </div>;


/** No auto-redirect to `/` — that fought HomeRouter and caused admin ↔ home flicker loops. */
function AdminAccessDenied() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f0817',
        color: '#e2e8f0',
        padding: '1.5rem',
        textAlign: 'center',
        gap: '1rem'
      }}>
      
            <AppText as="h1" style={{ margin: 0, fontSize: '1.25rem' }}>Access denied</AppText>
            <AppText as="p" style={{ margin: 0, maxWidth: 420, color: '#94a3b8', lineHeight: 1.5 }}>
                This account does not have admin panel access. You were not sent to the home feed automatically to avoid redirect loops.
            </AppText>
            <Link to="/posts-feed" replace style={{ color: '#E86E2E', fontWeight: 700, textDecoration: 'none' }}>
                Go to app feed
            </Link>
        </div>);

}

function identityUser(contextUser) {
  const fu = auth.currentUser;
  if (fu && contextUser?.uid && fu.uid === contextUser.uid) return fu;
  return contextUser;
}

const AdminRoute = ({ children, allowedRoles = ['admin', 'moderator', 'support', 'staff'] }) => {
  const { currentUser, userProfile, loading } = useAuth();
  const [tokenHasAdminClaim, setTokenHasAdminClaim] = useState(false);
  const [tokenChecked, setTokenChecked] = useState(false);

  useEffect(() => {
    if (!currentUser?.uid) {
      setTokenHasAdminClaim(false);
      setTokenChecked(true);
      return;
    }

    let cancelled = false;
    setTokenChecked(false);

    const deadline = Date.now() + 10000;

    (async () => {
      while (!cancelled && Date.now() < deadline) {
        const u = auth.currentUser;
        if (u && u.uid === currentUser.uid) {
          try {
            const tr = await u.getIdTokenResult();
            const c = tr.claims || {};
            if (!cancelled) {
              setTokenHasAdminClaim(c.admin === true || c.role === 'admin');
              setTokenChecked(true);
            }
          } catch {
            if (!cancelled) {
              setTokenHasAdminClaim(false);
              setTokenChecked(true);
            }
          }
          return;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      if (!cancelled) {
        setTokenHasAdminClaim(false);
        setTokenChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid]);

  if (!currentUser) {
    if (loading) {
      return fullPageSpinner;
    }
    return <Navigate to="/login" replace />;
  }

  if (loading || !tokenChecked) {
    return fullPageSpinner;
  }

  const id = identityUser(currentUser);
  const canEnterWithoutProfileDoc = isAdminIdentity(id, null) || tokenHasAdminClaim;

  // Firestore-backed roles need users/{uid}. Do not treat `loading === false` alone as "no profile will
  // arrive" (AuthContext fail-safe can clear loading before the first snapshot).
  if (userProfile === null && !canEnterWithoutProfileDoc) {
    return fullPageSpinner;
  }

  const isSuperAdmin = isAdminIdentity(id, userProfile);
  const userRole = userProfile?.role;
  const hasPermission =
  isSuperAdmin ||
  tokenHasAdminClaim ||
  userRole != null && userRole !== '' && allowedRoles.includes(userRole);

  if (!hasPermission) {
    console.warn(`Unauthorized admin access attempt by role: ${userRole}`);
    return <AdminAccessDenied />;
  }

  return children;
};

export default AdminRoute;