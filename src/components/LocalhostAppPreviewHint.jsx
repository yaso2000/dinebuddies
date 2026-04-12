import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Shown only in Vite dev on localhost — how to preview the app and enable Maps on this origin.
 */
export default function LocalhostAppPreviewHint() {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    if (!import.meta.env.DEV) return null;
    if (typeof window === 'undefined') return null;
    const { hostname, origin, href } = window.location;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') return null;

    const copyUrl = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            try {
                const ta = document.createElement('textarea');
                ta.value = href;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch {
                /* ignore */
            }
        }
    }, [href]);

    return (
        <div
            style={{
                marginBottom: '1rem',
                padding: '0.75rem 0.85rem',
                borderRadius: '12px',
                fontSize: '0.78rem',
                lineHeight: 1.5,
                color: 'var(--text-main)',
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
            }}
        >
            <strong style={{ display: 'block', marginBottom: '0.4rem', color: '#4ade80' }}>
                {t('localhost_preview_title', 'Localhost — app preview')}
            </strong>
            <p style={{ margin: '0 0 0.65rem', color: 'var(--text-muted)' }}>
                {t(
                    'localhost_preview_body',
                    'Run npm run dev and open this URL in your browser to see the live listing preview below. For Google Maps search on localhost, add your dev origin to the Maps API key: Application restrictions → HTTP referrers → {{origin}}/*',
                    { origin }
                )}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <code
                    style={{
                        flex: '1 1 180px',
                        fontSize: '0.72rem',
                        padding: '6px 8px',
                        borderRadius: 8,
                        background: 'var(--bg-body)',
                        border: '1px solid var(--border-color)',
                        wordBreak: 'break-all',
                    }}
                >
                    {href}
                </code>
                <button
                    type="button"
                    onClick={copyUrl}
                    style={{
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: '1px solid rgba(34, 197, 94, 0.45)',
                        background: 'rgba(34, 197, 94, 0.15)',
                        color: '#4ade80',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                    }}
                >
                    {copied
                        ? t('localhost_preview_copied', 'Copied')
                        : t('localhost_preview_copy', 'Copy page URL')}
                </button>
            </div>
        </div>
    );
}
