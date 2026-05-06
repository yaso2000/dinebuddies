/**
 * iOS Safari / PWA: layout vs visual viewport often leaves a dead band at the bottom.
 * Exposes --app-visible-height on :root; mobile-optimizations.css sizes body/#root to it.
 */
export function syncMobileShellViewport() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const mm = window.matchMedia('(max-width: 1023px)');

    const apply = () => {
        if (!mm.matches) {
            document.documentElement.style.removeProperty('--app-visible-height');
            return;
        }
        const vv = window.visualViewport;
        const h = vv ? Math.max(1, vv.height) : window.innerHeight;
        document.documentElement.style.setProperty('--app-visible-height', `${Math.round(h)}px`);
    };

    apply();
    if (mm.addEventListener) mm.addEventListener('change', apply);
    else if (mm.addListener) mm.addListener(apply);
    window.visualViewport?.addEventListener('resize', apply);
    window.visualViewport?.addEventListener('scroll', apply);
    window.addEventListener('orientationchange', apply);
    window.addEventListener('resize', apply);
}
