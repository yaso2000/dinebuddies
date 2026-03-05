import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaFont, FaPalette, FaTimes, FaPhotoVideo, FaSmile, FaCamera } from 'react-icons/fa';
import UnifiedCamera from '../components/UnifiedCamera';

import { uploadImage } from '../utils/imageUpload';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { getSafeAvatar } from '../utils/avatarUtils';
import './CreateStory.css';

const GRADIENTS = [
    { id: 'black', bg: '#000000', label: 'Black' },
    { id: 'white', bg: '#ffffff', label: 'White' },
    { id: 'classic', bg: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', label: 'Classic' },
    { id: 'purple', bg: 'linear-gradient(to bottom right, #8B5CF6, #3B82F6)', label: 'Galaxy' },
    { id: 'ocean', bg: 'linear-gradient(to bottom right, #00c6ff, #0072ff)', label: 'Ocean' },
    { id: 'sunset', bg: 'linear-gradient(to top right, #ff0844, #ffb199)', label: 'Sunset' },
    { id: 'neon', bg: 'linear-gradient(to right, #00f260, #0575e6)', label: 'Neon' },
    { id: 'gold', bg: 'linear-gradient(to right, #bf953f, #fcf6ba, #b38728, #fbf5b7, #aa771c)', label: 'Gold' }
];

const FONTS = [
    { id: 'modern', family: "'Outfit', sans-serif", label: 'Modern' },
    { id: 'typewriter', family: "'Courier New', monospace", label: 'Typewriter' },
    { id: 'hand', family: "'Comic Sans MS', cursive", label: 'Playful' },
    { id: 'bold', family: "Impact, sans-serif", label: 'Strong' },
];

const TEXT_COLORS = [
    '#ffffff', '#000000', '#ff0000', '#ffff00', '#00ff00', '#0000ff', '#800080'
];

const MOOD_EMOJIS = [
    '😄', '🥰', '🤤', '😋', '🥳', '🎂', '☕', '🍕', '🍔', '🥂', '🔥', '✨'
];

const CreateStory = () => {
    const navigate = useNavigate();
    const { currentUser, userProfile, loading: authLoading } = useAuth();

    // State — only GRADIENT or IMAGE (no VIDEO)
    const [backgroundType, setBackgroundType] = useState('GRADIENT'); // 'GRADIENT' | 'IMAGE'

    // Auth Loading Check
    if (authLoading) {
        return (<div className="loading-spinner" />);
    }

    const [mediaFile, setMediaFile] = useState(null);
    const [mediaPreview, setMediaPreview] = useState(null);

    // Text Overlay State
    const [text, setText] = useState('');
    const [isTextMode, setIsTextMode] = useState(true);
    const [bgIndex, setBgIndex] = useState(0);
    const [fontIndex, setFontIndex] = useState(0);
    const [textColor, setTextColor] = useState('#ffffff');
    const [textColorIndex, setTextColorIndex] = useState(0);
    const [showMoodPicker, setShowMoodPicker] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showCamera, setShowCamera] = useState(false);

    const fileInputRef = useRef(null);
    const moodPickerRef = useRef(null);

    // Click outside to close emoji picker
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (moodPickerRef.current && !moodPickerRef.current.contains(event.target)) {
                setShowMoodPicker(false);
            }
        };
        if (showMoodPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showMoodPicker]);

    // Access Control
    useEffect(() => {
        if (!authLoading && userProfile) {
            const role = (userProfile.role || '').toLowerCase();
            const isGuest = role === 'guest' || userProfile.isGuest;
            if (isGuest) {
                alert("Guests cannot post stories. Please sign up.");
                navigate('/');
            }
        }
    }, [authLoading, userProfile, navigate, currentUser]);

    const startCamera = () => setShowCamera(true);

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Only accept images
        if (!file.type.startsWith('image/')) {
            alert("Only image files are supported for stories.");
            e.target.value = "";
            return;
        }

        setBackgroundType('IMAGE');
        setMediaFile(file);
        setMediaPreview(URL.createObjectURL(file));
    };

    const cycleTextColor = () => {
        const nextIndex = (textColorIndex + 1) % TEXT_COLORS.length;
        setTextColorIndex(nextIndex);
        setTextColor(TEXT_COLORS[nextIndex]);
    };

    const cycleBackground = () => {
        if (backgroundType !== 'GRADIENT') {
            setBackgroundType('GRADIENT');
            setMediaFile(null);
            setMediaPreview(null);
        } else {
            setBgIndex((prev) => (prev + 1) % GRADIENTS.length);
        }
    };

    const cycleFont = () => {
        setFontIndex((prev) => (prev + 1) % FONTS.length);
    };

    const handleShare = async () => {
        if (loading) return;
        if (backgroundType === 'GRADIENT' && !text.trim()) return;
        if (backgroundType === 'IMAGE' && !mediaFile) return;

        setLoading(true);
        try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userDocSnap = await import('firebase/firestore').then(({ getDoc }) => getDoc(userDocRef));
            const freshUserData = userDocSnap.exists() ? userDocSnap.data() : {};

            const finalUserName = freshUserData.businessInfo?.businessName || freshUserData.name || freshUserData.displayName || currentUser.displayName || 'User';
            const finalUserPhoto = getSafeAvatar(freshUserData || currentUser);

            let mediaUrl = null;
            let finalType = 'text';

            if (mediaFile) {
                const sanitizedName = mediaFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                const path = `stories/${currentUser.uid}/${Date.now()}_${sanitizedName}`;
                mediaUrl = await uploadImage(mediaFile, path);
                finalType = 'image';
            }

            const storyData = {
                userId: String(currentUser.uid),
                userPhoto: finalUserPhoto,
                userName: finalUserName,
                type: finalType,
                url: mediaUrl,
                text: text.trim(),
                fontFamily: FONTS[fontIndex].family,
                textColor: textColor,
                backgroundColor: backgroundType === 'GRADIENT' ? GRADIENTS[bgIndex].bg : null,
                createdAt: serverTimestamp(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            };

            await addDoc(collection(db, 'stories'), storyData);
            navigate('/');
        } catch (error) {
            console.error("Error creating story:", error);
            alert("Failed to share story: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-story-container" style={{ zIndex: 100000 }}>
            <div className="story-header">
                <button onClick={() => { navigate(-1); }} className="icon-btn"><FaTimes /></button>
                <div className="story-title">{backgroundType === 'GRADIENT' ? 'Create' : 'Edit'} Story</div>
                <button onClick={handleShare} className="share-btn" disabled={loading || (backgroundType === 'GRADIENT' && !text.trim())}>
                    {loading ? 'Posting...' : 'Share'}
                </button>
            </div>

            {/* Canvas */}
            <div
                className="story-canvas"
                style={{
                    backgroundColor: backgroundType === 'GRADIENT' && !GRADIENTS[bgIndex].bg.includes('gradient') ? GRADIENTS[bgIndex].bg : '#000',
                    backgroundImage: backgroundType === 'GRADIENT' && GRADIENTS[bgIndex].bg.includes('gradient')
                        ? GRADIENTS[bgIndex].bg
                        : (backgroundType === 'IMAGE' && mediaPreview ? `url(${mediaPreview})` : 'none'),
                    backgroundSize: 'cover',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    fontFamily: FONTS[fontIndex].family
                }}
            >
                {isTextMode && (
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={backgroundType === 'GRADIENT' ? "Tap to type..." : "Add a caption..."}
                        className={`story-textarea ${backgroundType !== 'GRADIENT' ? 'text-overlay' : ''}`}
                        style={{ fontFamily: FONTS[fontIndex].family, color: textColor }}
                        maxLength={200}
                    />
                )}
                <style>
                    {`
                        .story-canvas {
                            font-family: ${FONTS[fontIndex].family} !important;
                        }
                        .story-textarea {
                            color: ${textColor} !important;
                            font-family: ${FONTS[fontIndex].family} !important;
                            background: transparent !important;
                            border: none !important;
                            outline: none !important;
                            box-shadow: none !important;
                        }
                        .story-textarea::placeholder { color: ${textColor} !important; opacity: 0.7 !important; }
                        .story-textarea::-webkit-input-placeholder { color: ${textColor} !important; opacity: 0.7 !important; }
                        .story-textarea::-moz-placeholder { color: ${textColor} !important; opacity: 0.7 !important; }
                    `}
                </style>
            </div>

            {/* Sidebar Tools */}
            <div className="story-tools">
                <button className={`tool-btn ${isTextMode ? 'active' : ''}`} onClick={() => setIsTextMode(!isTextMode)} title="Text">
                    <FaFont />
                </button>

                {isTextMode && (
                    <>
                        <button className="tool-btn" onClick={cycleFont}>
                            <span style={{ fontFamily: FONTS[(fontIndex + 1) % FONTS.length].family, fontSize: '1rem', fontWeight: 'bold' }}>Aa</span>
                        </button>
                        <button className="tool-btn" onClick={cycleTextColor}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: textColor, border: '2px solid white' }}></div>
                        </button>
                    </>
                )}

                {isTextMode && (
                    <div style={{ position: 'relative' }} ref={moodPickerRef}>
                        <button className={`tool-btn ${showMoodPicker ? 'active' : ''}`} onClick={() => setShowMoodPicker(!showMoodPicker)}>
                            <FaSmile />
                        </button>
                        {showMoodPicker && (
                            <div style={{
                                position: 'absolute', right: '60px', top: '-20px', background: 'rgba(0,0,0,0.85)',
                                backdropFilter: 'blur(10px)', borderRadius: '16px', padding: '12px', zIndex: 100,
                                display: 'flex', flexDirection: 'column', minWidth: '160px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    <span style={{ color: 'white', fontSize: '0.8rem', fontWeight: 'bold', paddingLeft: '4px' }}>Emojis</span>
                                    <button onClick={() => setShowMoodPicker(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                                        <FaTimes size={14} />
                                    </button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                    {MOOD_EMOJIS.map((emoji) => (
                                        <button
                                            key={emoji} onClick={() => { setText((prev) => prev + emoji); }}
                                            onMouseDown={(e) => e.preventDefault()}
                                            style={{ background: 'transparent', border: 'none', fontSize: '1.8rem', cursor: 'pointer' }}
                                        > {emoji} </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {backgroundType === 'GRADIENT' && (
                    <button className="tool-btn" onClick={cycleBackground} title="Background">
                        <FaPalette />
                    </button>
                )}

                <button className={`tool-btn ${backgroundType === 'IMAGE' ? 'active' : ''}`} onClick={() => fileInputRef.current?.click()} title="Upload Photo">
                    <FaPhotoVideo />
                </button>

                <button className="tool-btn" onClick={startCamera} title="Camera">
                    <FaCamera />
                </button>

                {backgroundType === 'IMAGE' && (
                    <button
                        className="tool-btn"
                        onClick={() => { setMediaFile(null); setMediaPreview(null); setBackgroundType('GRADIENT'); }}
                        style={{ background: 'rgba(239, 68, 68, 0.6)', marginTop: '4px' }}
                    >
                        <FaTimes />
                    </button>
                )}
            </div>

            {/* CAMERA OVERLAY — images only */}
            {showCamera && (
                <UnifiedCamera
                    stopCamera={() => setShowCamera(false)}
                    onMediaCaptured={(file, previewUrl, type) => {
                        if (type === 'video') {
                            // ignore video captures
                            setShowCamera(false);
                            return;
                        }
                        setBackgroundType('IMAGE');
                        setMediaFile(file);
                        setMediaPreview(previewUrl);
                    }}
                    maxDuration={0}
                    mode="photo"
                />
            )}

            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
        </div>
    );
};
export default CreateStory;
