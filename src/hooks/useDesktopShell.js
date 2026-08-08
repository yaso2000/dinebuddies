import { useEffect, useState } from 'react';

const DESKTOP_SHELL_MQ = '(min-width: 1024px)';

/** True when the app uses the 3-column desktop shell (≥1024px). */
export function useDesktopShell() {
    const [desktop, setDesktop] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia(DESKTOP_SHELL_MQ).matches : false
    );

    useEffect(() => {
        const mq = window.matchMedia(DESKTOP_SHELL_MQ);
        const sync = () => setDesktop(mq.matches);
        sync();
        mq.addEventListener('change', sync);
        return () => mq.removeEventListener('change', sync);
    }, []);

    return desktop;
}
