import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import AppRouteLoading from '../../components/AppRouteLoading';

/**
 * Emergency exit from redirect loops: full sign-out + hard navigation to /login.
 * User can open /affiliate/sign-out manually from the address bar.
 */
export default function AffiliateForceSignOut() {
    const { signOut } = useAuth();

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                await signOut('/login');
            } catch {
                if (!cancelled && typeof window !== 'undefined') {
                    window.location.replace('/login');
                }
            }
        })();
        return () => {
            cancelled = true;
        };
        // Intentionally once on mount — avoids re-running if AuthContext recreates signOut.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <AppRouteLoading variant="session" fullViewport />;
}
