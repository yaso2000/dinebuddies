import { App } from '@capacitor/app';

/**
 * Android hardware/gesture back button: without this, Capacitor's default behavior exits the
 * app entirely whenever the WebView has no history to go back to — including from deep in a
 * route the user reached via in-app navigation (tab switches, replace navigations, etc. don't
 * always leave WebView history). Route it through the browser history first so React Router
 * handles it like a normal back navigation; only minimize the app once there's truly nowhere
 * left to go.
 */
export function installNativeBackButtonHandler() {
    if (typeof window === 'undefined' || !window.Capacitor?.isNativePlatform?.()) return;

    App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
            window.history.back();
        } else {
            App.minimizeApp();
        }
    });
}
