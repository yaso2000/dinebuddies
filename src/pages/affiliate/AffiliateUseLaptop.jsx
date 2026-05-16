import React from 'react';
import { Navigate } from 'react-router-dom';

/** Legacy route: affiliate dashboard is available on mobile; send users to the dashboard. */
export default function AffiliateUseLaptop() {
    return <Navigate to="/affiliate/dashboard" replace />;
}
