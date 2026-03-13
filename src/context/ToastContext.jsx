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
                bottom: '1.5rem',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                maxWidth: 'min(90vw, 400px)',
                pointerEvents: 'none'
            }}
        >
            {toasts.map(({ id, message, type }) => (
                <div
                    key={id}
                    role="alert"
                    style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-main)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        border: '1px solid var(--border-color)',
                        borderLeft: type === 'error' ? '4px solid #ef4444' : type === 'success' ? '4px solid #22c55e' : type === 'warning' ? '4px solid #f59e0b' : '4px solid var(--primary)',
                        pointerEvents: 'auto',
                        fontSize: '0.95rem'
                    }}
                >
                    {message}
                </div>
            ))}
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

    const showToast = useCallback((message, type = 'info') => {
        const id = Date.now() + Math.random();
        setToasts((prev) => [...prev, { id, message, type, createdAt: Date.now() }]);

        const t = setTimeout(() => {
            dismiss(id);
        }, 5000);
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
