import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { uploadImage } from '../utils/imageUpload';
import { FaArrowLeft, FaImage, FaVideo, FaSmile, FaTimes, FaFont, FaPalette, FaCircle, FaStopCircle, FaFileUpload, FaBold, FaItalic, FaAlignLeft, FaAlignCenter, FaAlignRight } from 'react-icons/fa';
import './CreatePost.css';

const FONTS = [
    { name: 'Modern', family: '"Inter", sans-serif' },
    { name: 'Classic', family: '"Playfair Display", serif' },
    { name: 'Bold', family: '"Impact", sans-serif' },
    { name: 'Typewriter', family: '"Courier New", monospace' }
];

const CUSTOM_EMOJIS = [
    // Moods
    '😀', '😂', '🤣', '😍', '🥰', '😘', '😋', '😎', '🥳', '🤩', '😡', '😭', '😱', '🤔', '😴',
    // Food & Drink
    '🍔', '🍟', '🍕', '🌭', '🌮', '🌯', '🥗', '🍝', '🍜', '🍣', '🍤', '🍦', '🍩', '🍪', '🎂', '🍰', '🍫',
    '☕', '🍵', '🧋', '🍺', '🍷', '🥂', '🍹',
    // Celebration
    '🎈', '🎆', '🎁', '🎊', '🎉', '🕯️', '🎵', '🎶', '💃', '🕺'
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
    const [emojiPickerPosition, setEmojiPickerPosition] = useState('bottom');

    // Text Editor State
    const [showTextTools, setShowTextTools] = useState(false);
    const [fontSize, setFontSize] = useState(16);
    const [textAlign, setTextAlign] = useState('left');
    const [isBold, setIsBold] = useState(false);
    const [isItalic, setIsItalic] = useState(false);
    const [textColor, setTextColor] = useState('#ffffff');
    const [bgColor, setBgColor] = useState('transparent');
    const [selectedFont, setSelectedFont] = useState(0);

    const COLORS = ['#ffffff', '#000000', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
    const BG_COLORS = ['transparent', '#1f2937', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4499'];

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

    // Initialize author info from userProfile (Firestore) or currentUser (Auth)
    const [authorInfo, setAuthorInfo] = useState({
        name: userProfile?.display_name || userProfile?.name || userProfile?.businessInfo?.businessName || currentUser?.displayName || 'User',
        avatar: userProfile?.photo_url || userProfile?.photoURL || userProfile?.avatar || userProfile?.businessInfo?.logo || currentUser?.photoURL || ''
    });

    // Update author info when userProfile changes
    useEffect(() => {
        if (userProfile) {
            setAuthorInfo({
                name: userProfile.display_name || userProfile.name || userProfile.businessInfo?.businessName || currentUser?.displayName || 'User',
                avatar: userProfile.photo_url || userProfile.photoURL || userProfile.avatar || userProfile.businessInfo?.logo || currentUser?.photoURL || ''
            });
        } else if (currentUser?.uid) {
            // Fallback fetch if userProfile is not yet available in context
            getDoc(doc(db, 'users', currentUser.uid)).then(snap => {
                if (snap.exists()) {
                    const data = snap.data();
                    setAuthorInfo({
                        name: data.display_name || data.name || data.businessInfo?.businessName || currentUser.displayName || 'User',
                        avatar: data.photo_url || data.photoURL || data.avatar || data.businessInfo?.logo || currentUser.photoURL || ''
                    });
                }
            });
        }
    }, [currentUser, userProfile]);

    // Cleanup stream on unmount
    useEffect(() => {
        return () => {
            stopCameraStream();
        };
    }, []);

    // Close emoji picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.create-post-emoji-wrapper')) {
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
                textStyle: {
                    fontSize: fontSize,
                    textAlign: textAlign,
                    fontWeight: isBold ? 'bold' : 'normal',
                    fontStyle: isItalic ? 'italic' : 'normal',
                    color: textColor,
                    backgroundColor: bgColor,
                    fontFamily: FONTS[selectedFont].family
                },
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
                background: 'var(--bg-card)',
                flexShrink: 0,
                zIndex: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button onClick={() => { stopCameraStream(); navigate(-1); }} className="icon-btn">
                        <FaArrowLeft />
                    </button>
                    <img
                        src={authorInfo.avatar || currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.uid}`}
                        alt="Profile"
                        style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            objectFit: 'cover', backgroundColor: '#ccc', flexShrink: 0
                        }}
                    />
                </div>

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

            {/* Main Content (Scrollable) */}
            <div style={{ flex: 1, padding: '16px', paddingBottom: '120px', overflowY: 'auto' }}>

                {/* User Profile Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <img
                        src={authorInfo.avatar || currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.uid}`}
                        alt="Profile"
                        style={{
                            width: '46px', height: '46px', borderRadius: '50%', objectFit: 'cover',
                            border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)'
                        }}
                    />
                    <div>
                        <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '1rem' }}>
                            {authorInfo.name || currentUser?.displayName || 'User'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Public Post
                        </div>
                    </div>
                </div>

                {/* Content Card (Text + Media) */}
                <div style={{
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)',
                    backgroundColor: bgColor,
                    borderRadius: '12px',
                    padding: '12px',
                    marginBottom: '16px',
                    minHeight: '200px',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <textarea
                        className="post-textarea"
                        placeholder="What's happening?"
                        autoFocus
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        maxLength={Math.floor(4800 / fontSize)}
                        style={{
                            width: '100%',
                            border: 'none',
                            background: 'transparent',
                            resize: 'none',
                            minHeight: media ? '60px' : '150px', // Shrink text area if media is present
                            fontSize: `${fontSize}px`,
                            color: textColor,
                            '--dynamic-text-color': textColor,
                            textAlign: textAlign,
                            fontWeight: isBold ? 'bold' : 'normal',
                            fontStyle: isItalic ? 'italic' : 'normal',
                            fontFamily: FONTS[selectedFont].family,
                            outline: 'none',
                            marginBottom: '8px'
                        }}
                    />

                    {/* Media Display inside Card */}
                    {media && (
                        <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', marginTop: '8px' }}>
                            <button
                                onClick={() => { setMedia(null); setOverlayText(''); }}
                                style={{
                                    position: 'absolute', top: '8px', right: '8px', zIndex: 20,
                                    background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none',
                                    borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer'
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
                                        <button onClick={() => setFontIndex((p) => (p + 1) % FONTS.length)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <FaFont /> {FONTS[fontIndex].name}
                                        </button>
                                        <button onClick={() => setHasStroke(!hasStroke)} style={{ background: 'none', border: 'none', color: hasStroke ? '#22c55e' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <FaPalette /> Stroke
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{
                        textAlign: 'right',
                        fontSize: '0.85rem',
                        color: text.length >= Math.floor(4800 / fontSize) ? 'red' : ((bgColor === 'transparent' || bgColor === '#ffffff' || bgColor === '#f59e0b' || bgColor === '#ec4899') ? '#555' : 'rgba(255,255,255,0.7)'),
                        marginTop: '8px'
                    }}>
                        {text.length} / {Math.floor(4800 / fontSize)}
                    </div>
                </div>

                {/* Toolbar Buttons (Now below content card) */}
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap', // Allow wrapping to fit screen
                    alignItems: 'center',
                    marginBottom: '20px'
                }}>
                    <button
                        onClick={() => setShowTextTools(!showTextTools)}
                        style={{
                            background: showTextTools ? 'var(--primary)' : 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            color: showTextTools ? 'white' : '#1d9bf0',
                            padding: '8px 12px', borderRadius: '20px',
                            display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'bold',
                            whiteSpace: 'nowrap', flexShrink: 0
                        }}
                    >
                        <FaFont size={16} /> Text
                    </button>

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} className="create-post-emoji-wrapper">
                        <button
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const spaceBelow = window.innerHeight - rect.bottom;
                                // If space below is less than 320px (picker height + margin), show above
                                const position = spaceBelow < 320 ? 'top' : 'bottom';
                                setShowEmojiPicker(!showEmojiPicker);
                                // We store position in a state or just use a ref/variable, but here we can just set it dynamically
                                // Let's use a simple state for position
                                if (!showEmojiPicker) {
                                    setEmojiPickerPosition(position);
                                }
                            }}
                            style={{
                                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                color: '#1d9bf0', padding: '8px 12px', borderRadius: '20px',
                                display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'bold',
                                whiteSpace: 'nowrap', flexShrink: 0
                            }}
                        >
                            <FaSmile size={16} /> Emoji
                        </button>
                        {showEmojiPicker && (
                            <div style={{
                                position: 'absolute',
                                top: emojiPickerPosition === 'top' ? 'auto' : '45px',
                                bottom: emojiPickerPosition === 'top' ? '45px' : 'auto',
                                left: '-60px',
                                zIndex: 9999,
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                                borderRadius: '12px',
                                padding: '12px',
                                width: '300px',
                                maxHeight: '300px',
                                overflowY: 'auto'
                            }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                                    {CUSTOM_EMOJIS.map((emoji, index) => (
                                        <button
                                            key={index}
                                            onClick={() => {
                                                setText(prev => prev + emoji);
                                                // Don't close immediately to allow picking multiple
                                            }}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                fontSize: '1.5rem',
                                                cursor: 'pointer',
                                                padding: '4px',
                                                borderRadius: '8px',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => fileInputRef.current.click()}
                        style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                            color: '#1d9bf0', padding: '8px 12px', borderRadius: '20px',
                            display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'bold',
                            whiteSpace: 'nowrap', flexShrink: 0
                        }}
                    >
                        <FaImage size={16} /> Photo
                    </button>

                    <button
                        onClick={startCamera}
                        style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                            color: '#1d9bf0', padding: '8px 12px', borderRadius: '20px',
                            display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'bold',
                            whiteSpace: 'nowrap', flexShrink: 0
                        }}
                    >
                        <FaVideo size={16} /> Video
                    </button>
                </div>

                {/* Text Formatting Panel */}
                {showTextTools && (
                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                    }}>
                        {/* Section 1: Size, Style, Align */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="range" min="12" max="32" value={fontSize}
                                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                                    style={{ width: '100px' }}
                                />
                                <span style={{ fontSize: '0.9rem' }}>{fontSize}px</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => setIsBold(!isBold)} style={{ fontWeight: 'bold', padding: '6px 8px', borderRadius: '4px', background: isBold ? 'var(--primary)' : 'transparent', color: isBold ? 'white' : 'inherit', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><FaBold /></button>
                                <button onClick={() => setIsItalic(!isItalic)} style={{ fontStyle: 'italic', padding: '6px 8px', borderRadius: '4px', background: isItalic ? 'var(--primary)' : 'transparent', color: isItalic ? 'white' : 'inherit', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><FaItalic /></button>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => setTextAlign('left')} style={{ padding: '6px 8px', borderRadius: '4px', background: textAlign === 'left' ? 'var(--primary)' : 'transparent', color: textAlign === 'left' ? 'white' : 'inherit', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><FaAlignLeft /></button>
                                <button onClick={() => setTextAlign('center')} style={{ padding: '6px 8px', borderRadius: '4px', background: textAlign === 'center' ? 'var(--primary)' : 'transparent', color: textAlign === 'center' ? 'white' : 'inherit', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><FaAlignCenter /></button>
                                <button onClick={() => setTextAlign('right')} style={{ padding: '6px 8px', borderRadius: '4px', background: textAlign === 'right' ? 'var(--primary)' : 'transparent', color: textAlign === 'right' ? 'white' : 'inherit', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><FaAlignRight /></button>
                            </div>
                        </div>

                        {/* Section 2: Font Family */}
                        <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {FONTS.map((font, idx) => (
                                    <button
                                        key={font.name}
                                        onClick={() => setSelectedFont(idx)}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: '20px',
                                            border: selectedFont === idx ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                            background: 'transparent',
                                            color: 'inherit',
                                            fontFamily: font.family,
                                            whiteSpace: 'nowrap',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {font.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Section 3: Text Color */}
                        <div>
                            <div style={{ fontSize: '0.8rem', marginBottom: '8px', opacity: 0.7 }}>Text Color</div>
                            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                                {COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setTextColor(c)}
                                        style={{
                                            width: '24px', height: '24px', borderRadius: '50%',
                                            background: c,
                                            border: textColor === c ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                            cursor: 'pointer', flexShrink: 0
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Section 4: Background Color */}
                        <div>
                            <div style={{ fontSize: '0.8rem', marginBottom: '8px', opacity: 0.7 }}>Background Color</div>
                            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                                {BG_COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setBgColor(c)}
                                        style={{
                                            width: '24px', height: '24px', borderRadius: '50%',
                                            background: c,
                                            border: bgColor === c ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                            cursor: 'pointer', flexShrink: 0,
                                            position: 'relative'
                                        }}
                                    >
                                        {c === 'transparent' && (
                                            <div style={{
                                                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(45deg)',
                                                width: '1px', height: '20px', background: 'red'
                                            }} />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
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
