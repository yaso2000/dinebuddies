import React from 'react';
import { Outlet } from 'react-router-dom';

/**
 * Standalone affiliate routes sit outside Layout. On mobile, html/body/#root are overflow:hidden;
 * this fixed viewport layer is the scroll container (same pattern as /login auth-route-scroll).
 */
export default function AffiliateRouteLayout() {
    return (
        <div className="auth-route-scroll affiliate-route-scroll">
            <Outlet />
        </div>
    );
}
