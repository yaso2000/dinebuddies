import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';
import './styles/invitation-card-fonts.css';
import './styles/profile-shared.css';
import './styles/ui-primitives.css';
import './styles/composerFields.css';
import './mobile-optimizations.css';
import './styles/rtl-locale.css';
import './i18n';
import './utils/numberFormatOverrides';
import ErrorBoundary from './components/ErrorBoundary';
import App from './App.jsx';
import { bootDocumentTheme } from './theme/bootDocumentTheme';
import { installFatalUiRecoveryListeners } from './utils/fatalUiRecovery';
import { getFirebaseRedirectResultOnce } from './firebase/authBootstrap';
import { clearStaleOAuthRedirectFlags } from './utils/localDevAuth';
import { installCryptoRandomUuidPolyfill } from './utils/cryptoPolyfill';
import { bootFailureExplanation } from './utils/bootFailureMessages';
installCryptoRandomUuidPolyfill();
bootDocumentTheme();
installFatalUiRecoveryListeners();

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const rootEl = document.getElementById('root');
if (!rootEl) {
    throw new Error('Missing #root element in index.html');
}

/**
 * App is imported statically so Vite does not emit a separate async chunk + CSS preload for
 * `App-*.css` (dynamic `import('./App.jsx')` has caused "Unable to preload CSS" and blank screens).
 */
async function boot() {
    clearStaleOAuthRedirectFlags();
    try {
        await getFirebaseRedirectResultOnce();
    } catch (err) {
        console.warn('[boot] Firebase redirect bootstrap:', err?.message || err);
    }
    try {
        ReactDOM.createRoot(rootEl).render(
            <HelmetProvider>
                <ErrorBoundary>
                    <div className="app-root-fill">
                        <App />
                    </div>
                </ErrorBoundary>
            </HelmetProvider>
        );

        // Venue search uses OSM Photon + Nominatim (no Google Maps JS).
        // Preloading for every visitor caused huge unnecessary Places/Maps billing.

        // Run background tasks...
        (async () => {
            try {
                if (import.meta.env.DEV && 'serviceWorker' in navigator) {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(regs.map((r) => r.unregister()));
                }
            } catch (e) { console.warn('[bootBackground] failure:', e); }
        })();
    } catch (err) {
        console.error('[boot] Failed to load app:', err);
    }
}

void boot();
