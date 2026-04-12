import React, { useState, useRef, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { uploadImage } from '../utils/imageUpload';
import { getSafeAvatar } from '../utils/avatarUtils';
import { FaImage, FaTimes, FaSmile, FaPaste } from 'react-icons/fa';
import TikTokEmbed from './TikTokEmbed';

const CUSTOM_EMOJIS = [
    '😀', '😂', '🤣', '😍', '🥰', '😘', '😋', '😎', '🥳', '🤩', '😡', '😭', '😱', '🤔', '😴',
    '🍔', '🍟', '🍕', '🌭', '🌮', '🌯', '🥗', '🍝', '🍜', '🍣', '🍤', '🍦', '🍩', '🍪', '🎂', '🍰', '🍫',
    '☕', '🍵', '🧋', '🍺', '🍷', '🥂', '🍹',
    '🎈', '🎆', '🎁', '🎊', '🎉', '🕯️', '🎵', '🎶', '💃', '🕺'
];

const extractAndRemoveLink = (inputText) => {
    let newText = inputText;
    let embed = null;

    const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})[^\s]*/i;
    const ttRegex = /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[a-zA-Z0-9_.]+\/video\/([0-9]+)[^\s]*/i;
    const igRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel)\/([a-zA-Z0-9_-]+)[^\s]*/i;

    const ytMatch = newText.match(ytRegex);
    if (ytMatch && ytMatch[1]) {
        embed = { type: 'youtube', id: ytMatch[1] };
        newText = newText.replace(ytMatch[0], '').trim();
        return { text: newText, embed };
    }

    const ttMatch = newText.match(ttRegex);
    if (ttMatch && ttMatch[1]) {
        embed = { type: 'tiktok', id: ttMatch[1] };
        newText = newText.replace(ttMatch[0], '').trim();
        return { text: newText, embed };
    }

    const igMatch = newText.match(igRegex);
    if (igMatch && igMatch[1]) {
        embed = { type: 'instagram', id: igMatch[1] };
        newText = newText.replace(igMatch[0], '').trim();
        return { text: newText, embed };
    }

    return { text: newText, embed: null };
};

const InlinePostEditor = () => {
    const { t } = useTranslation();
    const { currentUser, userProfile } = useAuth();
    const { showToast } = useToast();

    const [isExpanded, setIsExpanded] = useState(false);
    const [text, setText] = useState('');
    const [media, setMedia] = useState(null);
    const [embedData, setEmbedData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    
    const fileInputRef = useRef(null);
    const textareaRef = useRef(null);

    const [authorInfo, setAuthorInfo] = useState({
        name: userProfile?.display_name || userProfile?.name || currentUser?.displayName || 'User',
        avatar: getSafeAvatar(userProfile || currentUser)
    });

    useEffect(() => {
        if (userProfile) {
            setAuthorInfo({
                name: userProfile.display_name || userProfile.name || userProfile.businessInfo?.businessName || currentUser?.displayName || 'User',
                avatar: getSafeAvatar(userProfile || currentUser)
            });
        } else if (currentUser?.uid) {
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

    const handleTextChange = (e) => {
        let val = e.target.value;
        const { text: newText, embed } = extractAndRemoveLink(val);
        
        if (embed) {
            setEmbedData(embed);
            setMedia(null); // Clear image media if embed is found to avoid clashes
            val = newText;
        }

        setText(val);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
        }
    };

    const handlePasteLink = async () => {
        try {
            const clipboardText = await navigator.clipboard.readText();
            if (clipboardText) {
                let val = clipboardText;
                const { text: newText, embed } = extractAndRemoveLink(val);
                
                if (embed) {
                    setEmbedData(embed);
                    setMedia(null);
                    val = newText;
                }
                
                if (val.trim() || embed) {
                    setText(prev => (prev + ' ' + val).trim());
                    setIsExpanded(true);
                }
            } else {
                showToast(t('no_link_found', 'No text found in clipboard.'), 'error');
            }
        } catch (err) {
            console.error(err);
            showToast(t('clipboard_error', 'Cannot read clipboard. Please paste manually.'), 'error');
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast(t('only_images_allowed', 'Please select an image file.'), 'error');
            e.target.value = null;
            return;
        }

        setMedia({ file, preview: URL.createObjectURL(file), type: 'image' });
        setEmbedData(null); // Clear embed if image is selected
        setIsExpanded(true);
    };

    const handleSubmit = async () => {
        if ((!text.trim() && !media && !embedData) || loading) return;
        setLoading(true);

        try {
            let mediaUrl = null;
            let mediaType = media?.type || null;

            if (embedData) {
                mediaUrl = embedData.id;
                mediaType = embedData.type;
            } else if (media?.file) {
                const path = `community-posts/${currentUser.uid}/post_${Date.now()}_${media.file.name}`;
                mediaUrl = await uploadImage(media.file, path);
            }

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
                textStyle: {
                    fontSize: 16,
                    textAlign: 'left',
                    fontWeight: 'normal',
                    fontStyle: 'normal',
                    color: 'var(--text-main)',
                    backgroundColor: 'transparent',
                    fontFamily: '"Inter", sans-serif'
                },
                overlayText: '',
                overlayStyle: null,
                createdAt: serverTimestamp(),
                likes: [],
                comments: [],
                reposts: [],
                location: userProfile?.location || null,
                city: userProfile?.city || null,
                country: userProfile?.country || null,
                coordinates: userProfile?.coordinates || null,
            };

            await addDoc(collection(db, 'communityPosts'), postData);
            
            // Revert state after success
            setText('');
            setMedia(null);
            setEmbedData(null);
            setIsExpanded(false);
            if (textareaRef.current) textareaRef.current.style.height = 'auto';
            showToast(t('post_created', 'Post created successfully!'), 'success');

        } catch (error) {
            console.error("Error creating post:", error);
            showToast(t('post_failed', 'Failed to create post. Try again.'), 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '12px 16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <img 
                    src={getSafeAvatar(userProfile || currentUser)} 
                    alt="User avatar" 
                    style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} 
                />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <textarea 
                        ref={textareaRef}
                        placeholder={t('whats_on_your_mind', "What's on your mind?")}
                        value={text}
                        onChange={handleTextChange}
                        onFocus={() => setIsExpanded(true)}
                        maxLength={300}
                        style={{
                            width: '100%',
                            background: isExpanded ? 'transparent' : 'var(--bg-input)',
                            padding: isExpanded ? '4px 0' : '10px 16px',
                            minHeight: isExpanded ? '60px' : '40px',
                            borderRadius: isExpanded ? '0' : '20px',
                            border: 'none',
                            color: 'var(--text-main)',
                            fontSize: '0.95rem',
                            resize: 'none',
                            outline: 'none',
                            fontFamily: 'inherit',
                            transition: 'all 0.2s ease',
                            cursor: 'text'
                        }}
                    />
                    
                    {isExpanded && (
                        <div style={{ textAlign: 'right', fontSize: '0.75rem', color: text.length >= 300 ? 'var(--secondary)' : 'var(--text-muted)', marginTop: '-8px', marginRight: '4px' }}>
                            {text.length} / 300
                        </div>
                    )}

                    {media && !embedData && (
                        <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', width: '100%', maxWidth: '300px', alignSelf: 'flex-start', border: '1px solid var(--border-color)' }}>
                            <button
                                onClick={() => setMedia(null)}
                                style={{
                                    position: 'absolute', top: '6px', right: '6px', zIndex: 10,
                                    background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none',
                                    borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer'
                                }}
                            >
                                <FaTimes size={12} />
                            </button>
                            <img src={media.preview} alt="Preview" style={{ width: '100%', display: 'block', maxHeight: '300px', objectFit: 'cover' }} />
                        </div>
                    )}

                    {embedData && (
                        <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', width: '100%', alignSelf: 'flex-start', border: '1px solid var(--border-color)', background: '#000' }}>
                            <button
                                onClick={() => setEmbedData(null)}
                                style={{
                                    position: 'absolute', top: '6px', right: '6px', zIndex: 10,
                                    background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none',
                                    borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer'
                                }}
                            >
                                <FaTimes size={12} />
                            </button>
                            {embedData.type === 'youtube' && (
                                <iframe width="100%" height="250" src={`https://www.youtube.com/embed/${embedData.id}?autoplay=0&controls=1&modestbranding=1`} frameBorder="0" allowFullScreen></iframe>
                            )}
                            {embedData.type === 'tiktok' && (
                                <TikTokEmbed videoId={embedData.id} />
                            )}
                            {embedData.type === 'instagram' && (
                                <iframe width="100%" height="300" src={`https://www.instagram.com/p/${embedData.id}/embed/captioned`} frameBorder="0" scrolling="no"></iframe>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {isExpanded && (
                <>
                    <div style={{ borderTop: '1px solid var(--border-color)', margin: '0 -16px' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
                            <button 
                                onClick={handlePasteLink}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: '8px' }}
                            >
                                <FaPaste size={18} color="#8b5cf6" /> {t('paste_link', 'Paste Link')}
                            </button>
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: '8px' }}
                            >
                                <FaImage size={18} color="#45bd62" /> {t('photo', 'Photo')}
                            </button>
                            <button 
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: '8px' }}
                            >
                                <FaSmile size={18} color="#f59e0b" /> {t('emoji', 'Emoji')}
                            </button>

                            {showEmojiPicker && (
                                <>
                                    <div onClick={() => setShowEmojiPicker(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000 }} />
                                    <div style={{
                                        position: 'absolute', top: '100%', left: '0', zIndex: 1001,
                                        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)', borderRadius: '12px', padding: '12px',
                                        width: '280px', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center',
                                        marginTop: '8px', maxHeight: '200px', overflowY: 'auto'
                                    }}>
                                        {CUSTOM_EMOJIS.map((emoji, index) => (
                                            <button
                                                key={index}
                                                onClick={() => { setText(prev => prev + emoji); }}
                                                style={{ background: 'transparent', border: 'none', fontSize: '1.4rem', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                        
                        <button 
                            onClick={handleSubmit}
                            disabled={(!text.trim() && !media && !embedData) || loading}
                            style={{
                                background: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                padding: '6px 16px',
                                borderRadius: '6px',
                                fontWeight: 'bold',
                                fontSize: '0.9rem',
                                cursor: ((!text.trim() && !media && !embedData) || loading) ? 'not-allowed' : 'pointer',
                                opacity: ((!text.trim() && !media && !embedData) || loading) ? 0.5 : 1
                            }}
                        >
                            {loading ? t('posting', 'Posting...') : t('post', 'Post')}
                        </button>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*"
                        style={{ display: 'none' }}
                    />
                </>
            )}

            {!isExpanded && (
                <>
                    <div style={{ borderTop: '1px solid var(--border-color)', margin: '0 -16px' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px' }}>
                        <div onClick={() => { fileInputRef.current?.click(); setIsExpanded(true); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>
                            <span style={{ fontSize: '1.2rem' }}>🖼️</span> {t('photo', 'Photo')}
                        </div>
                        <div onClick={() => setIsExpanded(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>
                            <span style={{ fontSize: '1.2rem' }}>📍</span> {t('check_in', 'Check in')}
                        </div>
                        <div onClick={() => setIsExpanded(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>
                            <span style={{ fontSize: '1.2rem' }}>😊</span> {t('feeling', 'Feeling')}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default InlinePostEditor;
