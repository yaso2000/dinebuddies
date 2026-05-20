import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ensurePushRegistration, isPushEnabledInPrefs } from '../services/notificationService';

/**
 * Keeps FCM registration fresh when the user returns to the app (tab focus, PWA resume).
 * Background push is delivered by the service worker; this re-saves the device token server-side.
 */
export default function PushRegistrationSync() {
    const { currentUser, isGuest } = useAuth();

    useEffect(() => {
        const uid = currentUser?.uid;
        if (!uid || isGuest) return undefined;
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
            return undefined;
        }

        let cancelled = false;

        const sync = async () => {
            if (cancelled) return;
            const enabled = await isPushEnabledInPrefs(uid);
            if (!enabled || cancelled) return;
            await ensurePushRegistration(uid);
        };

        sync();

        const onResume = () => {
            if (document.visibilityState && document.visibilityState !== 'visible') return;
            sync();
        };

        document.addEventListener('visibilitychange', onResume);
        window.addEventListener('pageshow', onResume);
        window.addEventListener('focus', onResume);

        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', onResume);
            window.removeEventListener('pageshow', onResume);
            window.removeEventListener('focus', onResume);
        };
    }, [currentUser?.uid, isGuest]);

    return null;
}
