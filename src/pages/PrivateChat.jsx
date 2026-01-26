import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { FaArrowRight, FaPaperPlane, FaUser } from 'react-icons/fa';

const PrivateChat = () => {
    const { t, i18n } = useTranslation();
    const { userId } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useInvitations();
    const [message, setMessage] = useState('');
    const chatEndRef = useRef(null);

    // Mock user data - في التطبيق الحقيقي، سيتم جلبها من API
    const otherUser = {
        id: userId,
        name: userId === 'user_1' ? 'أحمد محمد' : 'سارة علي',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
        isOnline: true
    };

    // Mock chat messages - في التطبيق الحقيقي، سيتم جلبها من API
    const [messages, setMessages] = useState([
        {
            id: 1,
            senderId: userId,
            senderName: otherUser.name,
            text: i18n.language === 'ar' ? 'مرحباً! كيف حالك؟' : 'Hello! How are you?',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            isRead: true
        },
        {
            id: 2,
            senderId: currentUser.id,
            senderName: currentUser.name,
            text: i18n.language === 'ar' ? 'الحمدلله، بخير. وأنت؟' : "I'm good, thanks! And you?",
            timestamp: new Date(Date.now() - 3000000).toISOString(),
            isRead: true
        },
        {
            id: 3,
            senderId: userId,
            senderName: otherUser.name,
            text: i18n.language === 'ar' ? 'بخير، شكراً. هل أنت مهتم بالدعوة القادمة؟' : "I'm great! Are you interested in the upcoming invitation?",
            timestamp: new Date(Date.now() - 1800000).toISOString(),
            isRead: true
        }
    ]);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!message.trim()) return;

        const newMessage = {
            id: messages.length + 1,
            senderId: currentUser.id,
            senderName: currentUser.name,
            text: message,
            timestamp: new Date().toISOString(),
            isRead: false
        };

        setMessages([...messages, newMessage]);
        setMessage('');
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return i18n.language === 'ar' ? 'الآن' : 'Now';
        if (diffMins < 60) return `${diffMins} ${i18n.language === 'ar' ? 'د' : 'm'}`;
        if (diffHours < 24) return `${diffHours} ${i18n.language === 'ar' ? 'س' : 'h'}`;
        if (diffDays < 7) return `${diffDays} ${i18n.language === 'ar' ? 'ي' : 'd'}`;

        return date.toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', {
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-body)'
        }}>
            {/* Header */}
            <header style={{
                background: 'rgba(15, 23, 42, 0.95)',
                backdropFilter: 'blur(25px)',
                padding: '1rem 1.5rem',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                position: 'sticky',
                top: 0,
                zIndex: 100
            }}>
                <button
                    onClick={() => navigate('/followers')}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        padding: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <FaArrowRight style={i18n.language === 'ar' ? {} : { transform: 'rotate(180deg)' }} />
                </button>

                {/* User Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <div style={{ position: 'relative' }}>
                        <div style={{
                            width: '45px',
                            height: '45px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            border: '2px solid var(--primary)'
                        }}>
                            <img
                                src={otherUser.avatar}
                                alt={otherUser.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        </div>
                        {otherUser.isOnline && (
                            <div style={{
                                position: 'absolute',
                                bottom: '2px',
                                right: '2px',
                                width: '12px',
                                height: '12px',
                                background: '#10b981',
                                border: '2px solid var(--bg-body)',
                                borderRadius: '50%'
                            }}></div>
                        )}
                    </div>
                    <div>
                        <div style={{ fontSize: '1rem', fontWeight: '800', color: 'white' }}>
                            {otherUser.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {otherUser.isOnline
                                ? (i18n.language === 'ar' ? 'متصل الآن' : 'Online now')
                                : (i18n.language === 'ar' ? 'غير متصل' : 'Offline')}
                        </div>
                    </div>
                </div>

                {/* Profile Button */}
                <button
                    onClick={() => navigate(`/profile/${userId}`)}
                    style={{
                        background: 'rgba(139, 92, 246, 0.15)',
                        border: '1px solid var(--primary)',
                        color: 'var(--primary)',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    <FaUser style={{ fontSize: '0.7rem' }} />
                    {i18n.language === 'ar' ? 'البروفايل' : 'Profile'}
                </button>
            </header>

            {/* Chat Messages */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
            }}>
                {/* Info Banner */}
                <div style={{
                    background: 'rgba(139, 92, 246, 0.1)',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                    borderRadius: '12px',
                    padding: '12px',
                    textAlign: 'center',
                    marginBottom: '1rem'
                }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                        💬 {i18n.language === 'ar'
                            ? 'دردشة خاصة مع متابع متبادل'
                            : 'Private chat with mutual follower'}
                    </div>
                </div>

                {messages.map((msg) => {
                    const isMe = msg.senderId === currentUser.id;
                    return (
                        <div
                            key={msg.id}
                            style={{
                                display: 'flex',
                                justifyContent: isMe ? 'flex-end' : 'flex-start',
                                marginBottom: '8px'
                            }}
                        >
                            <div style={{
                                maxWidth: '75%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: isMe ? 'flex-end' : 'flex-start'
                            }}>
                                {!isMe && (
                                    <div style={{
                                        fontSize: '0.7rem',
                                        color: 'var(--text-muted)',
                                        marginBottom: '4px',
                                        paddingLeft: '12px',
                                        fontWeight: '600'
                                    }}>
                                        {msg.senderName}
                                    </div>
                                )}
                                <div style={{
                                    background: isMe
                                        ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)'
                                        : 'var(--bg-card)',
                                    color: 'white',
                                    padding: '12px 16px',
                                    borderRadius: isMe
                                        ? '18px 18px 4px 18px'
                                        : '18px 18px 18px 4px',
                                    border: isMe ? 'none' : '1px solid var(--border-color)',
                                    boxShadow: isMe
                                        ? '0 4px 12px rgba(139, 92, 246, 0.3)'
                                        : 'none',
                                    wordWrap: 'break-word'
                                }}>
                                    <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                                        {msg.text}
                                    </div>
                                </div>
                                <div style={{
                                    fontSize: '0.65rem',
                                    color: 'var(--text-muted)',
                                    marginTop: '4px',
                                    paddingLeft: isMe ? '0' : '12px',
                                    paddingRight: isMe ? '12px' : '0',
                                    fontWeight: '600'
                                }}>
                                    {formatTime(msg.timestamp)}
                                    {isMe && msg.isRead && ' ✓✓'}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={chatEndRef} />
            </div>

            {/* Message Input */}
            <form
                onSubmit={handleSendMessage}
                style={{
                    background: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(25px)',
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center'
                }}
            >
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={i18n.language === 'ar' ? 'اكتب رسالة...' : 'Type a message...'}
                    style={{
                        flex: 1,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '24px',
                        padding: '12px 20px',
                        color: 'white',
                        fontSize: '0.9rem',
                        outline: 'none'
                    }}
                />
                <button
                    type="submit"
                    disabled={!message.trim()}
                    style={{
                        background: message.trim()
                            ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)'
                            : 'var(--bg-card)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '48px',
                        height: '48px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: message.trim() ? 'pointer' : 'not-allowed',
                        boxShadow: message.trim()
                            ? '0 4px 12px rgba(139, 92, 246, 0.4)'
                            : 'none',
                        transition: 'all 0.3s',
                        opacity: message.trim() ? 1 : 0.5
                    }}
                >
                    <FaPaperPlane style={{ fontSize: '1rem' }} />
                </button>
            </form>
        </div>
    );
};

export default PrivateChat;
