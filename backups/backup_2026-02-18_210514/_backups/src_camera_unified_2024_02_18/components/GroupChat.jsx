import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { FaPaperPlane, FaMicrophone, FaTrash, FaExpand, FaCompress, FaArrowDown, FaPause, FaPlay, FaArrowLeft } from 'react-icons/fa';
import { startRecording, uploadVoiceMessage, formatDuration } from '../utils/mediaUtils';
import '../pages/CommunityChatRoom.css'; // Use the shared CSS for consistent look

const GroupChat = ({ collectionPath, height = '500px' }) => {
    const { currentUser, userProfile } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [showScrollBottom, setShowScrollBottom] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);

    // Audio Playback State
    const [playingAudioId, setPlayingAudioId] = useState(null);
    const audioRef = useRef(new Audio());

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingRef = useRef(null);
    const timerRef = useRef(null);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Initial scroll state
    const [initialScrollDone, setInitialScrollDone] = useState(false);

    // Cleanup Audio on Unmount
    useEffect(() => {
        return () => {
            audioRef.current.pause();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    // Subscribe to messages
    useEffect(() => {
        if (!collectionPath) return;

        setLoading(true);
        const q = query(collection(db, collectionPath), orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(msgs);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching messages:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [collectionPath]);

    // Auto-scroll
    useEffect(() => {
        if (messages.length > 0) {
            if (!initialScrollDone || isFullScreen) {
                messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
                setInitialScrollDone(true);
            } else {
                // Only smooth scroll if we are already near bottom or it's a new message
                // strict check to avoid annoying jumps
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
        }
    }, [messages, initialScrollDone, isFullScreen]);

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
        setShowScrollBottom(!isNearBottom);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // --- Audio Handlers ---
    const handleStartRecording = async () => {
        try {
            const { stop } = await startRecording();
            recordingRef.current = stop;
            setIsRecording(true);
            setRecordingDuration(0);

            timerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } catch (error) {
            console.error("Failed to start recording:", error);
            alert("Could not access microphone.");
        }
    };

    const handleStopRecording = async (shouldSend = true) => {
        if (!recordingRef.current) return;

        clearInterval(timerRef.current);
        const audioBlob = await recordingRef.current();
        setIsRecording(false);
        setRecordingDuration(0);
        recordingRef.current = null;

        if (shouldSend && audioBlob) {
            await sendVoiceMessage(audioBlob);
        }
    };

    const sendVoiceMessage = async (audioBlob) => {
        try {
            const url = await uploadVoiceMessage(audioBlob, currentUser.uid);
            await addDoc(collection(db, collectionPath), {
                text: '',
                audioUrl: url,
                senderId: currentUser.uid,
                senderName: userProfile?.display_name || currentUser.displayName || 'User',
                senderAvatar: userProfile?.photo_url || currentUser.photoURL || '',
                createdAt: serverTimestamp(),
                type: 'audio',
                duration: recordingDuration
            });
        } catch (error) {
            console.error("Error sending voice:", error);
        }
    };

    const handlePlayAudio = (url, msgId) => {
        if (playingAudioId === msgId) {
            audioRef.current.pause();
            setPlayingAudioId(null);
        } else {
            audioRef.current.src = url;
            audioRef.current.play();
            setPlayingAudioId(msgId);
            audioRef.current.onended = () => setPlayingAudioId(null);
        }
    };

    const handleSendMessage = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!newMessage.trim()) return;

        const messageToSend = newMessage.trim(); // Capture before clearing
        setNewMessage(''); // Clear immediately for better UX

        // Refocus immediately to keep keyboard open on mobile
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
            }
        }, 10);

        try {
            await addDoc(collection(db, collectionPath), {
                text: messageToSend,
                senderId: currentUser.uid,
                senderName: userProfile?.display_name || currentUser.displayName || 'User',
                senderAvatar: userProfile?.photo_url || currentUser.photoURL || '',
                createdAt: serverTimestamp(),
                type: 'text'
            });
            scrollToBottom();
        } catch (error) {
            console.error("Error sending message:", error);
            setNewMessage(messageToSend); // Restore if failed
        } finally {
            // Ensure focus is kept/restored to keep keyboard open
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    };

    // --- Render Helpers ---
    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderBubbleContent = (msg) => {
        // Detect Links
        const urlRegex = /(https?:\/\/[^\s]+)/g;

        switch (msg.type) {
            case 'audio':
                const isPlaying = playingAudioId === msg.id;
                const circumference = 339.292; // Circle math for ring

                return (
                    <div className="voice-widget">
                        <div className="voice-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button className="voice-play-btn" onClick={() => handlePlayAudio(msg.audioUrl, msg.id)}>
                                {isPlaying ? (
                                    <FaPause color="var(--play-green)" size={14} />
                                ) : (
                                    <FaPlay color="var(--text-main)" size={14} />
                                )}
                            </button>
                            <div className="voice-time">{formatDuration(msg.duration || 0)}</div>
                        </div>
                    </div>
                );
            default:
                // Text with Link detection
                if (!msg.text) return null;
                const parts = msg.text.split(urlRegex);
                return (
                    <span>
                        {parts.map((part, i) =>
                            urlRegex.test(part) ? (
                                <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline' }}>{part}</a>
                            ) : (
                                <span key={i}>{part}</span>
                            )
                        )}
                    </span>
                );
        }
    };


    if (!currentUser) return <div style={{ padding: '20px', textAlign: 'center' }}>Please login to view chat</div>;

    // Styles for Full Screen vs Embedded
    const containerStyle = isFullScreen ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100dvh', // Force dynamic viewport height
        zIndex: 9999999, // Max z-index
        background: '#0b1220', // Solid background
        display: 'flex',
        flexDirection: 'column',
        margin: 0,
        padding: 0
    } : {
        height: height,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '16px',
        overflow: 'hidden'
    };

    return (
        <div className="group-chat-container" style={containerStyle}>
            {/* Header Control */}
            <div style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: isFullScreen ? 'rgba(20, 20, 30, 0.95)' : 'rgba(255,255,255,0.05)',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(10px)'
            }}>
                {isFullScreen ? (
                    <>
                        <button
                            onClick={() => setIsFullScreen(false)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '1rem',
                                fontWeight: '600'
                            }}
                        >
                            <FaArrowLeft /> Back
                        </button>
                        <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'white' }}>Group Chat</span>
                        <div style={{ width: '60px' }}></div> {/* Spacer for visual centering */}
                    </>
                ) : (
                    <>
                        <span style={{ fontSize: '0.9rem', color: '#9ca3af', fontWeight: '600' }}>Recent Messages</span>
                        <button
                            onClick={() => setIsFullScreen(true)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.8rem'
                            }}
                            title="Full Screen"
                        >
                            <FaExpand /> Full Screen
                        </button>
                    </>
                )}
            </div>

            {/* Messages Area - Using classes from CommunityChatRoom.css */}
            <div className="message-list" onScroll={handleScroll} style={{ flex: 1, padding: '15px' }}>
                {messages.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
                        <div style={{ fontSize: '2rem' }}>💬</div>
                        <p>Start the conversation!</p>
                    </div>
                ) : (
                    messages.map((msg, index) => {
                        const isMe = msg.senderId === currentUser.uid;
                        const prevMsg = messages[index - 1];
                        const isFirstOfGroup = !prevMsg || prevMsg.senderId !== msg.senderId;

                        return (
                            <div
                                key={msg.id}
                                className={`message-row ${isMe ? 'outgoing' : 'incoming'} ${isFirstOfGroup ? 'first-of-group' : ''}`}
                                style={{ marginTop: isFirstOfGroup ? '12px' : '2px' }}
                            >
                                {/* Avatar for Incoming */}
                                {!isMe && (
                                    <img
                                        src={msg.senderAvatar || `https://ui-avatars.com/api/?name=${msg.senderName}`}
                                        alt=""
                                        className="sender-avatar"
                                        style={{ visibility: isFirstOfGroup ? 'visible' : 'hidden' }}
                                    />
                                )}

                                {/* Bubble */}
                                <div className={`bubble ${msg.type === 'audio' ? 'audio-bubble' : ''}`}>
                                    {/* Sender Name for incoming (first of group) */}
                                    {!isMe && isFirstOfGroup && (
                                        <div style={{ fontSize: '0.7rem', color: '#a78bfa', marginBottom: '2px', fontWeight: 'bold' }}>
                                            {msg.senderName}
                                        </div>
                                    )}

                                    {renderBubbleContent(msg)}

                                    {/* Timestamp */}
                                    <span className="timestamp" style={{
                                        fontSize: '0.65rem',
                                        opacity: 0.7,
                                        marginLeft: '8px',
                                        float: 'right',
                                        marginTop: '4px'
                                    }}>
                                        {formatTime(msg.createdAt)}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />

                {showScrollBottom && (
                    <button
                        onClick={scrollToBottom}
                        style={{
                            position: 'absolute', bottom: '80px', right: '20px',
                            background: 'var(--primary)', color: 'white', border: 'none',
                            borderRadius: '50%', width: '35px', height: '35px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                        }}
                    >
                        <FaArrowDown />
                    </button>
                )}
            </div>

            {/* Input Area - Clean & Simple */}
            <div className="input-area" style={{ padding: '10px', background: 'var(--bg-secondary)' }}>
                <div className="input-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', borderRadius: '25px', padding: '5px 15px', border: '1px solid var(--border-color)', flex: 1 }}>
                    {isRecording ? (
                        <div className="recording-ui" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444' }}>
                                <FaMicrophone className="recording-pulse" />
                                <span>{formatDuration(recordingDuration)}</span>
                            </div>
                            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Recording...</span>
                            <button
                                onClick={() => handleStopRecording(false)} // Cancel
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <FaTrash />
                            </button>
                        </div>
                    ) : (
                        <input
                            ref={inputRef}
                            type="text"
                            className="message-input"
                            placeholder="Type a message..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(e)}
                            autoComplete="off"
                            style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', outline: 'none', padding: '10px 0' }}
                        />
                    )}
                </div>

                <button
                    type="button"
                    className="send-btn-circle"
                    // KEY FIX: Use onMouseDown instead of onClick to prevent button from stealing focus
                    // preventDefault() in onMouseDown stops the 'blur' event on the input
                    onMouseDown={(e) => {
                        e.preventDefault(); // This is the magic line that keeps keyboard open
                        if (isRecording) {
                            handleStopRecording(true);
                        } else {
                            handleSendMessage(e);
                        }
                    }}
                    style={{
                        width: '45px', height: '45px', borderRadius: '50%',
                        background: isRecording ? '#ef4444' : 'var(--primary)',
                        border: 'none', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', marginLeft: '8px'
                    }}
                >
                    {isRecording ? (
                        <FaPaperPlane />
                    ) : (
                        newMessage.trim() ? (
                            <FaPaperPlane style={{ marginLeft: '-2px' }} />
                        ) : (
                            <FaMicrophone onMouseDown={(e) => {
                                e.preventDefault(); // Also prevent blur on mic click
                                e.stopPropagation();
                                handleStartRecording();
                            }} />
                        )
                    )}
                </button>
            </div>
        </div>
    );
};

export default GroupChat;
