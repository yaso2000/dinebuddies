/** Remove FB JS SDK dialogs that can block taps after cancel/timeout.
 *  Never remove `#fb-root` — the Meta SDK needs it for the next login. */
export function dismissFacebookSdkOverlay() {
    if (typeof document === 'undefined') return;
    try {
        for (const el of document.querySelectorAll(
            '.fb_dialog, .fb_dialog_background, .fb_iframe_widget'
        )) {
            el.remove();
        }
    } catch {
        /* ignore */
    }
}
