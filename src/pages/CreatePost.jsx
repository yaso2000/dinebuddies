import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { uploadImage } from '../utils/imageUpload';
import { FaArrowLeft, FaImage, FaVideo, FaSmile, FaTimes, FaFont, FaPalette, FaCircle, FaStopCircle, FaFileUpload } from 'react-icons/fa';
import EmojiPicker from 'emoji-picker-react';
import './CreatePost.css';

const FONTS = [
    { name: 'Modern', family: '"Inter", sans-serif' },
    { name: 'Classic', family: '"Playfair Display", serif' },
    { name: 'Bold', family: '"Impact", sans-serif' },
    { name: 'Typewriter', family: '"Courier New", monospace' }
];

const CreatePost = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { currentUser, userProfile } = useAuth();

    // State
    const [text, setText] = useState('');
    const [media, setMedia] = useState(null);
    const [overlayText, setOverlayText] = useState('');
    const [fontIndex, setFontIndex] = useState(0);
    const [hasStroke, setHasStroke] = useState(true);
    const [loading, setLoading] = useState(false);
    const [showOverlayInput, setShowOverlayInput] = useState(false);
    const [showQuickReactions, setShowQuickReactions] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Camera State
    const [showCamera, setShowCamera] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);

    const fileInputRef = useRef(null);
    // We keep a video input for fallback upload
    const videoUploadRef = useRef(null);

    // Fetch fresh user profile
    const [authorInfo, setAuthorInfo] = useState({
        name: currentUser?.displayName || 'User',
        avatar: currentUser?.photoURL || ''
    });

    useEffect(() => {
        if (currentUser?.uid) {
            getDoc(doc(db, 'users', currentUser.uid)).then(snap => {
                if (snap.exists()) {
                    const data = snap.data();
                    setAuthorInfo({
                        name: data.displayName || data.name || data.businessInfo?.businessName || currentUser.displayName || 'User',
                        avatar: data.photoURL || data.avatar || data.businessInfo?.logo || currentUser.photoURL || ''
                    });
                }
            });
        }
    }, [currentUser]);

    // Cleanup stream on unmount
    useEffect(() => {
        return () => {
            stopCameraStream();
        };
    }, []);

    // Close emoji picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.emoji-container')) {
                setShowQuickReactions(false);
                setShowEmojiPicker(false);
            }
        };

        if (showQuickReactions || showEmojiPicker) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showQuickReactions, showEmojiPicker]);

    // NEW: Effect to attach stream when Camera UI opens
    useEffect(() => {
        if (showCamera && streamRef.current && videoRef.current) {
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.play().catch(e => console.log("Play error:", e));
        }
    }, [showCamera]);

    const stopCameraStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            streamRef.current = stream;
            setShowCamera(true); // This triggers render -> Effect attaches stream
        } catch (err) {
            console.error("Camera Error:", err);
            alert("Could not access camera. Please allow permissions or use upload.");
        }
    };

    const startRecording = () => {
        if (!streamRef.current) return;

        chunksRef.current = [];
        const recorder = new MediaRecorder(streamRef.current);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            const file = new File([blob], "recorded-video.webm", { type: 'video/webm' });
            // Validate duration is rough, but we limited recording time
            setMedia({ file, preview: URL.createObjectURL(blob), type: 'video' });
            setShowCamera(false);
            setShowOverlayInput(true);
            stopCameraStream();
        };

        recorder.start();
        setIsRecording(true);
        setRecordingTime(0);

        timerRef.current = setInterval(() => {
            setRecordingTime(prev => {
                if (prev >= 30) {
                    stopRecording(); // Auto stop at 30s
                    return 30;
                }
                return prev + 1;
            });
        }, 1000);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const type = file.type.startsWith('video/') ? 'video' : 'image';

        if (type === 'video') {
            const videoEl = document.createElement('video');
            videoEl.preload = 'metadata';
            videoEl.onloadedmetadata = () => {
                window.URL.revokeObjectURL(videoEl.src);
                if (videoEl.duration > 31) {
                    alert("Video too long. Max 30s.");
                    e.target.value = null;
                    return;
                }
                setMedia({ file, preview: URL.createObjectURL(file), type });
            };
            videoEl.src = URL.createObjectURL(file);
        } else {
            setMedia({ file, preview: URL.createObjectURL(file), type });
        }
        setShowOverlayInput(true);
    };

    const handleSubmit = async () => {
        if ((!text.trim() && !media) || loading) return;
        setLoading(true);

        try {
            let mediaUrl = null;
            let mediaType = media?.type || null;

            if (media?.file) {
                // Use 'invitations' path as it has the correct permissions for video uploads in Storage Rules
                const path = `invitations/${currentUser.uid}/post_${Date.now()}_${media.file.name}`;
                mediaUrl = await uploadImage(media.file, path);
            }

            const postData = {
                author: {
                    id: currentUser.uid,
                    name: authorInfo.name,
                    avatar: authorInfo.avatar
                },
                content: text.trim(),
                mediaUrl: mediaUrl,
                mediaType: mediaType,
                overlayText: overlayText.trim(),
                overlayStyle: overlayText.trim() ? {
                    fontFamily: FONTS[fontIndex].family,
                    hasStroke: hasStroke,
                    color: '#ffffff'
                } : null,
                createdAt: serverTimestamp(),
                likes: [],
                comments: [],
                reposts: []
            };

            await addDoc(collection(db, 'communityPosts'), postData);
            navigate('/');
        } catch (error) {
            console.error("Error creating post:", error);
            alert("Failed to post.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-post-container" style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'var(--bg-body)', display: 'flex', flexDirection: 'column'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderBottom: '1px solid var(--border-color)',
                background: 'var(--bg-card)'
            }}>
                <button onClick={() => { stopCameraStream(); navigate(-1); }} className="icon-btn">
                    <FaArrowLeft />
                </button>
                <div style={{ fontWeight: 'bold' }}>New Post</div>
                <button
                    onClick={handleSubmit}
                    disabled={(!text.trim() && !media) || loading}
                    style={{
                        background: 'var(--primary)', color: 'white', border: 'none',
                        padding: '8px 20px', borderRadius: '20px', fontWeight: 'bold',
                        opacity: (!text.trim() && !media) || loading ? 0.5 : 1
                    }}
                >
                    {loading ? 'Posting...' : 'Post'}
                </button>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{
                        width: '48px', height: '48px', borderRadius: '50%',
                        background: `url(${authorInfo.avatar}) center/cover`,
                        backgroundColor: '#ccc', flexShrink: 0
                    }} />
                    <div style={{ flex: 1 }}>
                        <textarea
                            className="post-textarea"
                            placeholder="What's happening?"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            style={{
                                width: '100%', border: 'none', background: 'transparent',
                                resize: 'none', minHeight: '80px',
                                fontSize: '1.2rem', color: 'var(--text-main)',
                                outline: 'none', fontFamily: 'inherit', marginBottom: '16px'
                            }}
                        />

                        {/* Toolbar Buttons */}
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', paddingBottom: '12px' }}>
                            <button
                                onClick={() => fileInputRef.current.click()}
                                style={{
                                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                    color: '#1d9bf0', padding: '8px 16px', borderRadius: '20px',
                                    display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold'
                                }}
                            >
                                <FaImage size={18} /> Photo
                            </button>

                            <button
                                onClick={startCamera}
                                style={{
                                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                    color: '#1d9bf0', padding: '8px 16px', borderRadius: '20px',
                                    display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold'
                                }}
                            >
                                <FaVideo size={18} /> Video
                            </button>

                            {/* Emoji Button */}
                            <div style={{ position: 'relative' }} className="emoji-container">
                                <button
                                    onClick={() => {
                                        setShowQuickReactions(!showQuickReactions);
                                        setShowEmojiPicker(false);
                                    }}
                                    style={{
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '50%',
                                        width: '32px',
                                        height: '32px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        position: 'relative',
                                        color: '#888'
                                    }}
                                >
                                    <FaSmile size={16} />
                                    <span style={{
                                        position: 'absolute',
                                        top: '-2px',
                                        right: '-2px',
                                        background: '#888',
                                        color: 'white',
                                        width: '12px',
                                        height: '12px',
                                        borderRadius: '50%',
                                        fontSize: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 'bold'
                                    }}>+</span>
                                </button>

                                {/* Quick Reactions */}
                                {showQuickReactions && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '40px',
                                        right: '0',
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '30px',
                                        padding: '8px 12px',
                                        display: 'flex',
                                        gap: '8px',
                                        alignItems: 'center',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                        zIndex: 10
                                    }}>
                                        {['❤️', '😊', '😂', '😮', '😢', '👍'].map((emoji, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    setText(prev => prev + emoji);
                                                    setShowQuickReactions(false);
                                                }}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    fontSize: '24px',
                                                    cursor: 'pointer',
                                                    padding: '4px',
                                                    transition: 'transform 0.2s',
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.3)'}
                                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => {
                                                setShowEmojiPicker(true);
                                                setShowQuickReactions(false);
                                            }}
                                            style={{
                                                background: 'var(--border-color)',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: '28px',
                                                height: '28px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                fontSize: '16px',
                                                fontWeight: 'bold',
                                                color: 'var(--text-main)'
                                            }}
                                        >
                                            +
                                        </button>
                                    </div>
                                )}

                                {/* Full Emoji Picker */}
                                {showEmojiPicker && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '40px',
                                        right: '0',
                                        zIndex: 20,
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                                        borderRadius: '12px',
                                        overflow: 'hidden'
                                    }}>
                                        <EmojiPicker
                                            onEmojiClick={(emojiObject) => {
                                                setText(prev => prev + emojiObject.emoji);
                                                setShowEmojiPicker(false);
                                            }}
                                            width="320px"
                                            height="400px"
                                            theme={document.body.classList.contains('light-theme') ? 'light' : 'dark'}
                                            searchPlaceholder={t('search_emoji')}
                                            previewConfig={{ showPreview: false }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Media Preview & Overlay */}
                {media && (
                    <div style={{ marginTop: '20px', position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <button
                            onClick={() => { setMedia(null); setOverlayText(''); }}
                            style={{
                                position: 'absolute', top: '8px', right: '8px', zIndex: 20,
                                background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none',
                                borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            <FaTimes />
                        </button>

                        {media.type === 'video' ? (
                            <video src={media.preview} autoPlay muted loop style={{ width: '100%', display: 'block' }} />
                        ) : (
                            <img src={media.preview} alt="Preview" style={{ width: '100%', display: 'block' }} />
                        )}

                        {/* Overlay Caption Display */}
                        {overlayText && (
                            <div style={{
                                position: 'absolute', inset: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '20px', pointerEvents: 'none'
                            }}>
                                <span style={{
                                    fontFamily: FONTS[fontIndex].family, color: 'white',
                                    fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'center',
                                    WebkitTextStroke: hasStroke ? '1px black' : 'none',
                                    textShadow: hasStroke ? '2px 2px 0 #000' : '0 2px 4px rgba(0,0,0,0.5)',
                                    whiteSpace: 'pre-wrap'
                                }}>
                                    {overlayText}
                                </span>
                            </div>
                        )}

                        {/* Overlay Controls */}
                        {showOverlayInput && (
                            <div style={{
                                position: 'absolute', bottom: '16px', left: '16px', right: '16px',
                                background: 'rgba(0,0,0,0.7)', padding: '12px', borderRadius: '12px', zIndex: 10
                            }}>
                                <input
                                    type="text" value={overlayText} onChange={(e) => setOverlayText(e.target.value)}
                                    placeholder="Caption..."
                                    style={{
                                        width: '100%', background: 'transparent', border: 'none',
                                        color: 'white', fontSize: '1rem', outline: 'none', marginBottom: '8px'
                                    }}
                                />
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button onClick={() => setFontIndex((p) => (p + 1) % FONTS.length)} style={{ background: 'none', border: 'none', color: 'white' }}>
                                        <FaFont /> {FONTS[fontIndex].name}
                                    </button>
                                    <button onClick={() => setHasStroke(!hasStroke)} style={{ background: 'none', border: 'none', color: hasStroke ? '#22c55e' : 'white' }}>
                                        <FaPalette /> Stroke
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* CAMERA OVERLAY */}
            {showCamera && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 10000,
                    background: 'black', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                }}>
                    {/* Camera View */}
                    <div style={{ position: 'relative', width: '100%', height: '100%', maxWidth: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />

                        {/* Camera Controls */}
                        <div style={{
                            position: 'absolute', bottom: '150px', left: 0, right: 0,
                            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '30px'
                        }}>
                            {/* Upload Fallback inside Camera */}
                            <button
                                onClick={() => { setShowCamera(false); stopCameraStream(); videoUploadRef.current.click(); }}
                                style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', padding: '12px', border: 'none', color: 'white' }}
                                title="Upload instead"
                            >
                                <FaFileUpload size={24} />
                            </button>

                            {/* Record Button */}
                            <button
                                onClick={isRecording ? stopRecording : startRecording}
                                style={{
                                    width: '72px', height: '72px', borderRadius: '50%',
                                    background: isRecording ? 'transparent' : 'red',
                                    border: isRecording ? '4px solid red' : '4px solid white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                            >
                                {isRecording && <div style={{ width: '32px', height: '32px', background: 'red', borderRadius: '4px' }} />}
                            </button>

                            {/* Close Camera */}
                            <button
                                onClick={() => { setShowCamera(false); stopCameraStream(); }}
                                style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', padding: '12px', border: 'none', color: 'white' }}
                                title="Close Camera"
                            >
                                <FaTimes size={24} />
                            </button>
                        </div>

                        {/* Timer */}
                        {isRecording && (
                            <div style={{
                                position: 'absolute', top: '20px',
                                background: 'red', color: 'white', padding: '4px 12px', borderRadius: '12px', fontWeight: 'bold'
                            }}>
                                00:{recordingTime < 10 ? `0${recordingTime}` : recordingTime} / 00:30
                            </div>
                        )}
                    </div>
                </div>
            )}

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                style={{ display: 'none' }}
            />
            {/* Fallback Video Upload */}
            <input
                type="file"
                ref={videoUploadRef}
                onChange={handleFileSelect}
                accept="video/*"
                style={{ display: 'none' }}
            />
        </div>
    );
};

export default CreatePost;
