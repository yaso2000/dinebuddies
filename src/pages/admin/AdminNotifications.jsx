import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPaperPlane, FaHistory } from 'react-icons/fa';
import { adminSecurityService } from '../../services/adminSecurityService';

const AdminNotifications = () => {
    const [targetType, setTargetType] = useState('user');
    const [targetId, setTargetId] = useState('');
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState(null);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!targetId.trim() || !title.trim() || !message.trim()) {
            setResult({ ok: false, message: 'Fill target, title and message.' });
            return;
        }
        setSending(true);
        setResult(null);
        try {
            await adminSecurityService.createNotification({
                userId: targetId.trim(),
                type: 'message',
                title: title.trim().slice(0, 120),
                message: message.trim().slice(0, 500),
            });
            setResult({ ok: true, message: 'Notification sent.' });
            setTitle('');
            setMessage('');
        } catch (err) {
            setResult({ ok: false, message: err?.message || 'Failed.' });
        } finally {
            setSending(false);
        }
    };

    return (
        <div>
            <div className="admin-page-header">
                <h1 className="admin-page-title">Notifications System</h1>
                <p className="admin-page-subtitle">Send and manage in-app notifications.</p>
            </div>

            <div className="admin-card admin-mb-4">
                <h2 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaPaperPlane /> Send notification
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', marginBottom: '1rem' }}>
                    Broadcast to all • To a user segment • To one user • To businesses — single-user send is available below. Broadcast/segment require backend support.
                </p>
                <form onSubmit={handleSend} style={{ maxWidth: '480px' }}>
                    <div className="admin-mb-2">
                        <label className="admin-label">Target user ID (Firebase UID)</label>
                        <input type="text" className="admin-input" value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="User UID" required />
                    </div>
                    <div className="admin-mb-2">
                        <label className="admin-label">Title</label>
                        <input type="text" className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={120} required />
                    </div>
                    <div className="admin-mb-2">
                        <label className="admin-label">Message</label>
                        <textarea className="admin-input" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message" rows={3} maxLength={500} required style={{ resize: 'vertical' }} />
                    </div>
                    {result && (
                        <div className="admin-mb-2" style={{ padding: '0.75rem', borderRadius: 'var(--admin-radius-sm)', background: result.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: result.ok ? 'var(--admin-success)' : 'var(--admin-danger)', fontSize: '0.875rem' }}>
                            {result.message}
                        </div>
                    )}
                    <button type="submit" className="admin-btn admin-btn-primary" disabled={sending}>{sending ? 'Sending…' : 'Send to user'}</button>
                </form>
            </div>

            <div className="admin-card">
                <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaHistory /> Sent notifications / delivery stats
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)' }}>Log and delivery stats — connect to notifications collection when ready.</p>
            </div>
        </div>
    );
};

export default AdminNotifications;
