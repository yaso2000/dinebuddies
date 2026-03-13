import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { getSafeAvatar } from '../../utils/avatarUtils';
import { FaPaperPlane } from 'react-icons/fa';

const ProMessages = () => {
    const { currentUser, userProfile } = useAuth();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [messageText, setMessageText] = useState('');

    useEffect(() => {
        if (!currentUser?.uid) return;
        const messagesRef = collection(db, 'communities', currentUser.uid, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(50));
        const unsub = onSnapshot(q, snap => {
            const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
            setMessages(msgs);
            setLoading(false);
        }, err => {
            console.warn('ProMessages error:', err.message);
            setLoading(false);
        });
        return () => unsub();
    }, [currentUser?.uid]);

    const formatTime = (ts) => {
        if (!ts) return '';
        const date = ts.toDate?.() || new Date(ts);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)' }}>
            <div className="bpro-card-header" style={{ marginBottom: 16 }}>
                <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9' }}>Community Chat</div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Communicate with your community members</div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="ui-card" style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {loading ? (
                    <div className="bpro-spinner" />
                ) : messages.length === 0 ? (
                    <div className="bpro-empty">
                        <div className="bpro-empty-icon">💬</div>
                        <h3>No messages yet</h3>
                        <p>Send your first message to your community</p>
                    </div>
                ) : (
                    messages.map(msg => {
                        const isMe = msg.senderId === currentUser.uid;
                        return (
                            <div key={msg.id} style={{ display: 'flex', gap: 10, flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                                <img
                                    src={isMe ? getSafeAvatar(userProfile) : (msg.senderAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.senderName || 'U')}&background=7c3aed&color=fff`)}
                                    alt=""
                                    style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                />
                                <div style={{ maxWidth: '60%' }}>
                                    {!isMe && (
                                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>{msg.senderName || 'User'}</div>
                                    )}
                                    <div style={{
                                        background: isMe ? 'linear-gradient(135deg, #7c3aed, #a78bfa)' : 'rgba(255,255,255,0.07)',
                                        border: isMe ? 'none' : '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                        padding: '10px 14px',
                                        fontSize: '0.875rem',
                                        color: isMe ? 'white' : 'rgba(255,255,255,0.85)',
                                    }}>
                                        {msg.text || msg.message}
                                    </div>
                                    <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', marginTop: 3, textAlign: isMe ? 'right' : 'left' }}>
                                        {formatTime(msg.createdAt)}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Input */}
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <input
                    type="text"
                    className="ui-form-field"
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    placeholder="Message your community..."
                    onKeyDown={e => {
                        if (e.key === 'Enter' && messageText.trim()) {
                            // Sending handled via CommunityChat functionality
                            setMessageText('');
                        }
                    }}
                    style={{ flex: 1 }}
                />
                <button type="button" className="ui-btn ui-btn--primary" style={{ padding: '12px 20px' }}>
                    <FaPaperPlane />
                </button>
            </div>
        </div>
    );
};

export default ProMessages;
