/** Remove FB JS SDK dialogs/overlays that can block page taps after cancel or timeout. */
export function dismissFacebookSdkOverlay() {
    if (typeof document === 'undefined') return;
    try {
        for (const el of document.querySelectorAll(
            '#fb-root, .fb_dialog, .fb_dialog_background, .fb_reset'
        )) {
            el.remove();
        }
    } catch {
        /* ignore */
    }
}
