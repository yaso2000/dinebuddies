import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAppUpdatePrompt } from '../hooks/useAppUpdatePrompt';

/**
 * Full-screen "Update available" prompt for native app users on an outdated
 * build. Renders above everything (before login and while signed in). Web/PWA
 * users never see it (the hook returns show:false there).
 */
export default function AppUpdatePrompt() {
    const { t, i18n } = useTranslation();
    const { show, forced, storeUrl, cfg } = useAppUpdatePrompt();
    const [dismissed, setDismissed] = useState(false);

    if (!show || (dismissed && !forced)) return null;

    const isAr = String(i18n.language || '').toLowerCase().startsWith('ar');
    const title =
        (isAr ? cfg?.updateTitleAr : cfg?.updateTitleEn) ||
        t('update_available_title', 'Update available');
    const message =
        (isAr ? cfg?.updateMessageAr : cfg?.updateMessageEn) ||
        t('update_available_msg', 'A new version of DineBuddies is available. Please update for the latest features and fixes.');

    const overlay = {
        position: 'fixed', inset: 0, zIndex: 2147483000,
        background: 'rgba(10, 12, 20, 0.72)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'max(20px, env(safe-area-inset-top)) 20px max(20px, env(safe-area-inset-bottom))',
    };
    const card = {
        width: '100%', maxWidth: 360, background: '#ffffff', color: '#111827',
        borderRadius: 20, padding: '28px 22px', textAlign: 'center',
        boxShadow: '0 24px 60px rgba(0,0,0,0.35)', boxSizing: 'border-box',
    };
    const btnPrimary = {
        display: 'block', width: '100%', boxSizing: 'border-box',
        background: '#E86A2D', color: '#fff', textDecoration: 'none',
        fontWeight: 800, fontSize: '1.05rem', padding: '0.95rem 1rem',
        borderRadius: 14, border: 'none', cursor: 'pointer', marginTop: 18,
    };
    const btnGhost = {
        display: 'block', width: '100%', boxSizing: 'border-box',
        background: 'transparent', color: '#6b7280', fontWeight: 600,
        fontSize: '0.95rem', padding: '0.7rem', border: 'none', cursor: 'pointer', marginTop: 6,
    };

    return createPortal(
        <div style={overlay} role="dialog" aria-modal="true" aria-label={title}>
            <div style={card}>
                <img src="/db-logo.svg" alt="" width={64} height={64} style={{ margin: '0 auto 14px', display: 'block' }} />
                <h2 style={{ margin: '0 0 8px', fontSize: '1.35rem', fontWeight: 800 }}>{title}</h2>
                <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.55, color: '#4b5563' }}>{message}</p>
                <a href={storeUrl} target="_blank" rel="noopener noreferrer" style={btnPrimary}>
                    {t('update_now', 'Update now')}
                </a>
                {!forced ? (
                    <button type="button" onClick={() => setDismissed(true)} style={btnGhost}>
                        {t('later', 'Later')}
                    </button>
                ) : null}
            </div>
        </div>,
        document.body
    );
}
