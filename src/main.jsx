import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';
import './styles/profile-shared.css';
import './styles/ui-primitives.css';
import './mobile-optimizations.css';
import './i18n';
import './utils/numberFormatOverrides';
import ErrorBoundary from './components/ErrorBoundary';
import App from './App.jsx';

/**
 * MetaMask’s `inpage.js` runs on every site; if the extension isn’t installed it rejects with
 * “Failed to connect” / “extension not found”. This app does not use Web3 — suppress only that
 * noise so the console isn’t spammed (dev + production).
 */
if (typeof window !== 'undefined') {
    const reasonToText = (reason, depth = 0) => {
        if (depth > 14 || reason == null) return '';
        if (typeof reason === 'string') return reason;
        if (typeof reason === 'number' || typeof reason === 'boolean') return String(reason);
        if (reason instanceof Error) {
            return [reason.message, reason.name, reason.stack].filter(Boolean).join(' ');
        }
        if (typeof reason === 'object') {
            let s = '';
            for (const k of ['message', 'name', 'description', 'code']) {
                if (typeof reason[k] === 'string') s += `${reason[k]} `;
            }
            if (reason.cause != null) s += reasonToText(reason.cause, depth + 1);
            if (!s.trim() && typeof reason.toString === 'function') {
                const ts = reason.toString();
                if (ts && ts !== '[object Object]') s += ts;
            }
            return s;
        }
        return String(reason);
    };

    const metamaskExtensionNoise = (reason) => {
        const t = `${reasonToText(reason)} ${String(reason)}`.toLowerCase();
        return (
            t.includes('metamask extension not found') ||
            (t.includes('failed to connect') && t.includes('metamask'))
        );
    };

    window.addEventListener(
        'unhandledrejection',
        (e) => {
            if (metamaskExtensionNoise(e.reason)) e.preventDefault();
        },
        true
    );
}

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
async function boot() {
    try {
        // Unregister any SW on dev (e.g. user opened production before) — stale workers cause
        // blank pages until hard refresh. Production registers /sw.js after mount.
        if (import.meta.env.DEV && 'serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
        }

        ReactDOM.createRoot(rootEl).render(
            <React.StrictMode>
                <ErrorBoundary>
                    <HelmetProvider>
                        <App />
                    </HelmetProvider>
                </ErrorBoundary>
            </React.StrictMode>
        );

        if (import.meta.env.PROD && 'serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        }
    } catch (err) {
        console.error('[boot] Failed to load app:', err);
        const msg = err?.message || String(err);
        const { bodyHtml, footerHtml } = bootFailureExplanation(msg);
        rootEl.innerHTML = `
<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;font-family:system-ui,Segoe UI,sans-serif;background:#0f172a;color:#e2e8f0;text-align:center;box-sizing:border-box;">
  <h1 style="font-size:1.15rem;margin:0 0 12px;">تعذّر تشغيل التطبيق</h1>
  <p style="max-width:520px;margin:0 0 16px;font-size:0.9rem;line-height:1.55;color:#94a3b8;">
    ${bodyHtml}
  </p>
  <pre style="text-align:left;max-width:560px;overflow:auto;background:#1e293b;padding:14px;border-radius:10px;font-size:12px;color:#fecaca;margin:0;">${escapeHtml(msg)}</pre>
  <p style="margin-top:18px;font-size:0.85rem;color:#94a3b8;">${footerHtml}</p>
</div>`;
    }
}

boot();
