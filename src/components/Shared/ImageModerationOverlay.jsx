import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaExclamationTriangle } from 'react-icons/fa';

/**
 * Overlay for image preview during moderation or after rejection.
 * @param {'checking'|'rejected'|null} status
 * @param {string} [message] — override rejection text
 */
export default function ImageModerationOverlay({ status, message, children, style = {} }) {
    const { t } = useTranslation();

    if (!status) {
        return children ?? null;
    }

    const rejectionText = message || t('image_rejected_policy');

    return (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', ...style }}>
            {children}
            <div
                role="status"
                aria-live="polite"
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    padding: 16,
                    textAlign: 'center',
                    background:
                        status === 'rejected'
                            ? 'rgba(127, 29, 29, 0.82)'
                            : 'rgba(15, 23, 42, 0.72)',
                    color: '#fff',
                    zIndex: 2,
                }}
            >
                {status === 'checking' ? (
                    <>
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                border: '3px solid rgba(255,255,255,0.25)',
                                borderTopColor: '#fff',
                                borderRadius: '50%',
                                animation: 'db-spin 0.85s linear infinite',
                            }}
                        />
                        <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                            {t('image_upload_checking')}
                        </span>
                    </>
                ) : (
                    <>
                        <FaExclamationTriangle size={28} aria-hidden />
                        <span style={{ fontSize: '0.88rem', fontWeight: 800, lineHeight: 1.45, maxWidth: 280 }}>
                            {rejectionText}
                        </span>
                        <span style={{ fontSize: '0.78rem', opacity: 0.9 }}>
                            {t('image_rejected_choose_another', 'Choose another photo')}
                        </span>
                    </>
                )}
            </div>
            <style>{`@keyframes db-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
