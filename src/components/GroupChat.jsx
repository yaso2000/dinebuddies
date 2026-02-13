import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { FaPaperPlane, FaUserCircle } from 'react-icons/fa';
import './GroupChat.css';

const GroupChat = ({ collectionPath }) => {
    const { currentUser, userProfile } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Early return if no user
    if (!currentUser) {
        return (
            <div className="group-chat-container">
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Please login to use the chat
                </div>
            </div>
        );
    }

    // Subscribe to messages
    useEffect(() => {
        if (!collectionPath) return;

        const messagesQuery = query(
            collection(db, collectionPath),
            orderBy('createdAt', 'asc')
        );

        const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(msgs);
        });

        return () => unsubscribe();
    }, [collectionPath]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;
        if (!currentUser?.uid) return;

        try {
            const messagesRef = collection(db, collectionPath);
            await addDoc(messagesRef, {
                type: 'text',
                text: newMessage.trim(),
                senderId: currentUser.uid,
                senderName: userProfile?.display_name || currentUser.displayName || 'User',
                senderAvatar: userProfile?.photo_url || currentUser.photoURL || '',
                createdAt: serverTimestamp()
            });
            setNewMessage('');
            inputRef.current?.focus();
        } catch (error) {
            console.error('Error sending message:', error);
            // alert('Failed to send message');
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate();
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    return (
        <div className="group-chat-container">
            {/* Messages */}
            <div className="group-messages-area">
                {messages.length === 0 ? (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: 'var(--text-muted)',
                        padding: '2rem',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '1rem',
                            fontSize: '1.5rem'
                        }}>
                            💬
                        </div>
                        <p style={{ fontSize: '0.9rem' }}>No messages yet. Start the conversation!</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isOwn = msg.senderId === currentUser?.uid;
                        const isSystem = msg.senderId === 'system';

                        if (isSystem) {
                            return (
                                <div key={msg.id} style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    margin: '1rem 0',
                                    width: '100%'
                                }}>
                                    <span style={{
                                        background: 'rgba(255,255,255,0.1)',
                                        padding: '4px 12px',
                                        borderRadius: '12px',
                                        fontSize: '0.75rem',
                                        color: 'var(--text-secondary)'
                                    }}>
                                        {msg.text}
                                    </span>
                                </div>
                            );
                        }

                        return (
                            <div key={msg.id} className={`group-message-wrapper ${isOwn ? 'own' : 'other'}`}>
                                {!isOwn && (
                                    <img
                                        src={msg.senderAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.senderName || 'U')}&background=8b5cf6&color=fff&size=128`}
                                        alt={msg.senderName}
                                        className="group-message-avatar"
                                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://ui-avatars.com/api/?name=User&background=random'; }}
                                    />
                                )}

                                <div className="group-message-content-wrapper">
                                    {!isOwn && <p className="sender-name">{msg.senderName}</p>}

                                    <div className="group-message-bubble">
                                        <p className="message-text">{msg.text}</p>
                                        <div className="message-meta">
                                            <span className="message-time">{formatTime(msg.createdAt)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="group-chat-input-area">
                <div className="input-wrapper" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        className="message-input"
                        style={{
                            flex: 1,
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '24px',
                            padding: '10px 16px',
                            color: 'white',
                            fontSize: '0.95rem',
                            outline: 'none'
                        }}
                    />
                    <button
                        className="send-btn"
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim()}
                        style={{
                            background: newMessage.trim() ? 'var(--primary)' : 'var(--bg-secondary)',
                            color: newMessage.trim() ? 'white' : 'var(--text-muted)',
                            border: 'none',
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: newMessage.trim() ? 'pointer' : 'default',
                            transition: 'all 0.2s'
                        }}
                    >
                        <FaPaperPlane size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GroupChat;
