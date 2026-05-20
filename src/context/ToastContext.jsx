import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const ToastContext = createContext(null);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}

function ToastContainer({ toasts }) {
    return (
        <div
            style={{
                position: 'fixed',
                top: '1.5rem',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                width: 'min(92vw, 450px)',
                pointerEvents: 'none',
                alignItems: 'center'
            }}
        >
            {toasts.map(({ id, message, type, onClick }) => {
                const isNotification = type === 'notification' && typeof message === 'object';
                
                if (isNotification) {
                    return (
                        <div
                            key={id}
                            role="alert"
                            onClick={() => {
                                if (onClick) onClick();
                                if (message.onClick) message.onClick();
                            }}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                borderRadius: '16px',
                                background: 'rgba(255, 255, 255, 0.95)',
                                backdropFilter: 'blur(10px)',
                                color: '#1f2937',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                border: '1px solid rgba(0,0,0,0.05)',
                                pointerEvents: 'auto',
                                cursor: (onClick || message.onClick) ? 'pointer' : 'default',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                transition: 'all 0.2s ease',
                                animation: 'slideDown 0.3s ease forwards'
                            }}
                        >
                            {message.icon && (
                                <img 
                                    src={message.icon} 
                                    alt="Sender" 
                                    style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        flexShrink: 0,
                                        border: '2px solid rgba(0,0,0,0.05)',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                                    }} 
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                    }}
                                />
                            )}
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <h4 style={{ 
                                    margin: '0 0 0.25rem 0', 
                                    fontSize: '1rem', 
                                    fontWeight: '700',
                                    color: '#111827',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {message.title || 'New Notification'}
                                </h4>
                                <p style={{ 
                                    margin: 0, 
                                    fontSize: '0.9rem', 
                                    color: '#4b5563',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                }}>
                                    {message.body || message.text}
                                </p>
                            </div>
                        </div>
                    );
                }

                // Standard Info/Error Toast
                return (
                    <div
                        key={id}
                        role="alert"
                        style={{
                            padding: '0.75rem 1.25rem',
                            borderRadius: '12px',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-main)',
                            boxShadow: '0 8px 16px rgba(0,0,0,0.12)',
                            border: '1px solid var(--border-color)',
                            borderLeft: type === 'error' ? '4px solid #ef4444' : type === 'success' ? '4px solid #22c55e' : type === 'warning' ? '4px solid #f59e0b' : '4px solid var(--primary)',
                            pointerEvents: 'auto',
                            fontSize: '0.95rem',
                            animation: 'slideDown 0.3s ease forwards'
                        }}
                    >
                        {message}
                    </div>
                );
            })}
            <style>
                {`
                    @keyframes slideDown {
                        from { opacity: 0; transform: translateY(-20px) scale(0.95); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                `}
            </style>
        </div>
    );
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const timeoutsRef = useRef({});

    const dismiss = useCallback((id) => {
        if (timeoutsRef.current[id]) {
            clearTimeout(timeoutsRef.current[id]);
            delete timeoutsRef.current[id];
        }
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const showToast = useCallback((message, type = 'info', onClick = null, durationMs = 5000) => {
        const id = Date.now() + Math.random();
        setToasts((prev) => [...prev, { id, message, type, onClick, createdAt: Date.now() }]);

        const ms = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 5000;
        const t = setTimeout(() => {
            dismiss(id);
        }, ms);
        timeoutsRef.current[id] = t;
    }, [dismiss]);

    useEffect(() => {
        return () => {
            Object.values(timeoutsRef.current).forEach(clearTimeout);
        };
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {toasts.length > 0 && <ToastContainer toasts={toasts} />}
        </ToastContext.Provider>
    );
}
