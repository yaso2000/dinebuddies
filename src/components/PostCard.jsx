import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, serverTimestamp, getDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { FaRegCommentDots, FaTrash, FaEllipsisH, FaEdit, FaEyeSlash, FaRegSmile } from 'react-icons/fa';
import { AiOutlineHeart, AiFillHeart } from 'react-icons/ai';
import { BiRepost } from 'react-icons/bi';
import { IoShareSocialOutline, IoSend } from 'react-icons/io5';
import TikTokEmbed from './TikTokEmbed';
import ShareButtons from './ShareButtons';
import { getSafeAvatar, getGenderBorderColor } from '../utils/avatarUtils';
import UserAvatar from './UserAvatar';
import FeaturedPostSlideCard from './FeaturedPostSlideCard';
import { FaCalendarAlt, FaMapMarkerAlt, FaImage, FaYoutube, FaTiktok, FaInstagram, FaPlay } from 'react-icons/fa';
import { globalMediaManager } from '../utils/mediaUtils';
import './PostCard.css';
import { createNotification } from '../utils/notificationHelpers';
import { mapPublicProfileDocToUserShape } from '../utils/publicProfileMap';

// Detect if a post object is an elite featured slide
const isFeaturedSlide = (p) => p && (p.type === 'elite_slide' || (p.background && p.title?.text !== undefined));

const PostCard = ({ post, showInChat = false, defaultExpandComments = false }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();
    const { showToast } = useToast();

    const [showComments, setShowComments] = useState(defaultExpandComments);
    const [showMenu, setShowMenu] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [userData, setUserData] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);

    const [isPlaying, setIsPlaying] = useState(false);
    const videoRef = useRef(null);
    const mediaContainerRef = useRef(null);

    useEffect(() => {
        if (!mediaContainerRef.current) return;
        const type = post?.mediaType;
        if (!['video', 'youtube', 'tiktok'].includes(type)) return;

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                if (['youtube', 'tiktok'].includes(type)) {
                    setIsPlaying(true);
                } else if (type === 'video' && videoRef.current) {
                    videoRef.current.play().catch(e => console.log('Autoplay blocked', e));
                    setIsPlaying(true);
                }
                globalMediaManager.play(post.id);
            } else {
                if (['youtube', 'tiktok'].includes(type)) {
                    setIsPlaying(false);
                } else if (type === 'video' && videoRef.current) {
                    videoRef.current.pause();
                    setIsPlaying(false);
                }
            }
        }, { threshold: 0.5 });

        observer.observe(mediaContainerRef.current);
        return () => observer.disconnect();
    }, [post?.mediaType, post.id]);

    useEffect(() => {
        return globalMediaManager.subscribe((activeId) => {
            if (activeId !== post.id) {
                setIsPlaying(false);
                if (videoRef.current) videoRef.current.pause();
            }
        });
    }, [post.id]);

    const handlePlayMedia = (e) => {
        if (e) e.stopPropagation();
        setIsPlaying(true);
        globalMediaManager.play(post.id);
    };

    // Optimistic likes — local state prevents flicker from onSnapshot two-phase firing
    const [localLikes, setLocalLikes] = useState(() => post.likes || []);
    // useRef instead of useState: always synchronously current, no stale-closure race
    const likeInFlight = useRef(false);

    // Sync from server only when there is no in-flight write
    useEffect(() => {
        if (!likeInFlight.current) setLocalLikes(post.likes || []);
    }, [post.likes]);

    // Identify author ID
    const authorId = post.partnerId || post.author?.id || post.authorId || post.userId || post.uid;

    useEffect(() => {
        if (!authorId) return;

        // SKIP FETCH if it is ME (we use live profile in render)
        if (currentUser?.uid === authorId && userProfile) return;

        const fetchUser = async () => {
            try {
                // public_profiles: allow get for everyone (guests + signed-in). users/{id} is signed-in only.
                const pubSnap = await getDoc(doc(db, 'public_profiles', authorId));
                if (pubSnap.exists()) {
                    const mapped = mapPublicProfileDocToUserShape(pubSnap.data());
                    if (mapped) {
                        setUserData(mapped);
                        return;
                    }
                }
                // Sync lag / missing projection: signed-in clients may still read users/{id}
                if (currentUser?.uid) {
                    const userSnap = await getDoc(doc(db, 'users', authorId));
                    if (userSnap.exists()) setUserData(userSnap.data());
                }
            } catch (err) {
                if (err?.code !== 'permission-denied') {
                    console.warn('PostCard author fetch:', err?.message || err);
                }
            }
        };
        fetchUser();
    }, [authorId, currentUser?.uid, userProfile]);

    // Derived State — based on LOCAL optimistic likes, not raw post.likes
    const hasLiked = localLikes.includes(currentUser?.uid || '');

    const collectionName = post._isFeatured ? 'featured_posts' : 'communityPosts';

    const handleHide = async (e) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure you want to hide this post? It will be moved to your drafts.")) return;
        try {
            await updateDoc(doc(db, collectionName, post.id), { status: 'draft' });
            showToast("Post hidden from feed.", 'success');
        } catch (err) { showToast("Failed to hide post.", 'error'); }
        setShowMenu(false);
    };

    const handleEditClick = (e) => {
        e.stopPropagation();
        setShowMenu(false);
        if (post.type === 'event') {
            navigate('/business-pro', { state: { defaultTab: 'event', editEvent: post } });
        } else if (post.type === 'elite_slide') {
            navigate('/business-pro', { state: { defaultTab: 'featured', editPost: post } });
        } else {
            setEditedContent(post.content || post.caption || '');
            setIsEditing(true);
        }
    };

    const handleSaveEdit = async (e) => {
        e.stopPropagation();
        if (!editedContent.trim() || savingEdit) return;
        setSavingEdit(true);
        try {
            await updateDoc(doc(db, collectionName, post.id), {
                content: editedContent.trim(),
                updatedAt: serverTimestamp()
            });
            showToast("Post updated.", 'success');
            setIsEditing(false);
        } catch (err) { showToast("Failed to update post.", 'error'); }
        setSavingEdit(false);
    };

    const handleLike = async (e) => {
        e.stopPropagation();
        if (!currentUser || likeInFlight.current) return;

        // Optimistic update: flip locally first
        const wasLiked = hasLiked;
        setLocalLikes(prev =>
            wasLiked ? prev.filter(id => id !== currentUser.uid) : [...prev, currentUser.uid]
        );
        likeInFlight.current = true;
        try {
            const postRef = doc(db, collectionName, post.id);
            if (wasLiked) {
                await updateDoc(postRef, { likes: arrayRemove(currentUser.uid) });
            } else {
                await updateDoc(postRef, { likes: arrayUnion(currentUser.uid) });
                // Notify post author (not if they liked their own post)
                if (authorId && authorId !== currentUser.uid) {
                    const likerName = userProfile?.displayName || userProfile?.display_name || currentUser.displayName || 'Someone';
                    createNotification({
                        userId: authorId,
                        type: 'like',
                        title: `${likerName} liked your post`,
                        message: post.content?.slice(0, 60) || post.caption?.slice(0, 60) || 'Liked your post',
                        actionUrl: post._isFeatured ? `/post/featured/${post.id}` : `/post/${post.id}`
                    }).catch(() => {});
                }
            }
        } catch (error) {
            console.error('Error toggling like:', error);
            // Revert on failure
            setLocalLikes(prev =>
                wasLiked ? [...prev, currentUser.uid] : prev.filter(id => id !== currentUser.uid)
            );
        } finally {
            likeInFlight.current = false;
        }
    };

    const handleDelete = async (e) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure you want to delete this post? This cannot be undone.")) return;

        try {
            await deleteDoc(doc(db, collectionName, post.id));
            // UI should update automatically if parent is listening to snapshots
        } catch (error) {
            console.error("Error deleting post:", error);
            showToast("Failed to delete post.", 'error');
        }
    };

    const handleAddComment = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!currentUser || !newComment.trim() || submitting) return;

        setSubmitting(true);
        try {
            const postRef = doc(db, collectionName, post.id);
            const comment = {
                id: Date.now().toString(),
                userId: currentUser.uid,
                userName: currentUser.displayName || 'User',
                userPhoto: getSafeAvatar(userProfile || currentUser),
                text: newComment.trim(),
                createdAt: new Date().toISOString()
            };

            await updateDoc(postRef, {
                comments: arrayUnion(comment)
            });

            setNewComment('');

            // Notify the post author, unless they commented on their own post
            if (authorId && authorId !== currentUser.uid) {
                const commenterName = userProfile?.displayName || userProfile?.display_name || currentUser.displayName || 'Someone';
                createNotification({
                    userId: authorId,
                    type: 'comment',
                    title: `${commenterName} commented on your post`,
                    message: comment.text.slice(0, 80),
                    actionUrl: `/post/${post.id}`
                }).catch(() => { });
            }
        } catch (error) {
            console.error('Error adding comment:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (isNaN(diff)) return '';

        // Twitter style time
        if (diff < 60000) return t('Just now', 'Just now');
        if (diff < 3600000) return `${Math.floor(diff / 60000)}${t('time_m', 'm')}`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}${t('time_h', 'h')}`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}${t('time_d', 'd')}`;

        try {
            const loc = localStorage.getItem('app_language') === 'ar' ? 'ar-EG' : 'en-US';
            return date.toLocaleDateString(loc, { month: 'short', day: 'numeric' });
        } catch (e) {
            return '';
        }
    };

    // --- AUTHOR DATA RESOLUTION ---
    // 1. Initial State from Post Document (Snapshot) - With RESTORED Fallbacks
    // We try every possible field, and avoid "User" if possible until the very end.
    let authorName = post.businessName || post.partnerName || post.author?.name || post.userName || post.user_name || post.displayName || post.name;
    if (authorName === 'User' || authorName === 'Guest') {
        // Try to find a better name if the current one is generic
        authorName = post.email?.split('@')[0] || authorName;
    }
    authorName = authorName || 'User';

    let authorAvatar = post.businessLogoUrl || getSafeAvatar(post.author || post);

    let authorHandle = post.author?.username || post.author?.handle || null;

    // 2. Override with Fetched Data (from useEffect - Medium Priority)
    // 2. Override with Fetched Data (from useEffect - Medium Priority)
    // CRITICAL FIX: If we fetched fresh userData, we should use it!
    if (userData) {
        const fetchedName = userData.displayName || userData.display_name || userData.name || userData.businessInfo?.businessName;
        // Only override if fetched name is valid and not "User" or "Guest" (unless the original was also User/Guest)
        if (fetchedName && fetchedName !== 'User' && fetchedName !== 'Guest') {
            authorName = fetchedName;
        } else if (authorName === 'User' || authorName === 'Guest') {
            // If original was generic, and fetched is generic, try even harder (e.g. email)
            authorName = fetchedName || userData.email?.split('@')[0] || authorName;
        }

        authorAvatar = getSafeAvatar(userData);
        authorHandle = userData.username || userData.handle || authorHandle;
    }

    // 3. Override with Current User - Live Profile (Highest Priority for Self)
    if (currentUser?.uid === authorId && userProfile) {
        authorName = userProfile.businessInfo?.businessName || userProfile.displayName || userProfile.display_name || userProfile.name || authorName;
        authorAvatar = getSafeAvatar(userProfile);
        authorHandle = userProfile.username || userProfile.handle || authorHandle;
    } else {
        // Use utility for general case
        authorAvatar = getSafeAvatar(userData || post.author || post);
    }

    // Fallbacks
    if (!authorAvatar || String(authorAvatar).includes('dicebear')) {
        authorAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(String(authorName || 'User'))}&background=random`;
    }

    if (!authorHandle) {
        authorHandle = `@${String(authorName).toLowerCase().replace(/\s/g, '')}`;
    } else if (!String(authorHandle).startsWith('@')) {
        authorHandle = `@${authorHandle}`;
    }

    // --- REPOST RENDERING LOGIC ---
    // If this is a repost, we show the reposter's info at the top,
    // but the MAIN content is the original post.
    const isRepost = post.type === 'repost' && post.originalPost;
    const displayPost = isRepost ? post.originalPost : post;

    // Resolve Display Post Author (Original Author)
    let displayAuthorName = displayPost.businessName || displayPost.partnerName || displayPost.author?.name || displayPost.userName || displayPost.user_name || displayPost.displayName || 'User';
    let displayAuthorId = displayPost.partnerId || displayPost.author?.id || displayPost.authorId || displayPost.userId || displayPost.uid;

    // Use utility for display author avatar
    const isBusinessPost = !!(displayPost.partnerId || displayPost.businessName || displayPost.businessLogoUrl || displayPost.partnerName || displayPost.type === 'elite_slide' || (displayAuthorId === authorId && userData?.role === 'business'));
    let displayAuthorObj = {
        ...(displayPost.author || displayPost),
        isBusiness: isBusinessPost,
        role: isBusinessPost ? 'business' : (displayPost.author?.role || displayPost.role)
    };
    let displayAuthorAvatar = displayPost.businessLogoUrl || getSafeAvatar(displayAuthorObj);

    // Override for current user (if I am the original author)
    if (currentUser?.uid === displayAuthorId && userProfile && !isRepost) {
        displayAuthorName = userProfile.businessInfo?.businessName || userProfile.displayName || userProfile.display_name || userProfile.name || displayAuthorName;
        displayAuthorObj = userProfile;
        displayAuthorAvatar = getSafeAvatar(userProfile);
    }

    let displayAuthorHandle = displayPost.author?.username || displayPost.author?.handle || null;
    if (!displayAuthorHandle) {
        displayAuthorHandle = `@${String(displayAuthorName).toLowerCase().replace(/\s/g, '')}`;
    }

    // Helper functions for event dates
    const getEventMonth = (dateStr) => {
        try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short' }).toUpperCase(); }
        catch(e) { return 'MON'; }
    };
    const getEventDay = (dateStr) => {
        try { return new Date(dateStr).toLocaleDateString('en-US', { day: '2-digit' }); }
        catch(e) { return 'DD'; }
    };
    const getEventFullDate = (dateStr) => {
        try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }); }
        catch(e) { return 'No Date'; }
    };

    return (
        <div
            className={`post-card ${showInChat ? 'in-chat' : ''}`}
            onClick={() => {
                if (!showInChat) {
                    navigate(post._isFeatured ? `/post/featured/${post.id}` : `/post/${post.id}`);
                }
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '0' }}
        >
            {/* Repost Header */}
            {isRepost && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', padding: '16px 16px 0 16px' }}>
                    <BiRepost size={16} />
                    <span style={{ fontWeight: 'bold' }}>{authorName} reposted</span>
                </div>
            )}

            {/* HEADER ROW: Avatar + User Info + Options */}
            <div className="post-header-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', padding: isRepost ? '0 16px' : '16px 16px 4px 16px' }}>
                <UserAvatar
                    user={displayAuthorObj}
                    src={displayAuthorAvatar}
                    className="post-avatar"
                    alt={displayAuthorName}
                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: `2px solid ${getGenderBorderColor(displayAuthorObj)}` }}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (displayPost.partnerId) navigate(`/business/${displayPost.partnerId}`);
                        else if (displayAuthorId) navigate(`/profile/${displayAuthorId}`);
                    }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2', flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                        <span className="post-user-name" style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.85rem', lineHeight: '1.2', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {displayAuthorName}
                        </span>
                        {/* Optional Verified Badge here if needed */}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.80rem', color: 'var(--text-muted)', overflow: 'hidden' }}>
                        <span className="post-user-handle" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {displayAuthorHandle}
                        </span>
                        <span style={{ flexShrink: 0 }}>·</span>
                        <span className="post-time" style={{ flexShrink: 0 }}>
                            {formatDate(displayPost.createdAt)}
                        </span>
                    </div>
                </div>

                <div style={{ marginLeft: 'auto', position: 'relative' }}>
                    <button
                        className="icon-btn-small"
                        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px' }}
                    >
                        <FaEllipsisH size={16} />
                    </button>

                    {/* Dropdown Menu */}
                    {showMenu && (
                        <div style={{
                            position: 'absolute', top: '100%', right: 0,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                            zIndex: 10, minWidth: '120px', overflow: 'hidden'
                        }}>
                            {(currentUser?.uid === authorId) ? (
                                <>
                                    <button
                                        onClick={handleEditClick}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            padding: '10px 16px', width: '100%', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            background: 'transparent', color: 'var(--text-main)', cursor: 'pointer',
                                            fontSize: '0.9rem', textAlign: 'left'
                                        }}
                                    >
                                        <FaEdit size={14} /> {t('edit', 'Edit')}</button>
                                    <button
                                        onClick={handleHide}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            padding: '10px 16px', width: '100%', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            background: 'transparent', color: 'var(--text-main)', cursor: 'pointer',
                                            fontSize: '0.9rem', textAlign: 'left'
                                        }}
                                    >
                                        <FaEyeSlash size={14} /> {t('hide', 'Hide')}</button>
                                    <button
                                        onClick={handleDelete}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            padding: '10px 16px', width: '100%', border: 'none',
                                            background: 'transparent', color: 'red', cursor: 'pointer',
                                            fontSize: '0.9rem', textAlign: 'left'
                                        }}
                                    >
                                        <FaTrash size={14} /> {t('delete', 'Delete')}</button>
                                </>
                            ) : (
                                <button
                                    onClick={(e) => { e.stopPropagation(); showToast("Reported.", 'success'); setShowMenu(false); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '10px 16px', width: '100%', border: 'none',
                                        background: 'transparent', color: 'var(--text-main)', cursor: 'pointer',
                                        fontSize: '0.9rem', textAlign: 'left'
                                    }}
                                >{t('report_post', 'Report Post')}</button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* CONTENT BODY (Full Width) */}
            <div className="post-content-body" style={{ width: '100%' }}>
                {/* Repost of a featured slide OR the featured slide itself show the slide visual */}
                {isFeaturedSlide(displayPost) ? (
                    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-color)', marginBottom: 8 }}>
                        <FeaturedPostSlideCard
                            data={displayPost}
                            businessName={displayPost.businessName}
                            businessLogoUrl={displayPost.businessLogoUrl}
                            playEntrance={false}
                            compact={true}
                        />
                    </div>
                ) : displayPost.type === 'event' && displayPost.eventDetails ? (
                    <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-color)', marginBottom: 8, background: 'var(--bg-card)' }}>
                        <div style={{ position: 'relative', width: '100%', height: 260, background: '#1a1a24' }}>
                            {displayPost.eventDetails.imageUrl ? (
                                <img src={displayPost.eventDetails.imageUrl} alt="Event" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.1)' }}>
                                    <FaImage size={64} />
                                </div>
                            )}
                            <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', borderRadius: 12, padding: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase' }}>
                                    {displayPost.eventDetails.startDate ? getEventMonth(displayPost.eventDetails.startDate) : 'MON'}
                                </div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                                    {displayPost.eventDetails.startDate ? getEventDay(displayPost.eventDetails.startDate) : 'DD'}
                                </div>
                            </div>
                        </div>
                        <div style={{ padding: 16 }}>
                            <div style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 6, background: 'rgba(167,139,250,0.15)', color: '#a78bfa', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                                🎟️ {t('upcoming_event', 'UPCOMING EVENT')}
                            </div>
                            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 8px 0', lineHeight: 1.3 }}>
                                {displayPost.eventDetails.title}
                            </h4>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                {displayPost.eventDetails.description}
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12, background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: displayPost.eventDetails.actionLink ? 16 : 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                                    <FaCalendarAlt style={{ color: '#a78bfa', flexShrink: 0 }} />
                                    <span>
                                        {displayPost.eventDetails.startDate ? getEventFullDate(displayPost.eventDetails.startDate) : 'No Date'} 
                                        {displayPost.eventDetails.startTime && ` • ${displayPost.eventDetails.startTime}`}
                                    </span>
                                </div>
                                {displayPost.eventDetails.location && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                                        <FaMapMarkerAlt style={{ color: '#a78bfa', flexShrink: 0 }} />
                                        <span>{displayPost.eventDetails.location}</span>
                                    </div>
                                )}
                            </div>
                            {displayPost.eventDetails.actionLink && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); window.open(displayPost.eventDetails.actionLink, '_blank', 'noopener,noreferrer'); }}
                                    style={{ width: '100%', padding: '12px', borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
                                >{t('view_event_details', 'View Event Details')}</button>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Regular post content */
                    <div style={{
                        backgroundColor: displayPost.textStyle?.backgroundColor || 'transparent',
                        color: displayPost.textStyle?.color || 'inherit',
                        fontFamily: displayPost.textStyle?.fontFamily || 'inherit',
                        borderRadius: displayPost.textStyle?.backgroundColor && displayPost.textStyle.backgroundColor !== 'transparent' ? '12px' : '0',
                        padding: displayPost.textStyle?.backgroundColor && displayPost.textStyle.backgroundColor !== 'transparent' ? '12px' : '0',
                        marginBottom: '8px'
                    }}>
                        {isEditing ? (
                            <div style={{ padding: '0 16px', marginBottom: '8px' }}>
                                <textarea
                                    value={editedContent}
                                    onChange={(e) => setEditedContent(e.target.value)}
                                    style={{ width: '100%', minHeight: '80px', background: 'var(--bg-elevated)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', fontSize: '0.95rem', resize: 'vertical' }}
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                                    <button onClick={(e) => { e.stopPropagation(); setIsEditing(false); }} style={{ padding: '6px 14px', borderRadius: '20px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer' }}>{t('cancel', 'Cancel')}</button>
                                    <button onClick={handleSaveEdit} disabled={savingEdit || !editedContent.trim()} style={{ padding: '6px 14px', borderRadius: '20px', background: 'var(--primary)', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                                        {savingEdit ? t('saving', 'Saving...') : t('save', 'Save')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            (displayPost.content || (!displayPost.overlayText && displayPost.caption)) && (
                                <div className="post-text" style={{
                                    whiteSpace: 'pre-wrap',
                                    fontSize: displayPost.textStyle?.fontSize ? `${displayPost.textStyle.fontSize}px` : '0.95rem',
                                    textAlign: displayPost.textStyle?.textAlign || 'left',
                                    fontWeight: displayPost.textStyle?.fontWeight || 'normal',
                                    fontStyle: displayPost.textStyle?.fontStyle || 'normal',
                                    lineHeight: '1.5',
                                    color: 'inherit',
                                    padding: '0 16px',
                                    marginBottom: '12px'
                                }}>
                                    {displayPost.content || displayPost.caption}
                                </div>
                            )
                        )}

                        {/* Media Container (Video/YouTube/TikTok/Images) */}
                        {(displayPost.mediaUrl || displayPost.images?.length > 0 || displayPost.image) && (
                            <div ref={mediaContainerRef} className="post-media-container" onClick={() => { if (!isEditing) navigate(post._isFeatured ? `/post/featured/${post.id}` : `/post/${post.id}`); }} style={{ position: 'relative', overflow: 'hidden', marginTop: '10px', width: '100%', background: '#000' }}>
                                {displayPost.mediaType === 'youtube' ? (
                                    isPlaying ? (
                                        <iframe 
                                            width="100%" 
                                            height="350" 
                                            src={`https://www.youtube.com/embed/${displayPost.mediaUrl}?autoplay=1&controls=1&modestbranding=1`} 
                                            frameBorder="0" 
                                            allow="autoplay; fullscreen"
                                            allowFullScreen
                                            style={{ display: 'block' }}
                                        ></iframe>
                                    ) : (
                                        <div onClick={handlePlayMedia} style={{ width: '100%', height: '350px', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <img src={`https://img.youtube.com/vi/${displayPost.mediaUrl}/hqdefault.jpg`} alt="YouTube" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                                            <FaYoutube size={64} color="#ff0000" style={{ position: 'absolute' }} />
                                        </div>
                                    )
                                ) : displayPost.mediaType === 'tiktok' ? (
                                    isPlaying ? (
                                        <div style={{ background: '#000', width: '100%', display: 'flex', justifyContent: 'center' }}>
                                            <iframe 
                                                src={`https://www.tiktok.com/embed/v2/${displayPost.mediaUrl}?autoplay=1`} 
                                                width="100%" 
                                                height="600" 
                                                frameBorder="0" 
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                                allowFullScreen
                                                style={{ border: 'none', maxWidth: '400px', display: 'block' }}
                                            />
                                        </div>
                                    ) : (
                                        <div onClick={(e) => { e.stopPropagation(); handlePlayMedia(e); }} style={{ width: '100%', height: '500px', cursor: 'pointer', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '50%', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <FaTiktok size={30} />
                                            </div>
                                        </div>
                                    )
                                ) : displayPost.mediaType === 'instagram' ? (
                                    <iframe 
                                        width="100%" 
                                        height="450" 
                                        src={`https://www.instagram.com/p/${displayPost.mediaUrl}/embed/captioned`} 
                                        frameBorder="0" 
                                        scrolling="no"
                                        style={{ display: 'block' }}
                                    ></iframe>
                                ) : displayPost.mediaType === 'video' ? (
                                    <video 
                                        ref={videoRef}
                                        src={displayPost.mediaUrl} 
                                        className="post-video" 
                                        controls={isPlaying}
                                        autoPlay={isPlaying}
                                        onClick={(e) => { e.stopPropagation(); if(!isPlaying) handlePlayMedia(e); }}
                                        style={{ width: '100%', maxHeight: '500px', objectFit: 'contain', background: '#000' }}
                                    />
                                ) : (
                                    <img
                                        src={displayPost.mediaUrl || displayPost.image}
                                        alt="Post media"
                                        className="post-media-content"
                                        style={{ width: '100%', display: 'block', objectFit: 'cover', maxHeight: '500px' }}
                                    />
                                )}

                                {/* Overlay Text Support */}
                                {displayPost.overlayText && (
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        pointerEvents: 'none', padding: '20px',
                                        zIndex: 5
                                    }}>
                                        <span style={{
                                            color: displayPost.overlayStyle?.color || 'white',
                                            fontFamily: displayPost.overlayStyle?.fontFamily || 'inherit',
                                            fontSize: '1.5rem', fontWeight: 'bold',
                                            textAlign: 'center',
                                            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                                            WebkitTextStroke: displayPost.overlayStyle?.hasStroke ? '1px black' : 'none',
                                            whiteSpace: 'pre-wrap'
                                        }}>
                                            {displayPost.overlayText}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ATTACHED INVITATION CARD */}
                        {displayPost.attachedInvitation && (
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const inv = displayPost.attachedInvitation;
                                    const path = inv.privacy === 'private' ? `/invitation/private/${inv.id}` : `/invitation/${inv.id}`;
                                    navigate(path);
                                }}
                                style={{
                                    marginTop: '12px',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    backgroundColor: 'var(--bg-card)',
                                    transition: 'transform 0.2s',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                            >
                                <div style={{ height: '140px', width: '100%', position: 'relative' }}>
                                    <img
                                        src={displayPost.attachedInvitation.image || displayPost.attachedInvitation.restaurantImage || displayPost.attachedInvitation.customImage || 'https://via.placeholder.com/300x150'}
                                        alt="Invitation"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    <div style={{
                                        position: 'absolute', bottom: 0, left: 0, right: 0,
                                        background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                                        padding: '10px', display: 'flex', alignItems: 'center', gap: '8px'
                                    }}>
                                        <span style={{
                                            background: '#f59e0b', color: 'black', fontWeight: 'bold',
                                            fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px'
                                        }}>INVITATION</span>
                                        <h4 style={{ color: 'white', margin: 0, fontSize: '0.95rem', textShadow: '0 1px 2px black' }}>
                                            {displayPost.attachedInvitation.title}
                                        </h4>
                                    </div>
                                </div>
                                <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        <span>📅 {displayPost.attachedInvitation.date} • {displayPost.attachedInvitation.time}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                                        <span>📍 {displayPost.attachedInvitation.location || 'Selected Venue'}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Stats Row */}
                <div className="post-stats-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {localLikes.length > 0 && <span>👍 {localLikes.length}</span>}
                    </div>
                    <div>
                        {(post.comments?.length || 0) > 0 && <span>{post.comments.length} {t('comments', 'Comments')}</span>}
                    </div>
                </div>

                {/* Actions Bar */}
                <div className="post-actions">
                    {/* Like */}
                    <button
                        className={`action-item like ${hasLiked ? 'liked' : ''}`}
                        onClick={handleLike}
                    >
                        {hasLiked ? <AiFillHeart size={20} /> : <AiOutlineHeart size={20} />}
                        <span>{t('like', 'Like')}</span>
                    </button>

                    {/* Comment */}
                    <button
                        className="action-item reply"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowComments(!showComments);
                        }}
                    >
                        <FaRegCommentDots size={19} />
                        <span>{t('comment', 'Comment')}</span>
                    </button>

                    {/* Share */}
                    <button
                        className="action-item share"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowShare(true);
                        }}
                    >
                        <IoShareSocialOutline size={20} />
                        <span>{t('share', 'Share')}</span>
                    </button>
                </div>

                {/* Comments Section (Inline) */}
                {showComments && (
                    <div className="comments-section" onClick={(e) => e.stopPropagation()} style={{ marginTop: '12px' }}>
                        {/* Input */}
                        <form
                            onSubmit={handleAddComment}
                            className="comment-input-row"
                            style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                        >
                            <input
                                type="text"
                                className="comment-input"
                                placeholder={t('post_reply', 'Post your reply')}
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                autoFocus
                                style={{
                                    width: '100%',
                                    paddingInlineEnd: '80px',
                                    paddingInlineStart: '16px',
                                    paddingTop: '12px',
                                    paddingBottom: '12px',
                                    borderRadius: '24px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-elevated)',
                                    color: 'var(--text-main)',
                                    outline: 'none',
                                    fontSize: '0.95rem'
                                }}
                            />
                            
                            <div style={{ position: 'absolute', insetInlineEnd: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {/* Emoji Button */}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setShowEmojiPicker(prev => !prev);
                                    }}
                                    style={{
                                        background: 'transparent', border: 'none', color: 'var(--text-muted)',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        padding: '4px', transition: 'color 0.2s', outline: 'none'
                                    }}
                                >
                                    <FaRegSmile size={20} />
                                </button>

                                {/* Send Button */}
                                <button
                                    type="submit"
                                    disabled={!newComment.trim() || submitting}
                                    style={{
                                        background: 'transparent', border: 'none',
                                        cursor: !newComment.trim() || submitting ? 'not-allowed' : 'pointer',
                                        color: !newComment.trim() || submitting ? 'var(--border-color)' : 'var(--primary)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        padding: '4px', transition: 'color 0.2s, transform 0.1s', outline: 'none',
                                        transform: newComment.trim() ? 'scale(1)' : 'scale(0.95)'
                                    }}
                                >
                                    <IoSend size={22} style={{ marginLeft: '2px' }} />
                                </button>
                            </div>
                        </form>

                        {showEmojiPicker && (
                            <div style={{
                                display: 'flex', gap: '16px', padding: '12px 16px',
                                overflowX: 'auto', WebkitOverflowScrolling: 'touch',
                                scrollbarWidth: 'none', background: 'var(--bg-elevated)',
                                borderRadius: '16px', border: '1px solid var(--border-color)',
                                marginTop: '8px'
                            }}>
                                {['❤️', '😂', '🔥', '👏', '😍', '👍', '🙏', '😢', '🎉'].map(emoji => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setNewComment(prev => prev + emoji);
                                        }}
                                        style={{
                                            background: 'transparent', border: 'none',
                                            fontSize: '1.5rem', cursor: 'pointer', padding: '0',
                                            transition: 'transform 0.1s', outline: 'none'
                                        }}
                                        onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
                                        onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Recent Comments */}
                        {(post.comments?.length || 0) > 0 && (
                            <div className="recent-comments">
                                {(post.comments || []).slice(-3).reverse().map((comment, idx) => (
                                    <div key={idx} style={{
                                        padding: '8px 0',
                                        borderTop: '1px solid var(--border-color)',
                                        fontSize: '0.9rem'
                                    }}>
                                        <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                                            {comment.userName}
                                            <span style={{ fontWeight: 'normal', color: 'var(--text-muted)', marginLeft: '6px' }}>
                                                {formatDate(comment.createdAt)}
                                            </span>
                                        </div>
                                        <div style={{ color: 'var(--text-main)' }}>{comment.text}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Share Modal */}
            {showShare && (
                <div
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={(e) => { e.stopPropagation(); setShowShare(false); }}
                >
                    <div
                        style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', maxWidth: '90%', width: '320px' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 style={{ textAlign: 'center', marginBottom: '16px', color: 'var(--text-main)' }}>{t('share_post')}</h3>
                        <ShareButtons
                            url={window.location.href}
                            title={`Post by ${authorName}`}
                            description={post.caption || post.content || 'Check out this post on DineBuddies!'}
                            type="post"
                            sharedData={{
                                type: 'post',
                                id: post.id,
                                title: `Post by ${authorName}`,
                                description: post.caption || post.content || '',
                                image: post.mediaUrl || post.image || null,
                                mediaType: post.mediaType || 'image',
                                authorName: authorName,
                                authorAvatar: authorAvatar,
                                url: window.location.href
                            }}
                            storyData={{
                                title: `Post by ${authorName}`,
                                image: post.mediaUrl || post.image,
                                description: post.caption || post.content,
                                hostName: authorName,
                                hostImage: authorAvatar
                            }}
                        />
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowShare(false); }}
                            style={{ width: '100%', marginTop: '16px', padding: '10px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '8px', cursor: 'pointer' }}
                        >
                            {t('close')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PostCard;
