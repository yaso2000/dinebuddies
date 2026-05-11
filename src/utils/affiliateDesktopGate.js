import { useState, useEffect } from 'react';

const MIN_WIDTH = 1024;

/** UA strings that strongly indicate a phone-class device (not desktop browser). */
function isPhoneClassUserAgent() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    if (/Tablet|iPad/i.test(ua)) return false;
    return /Mobi|Android.+Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|webOS/i.test(ua);
}

/**
 * Affiliate dashboard is web / laptop-first: block narrow viewports or phone-class UA.
 * @returns {boolean} true when the shell is allowed to show the dashboard
 */
export function isAffiliateDesktopShell() {
    if (typeof window === 'undefined') return true;
    const w = window.innerWidth;
    if (w < MIN_WIDTH) return false;
    if (isPhoneClassUserAgent()) return false;
    return true;
}

export function useAffiliateDesktopEligible() {
    const [allowed, setAllowed] = useState(() =>
        typeof window !== 'undefined' ? isAffiliateDesktopShell() : true
    );

    useEffect(() => {
        const tick = () => setAllowed(isAffiliateDesktopShell());
        tick();
        window.addEventListener('resize', tick);
        const mq = window.matchMedia(`(min-width: ${MIN_WIDTH}px)`);
        mq.addEventListener('change', tick);
        return () => {
            window.removeEventListener('resize', tick);
            mq.removeEventListener('change', tick);
        };
    }, []);

    return allowed;
}
