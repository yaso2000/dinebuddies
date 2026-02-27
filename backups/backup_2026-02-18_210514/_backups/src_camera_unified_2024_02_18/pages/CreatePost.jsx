import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { uploadImage } from '../utils/imageUpload';
import { FaArrowLeft, FaImage, FaVideo, FaSmile, FaTimes, FaFont, FaPalette, FaCircle, FaFileUpload, FaBold, FaItalic, FaAlignLeft, FaAlignCenter, FaAlignRight } from 'react-icons/fa';
import UnifiedCamera from '../components/UnifiedCamera';
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
    const location = useLocation();
    const { t } = useTranslation();
    const { currentUser, userProfile } = useAuth();

    // State
    const [text, setText] = useState('');
    const [media, setMedia] = useState(null);
    const [attachedInvitation, setAttachedInvitation] = useState(location.state?.attachedInvitation || null);

    const [overlayText, setOverlayText] = useState('');
    const [fontIndex, setFontIndex] = useState(0);
    const [hasStroke, setHasStroke] = useState(true);
    const [loading, setLoading] = useState(false);
    const [showOverlayInput, setShowOverlayInput] = useState(false);
    const [showQuickReactions, setShowQuickReactions] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);


    // Text Editor State
    const [showTextTools, setShowTextTools] = useState(true);
    const [fontSize, setFontSize] = useState(16);
    const [textAlign, setTextAlign] = useState('left');
    const [isBold, setIsBold] = useState(false);
    const [isItalic, setIsItalic] = useState(false);
    const [textColor, setTextColor] = useState(''); // Empty string = Auto/Smart Color
    const [bgColor, setBgColor] = useState('transparent');
    const [selectedFont, setSelectedFont] = useState(0);

    const COLORS = ['', '#ffffff', '#000000', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
    const BG_COLORS = ['transparent', '#1f2937', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4499'];

    // Camera State
    // Camera State
    const [showCamera, setShowCamera] = useState(false);


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

    const startCamera = () => {
        setShowCamera(true);
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
        if ((!text.trim() && !media && !attachedInvitation) || loading) return;
        setLoading(true);

        try {
            let mediaUrl = null;
            let mediaType = media?.type || null;

            if (media?.file) {
                // Use 'community-posts' path to avoid potential conflicts with invitation rules
                const path = `community-posts/${currentUser.uid}/post_${Date.now()}_${media.file.name}`;
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
                attachedInvitation: attachedInvitation ? {
                    id: attachedInvitation.id,
                    title: attachedInvitation.title,
                    date: attachedInvitation.date,
                    time: attachedInvitation.time,
                    location: attachedInvitation.location,
                    image: attachedInvitation.videoThumbnail || attachedInvitation.image || attachedInvitation.restaurantImage || attachedInvitation.customImage || null,
                    author: attachedInvitation.author
                } : null,
                textStyle: {
                    fontSize: fontSize,
                    textAlign: textAlign,
                    fontWeight: isBold ? 'bold' : 'normal',
                    fontStyle: isItalic ? 'italic' : 'normal',
                    color: textColor || 'var(--text-main)',
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
                reposts: [],
                // Attach User Location (City/Country) automatically
                location: userProfile?.location || null,
                city: userProfile?.city || null,
                country: userProfile?.country || null,
                coordinates: userProfile?.coordinates || null,
                // Fallback: If attached invitation has location, we might want to mirror it here or prioritize user location? 
                // User said "reference is user location", so we stick to userProfile.
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
                    <button onClick={() => { navigate(-1); }} className="icon-btn">
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
                    disabled={(!text.trim() && !media && !attachedInvitation) || loading}
                    style={{
                        background: 'var(--primary)', color: 'white', border: 'none',
                        padding: '8px 20px', borderRadius: '20px', fontWeight: 'bold',
                        opacity: (!text.trim() && !media && !attachedInvitation) || loading ? 0.5 : 1
                    }}
                >
                    {loading ? 'Posting...' : 'Post'}
                </button>
            </div>

            {/* Main Content (Scrollable) */}
            <div style={{ flex: 1, padding: '16px', paddingBottom: '120px', overflowY: 'auto' }}>

                {/* Content Card (Text + Media) */}
                <div style={{
                    border: '1px solid var(--border-color)',
                    backgroundColor: bgColor === 'transparent' ? 'transparent' : bgColor, // Explicit transparent handling
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
                            color: textColor || 'var(--text-main)', // Use smart color if empty
                            caretColor: textColor || 'var(--text-main)',
                            '--dynamic-text-color': textColor || 'var(--text-main)',
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

                    {/* ATTACHED INVITATION PREVIEW */}
                    {attachedInvitation && (
                        <div style={{
                            marginTop: '12px',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            position: 'relative',
                            background: 'var(--bg-main)'
                        }}>
                            <button
                                onClick={() => setAttachedInvitation(null)}
                                style={{
                                    position: 'absolute', top: '8px', right: '8px', zIndex: 20,
                                    background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none',
                                    borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer'
                                }}
                            >
                                <FaTimes />
                            </button>

                            {/* Simple Preview */}
                            <div style={{ display: 'flex', gap: '12px', padding: '12px', alignItems: 'center' }}>
                                <img
                                    src={attachedInvitation.videoThumbnail || attachedInvitation.image || attachedInvitation.restaurantImage || attachedInvitation.customImage || 'https://via.placeholder.com/150'}
                                    style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover' }}
                                />
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{attachedInvitation.title}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>📅 {attachedInvitation.date} • ⏰ {attachedInvitation.time}</div>
                                </div>
                            </div>
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
                    gap: '5px',
                    flexWrap: 'nowrap', // Ensure single row
                    overflowX: 'auto', // Scroll if needed on very small screens
                    alignItems: 'center',
                    marginBottom: '20px',
                    scrollbarWidth: 'none', // Hide scrollbar for cleaner look
                    msOverflowStyle: 'none'
                }}>

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} className="create-post-emoji-wrapper">
                        <button
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            style={{
                                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                color: '#1d9bf0', padding: '6px 10px', borderRadius: '20px', fontSize: '0.85rem',
                                display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 'bold',
                                whiteSpace: 'nowrap', flexShrink: 0
                            }}
                        >
                            <FaSmile size={16} /> Emoji
                        </button>
                        {showEmojiPicker && (
                            <div style={{
                                position: 'fixed',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                zIndex: 10002,
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                                borderRadius: '12px',
                                padding: '12px',
                                width: '90%',
                                maxWidth: '320px',
                                maxHeight: '150px', // Limit to approx 3 lines
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
                                                transition: 'background 0.2s',
                                                flexShrink: 0
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                                    <button
                                        onClick={() => setShowEmojiPicker(false)}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem' }}
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Photo Upload */}
                    <button
                        onClick={() => fileInputRef.current.click()}
                        style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                            color: '#1d9bf0', padding: '6px 10px', borderRadius: '20px', fontSize: '0.85rem',
                            display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 'bold',
                            whiteSpace: 'nowrap', flexShrink: 0
                        }}
                    >
                        <FaImage size={16} /> Photo
                    </button>

                    {/* Video Upload */}
                    <button
                        onClick={() => videoUploadRef.current.click()}
                        style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                            color: '#1d9bf0', padding: '6px 10px', borderRadius: '20px', fontSize: '0.85rem',
                            display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 'bold',
                            whiteSpace: 'nowrap', flexShrink: 0
                        }}
                    >
                        <FaVideo size={16} /> Video
                    </button>

                    {/* Camera Recording */}
                    <button
                        onClick={startCamera}
                        style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                            color: '#ef4444', padding: '6px 10px', borderRadius: '20px', fontSize: '0.85rem',
                            display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 'bold',
                            whiteSpace: 'nowrap', flexShrink: 0
                        }}
                    >
                        <FaCircle size={14} /> Record
                    </button>
                </div>

                {/* Text Formatting Panel (Always Visible) */}
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
                    {/* Section 1: Size */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                        <span style={{ fontSize: '0.8rem', opacity: 0.7, minWidth: '30px' }}>Size</span>
                        <input
                            type="range" min="12" max="48" value={fontSize}
                            onChange={(e) => setFontSize(parseInt(e.target.value))}
                            style={{ flex: 1, accentColor: 'var(--primary)' }}
                        />
                        <span style={{ fontSize: '0.9rem', minWidth: '35px', textAlign: 'right' }}>{fontSize}px</span>
                    </div>

                    {/* Section 2: Style & Align */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setIsBold(!isBold)} style={{ fontWeight: 'bold', padding: '8px 12px', borderRadius: '8px', background: isBold ? 'var(--primary)' : 'var(--bg-main)', color: isBold ? 'white' : 'inherit', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><FaBold /></button>
                            <button onClick={() => setIsItalic(!isItalic)} style={{ fontStyle: 'italic', padding: '8px 12px', borderRadius: '8px', background: isItalic ? 'var(--primary)' : 'var(--bg-main)', color: isItalic ? 'white' : 'inherit', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><FaItalic /></button>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setTextAlign('left')} style={{ padding: '8px 12px', borderRadius: '8px', background: textAlign === 'left' ? 'var(--primary)' : 'var(--bg-main)', color: textAlign === 'left' ? 'white' : 'inherit', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><FaAlignLeft /></button>
                            <button onClick={() => setTextAlign('center')} style={{ padding: '8px 12px', borderRadius: '8px', background: textAlign === 'center' ? 'var(--primary)' : 'var(--bg-main)', color: textAlign === 'center' ? 'white' : 'inherit', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><FaAlignCenter /></button>
                            <button onClick={() => setTextAlign('right')} style={{ padding: '8px 12px', borderRadius: '8px', background: textAlign === 'right' ? 'var(--primary)' : 'var(--bg-main)', color: textAlign === 'right' ? 'white' : 'inherit', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><FaAlignRight /></button>
                        </div>
                    </div>

                    {/* Section 2: Font Family */}
                    <div style={{ overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
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
                        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                            {COLORS.map(c => (
                                <button
                                    key={c}
                                    onClick={() => setTextColor(c)}
                                    style={{
                                        width: '24px', height: '24px', borderRadius: '50%',
                                        background: c === '' ? 'linear-gradient(135deg, #ffffff 50%, #000000 50%)' : c, // Split circle for Auto
                                        border: textColor === c ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                        cursor: 'pointer', flexShrink: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}
                                    title={c === '' ? "Auto (Theme Adaptive)" : c}
                                >
                                    {c === '' && textColor === '' && <div style={{ w: '6px', h: '6px', borderRadius: '50%', bg: 'var(--primary)' }} />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Section 4: Background Color */}
                    <div>
                        <div style={{ fontSize: '0.8rem', marginBottom: '8px', opacity: 0.7 }}>Background Color</div>
                        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
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
            </div>

            {/* CAMERA OVERLAY */}
            {showCamera && (
                <UnifiedCamera
                    stopCamera={() => setShowCamera(false)}
                    onMediaCaptured={(file, previewUrl, type) => {
                        setMedia({ file, preview: previewUrl, type });
                        setShowOverlayInput(true);
                    }}
                    mode="both" // Allow both photo and video
                />
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
