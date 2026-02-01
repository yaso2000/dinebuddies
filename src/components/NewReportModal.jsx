import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaTimes, FaFlag } from 'react-icons/fa';

const NewReportModal = ({ isOpen, onClose, reportType, targetId, targetName, onSubmit }) => {
    const { i18n } = useTranslation();
    const [selectedReason, setSelectedReason] = useState('');
    const [details, setDetails] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Report reasons based on type
    const getReasons = () => {
        const baseReasons = {
            invitation: [
                { id: 'inappropriate', label: i18n.language === 'ar' ? 'محتوى غير لائق' : 'Inappropriate Content' },
                { id: 'fraud', label: i18n.language === 'ar' ? 'احتيال أو نصب' : 'Fraud or Scam' },
                { id: 'spam', label: i18n.language === 'ar' ? 'إزعاج' : 'Spam' },
                { id: 'fake', label: i18n.language === 'ar' ? 'معلومات مزيفة' : 'False Information' },
                { id: 'other', label: i18n.language === 'ar' ? 'سبب آخر' : 'Other' }
            ],
            user: [
                { id: 'harassment', label: i18n.language === 'ar' ? 'مضايقة' : 'Harassment' },
                { id: 'impersonation', label: i18n.language === 'ar' ? 'انتحال شخصية' : 'Impersonation' },
                { id: 'inappropriate', label: i18n.language === 'ar' ? 'محتوى غير لائق' : 'Inappropriate Content' },
                { id: 'spam', label: i18n.language === 'ar' ? 'حساب spam' : 'Spam Account' },
                { id: 'other', label: i18n.language === 'ar' ? 'سبب آخر' : 'Other' }
            ],
            restaurant: [
                { id: 'wrong_info', label: i18n.language === 'ar' ? 'معلومات خاطئة' : 'Wrong Information' },
                { id: 'closed', label: i18n.language === 'ar' ? 'المطعم مغلق' : 'Restaurant Closed' },
                { id: 'poor_quality', label: i18n.language === 'ar' ? 'جودة سيئة' : 'Poor Quality' },
                { id: 'other', label: i18n.language === 'ar' ? 'سبب آخر' : 'Other' }
            ]
        };

        return baseReasons[reportType] || baseReasons.invitation;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedReason) {
            alert(i18n.language === 'ar' ? 'الرجاء اختيار سبب التبليغ' : 'Please select a reason');
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

    // Inline Styles System to ensure consistency (Base styles)
    const styles = {
        overlay: {
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            paddingBottom: '2rem'
        },
        content: {
            background: '#0f172a', // Hardcoded dark blue/slate
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '380px', // Reduced to standard mobile width
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            color: '#f8fafc',
            fontFamily: 'inherit',
            position: 'relative'
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
            fontSize: '1.1rem', // Slightly smaller for mobile feel
            fontWeight: '700',
            margin: 0,
            color: '#f8fafc'
        },
        // Buttons are handled via CSS now
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
            gap: '1.25rem'
        },
        label: {
            display: 'block',
            fontSize: '0.9rem',
            fontWeight: '700',
            color: '#f8fafc',
            marginBottom: '0.5rem',
            textAlign: i18n.language === 'ar' ? 'right' : 'left'
        },
        reasonsGrid: {
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '0.6rem'
        },
        textarea: {
            width: '100%',
            padding: '0.85rem',
            background: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            color: '#f8fafc',
            fontSize: '0.9rem',
            fontFamily: 'inherit',
            resize: 'vertical',
            minHeight: '100px',
            outline: 'none',
            transition: 'border-color 0.2s'
        },
        warning: {
            padding: '0.85rem',
            background: 'rgba(251, 191, 36, 0.1)',
            border: '1px solid rgba(251, 191, 36, 0.2)',
            borderRadius: '12px',
            color: '#fbbf24',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            direction: i18n.language === 'ar' ? 'rtl' : 'ltr',
            lineHeight: '1.4'
        },
        actions: {
            display: 'flex',
            gap: '0.75rem',
            marginTop: '0.5rem'
        }
    };

    return (
        <div style={styles.overlay} onClick={onClose} className="report-modal-overlay-fade">
            <div style={styles.content} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={styles.header}>
                    <div style={styles.title}>
                        <FaFlag style={{ color: '#f43f5e' }} />
                        <h3>{i18n.language === 'ar' ? 'إبلاغ عن مخالفة' : 'Report Violation'}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="nrm-close-btn"
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
                            {i18n.language === 'ar' ? 'سبب التبليغ' : 'Reason for Report'} <span style={{ color: '#f43f5e' }}>*</span>
                        </label>
                        <div style={styles.reasonsGrid}>
                            {reasons.map(reason => (
                                <button
                                    key={reason.id}
                                    type="button"
                                    onClick={() => setSelectedReason(reason.id)}
                                    className={`nrm-reason-btn ${selectedReason === reason.id ? 'active' : ''}`}
                                >
                                    {reason.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Details */}
                    <div>
                        <label style={styles.label}>
                            {i18n.language === 'ar' ? 'تفاصيل إضافية (اختياري)' : 'Additional Details (Optional)'}
                        </label>
                        <textarea
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            placeholder={i18n.language === 'ar'
                                ? 'أضف أي معلومات إضافية...'
                                : 'Add any additional information...'}
                            rows={4}
                            style={styles.textarea}
                            className="nrm-textarea"
                        />
                    </div>

                    {/* Warning */}
                    <div style={styles.warning}>
                        <span>⚠️</span>
                        <span>{i18n.language === 'ar'
                            ? 'التبليغات الكاذبة قد تؤدي إلى تعليق حسابك.'
                            : 'False reports may result in account suspension.'}</span>
                    </div>

                    {/* Actions */}
                    <div style={styles.actions}>
                        <button
                            type="button"
                            onClick={onClose}
                            className="nrm-btn nrm-btn-cancel"
                        >
                            {i18n.language === 'ar' ? 'إلغاء' : 'Cancel'}
                        </button>
                        <button
                            type="submit"
                            disabled={!selectedReason || isSubmitting}
                            className="nrm-btn nrm-btn-submit"
                        >
                            {isSubmitting
                                ? (i18n.language === 'ar' ? 'جاري الإرسال...' : 'Submitting...')
                                : (i18n.language === 'ar' ? 'إرسال التبليغ' : 'Submit Report')}
                        </button>
                    </div>
                </form>
            </div>

            <style>
                {`
                .nrm-close-btn {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: #1e293b;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: #94a3b8;
                    font-size: 0.9rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                }
                .nrm-close-btn:hover {
                    background: #f43f5e;
                    color: white;
                    border-color: #f43f5e;
                    transform: rotate(90deg);
                }

                .nrm-reason-btn {
                    padding: 0.85rem;
                    background: #1e293b;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    color: #f8fafc;
                    font-size: 0.9rem;
                    cursor: pointer;
                    width: 100%;
                    text-align: ${i18n.language === 'ar' ? 'right' : 'left'};
                    transition: all 0.2s ease;
                    font-family: inherit;
                }
                .nrm-reason-btn:hover {
                    border-color: #94a3b8;
                    transform: translateY(-1px);
                }
                .nrm-reason-btn.active {
                    background: rgba(244, 63, 94, 0.1);
                    border-color: #f43f5e;
                    color: #f43f5e;
                    font-weight: 700;
                }

                .nrm-textarea:focus {
                    border-color: #f43f5e !important;
                }

                .nrm-btn {
                    flex: 1;
                    padding: 0.85rem;
                    border-radius: 9999px;
                    font-weight: 700;
                    font-size: 0.95rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-family: inherit;
                }

                .nrm-btn-cancel {
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: #94a3b8;
                }
                .nrm-btn-cancel:hover {
                    color: #f8fafc;
                    border-color: #f8fafc;
                }

                .nrm-btn-submit {
                    background: #f43f5e;
                    border: none;
                    color: white;
                    box-shadow: 0 4px 15px rgba(244, 63, 94, 0.3);
                }
                .nrm-btn-submit:hover:not(:disabled) {
                    background: #e11d48;
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(244, 63, 94, 0.4);
                }
                .nrm-btn-submit:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }
            `}
            </style>
        </div>
    );
};

export default NewReportModal;
