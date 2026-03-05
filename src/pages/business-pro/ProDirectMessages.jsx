import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { getSafeAvatar } from '../../utils/avatarUtils';
import {
    FaSearch, FaPaperPlane, FaCommentDots, FaCamera, FaArrowDown
} from 'react-icons/fa';
import { uploadImage } from '../../utils/mediaUtils';
import '../../pages/Chat.css';

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatListTime = (ts) => {
    if (!ts) return '';
    const d = ts.toDate();
    const now = new Date();
    if (d.toDateString() === now.toDateString())
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const yest = new Date(now); yest.setDate(yest.getDate() - 1);
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    if (now - d < 604800000) return d.toLocaleDateString('en-US', { weekday: 'short' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatMsgTime = (ts) => {
    if (!ts) return '';
    return ts.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
};

// ─── Conversation List Panel ────────────────────────────────────────────────

const ConvoList = ({ conversations, activeId, onSelect, search, setSearch, loading }) => (
    <div style={{
        width: 280, minWidth: 280,
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', height: '100%'
    }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9', marginBottom: 10 }}>Messages</div>
            <div style={{ position: 'relative' }}>
                <FaSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }} />
                <input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search conversations…"
                    style={{ width: '100%', padding: '8px 10px 8px 32px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#f1f5f9', fontSize: '0.8rem', outline: 'none' }}
                />
            </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>Loading…</div>}
            {!loading && conversations.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                    <FaCommentDots style={{ fontSize: '2rem', marginBottom: 10 }} />
                    <p style={{ fontSize: '0.85rem', margin: 0 }}>No conversations yet</p>
                </div>
            )}
            {conversations.map(convo => (
                <div key={convo.id} onClick={() => onSelect(convo)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px',
                        background: activeId === convo.id ? 'rgba(167,139,250,0.1)' : 'transparent',
                        borderLeft: activeId === convo.id ? '3px solid #a78bfa' : '3px solid transparent',
                        cursor: 'pointer', transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => { if (activeId !== convo.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={e => { if (activeId !== convo.id) e.currentTarget.style.background = 'transparent'; }}
                >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                        <img src={convo.otherUser?.photoURL || getSafeAvatar(convo.otherUser)} alt=""
                            style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                            onError={e => e.target.src = `https://ui-avatars.com/api/?name=U&background=7c3aed&color=fff`}
                        />
                        {convo.otherUser?.isOnline && (
                            <div style={{ position: 'absolute', bottom: 1, right: 1, width: 9, height: 9, background: '#10b981', borderRadius: '50%', border: '2px solid #0a0a14' }} />
                        )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: convo.isUnread ? 700 : 500, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>
                                {convo.otherUser?.displayName || 'User'}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', flexShrink: 0, marginLeft: 4 }}>
                                {formatListTime(convo.lastMessageTime)}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>
                                {convo.lastMessage || 'No messages yet'}
                            </span>
                            {convo.isUnread && (
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#a78bfa', flexShrink: 0, marginLeft: 6 }} />
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

// ─── Chat Window Panel ───────────────────────────────────────────────────────

const ChatWindow = ({ convo, currentUser }) => {
    const { sendMessage, markAsRead, setTypingStatus } = useChat();
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [otherTyping, setOtherTyping] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const messagesEndRef = useRef(null);
    const imageRef = useRef(null);
    const typingTimer = useRef(null);

    useEffect(() => {
        if (!convo?.id) return;
        const q = query(collection(db, 'conversations', convo.id, 'messages'), orderBy('createdAt', 'asc'));
        const unsub = onSnapshot(q, snap => {
            setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            markAsRead(convo.id);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        });
        return () => unsub();
    }, [convo?.id]);

    useEffect(() => {
        if (!convo?.id) return;
        const unsub = onSnapshot(doc(db, 'conversations', convo.id), d => {
            if (d.exists()) setOtherTyping(d.data().typing?.[convo.otherUser?.uid] || false);
        });
        return () => unsub();
    }, [convo?.id, convo?.otherUser?.uid]);

    const handleSend = async (e) => {
        e?.preventDefault();
        if (!text.trim() || !convo?.id) return;
        const t = text.trim();
        setText('');
        await sendMessage(convo.id, { type: 'text', text: t });
        setTypingStatus(convo.id, false);
    };

    const handleTyping = (val) => {
        setText(val);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        if (val) setTypingStatus(convo.id, true);
        typingTimer.current = setTimeout(() => setTypingStatus(convo.id, false), 2000);
    };

    const handleImage = async (e) => {
        const file = e.target.files[0];
        if (!file || !convo?.id) return;
        setUploading(true);
        try {
            const url = await uploadImage(file, currentUser.uid);
            await sendMessage(convo.id, { type: 'image', text: url });
        } catch (_) { alert('Failed to upload image'); }
        finally { setUploading(false); }
    };

    if (!convo) return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'rgba(255,255,255,0.2)' }}>
            <FaCommentDots style={{ fontSize: '3rem' }} />
            <p style={{ margin: 0, fontSize: '0.9rem' }}>Select a conversation</p>
        </div>
    );

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
            {/* Chat header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <div style={{ position: 'relative' }}>
                    <img src={convo.otherUser?.photoURL || getSafeAvatar(convo.otherUser)} alt=""
                        style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }}
                        onError={e => e.target.src = `https://ui-avatars.com/api/?name=U&background=7c3aed&color=fff`}
                    />
                    {convo.otherUser?.isOnline && <div style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, background: '#10b981', borderRadius: '50%', border: '2px solid #0a0a14' }} />}
                </div>
                <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f1f5f9' }}>{convo.otherUser?.displayName || 'User'}</div>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>
                        {otherTyping ? 'typing…' : convo.otherUser?.isOnline ? 'Online' : 'Offline'}
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}
                onScroll={e => {
                    const { scrollTop, scrollHeight, clientHeight } = e.target;
                    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 150);
                }}
            >
                {messages.map(msg => {
                    const isOwn = msg.senderId === currentUser?.uid;
                    return (
                        <div key={msg.id} style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                            <div style={{
                                maxWidth: '65%',
                                background: isOwn ? 'rgba(124,58,237,0.7)' : 'rgba(255,255,255,0.07)',
                                borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                padding: '8px 12px',
                                backdropFilter: 'blur(4px)'
                            }}>
                                {msg.type === 'image' && <img src={msg.text} alt="" style={{ maxWidth: 220, borderRadius: 8, display: 'block' }} />}
                                {msg.type === 'text' && <p style={{ margin: 0, fontSize: '0.875rem', color: '#f1f5f9', lineHeight: 1.4 }}>{msg.text}</p>}
                                {msg.type === 'voice' && <audio controls src={msg.text} style={{ maxWidth: 200 }} />}
                                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', textAlign: 'right', marginTop: 3 }}>{formatMsgTime(msg.createdAt)}</div>
                            </div>
                        </div>
                    );
                })}
                {otherTyping && (
                    <div style={{ display: 'flex', gap: 4, padding: '6px 10px', background: 'rgba(255,255,255,0.06)', borderRadius: 12, width: 'fit-content' }}>
                        {[0, 1, 2].map(i => (
                            <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.4)', animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
                        ))}
                    </div>
                )}
                <div ref={messagesEndRef} />
                {showScrollBtn && (
                    <button onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                        style={{ position: 'absolute', bottom: 80, right: 24, background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FaArrowDown />
                    </button>
                )}
            </div>

            {/* Input */}
            <input ref={imageRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />
            <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <button onClick={() => imageRef.current?.click()}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 6, fontSize: '1rem' }}>
                    <FaCamera />
                </button>
                <input
                    value={text} onChange={e => handleTyping(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend(e)}
                    placeholder={uploading ? 'Uploading…' : 'Message…'}
                    disabled={uploading}
                    style={{ flex: 1, padding: '9px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 22, color: '#f1f5f9', fontSize: '0.875rem', outline: 'none' }}
                />
                <button onClick={handleSend} disabled={!text.trim() || uploading}
                    style={{ width: 38, height: 38, borderRadius: '50%', background: text.trim() ? '#7c3aed' : 'rgba(255,255,255,0.06)', color: '#fff', border: 'none', cursor: text.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
                    <FaPaperPlane style={{ marginLeft: -2 }} />
                </button>
            </div>
        </div>
    );
};

// ─── Main Component ──────────────────────────────────────────────────────────

const ProDirectMessages = () => {
    const { currentUser } = useAuth();
    const { conversations, loading } = useChat();
    const [activeConvo, setActiveConvo] = useState(null);
    const [search, setSearch] = useState('');

    const filtered = conversations.filter(c =>
        !search || c.otherUser?.displayName?.toLowerCase().includes(search.toLowerCase())
    );

    // Auto-select first conversation
    useEffect(() => {
        if (!activeConvo && filtered.length > 0) setActiveConvo(filtered[0]);
    }, [filtered.length]);

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 120px)', overflow: 'hidden', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
            <ConvoList
                conversations={filtered}
                activeId={activeConvo?.id}
                onSelect={setActiveConvo}
                search={search}
                setSearch={setSearch}
                loading={loading}
            />
            <ChatWindow
                convo={activeConvo}
                currentUser={currentUser}
            />
        </div>
    );
};

export default ProDirectMessages;
