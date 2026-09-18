import React from 'react';
import { Navigate } from 'react-router-dom';
import { isExternalPaymentAllowed } from '../utils/commercePlatform';

/**
 * Route guard for pages that surface off-store payment (saved cards, billing/
 * invoices, external checkout). On native iOS/Android these must not be
 * reachable at all (Apple/Google anti-steering). Renders children on web only;
 * on native it redirects to /settings so a hand-typed or deep-linked URL shows
 * nothing payment-related. Defense-in-depth alongside the page-level guards.
 */
export default function WebOnlyRoute({ children, redirectTo = '/settings' }) {
  if (!isExternalPaymentAllowed()) {
    return <Navigate to={redirectTo} replace />;
  }
  return children;
}
