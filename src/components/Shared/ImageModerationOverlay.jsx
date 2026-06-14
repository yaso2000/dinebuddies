import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaExclamationTriangle } from 'react-icons/fa';
import { subscribeImageUploadProgress } from '../../services/imageUploadProgressStore';

/**
 * Overlay for image preview during moderation or after rejection.
 * @param {'checking'|'rejected'|null} status
 * @param {string} [message] — override rejection text
 * @param {number|null} [progress] — optional 0-100; when null during checking, reads global upload progress
 */
export default function ImageModerationOverlay({ status, message, progress = null, children, style = {} }) {
    const { t } = useTranslation();
    const [globalProgress, setGlobalProgress] = useState(0);

    useEffect(() => {
        if (status !== 'checking') return undefined;
        return subscribeImageUploadProgress((s) => {
            if (s.active) setGlobalProgress(s.progress);
        });
    }, [status]);

    if (!status) {
        return children ?? null;
    }

    const rejectionText = message || t('image_rejected_policy');
    const displayProgress = progress ?? globalProgress;

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
                        {displayProgress > 0 && (
                            <>
                                <div
                                    style={{
                                        width: 'min(200px, 80%)',
                                        height: 6,
                                        borderRadius: 999,
                                        overflow: 'hidden',
                                        background: 'rgba(255,255,255,0.2)',
                                    }}
                                >
                                    <div
                                        style={{
                                            height: '100%',
                                            width: `${displayProgress}%`,
                                            background: '#fff',
                                            transition: 'width 0.25s ease',
                                        }}
                                    />
                                </div>
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, opacity: 0.95 }}>
                                    {displayProgress}%
                                </span>
                            </>
                        )}
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
