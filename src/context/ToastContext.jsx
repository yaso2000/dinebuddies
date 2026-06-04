import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import NotificationToastBanner from '../components/NotificationToastBanner';
import '../components/NotificationToastBanner.css';

const ToastContext = createContext(null);

const NOTIFICATION_AUTO_DISMISS_MS = 7000;

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}

function ToastContainer({ toasts, onDismiss, onPin }) {
    return (
        <div className="toast-container">
            {toasts.map((toast) => {
                const isNotification =
                    toast.type === 'notification' && typeof toast.message === 'object';

                if (isNotification) {
                    return (
                        <NotificationToastBanner
                            key={toast.id}
                            toast={toast}
                            onNavigate={toast.onClick}
                            onPin={onPin}
                            onDismiss={onDismiss}
                        />
                    );
                }

                const typeClass =
                    toast.type === 'error'
                        ? 'toast-item--error'
                        : toast.type === 'success'
                          ? 'toast-item--success'
                          : toast.type === 'warning'
                            ? 'toast-item--warning'
                            : 'toast-item--info';

                return (
                    <div key={toast.id} role="alert" className={`toast-item ${typeClass}`}>
                        {toast.message}
                    </div>
                );
            })}
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

    const scheduleDismiss = useCallback(
        (id, ms) => {
            if (timeoutsRef.current[id]) {
                clearTimeout(timeoutsRef.current[id]);
            }
            timeoutsRef.current[id] = setTimeout(() => {
                setToasts((prev) => {
                    const target = prev.find((t) => t.id === id);
                    if (target?.pinned) return prev;
                    return prev.filter((t) => t.id !== id);
                });
                delete timeoutsRef.current[id];
            }, ms);
        },
        []
    );

    const pinToast = useCallback(
        (id) => {
            if (timeoutsRef.current[id]) {
                clearTimeout(timeoutsRef.current[id]);
                delete timeoutsRef.current[id];
            }
            setToasts((prev) =>
                prev.map((t) => (t.id === id ? { ...t, pinned: true } : t))
            );
        },
        []
    );

    const showToast = useCallback(
        (message, type = 'info', onClick = null, durationMs = 5000) => {
            const id = Date.now() + Math.random();
            const isNotification = type === 'notification' && typeof message === 'object';
            const ms =
                isNotification
                    ? NOTIFICATION_AUTO_DISMISS_MS
                    : Number.isFinite(durationMs) && durationMs > 0
                      ? durationMs
                      : 5000;

            setToasts((prev) => [
                ...prev,
                { id, message, type, onClick, pinned: false, createdAt: Date.now() },
            ]);

            scheduleDismiss(id, ms);
        },
        [scheduleDismiss]
    );

    useEffect(() => {
        return () => {
            Object.values(timeoutsRef.current).forEach(clearTimeout);
        };
    }, []);

    return (
        <ToastContext.Provider value={{ showToast, dismissToast: dismiss, pinToast }}>
            {children}
            {toasts.length > 0 && (
                <ToastContainer toasts={toasts} onDismiss={dismiss} onPin={pinToast} />
            )}
        </ToastContext.Provider>
    );
}
