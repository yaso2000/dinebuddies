import React from 'react';

export default function HomeRedirectAlert({ message, onDismiss, t }) {
    if (!message) return null;
    return (
        <div
            role="alert"
            style={{
                margin: '8px 12px',
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'var(--primary)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
            }}
        >
            <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{message}</span>
            <button
                type="button"
                onClick={onDismiss}
                style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: '600',
                }}
            >
                {t('close', { defaultValue: 'Close' })}
            </button>
        </div>
    );
}
