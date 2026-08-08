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
import './styles/app-bidi.css';
import './i18n';
import './utils/numberFormatOverrides';
import ErrorBoundary from './components/ErrorBoundary';
import App from './App.jsx';
import { bootDocumentTheme } from './theme/bootDocumentTheme';
import { installFatalUiRecoveryListeners } from './utils/fatalUiRecovery';
import { getFirebaseRedirectResultOnce } from './firebase/authBootstrap';
import { clearStaleOAuthRedirectFlags } from './utils/localDevAuth';
import { peekFacebookIosLoginPending } from './utils/facebookIosSignIn';
import { installCryptoRandomUuidPolyfill } from './utils/cryptoPolyfill';

installCryptoRandomUuidPolyfill();
bootDocumentTheme();
installFatalUiRecoveryListeners();

const rootEl = document.getElementById('root');
if (!rootEl) {
    throw new Error('Missing #root element in index.html');
}

if (typeof window === 'undefined' || !peekFacebookIosLoginPending()) {
    clearStaleOAuthRedirectFlags();
}

/** Start immediately — must run before React auth listeners; do not block UI render on this. */
const oauthRedirectBootPromise =
    typeof window !== 'undefined' ? getFirebaseRedirectResultOnce() : Promise.resolve(null);

async function boot() {
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
    } catch (err) {
        console.error('[boot] Failed to load app:', err);
        return;
    }

    try {
        await oauthRedirectBootPromise;
    } catch (err) {
        console.warn('[boot] Firebase redirect bootstrap:', err?.message || err);
    }
    if (!peekFacebookIosLoginPending()) {
        clearStaleOAuthRedirectFlags();
    }

    if (import.meta.env.DEV && 'serviceWorker' in navigator) {
        void navigator.serviceWorker.getRegistrations().then((regs) =>
            Promise.all(regs.map((r) => r.unregister()))
        ).catch(() => {});
    }
}

void boot();
