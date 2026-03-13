import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEnvelope, FaBullhorn, FaChartLine, FaPaperPlane, FaInfoCircle } from 'react-icons/fa';
import { adminSecurityService } from '../../services/adminSecurityService';

const Communications = () => {
    const navigate = useNavigate();
    const [targetUserId, setTargetUserId] = useState('');
    const [notifTitle, setNotifTitle] = useState('');
    const [notifMessage, setNotifMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState(null);

    const handleSendNotification = async (e) => {
        e.preventDefault();
        if (!targetUserId.trim() || !notifTitle.trim() || !notifMessage.trim()) {
            setResult({ ok: false, message: 'Please fill User ID, Title, and Message.' });
            return;
        }
        setSending(true);
        setResult(null);
        try {
            await adminSecurityService.createNotification({
                userId: targetUserId.trim(),
                type: 'message',
                title: notifTitle.trim().slice(0, 120),
                message: notifMessage.trim().slice(0, 500),
            });
            setResult({ ok: true, message: 'Notification sent successfully.' });
            setNotifTitle('');
            setNotifMessage('');
        } catch (err) {
            setResult({ ok: false, message: err?.message || 'Failed to send notification.' });
        } finally {
            setSending(false);
        }
    };

    return (
        <div>
            <div className="admin-page-header">
                <h1 className="admin-page-title">Communications</h1>
                <p className="admin-page-subtitle">
                    Manage invitations and send in-app notifications to users.
                </p>
            </div>

            <div className="admin-grid admin-grid-2 admin-mb-4">
                <div
                    className="admin-card"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate('/admin/invitations')}
                    onKeyDown={(e) => e.key === 'Enter' && navigate('/admin/invitations')}
                    role="button"
                    tabIndex={0}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '3rem', height: '3rem', borderRadius: 'var(--admin-radius-sm)', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FaEnvelope style={{ color: '#6366f1', fontSize: '1.5rem' }} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--admin-text-primary)', margin: '0 0 0.25rem 0' }}>
                                Invitations
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', margin: 0 }}>
                                View and manage all invitations and RSVPs.
                            </p>
                        </div>
                    </div>
                </div>
                <div
                    className="admin-card"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate('/admin/reports')}
                    onKeyDown={(e) => e.key === 'Enter' && navigate('/admin/reports')}
                    role="button"
                    tabIndex={0}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '3rem', height: '3rem', borderRadius: 'var(--admin-radius-sm)', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FaChartLine style={{ color: '#f59e0b', fontSize: '1.5rem' }} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--admin-text-primary)', margin: '0 0 0.25rem 0' }}>
                                Reports & Analytics
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', margin: 0 }}>
                                User reports and platform analytics.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="admin-card admin-mb-4">
                <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--admin-text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaPaperPlane /> Send notification to user
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', marginBottom: '1rem' }}>
                    Send an in-app notification to a specific user (e.g. for support or announcements). The user will see it in their notifications.
                </p>
                <form onSubmit={handleSendNotification} style={{ maxWidth: '480px' }}>
                    <div className="admin-mb-2">
                        <label className="admin-label">User ID (Firebase UID)</label>
                        <input
                            type="text"
                            className="admin-input"
                            value={targetUserId}
                            onChange={(e) => setTargetUserId(e.target.value)}
                            placeholder="e.g. abc123..."
                            required
                        />
                    </div>
                    <div className="admin-mb-2">
                        <label className="admin-label">Title</label>
                        <input
                            type="text"
                            className="admin-input"
                            value={notifTitle}
                            onChange={(e) => setNotifTitle(e.target.value)}
                            placeholder="Notification title"
                            maxLength={120}
                            required
                        />
                    </div>
                    <div className="admin-mb-2">
                        <label className="admin-label">Message</label>
                        <textarea
                            className="admin-input"
                            value={notifMessage}
                            onChange={(e) => setNotifMessage(e.target.value)}
                            placeholder="Message body"
                            rows={3}
                            maxLength={500}
                            required
                            style={{ resize: 'vertical', minHeight: '80px' }}
                        />
                    </div>
                    {result && (
                        <div
                            className="admin-mb-2"
                            style={{
                                padding: '0.75rem',
                                borderRadius: 'var(--admin-radius-sm)',
                                background: result.ok ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: result.ok ? 'var(--admin-success)' : 'var(--admin-danger)',
                                fontSize: '0.875rem',
                            }}
                        >
                            {result.message}
                        </div>
                    )}
                    <button
                        type="submit"
                        className="admin-btn admin-btn-primary"
                        disabled={sending}
                    >
                        {sending ? 'Sending…' : 'Send notification'}
                    </button>
                </form>
            </div>

            <div className="admin-card" style={{ background: 'var(--admin-bg-elevated)', border: '1px dashed var(--admin-border)' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--admin-text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaBullhorn /> Broadcast to all users
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', margin: 0, display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <FaInfoCircle style={{ flexShrink: 0, marginTop: '2px' }} />
                    Send a single notification to every user or segment (e.g. all businesses). This feature can be added with a dedicated Cloud Function when needed.
                </p>
            </div>
        </div>
    );
};

export default Communications;
