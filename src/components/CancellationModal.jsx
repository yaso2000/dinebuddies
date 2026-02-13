import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaTimes, FaExclamationTriangle } from 'react-icons/fa';
import { CANCELLATION_REASONS } from '../utils/invitationCancellation';

const CancellationModal = ({ isOpen, onClose, onConfirm, invitationTitle }) => {
    const { t } = useTranslation();
    const [selectedReason, setSelectedReason] = useState('');
    const [customReason, setCustomReason] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        if (!selectedReason) {
            alert('Please select a reason');
            return;
        }

        if (selectedReason === 'other' && !customReason.trim()) {
            alert(t('enter_custom_reason'));
            return;
        }

        setLoading(true);
        await onConfirm(selectedReason, customReason);
        setLoading(false);
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
        }}>
            <div style={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                maxWidth: '500px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <FaExclamationTriangle style={{ color: '#ef4444', fontSize: '1.5rem' }} />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>
                            {t('cancel_invitation')}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '1.25rem',
                            padding: '0.5rem'
                        }}
                    >
                        <FaTimes />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '1.5rem' }}>
                    <p style={{
                        marginBottom: '1.5rem',
                        color: 'var(--text-muted)',
                        fontSize: '0.95rem'
                    }}>
                        {t('cancel_invitation_confirm')}
                    </p>

                    <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1rem',
                        marginBottom: '1.5rem'
                    }}>
                        <p style={{
                            fontSize: '0.9rem',
                            fontWeight: '700',
                            color: 'white',
                            margin: 0
                        }}>
                            "{invitationTitle}"
                        </p>
                    </div>

                    <label style={{
                        display: 'block',
                        marginBottom: '0.75rem',
                        fontSize: '0.9rem',
                        fontWeight: '700',
                        color: 'var(--text-white)'
                    }}>
                        {t('select_cancellation_reason')}
                    </label>

                    {/* Reason Options */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        {CANCELLATION_REASONS.map(reason => (
                            <label
                                key={reason.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '1rem',
                                    background: selectedReason === reason.id ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-input)',
                                    border: `2px solid ${selectedReason === reason.id ? 'var(--primary)' : 'var(--border-color)'}`,
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    if (selectedReason !== reason.id) {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (selectedReason !== reason.id) {
                                        e.currentTarget.style.background = 'var(--bg-input)';
                                    }
                                }}
                            >
                                <input
                                    type="radio"
                                    name="cancellation_reason"
                                    value={reason.id}
                                    checked={selectedReason === reason.id}
                                    onChange={(e) => setSelectedReason(e.target.value)}
                                    style={{ cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                                    {t(`cancellation_reason_${reason.id}`)}
                                </span>
                            </label>
                        ))}
                    </div>

                    {/* Custom Reason Input */}
                    {selectedReason === 'other' && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                color: 'var(--text-muted)'
                            }}>
                                {t('enter_custom_reason')}
                            </label>
                            <textarea
                                value={customReason}
                                onChange={(e) => setCustomReason(e.target.value)}
                                placeholder="Type your reason here..."
                                style={{
                                    width: '100%',
                                    minHeight: '100px',
                                    padding: '0.75rem',
                                    background: 'var(--bg-input)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'white',
                                    fontSize: '0.9rem',
                                    resize: 'vertical',
                                    fontFamily: 'inherit'
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '1.5rem',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    gap: '0.75rem'
                }}>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            color: 'white',
                            fontSize: '0.95rem',
                            fontWeight: '700',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.5 : 1
                        }}
                    >
                        {t('cancel')}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={loading || !selectedReason}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            background: loading || !selectedReason ? '#7f1d1d' : '#ef4444',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            color: 'white',
                            fontSize: '0.95rem',
                            fontWeight: '700',
                            cursor: loading || !selectedReason ? 'not-allowed' : 'pointer',
                            opacity: loading || !selectedReason ? 0.5 : 1
                        }}
                    >
                        {loading ? t('submitting') : t('cancel_invitation')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CancellationModal;
