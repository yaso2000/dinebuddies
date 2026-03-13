import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css';
import './styles/profile-shared.css';
import './styles/ui-primitives.css';
import './mobile-optimizations.css';
import './i18n';
import { loadGoogleMapsScript } from './utils/loadGoogleMaps';

import ErrorBoundary from './components/ErrorBoundary';

// Load Google Maps Places API early (key from env, not hardcoded)
loadGoogleMapsScript().catch(() => { /* Components handle missing Maps gracefully */ });

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>,
);
