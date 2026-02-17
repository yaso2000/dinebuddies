import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaArrowLeft, FaFileInvoice, FaDownload, FaCheckCircle, FaClock } from 'react-icons/fa';
import './SettingsPages.css';

const BillingSettings = () => {
    const navigate = useNavigate();
    const { userProfile } = useAuth();

    // Mock billing history (in real app, fetch from Stripe)
    const [invoices] = useState([
        {
            id: 'inv_1',
            date: '2026-02-01',
            amount: 29.00,
            status: 'paid',
            description: 'Premium Subscription - February 2026',
            invoiceUrl: '#'
        },
        {
            id: 'inv_2',
            date: '2026-01-01',
            amount: 29.00,
            status: 'paid',
            description: 'Premium Subscription - January 2026',
            invoiceUrl: '#'
        },
        {
            id: 'inv_3',
            date: '2025-12-01',
            amount: 29.00,
            status: 'paid',
            description: 'Premium Subscription - December 2025',
            invoiceUrl: '#'
        }
    ]);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatAmount = (amount) => {
        return `$${amount.toFixed(2)}`;
    };

    const handleDownloadInvoice = (invoice) => {
        // In real app, download from Stripe
        window.open(invoice.invoiceUrl, '_blank');
    };

    const getStatusBadge = (status) => {
        const styles = {
            paid: {
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                icon: FaCheckCircle
            },
            pending: {
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#f59e0b',
                icon: FaClock
            },
            failed: {
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                icon: FaClock
            }
        };

        const style = styles[status] || styles.pending;
        const Icon = style.icon;

        return (
            <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                ...style
            }}>
                <Icon size={12} />
                {status}
            </div>
        );
    };

    return (
        <div className="settings-page">
            {/* Header */}
            <div className="settings-header">
                <button onClick={() => navigate('/settings')} className="back-btn">
                    <FaArrowLeft />
                </button>
                <h1>Billing History</h1>
                <div style={{ width: '40px' }}></div>
            </div>

            {/* Content */}
            <div className="settings-content">
                <div className="settings-card">
                    <div className="settings-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                        <FaFileInvoice style={{ color: '#10b981', fontSize: '1.5rem' }} />
                    </div>

                    <h2>Billing History</h2>
                    <p className="settings-description">
                        View and download your past invoices
                    </p>

                    {/* Invoices List */}
                    <div style={{ marginTop: '2rem' }}>
                        {invoices.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '3rem 1rem',
                                background: 'var(--bg-secondary)',
                                borderRadius: '12px'
                            }}>
                                <FaFileInvoice style={{
                                    fontSize: '3rem',
                                    color: 'var(--text-secondary)',
                                    opacity: 0.3,
                                    marginBottom: '1rem'
                                }} />
                                <h3 style={{
                                    fontSize: '1.1rem',
                                    color: 'var(--text-main)',
                                    marginBottom: '0.5rem'
                                }}>
                                    No invoices yet
                                </h3>
                                <p style={{
                                    fontSize: '0.9rem',
                                    color: 'var(--text-secondary)'
                                }}>
                                    Your billing history will appear here
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {invoices.map(invoice => (
                                    <div
                                        key={invoice.id}
                                        style={{
                                            padding: '1.5rem',
                                            background: 'var(--bg-secondary)',
                                            borderRadius: '12px',
                                            border: '1px solid var(--border-color)'
                                        }}
                                    >
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            justifyContent: 'space-between',
                                            marginBottom: '1rem'
                                        }}>
                                            <div style={{ flex: 1 }}>
                                                <h3 style={{
                                                    fontSize: '1rem',
                                                    fontWeight: '600',
                                                    color: 'var(--text-main)',
                                                    marginBottom: '0.5rem'
                                                }}>
                                                    {invoice.description}
                                                </h3>
                                                <p style={{
                                                    fontSize: '0.85rem',
                                                    color: 'var(--text-secondary)',
                                                    margin: 0
                                                }}>
                                                    {formatDate(invoice.date)}
                                                </p>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{
                                                    fontSize: '1.25rem',
                                                    fontWeight: '700',
                                                    color: 'var(--text-main)',
                                                    marginBottom: '0.5rem'
                                                }}>
                                                    {formatAmount(invoice.amount)}
                                                </div>
                                                {getStatusBadge(invoice.status)}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleDownloadInvoice(invoice)}
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem',
                                                background: 'var(--bg-input)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '8px',
                                                color: 'var(--text-main)',
                                                fontSize: '0.9rem',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.5rem'
                                            }}
                                        >
                                            <FaDownload />
                                            Download Invoice
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Summary */}
                    {invoices.length > 0 && (
                        <div style={{
                            marginTop: '2rem',
                            padding: '1.5rem',
                            background: 'var(--bg-secondary)',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)'
                        }}>
                            <h3 style={{
                                fontSize: '1rem',
                                fontWeight: '600',
                                color: 'var(--text-main)',
                                marginBottom: '1rem'
                            }}>
                                Summary
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: '0.9rem'
                                }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>
                                        Total Invoices:
                                    </span>
                                    <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>
                                        {invoices.length}
                                    </span>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: '0.9rem'
                                }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>
                                        Total Paid:
                                    </span>
                                    <span style={{ color: '#10b981', fontWeight: '700' }}>
                                        {formatAmount(invoices.reduce((sum, inv) =>
                                            inv.status === 'paid' ? sum + inv.amount : sum, 0
                                        ))}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="settings-note" style={{ marginTop: '2rem' }}>
                        <strong>Need help?</strong> If you have any questions about your billing,
                        please contact our support team at support@dinebuddies.com
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BillingSettings;
