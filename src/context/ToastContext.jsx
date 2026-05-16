import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import UserAvatar from '../components/UserAvatar';

const ToastContext = createContext(null);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}

/** In-app notification toast: avatar, theme-aware surface, swipe L/R to dismiss + optional delete. */
function NotificationToastRow({ id, message, dismiss }) {
    const [tx, setTx] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const drag = useRef({ active: false, startX: 0, startY: 0, mode: null });

    const runDismiss = useCallback(() => {
        const p = message.onSwipeDismiss?.();
        if (p && typeof p.then === 'function') p.catch(() => {});
        dismiss(id);
    }, [id, message, dismiss]);

    const onPointerDown = (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        drag.current = {
            active: true,
            startX: e.clientX,
            startY: e.clientY,
            mode: null,
            pointerId: e.pointerId,
        };
        setIsDragging(false);
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch (_) { /* ignore */ }
    };

    const onPointerMove = (e) => {
        const d = drag.current;
        if (!d.active || e.pointerId !== d.pointerId) return;
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        if (!d.mode && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
            d.mode = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
            if (d.mode === 'h') setIsDragging(true);
        }
        if (d.mode === 'h') {
            e.preventDefault();
            setTx(Math.max(-120, Math.min(120, dx)));
        }
    };

    const onPointerUp = (e) => {
        const d = drag.current;
        if (!d.active || e.pointerId !== d.pointerId) return;
        d.active = false;
        const dx = e.clientX - d.startX;
        d.mode = null;
        setIsDragging(false);
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch (_) { /* ignore */ }
        if (Math.abs(dx) > 64) {
            setTx(0);
            runDismiss();
            return;
        }
        setTx(0);
    };

    const userForAvatar = message.senderUser || {
        displayName: message.senderName || message.title || 'User',
        display_name: message.senderName,
        gender: message.senderGender,
        role: message.senderRole,
    };

    const handleClick = () => {
        if (Math.abs(tx) > 6) return;
        if (message.onClick) message.onClick();
    };

    return (
        <div
            role="alert"
            className="toast-notification-row"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClick={handleClick}
            style={{
                width: '100%',
                borderRadius: '16px',
                background: 'var(--bg-card, rgba(30, 30, 46, 0.96))',
                color: 'var(--text-main, #f1f5f9)',
                boxShadow: '0 10px 28px rgba(0,0,0,0.35)',
                border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                pointerEvents: 'auto',
                cursor: message.onClick ? 'pointer' : 'default',
                touchAction: isDragging ? 'none' : 'pan-y',
                position: 'relative',
                overflow: 'hidden',
                transform: `translateX(${tx}px)`,
                transition: isDragging ? 'none' : 'transform 0.2s ease',
            }}
        >
            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(90deg, rgba(239,68,68,0.95) 0%, rgba(220,38,38,0.85) 100%)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    opacity: Math.min(1, Math.abs(tx) / 72),
                }}
            >
                {message.swipeDeleteLabel || '⋯'}
            </div>
            <div
                style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem',
                    background: 'var(--bg-card, rgba(30, 30, 46, 0.98))',
                }}
            >
                <UserAvatar
                    src={message.avatarUrl || message.icon}
                    user={userForAvatar}
                    alt={message.senderName || message.title || 'Notification'}
                    style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0,
                    }}
                />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <h4
                        style={{
                            margin: '0 0 0.25rem 0',
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: 'var(--text-main, #f8fafc)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {message.title || 'New Notification'}
                    </h4>
                    <p
                        style={{
                            margin: 0,
                            fontSize: '0.9rem',
                            color: 'var(--text-muted, #94a3b8)',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                        }}
                    >
                        {message.body || message.text}
                    </p>
                </div>
            </div>
        </div>
    );
}

function ToastContainer({ toasts, dismiss }) {
    return (
        <>
            <style>
                {`
                    .toast-stack {
                        position: fixed;
                        left: 50%;
                        transform: translateX(-50%);
                        z-index: 99999;
                        display: flex;
                        flex-direction: column;
                        gap: 0.75rem;
                        width: min(92vw, 450px);
                        pointer-events: none;
                        align-items: center;
                        box-sizing: border-box;
                        padding-inline: 8px;
                    }
                    /* iPhone / narrow: sit above home indicator + bottom nav — clear Dynamic Island */
                    @media (max-width: 1023px) {
                        .toast-stack {
                            top: auto;
                            bottom: calc(env(safe-area-inset-bottom, 0px) + var(--nav-height, 72px) + 10px);
                            flex-direction: column-reverse;
                        }
                    }
                    @media (min-width: 1024px) {
                        .toast-stack {
                            top: calc(env(safe-area-inset-top, 0px) + 12px);
                            bottom: auto;
                            flex-direction: column;
                        }
                    }
                    @keyframes toastSlideIn {
                        from { opacity: 0; transform: translateY(-10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}
            </style>
            <div className="toast-stack">
                {toasts.map(({ id, message, type, onClick }) => {
                    const isNotification = type === 'notification' && typeof message === 'object';

                    if (isNotification) {
                        return (
                            <div
                                key={id}
                                style={{
                                    width: '100%',
                                    pointerEvents: 'auto',
                                    animation: 'toastSlideIn 0.28s ease forwards',
                                }}
                            >
                                <NotificationToastRow id={id} message={message} dismiss={dismiss} />
                            </div>
                        );
                    }

                    return (
                        <div
                            key={id}
                            role="alert"
                            onClick={() => onClick?.()}
                            style={{
                                padding: '0.75rem 1.25rem',
                                borderRadius: '12px',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-main)',
                                boxShadow: '0 8px 16px rgba(0,0,0,0.12)',
                                border: '1px solid var(--border-color)',
                                borderLeft:
                                    type === 'error'
                                        ? '4px solid #ef4444'
                                        : type === 'success'
                                          ? '4px solid #22c55e'
                                          : type === 'warning'
                                            ? '4px solid #f59e0b'
                                            : '4px solid var(--primary)',
                                pointerEvents: 'auto',
                                fontSize: '0.95rem',
                                animation: 'toastSlideIn 0.28s ease forwards',
                                cursor: onClick ? 'pointer' : 'default',
                            }}
                        >
                            {message}
                        </div>
                    );
                })}
            </div>
        </>
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

    const showToast = useCallback((message, type = 'info', onClick = null) => {
        const id = Date.now() + Math.random();
        setToasts((prev) => [...prev, { id, message, type, onClick, createdAt: Date.now() }]);

        const t = setTimeout(() => {
            dismiss(id);
        }, 6000);
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
            {toasts.length > 0 && <ToastContainer toasts={toasts} dismiss={dismiss} />}
        </ToastContext.Provider>
    );
}
