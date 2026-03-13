import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import {
    FaBell, FaCheckCircle, FaCommentAlt, FaTrash,
    FaUserPlus, FaTimesCircle, FaHeart, FaExclamationCircle,
    FaSearch, FaCheckDouble, FaCalendarCheck
} from 'react-icons/fa';
import EmptyState from '../../components/EmptyState';

const getIcon = (type) => {
    const s = { fontSize: '1.1rem' };
    switch (type) {
        case 'follow': return <FaUserPlus style={{ ...s, color: '#3b82f6' }} />;
        case 'invitation_accepted': return <FaCheckCircle style={{ ...s, color: '#10b981' }} />;
        case 'invitation_rejected': return <FaTimesCircle style={{ ...s, color: '#ef4444' }} />;
        case 'message': return <FaCommentAlt style={{ ...s, color: '#8b5cf6' }} />;
        case 'like': return <FaHeart style={{ ...s, color: '#f472b6' }} />;
        case 'comment': return <FaCommentAlt style={{ ...s, color: '#3b82f6' }} />;
        case 'reminder': return <FaExclamationCircle style={{ ...s, color: '#f59e0b' }} />;
        default: return <FaBell style={{ ...s, color: 'rgba(255,255,255,0.4)' }} />;
    }
};

const ProNotifications = () => {
    const navigate = useNavigate();
    const {
        notifications, unreadCount, loading,
        markAsRead, markAllAsRead,
        deleteNotification, deleteAllNotifications,
        formatTime
    } = useNotifications();

    const [filterStatus, setFilterStatus] = useState('all');
    const [filterType, setFilterType] = useState('all');
    const [search, setSearch] = useState('');

    const filtered = notifications.filter(n => {
        if (filterStatus === 'unread' && n.read) return false;
        if (filterStatus === 'read' && !n.read) return false;
        if (filterType !== 'all' && n.type !== filterType) return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            return n.title?.toLowerCase().includes(q) ||
                n.message?.toLowerCase().includes(q) ||
                n.fromUserName?.toLowerCase().includes(q);
        }
        return true;
    });

    const filterBtn = (val, current, setter, label) => (
        <button
            key={val}
            onClick={() => setter(val)}
            style={{
                flex: '0 0 auto',
                padding: '6px 14px',
                borderRadius: 20,
                border: `1px solid ${current === val ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.08)'}`,
                background: current === val ? 'rgba(167,139,250,0.15)' : 'transparent',
                color: current === val ? '#a78bfa' : 'rgba(255,255,255,0.5)',
                fontSize: '0.8rem', fontWeight: current === val ? 700 : 500,
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
            }}
        >{label}</button>
    );

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'rgba(255,255,255,0.4)' }}>
            Loading…
        </div>
    );

    return (
        <div style={{ maxWidth: 700 }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FaBell style={{ color: '#a78bfa' }} />
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: '#f1f5f9' }}>
                        Notifications
                    </span>
                    {unreadCount > 0 && (
                        <span style={{ background: '#7c3aed', color: '#fff', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px' }}>
                            {unreadCount} unread
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {unreadCount > 0 && (
                        <button type="button" className="ui-btn ui-btn--secondary" onClick={markAllAsRead} title="Mark all read"
                            style={{ padding: '6px 10px', color: '#10b981' }}>
                            <FaCheckDouble />
                        </button>
                    )}
                    {notifications.length > 0 && (
                        <button type="button" className="ui-btn ui-btn--danger-outline" onClick={deleteAllNotifications} title="Delete all"
                            style={{ padding: '6px 10px' }}>
                            <FaTrash />
                        </button>
                    )}
                </div>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
                <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }} />
                <input
                    type="text"
                    className="ui-form-field"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search notifications…"
                    style={{ paddingLeft: 36 }}
                />
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {filterBtn('all', filterStatus, setFilterStatus, 'All')}
                {filterBtn('unread', filterStatus, setFilterStatus, 'Unread')}
                {filterBtn('read', filterStatus, setFilterStatus, 'Read')}
                <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />
                {filterBtn('all', filterType, setFilterType, 'All types')}
                {filterBtn('follow', filterType, setFilterType, 'Follows')}
                {filterBtn('invitation_accepted', filterType, setFilterType, 'Invitations')}
                {filterBtn('message', filterType, setFilterType, 'Messages')}
                {filterBtn('like', filterType, setFilterType, 'Likes')}
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)' }}>
                        <FaBell style={{ fontSize: '2rem', marginBottom: 12 }} />
                        <p style={{ margin: 0 }}>No notifications found</p>
                    </div>
                ) : filtered.map(notif => (
                    <div
                        key={notif.id}
                        onClick={() => { if (!notif.read) markAsRead(notif.id); if (notif.actionUrl) navigate(notif.actionUrl); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '12px 14px',
                            background: notif.read ? 'rgba(255,255,255,0.02)' : 'rgba(167,139,250,0.06)',
                            border: `1px solid ${notif.read ? 'rgba(255,255,255,0.05)' : 'rgba(167,139,250,0.15)'}`,
                            borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s',
                            position: 'relative'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(167,139,250,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = notif.read ? 'rgba(255,255,255,0.02)' : 'rgba(167,139,250,0.06)'}
                    >
                        {/* Unread dot */}
                        {!notif.read && (
                            <div style={{ position: 'absolute', top: 12, right: 12, width: 7, height: 7, borderRadius: '50%', background: '#a78bfa' }} />
                        )}

                        {/* Avatar or type icon */}
                        <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {notif.fromUserAvatar
                                ? <img src={notif.fromUserAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : getIcon(notif.type)
                            }
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: notif.read ? 500 : 700, color: '#f1f5f9', marginBottom: 2 }}>{notif.title}</div>
                            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{notif.message}</div>
                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)', marginTop: 3 }}>{formatTime(notif.createdAt)}</div>
                        </div>

                        {/* Delete */}
                        <button
                            onClick={e => { e.stopPropagation(); deleteNotification(notif.id); }}
                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', padding: 6, borderRadius: 6, flexShrink: 0 }}
                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
                        ><FaTrash /></button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProNotifications;
