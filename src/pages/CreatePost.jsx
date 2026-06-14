import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { uploadPostMedia } from '../utils/imageUpload';
import { notifyImageUploadError } from '../utils/imageModerationErrors';
import { buildInvitationFeedAttachment } from '../utils/invitationFeedAttachment';
import { getSafeAvatar } from '../utils/avatarUtils';
import UserAvatar from '../components/UserAvatar';
import { FaArrowLeft, FaImage, FaVideo, FaSmile, FaTimes, FaFont, FaPalette, FaCircle, FaFileUpload, FaBold, FaItalic, FaAlignLeft, FaAlignCenter, FaAlignRight } from 'react-icons/fa';
import UnifiedCamera from '../components/UnifiedCamera';
import AIFloatingLauncher from '../components/AIFloatingLauncher';
import { extractAIContentFields } from '../utils/aiContentFieldMapper';
import { buildRegularPostAiUserPrompt } from '../utils/aiPromptLocale';
import { parseAiStudioImageFromState } from '../utils/aiStudioImagePayload';
import { publishGeoFirestoreFields, resolvePostPublishGeo } from '../utils/postPublishGeo';
import './CreatePost.css';

const FONTS = [
    { name: 'Modern', family: '"Inter", sans-serif' },
    { name: 'Classic', family: '"Inter", sans-serif' },
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
    const { showToast } = useToast();

    // State
    const [text, setText] = useState('');
    const [media, setMedia] = useState(null);
    const [attachedInvitation, setAttachedInvitation] = useState(location.state?.attachedInvitation || null);

    const [overlayText, setOverlayText] = useState('');
    const [fontIndex, setFontIndex] = useState(0);
    const [hasStroke, setHasStroke] = useState(true);
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isCheckingImage, setIsCheckingImage] = useState(false);
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
        avatar: getSafeAvatar(userProfile || currentUser)
    });

    // Update author info when userProfile changes
    useEffect(() => {
        if (userProfile) {
            setAuthorInfo({
                name: userProfile.display_name || userProfile.name || userProfile.businessInfo?.businessName || currentUser?.displayName || 'User',
                avatar: getSafeAvatar(userProfile || currentUser)
            });
        } else if (currentUser?.uid) {
            // Fallback fetch if userProfile is not yet available in context
            getDoc(doc(db, 'users', currentUser.uid)).then(snap => {
                if (snap.exists()) {
                    const data = snap.data();
                    setAuthorInfo({
                        name: data.display_name || data.name || data.businessInfo?.businessName || currentUser.displayName || 'User',
                        avatar: getSafeAvatar(data || currentUser)
                    });
                }
            });
        }
    }, [currentUser, userProfile]);

    useEffect(() => {
        const studio = parseAiStudioImageFromState(location.state?.aiStudioImage);
        if (!studio) return;
        setMedia({ type: 'image', preview: studio.publishedUrl, url: studio.publishedUrl });
        setShowOverlayInput(true);
    }, [location.state?.aiStudioImage]);

    const buildRegularPostAiPrompt = useCallback(
        () => buildRegularPostAiUserPrompt({ text, attachedInvitation }),
        [text, attachedInvitation],
    );

    const handleRegularPostAiContent = useCallback((data) => {
        const fields = extractAIContentFields('regular_post', data);
        if (fields.title && fields.text) {
            setText(`${fields.title}\n\n${fields.text}`.slice(0, 300));
        } else if (fields.text) {
            setText(fields.text.slice(0, 300));
        } else if (fields.title) {
            setText(fields.title.slice(0, 300));
        }
    }, []);

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
                    showToast(t('video_too_long', 'Video too long. Max 30s.'), 'error');
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
        setUploadProgress(0);
        setIsCheckingImage(false);

        try {
            let mediaUrl = null;
            let mediaType = media?.type || null;

            if (media?.file) {
                const safeName = String(media.file.name || 'media').replace(/[^a-zA-Z0-9._-]/g, '_');
                const path = `community-posts/${currentUser.uid}/post_${Date.now()}_${safeName}`;
                if (mediaType === 'image') setIsCheckingImage(true);
                mediaUrl = await uploadPostMedia(
                    media.file,
                    currentUser.uid,
                    path,
                    (p) => setUploadProgress(Math.round(p)),
                    mediaType
                );
            }

            const publishGeo = await resolvePostPublishGeo(userProfile);

            const postData = {
                author: {
                    id: currentUser.uid,
                    name: authorInfo.name,
                    avatar: authorInfo.avatar
                },
                authorId: currentUser.uid,
                content: text.trim(),
                mediaUrl: mediaUrl,
                mediaType: mediaType,
                attachedInvitation: buildInvitationFeedAttachment(attachedInvitation),
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
                ...publishGeoFirestoreFields(publishGeo),
            };

            await addDoc(collection(db, 'communityPosts'), postData);
            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }
            navigate('/posts-feed', { replace: true });
        } catch (error) {
            console.error("Error creating post:", error);
            notifyImageUploadError(showToast, error, t, 'failed_to_post');
        } finally {
            setLoading(false);
            setIsCheckingImage(false);
            setUploadProgress(0);
        }
    };

    return (
        <div className="create-post-container" style={{
            display: 'flex', flexDirection: 'column',
            background: 'var(--bg-body)',
            minHeight: 0,
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
                    <button onClick={() => { navigate(-1); }} className="icon-btn" style={{ color: 'var(--text-main)', background: 'var(--bg-input)' }}>
                        <FaArrowLeft size={20} />
                    </button>
                    <UserAvatar
                        user={userProfile || currentUser}
                        alt="Profile"
                        style={{ width: 32, height: 32, flexShrink: 0 }}
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
                    {loading
                        ? (isCheckingImage ? t('image_upload_checking') : t('posting', 'Posting...'))
                        : t('post_button', 'Post')}
                </button>
            </div>

            {isCheckingImage && (
                <div
                    role="status"
                    style={{
                        padding: '8px 16px',
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        textAlign: 'center',
                        borderBottom: '1px solid var(--border-color)',
                    }}
                >
                    {t('image_upload_checking')}
                    {uploadProgress > 0 && uploadProgress < 100 ? ` (${uploadProgress}%)` : ''}
                </div>
            )}

            {/* Main Content — scroll via .app-main (avoid nested scroll trap on mobile) */}
            <div style={{ flex: '1 1 auto', minHeight: 0, padding: '16px', paddingBottom: '70px' }}>

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
                        placeholder={t('whats_happening', "What's happening?")}
                        autoFocus
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        maxLength={300}
                        style={{
                            width: '100%',
                            border: 'none',
                            background: 'transparent',
                            resize: 'none',
                            minHeight: media ? '60px' : '90px', // Shrink text area if media is present
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

                    <div style={{ marginTop: '10px', marginBottom: '4px' }}>
                        <AIFloatingLauncher
                            postType="regular_post"
                            onTextSuccess={handleRegularPostAiContent}
                            buildContextPrompt={buildRegularPostAiPrompt}
                            disabled={loading}
                            compact
                        />
                    </div>

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
                                        placeholder={t('caption_placeholder', 'Caption...')}
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
                                            <FaPalette /> {t('stroke', 'Stroke')}
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
                        color: text.length >= 300 ? 'var(--secondary)' : 'var(--text-muted)',
                        marginTop: '8px'
                    }}>
                        {text.length} / 300
                    </div>
                </div>

                {/* Toolbar Buttons (Now below content card) */}
                <div style={{
                    display: 'flex',
                    gap: '4px',
                    flexWrap: 'nowrap',
                    overflowX: 'auto',
                    alignItems: 'center',
                    marginBottom: '20px',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    justifyContent: 'space-between'
                }}>

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} className="create-post-emoji-wrapper">
                        <button
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            style={{
                                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                color: 'var(--primary)', padding: '6px 10px', borderRadius: '20px', fontSize: '0.75rem',
                                display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 'bold',
                                whiteSpace: 'nowrap', flexShrink: 0, boxShadow: 'var(--shadow-premium)'
                            }}
                        >
                            <FaSmile size={16} /> {t('emoji', 'Emoji')}
                        </button>
                        {showEmojiPicker && (
                            <>
                                {/* Click-out overlay */}
                                <div
                                    onClick={() => setShowEmojiPicker(false)}
                                    style={{
                                        position: 'fixed', inset: 0, zIndex: 10001,
                                        background: 'transparent'
                                    }}
                                />
                                <div style={{
                                    position: 'fixed',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    zIndex: 10002,
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    boxShadow: 'var(--shadow-premium)',
                                    borderRadius: '18px',
                                    padding: '16px',
                                    width: '90%',
                                    maxWidth: '320px',
                                    maxHeight: '220px',
                                    overflowY: 'auto',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{t('quick_emojis', 'Quick Emojis')}</span>
                                        <button
                                            onClick={() => setShowEmojiPicker(false)}
                                            style={{ background: 'var(--bg-input)', border: 'none', color: 'var(--text-main)', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <FaTimes size={14} />
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                                        {CUSTOM_EMOJIS.map((emoji, index) => (
                                            <button
                                                key={index}
                                                onClick={() => {
                                                    setText(prev => prev + emoji);
                                                }}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    fontSize: '1.6rem',
                                                    cursor: 'pointer',
                                                    padding: '6px',
                                                    borderRadius: '10px',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.background = 'var(--hover-overlay)'}
                                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ textAlign: 'center', marginTop: '12px' }}>
                                        <button
                                            onClick={() => setShowEmojiPicker(false)}
                                            style={{ background: 'var(--primary)', border: 'none', color: 'white', padding: '8px 24px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '600', width: '100%' }}
                                        >
                                            {t('done', 'Done')}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Photo Upload */}
                    <button
                        onClick={() => fileInputRef.current.click()}
                        style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                            color: 'var(--primary)', padding: '6px 10px', borderRadius: '20px', fontSize: '0.75rem',
                            display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 'bold',
                            whiteSpace: 'nowrap', flexShrink: 0, boxShadow: 'var(--shadow-premium)'
                        }}
                    >
                        <FaImage size={16} /> {t('photo', 'Photo')}
                    </button>

                    {/* Video Upload */}
                    <button
                        onClick={() => videoUploadRef.current.click()}
                        style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                            color: 'var(--primary)', padding: '6px 10px', borderRadius: '20px', fontSize: '0.75rem',
                            display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 'bold',
                            whiteSpace: 'nowrap', flexShrink: 0, boxShadow: 'var(--shadow-premium)'
                        }}
                    >
                        <FaVideo size={16} /> {t('video', 'Video')}
                    </button>

                    {/* Camera Recording */}
                    <button
                        onClick={startCamera}
                        style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                            color: 'var(--secondary)', padding: '6px 10px', borderRadius: '20px', fontSize: '0.75rem',
                            display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 'bold',
                            whiteSpace: 'nowrap', flexShrink: 0, boxShadow: 'var(--shadow-premium)'
                        }}
                    >
                        <FaCircle size={12} /> {t('record', 'Record')}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)', minWidth: '40px' }}>{t('size', 'Size')}</span>
                        <input
                            type="range" min="12" max="48" value={fontSize}
                            onChange={(e) => setFontSize(parseInt(e.target.value))}
                            style={{ flex: 1, accentColor: 'var(--primary)' }}
                        />
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', minWidth: '40px', textAlign: 'right', fontWeight: '600' }}>{fontSize}px</span>
                    </div>

                    {/* Section 2: Style & Align */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setIsBold(!isBold)} className={`tool-btn ${isBold ? 'active' : ''}`}><FaBold /></button>
                            <button onClick={() => setIsItalic(!isItalic)} className={`tool-btn ${isItalic ? 'active' : ''}`}><FaItalic /></button>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setTextAlign('left')} className={`tool-btn ${textAlign === 'left' ? 'active' : ''}`}><FaAlignLeft /></button>
                            <button onClick={() => setTextAlign('center')} className={`tool-btn ${textAlign === 'center' ? 'active' : ''}`}><FaAlignCenter /></button>
                            <button onClick={() => setTextAlign('right')} className={`tool-btn ${textAlign === 'right' ? 'active' : ''}`}><FaAlignRight /></button>
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
                                        padding: '8px 16px',
                                        borderRadius: '20px',
                                        border: selectedFont === idx ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                        background: selectedFont === idx ? 'var(--primary)' : 'var(--bg-input)',
                                        color: selectedFont === idx ? 'white' : 'var(--text-main)',
                                        fontFamily: font.family,
                                        whiteSpace: 'nowrap',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: '500',
                                        transition: 'all 0.2s',
                                        boxShadow: selectedFont === idx ? 'var(--shadow-glow)' : 'none'
                                    }}
                                >
                                    {font.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Section 3: Text Color */}
                    <div>
                        <div style={{ fontSize: '0.85rem', marginBottom: '10px', fontWeight: '600', color: 'var(--text-main)' }}>{t('text_color', 'Text Color')}</div>
                        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                            {COLORS.map(c => (
                                <button
                                    key={c}
                                    onClick={() => setTextColor(c)}
                                    style={{
                                        width: '28px', height: '28px', borderRadius: '50%',
                                        background: c === '' ? 'linear-gradient(135deg, #000 50%, #fff 50%)' : c,
                                        border: textColor === c ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                        cursor: 'pointer', flexShrink: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                    title={c === '' ? t('auto_color', 'Auto') : c}
                                >
                                    {c === '' && textColor === '' && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Section 4: Background Color */}
                    <div>
                        <div style={{ fontSize: '0.85rem', marginBottom: '10px', fontWeight: '600', color: 'var(--text-main)' }}>{t('background_color', 'Background Color')}</div>
                        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                            {BG_COLORS.map(c => (
                                <button
                                    key={c}
                                    onClick={() => setBgColor(c)}
                                    style={{
                                        width: '28px', height: '28px', borderRadius: '50%',
                                        background: c,
                                        border: bgColor === c ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                        cursor: 'pointer', flexShrink: 0,
                                        position: 'relative',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    {c === 'transparent' && (
                                        <div style={{
                                            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(45deg)',
                                            width: '1px', height: '20px', background: 'var(--secondary)'
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
