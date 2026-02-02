import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaTimes, FaFlag } from 'react-icons/fa';

const ReportModal = ({ isOpen, onClose, reportType, targetId, targetName, onSubmit }) => {
    const { i18n } = useTranslation();
    const [selectedReason, setSelectedReason] = useState('');
    const [details, setDetails] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Report reasons based on type
    const getReasons = () => {
        const baseReasons = {
            invitation: [
                { id: 'inappropriate', label: t('inappropriate_content') },
                { id: 'fraud', label: t('fraud_scam') },
                { id: 'spam', label: t('spam') },
                { id: 'fake', label: t('false_information') },
                { id: 'other', label: t('other') }
            ],
            user: [
                { id: 'harassment', label: t('harassment') },
                { id: 'impersonation', label: t('impersonation') },
                { id: 'inappropriate', label: t('inappropriate_content') },
                { id: 'spam', label: t('spam_account') },
                { id: 'other', label: t('other') }
            ],
            restaurant: [
                { id: 'wrong_info', label: t('wrong_information') },
                { id: 'closed', label: t('restaurant_closed') },
                { id: 'poor_quality', label: t('poor_quality') },
                { id: 'other', label: t('other') }
            ]
        };

        return baseReasons[reportType] || baseReasons.invitation;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedReason) {
            alert(t('please_select_reason'));
            return;
        }

        setIsSubmitting(true);

        const report = {
            id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: reportType,
            targetId,
            targetName,
            reason: selectedReason,
            details,
            timestamp: new Date().toISOString(),
            status: 'pending'
        };

        await onSubmit(report);

        setIsSubmitting(false);
        setSelectedReason('');
        setDetails('');
        onClose();
    };

    if (!isOpen) return null;

    const reasons = getReasons();

    // Inline Styles System to ensure consistency
    const styles = {
        overlay: {
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
        },
        content: {
            background: '#0f172a', // Hardcoded dark blue/slate
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            color: '#f8fafc',
            fontFamily: 'inherit'
        },
        header: {
            padding: '1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(30, 41, 59, 0.5)',
        },
        title: {
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '1.25rem',
            fontWeight: '700',
            margin: 0,
            color: '#f8fafc'
        },
        closeBtn: {
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#94a3b8',
            fontSize: '1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
        },
        subtitle: {
            padding: '1rem 1.5rem 0.5rem',
            color: '#94a3b8',
            fontSize: '0.9rem',
            margin: 0,
            textAlign: i18n.language === 'ar' ? 'right' : 'left'
        },
        form: {
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
        },
        label: {
            display: 'block',
            fontSize: '0.95rem',
            fontWeight: '700',
            color: '#f8fafc',
            marginBottom: '0.75rem',
            textAlign: i18n.language === 'ar' ? 'right' : 'left'
        },
        reasonsGrid: {
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '0.75rem'
        },
        reasonBtn: (isActive) => ({
            padding: '1rem',
            background: isActive ? 'rgba(244, 63, 94, 0.1)' : '#1e293b',
            border: isActive ? '1px solid #f43f5e' : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            color: isActive ? '#f43f5e' : '#f8fafc',
            fontSize: '0.95rem',
            fontWeight: isActive ? '700' : '400',
            cursor: 'pointer',
            width: '100%',
            textAlign: i18n.language === 'ar' ? 'right' : 'left',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'inherit'
        }),
        textarea: {
            width: '100%',
            padding: '1rem',
            background: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            color: '#f8fafc',
            fontSize: '0.95rem',
            fontFamily: 'inherit',
            resize: 'vertical',
            minHeight: '100px',
            outline: 'none'
        },
        warning: {
            padding: '1rem',
            background: 'rgba(251, 191, 36, 0.1)',
            border: '1px solid rgba(251, 191, 36, 0.2)',
            borderRadius: '12px',
            color: '#fbbf24',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            direction: i18n.language === 'ar' ? 'rtl' : 'ltr'
        },
        actions: {
            display: 'flex',
            gap: '1rem',
            marginTop: '0.5rem'
        },
        cancelBtn: {
            flex: 1,
            padding: '0.85rem',
            borderRadius: '9999px',
            fontWeight: '700',
            fontSize: '1rem',
            cursor: 'pointer',
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#94a3b8',
            fontFamily: 'inherit'
        },
        submitBtn: {
            flex: 1,
            padding: '0.85rem',
            borderRadius: '9999px',
            fontWeight: '700',
            fontSize: '1rem',
            cursor: 'pointer',
            background: '#f43f5e',
            border: 'none',
            color: 'white',
            boxShadow: '0 4px 15px rgba(244, 63, 94, 0.3)',
            opacity: (!selectedReason || isSubmitting) ? 0.5 : 1,
            fontFamily: 'inherit'
        }
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.content} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={styles.header}>
                    <div style={styles.title}>
                        <FaFlag style={{ color: '#f43f5e' }} />
                        <h3>{t('report_violation')}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        style={styles.closeBtn}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f43f5e'; e.currentTarget.style.color = 'white'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#94a3b8'; }}
                    >
                        <FaTimes />
                    </button>
                </div>

                <p style={styles.subtitle}>{targetName}</p>

                {/* Form */}
                <form onSubmit={handleSubmit} style={styles.form}>
                    {/* Reasons */}
                    <div>
                        <label style={styles.label}>
                            {t('reason_for_report')} <span style={{ color: '#f43f5e' }}>*</span>
                        </label>
                        <div style={styles.reasonsGrid}>
                            {reasons.map(reason => (
                                <button
                                    key={reason.id}
                                    type="button"
                                    onClick={() => setSelectedReason(reason.id)}
                                    style={styles.reasonBtn(selectedReason === reason.id)}
                                >
                                    {reason.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Details */}
                    <div>
                        <label style={styles.label}>
                            {t('additional_details_optional')}
                        </label>
                        <textarea
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            placeholder={i18n.language === 'ar'
                                ? t('add_additional_info')
                                : 'Add any additional information...'}
                            rows={4}
                            style={styles.textarea}
                            onFocus={(e) => e.target.style.borderColor = '#f43f5e'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                        />
                    </div>

                    {/* Warning */}
                    <div style={styles.warning}>
                        <span>⚠️</span>
                        <span>{i18n.language === 'ar'
                            ? t('false_reports_warning')
                            : 'False reports may result in account suspension.'}</span>
                    </div>

                    {/* Actions */}
                    <div style={styles.actions}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={styles.cancelBtn}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f8fafc'; e.currentTarget.style.color = '#f8fafc'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'; e.currentTarget.style.color = '#94a3b8'; }}
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={!selectedReason || isSubmitting}
                            style={styles.submitBtn}
                            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                            {isSubmitting
                                ? t('submitting')
                                : t('submit_report')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ReportModal;
