import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';
import './styles/profile-shared.css';
import './styles/ui-primitives.css';
import './mobile-optimizations.css';
import './i18n';
import './utils/numberFormatOverrides';
import App from './App.jsx';

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Why `import('./App.jsx')` failed — drives help text (Firebase message is wrong for Vite CSS preload errors). */
function bootFailureExplanation(msg) {
    const m = String(msg || '').toLowerCase();
    if (m.includes('preload') && m.includes('css')) {
        return {
            bodyHtml:
                'فشل تحميل ملف تنسيق (CSS) أثناء بدء التطبيق. غالباً يحدث ذلك بسبب <strong>ذاكرة تخزين قديمة</strong> لخادم Vite أو للمتصفح، أو بعد تغيير الكود بينما الجلسة القديمة ما زالت مفتوحة.',
            footerHtml:
                'جرّب: إيقاف الخادم (Ctrl+C)، حذف المجلد <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">node_modules/.vite</code>، ثم <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code>، وتحديثاً قوياً للصفحة (Ctrl+Shift+R).',
        };
    }
    if (m.includes('firebase') || (m.includes('missing') && m.includes('credential'))) {
        return {
            bodyHtml:
                'غالباً مفاتيح <strong>Firebase</strong> غير صحيحة أو غير موجودة في ملف <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env</code> (انسخ من <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env.example</code> واملأ القيم من Firebase Console).',
            footerHtml:
                'بعد حفظ <code>.env</code>: أعد تشغيل الخادم <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code>',
        };
    }
    return {
        bodyHtml:
            'تعذّر تحميل الواجهة. راجع الرسالة التقنية أدناه. إن كانت تتعلق بـ Firebase، تحقق من ملف <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env</code> وأعد تشغيل الخادم.',
        footerHtml:
            'أعد تشغيل <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code> بعد أي تعديل على البيئة أو الاعتماديات.',
    };
}

const rootEl = document.getElementById('root');
if (!rootEl) {
    throw new Error('Missing #root element in index.html');
}

/**
 * App is imported statically so Vite does not emit a separate async chunk + CSS preload for
 * `App-*.css` (dynamic `import('./App.jsx')` has caused "Unable to preload CSS" and blank screens).
 */
function boot() {
    try {
        ReactDOM.createRoot(rootEl).render(
            <HelmetProvider>
                <div className="app-root-fill">
                    <App />
                </div>
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

boot();
