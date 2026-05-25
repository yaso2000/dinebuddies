import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    isStandalonePwa,
    markIosPwaLaunch,
    revivePushDelivery,
    warmupPushServiceWorker,
} from '../services/notificationService';

const REVIVE_DEBOUNCE_MS = 2500;

/**
 * Keeps FCM alive after iOS sleep / screen lock by re-waking the service worker
 * and refreshing the token whenever the app becomes visible again.
 */
export default function PushSessionManager() {
    const { currentUser, isGuest, userProfile } = useAuth();
    const reviveTimerRef = useRef(null);
    const lastReviveAtRef = useRef(0);

    useEffect(() => {
        const uid = currentUser?.uid;
        if (!uid || isGuest || !userProfile) return undefined;

        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
            return undefined;
        }

        let cancelled = false;
        if (isStandalonePwa()) markIosPwaLaunch();
        warmupPushServiceWorker();

        const runRevive = async (reason) => {
            if (cancelled) return;
            const now = Date.now();
            if (now - lastReviveAtRef.current < REVIVE_DEBOUNCE_MS) return;
            lastReviveAtRef.current = now;

            const result = await revivePushDelivery(uid, { label: `wake-${reason}` });
            if (!result.ok) {
                console.error('[FCM] PushSessionManager revive:', reason, result.reason, result.lastError);
            }
        };

        const scheduleRevive = (reason) => {
            if (reviveTimerRef.current) clearTimeout(reviveTimerRef.current);
            reviveTimerRef.current = setTimeout(() => {
                void runRevive(reason);
            }, 500);
        };

        void runRevive('session-load');

        const onVisible = () => {
            if (document.visibilityState && document.visibilityState !== 'visible') return;
            scheduleRevive('visibility');
        };

        const onPageShow = (event) => {
            if (event.persisted || document.visibilityState === 'visible') {
                scheduleRevive('pageshow');
            }
        };

        const onFocus = () => scheduleRevive('focus');

        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('pageshow', onPageShow);
        window.addEventListener('focus', onFocus);

        return () => {
            cancelled = true;
            if (reviveTimerRef.current) clearTimeout(reviveTimerRef.current);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('pageshow', onPageShow);
            window.removeEventListener('focus', onFocus);
        };
    }, [currentUser?.uid, isGuest, userProfile]);

    return null;
}
