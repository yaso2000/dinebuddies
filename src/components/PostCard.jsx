import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, serverTimestamp, getDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { FaRegCommentDots, FaTrash, FaEllipsisH, FaEdit, FaEyeSlash } from 'react-icons/fa';
import { AiOutlineHeart, AiFillHeart } from 'react-icons/ai';
import { BiRepost } from 'react-icons/bi';
import { IoShareSocialOutline } from 'react-icons/io5';
import TikTokEmbed from './TikTokEmbed';
import ShareButtons from './ShareButtons';
import { getSafeAvatar } from '../utils/avatarUtils';
import UserAvatar from './UserAvatar';
import FeaturedPostSlideCard from './FeaturedPostSlideCard';
import MotionPostBody from './MotionPostBody';
import { isCommunityMotionPost, motionDocFromPost } from '../features/motion-post/motionPostFeedUtils';
import { FaCalendarAlt, FaMapMarkerAlt, FaImage, FaYoutube, FaTiktok, FaInstagram, FaPlay } from 'react-icons/fa';
import { globalMediaManager } from '../utils/mediaUtils';
import {
    buildYoutubeEmbedSrc,
    isIosLikeDevice,
    isYoutubeShortPost,
    getYoutubeThumbnailUrl,
    shouldMuteEmbedAutoplay,
    YOUTUBE_EMBED_ALLOW
} from '../utils/videoEmbedUtils';
import './PostCard.css';
import './comments/PostComments.css';
import PostCommentRow from './comments/PostCommentRow';
import PostCommentComposer from './comments/PostCommentComposer';
import PostCommentsList from './comments/PostCommentsList';
import { createNotification } from '../utils/notificationHelpers';
import { notifyCommentLikeActivity, notifyPostCommentActivity } from '../utils/postCommentNotifications';
import { mapPublicProfileDocToUserShape } from '../utils/publicProfileMap';
import { deleteFeedPostCascade } from '../utils/postDeleteCascade';
import {
    buildPostCommentThreads,
    getCommentThreadRootId,
    resolveReplyParentId,
} from '../utils/postComments';

// Detect if a post object is an elite featured slide
const isFeaturedSlide = (p) =>
    p &&
    (p._isFeatured === true ||
        p.type === 'elite_slide' ||
        (p.background && p.title?.text !== undefined));

const getCommentTimeMs = (c) => {
    if (!c?.createdAt) return 0;
    const v = c.createdAt;
    if (typeof v === 'string') return new Date(v).getTime();
    if (typeof v.toDate === 'function') return v.toDate().getTime();
    return new Date(v).getTime();
};

const PostCard = ({ post, showInChat = false, defaultExpandComments = false }) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();
    const { showToast } = useToast();

    const [showComments, setShowComments] = useState(defaultExpandComments);
    const [showMenu, setShowMenu] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [replyingTo, setReplyingTo] = useState(null);
    const [expandedReplyIds, setExpandedReplyIds] = useState(() => new Set());
    const [userData, setUserData] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);

    /** Standalone post page: how many recent comments to show (starts at 5, +5 when scrolling up) */
    const [detailCommentWindow, setDetailCommentWindow] = useState(5);

    const [isPlaying, setIsPlaying] = useState(false);
    const [embedMuted, setEmbedMuted] = useState(false);
    const [playbackEpoch, setPlaybackEpoch] = useState(0);

    // Optimistic likes — local state prevents flicker from onSnapshot two-phase firing
    const [localLikes, setLocalLikes] = useState(() => post.likes || []);
    const likeInFlight = useRef(false);

    const videoRef = useRef(null);
    const mediaContainerRef = useRef(null);
    const detailCommentsScrollRef = useRef(null);
    const detailScrollRestoreRef = useRef(null);
    const detailLoadMoreCooldownRef = useRef(0);
    const postMenuRef = useRef(null);
    const [postMenuAlignStart, setPostMenuAlignStart] = useState(false);

    const sortedComments = useMemo(() => {
        const raw = post.comments || [];
        if (!raw.length) return [];
        return [...raw].sort((a, b) => getCommentTimeMs(a) - getCommentTimeMs(b));
    }, [post.comments]);

    const { topLevelComments, repliesByParentId } = useMemo(
        () => buildPostCommentThreads(sortedComments),
        [sortedComments]
    );

    const lastCommentPreview = sortedComments.length ? sortedComments[sortedComments.length - 1] : null;

    const commenterDisplayName =
        userProfile?.displayName || userProfile?.display_name || currentUser?.displayName || t('you', 'You');

    useEffect(() => {
        const core = post.type === 'repost' && post.originalPost ? post.originalPost : post;
        setDetailCommentWindow(core?.mediaType === 'video' ? 3 : 5);
    }, [post.id, post.type, post.originalPost, post.mediaType]);

    /** Standalone post: keep view pinned to newest after comments load or new replies */
    useEffect(() => {
        if (!showInChat) return;
        const id = requestAnimationFrame(() => {
            const el = detailCommentsScrollRef.current;
            if (el) el.scrollTop = el.scrollHeight;
        });
        return () => cancelAnimationFrame(id);
    }, [showInChat, post.id, sortedComments.length]);

    useLayoutEffect(() => {
        const fix = detailScrollRestoreRef.current;
        if (!fix || !detailCommentsScrollRef.current) return;
        detailScrollRestoreRef.current = null;
        const el = detailCommentsScrollRef.current;
        const newH = el.scrollHeight;
        el.scrollTop = fix.top + (newH - fix.height);
    }, [detailCommentWindow]);

    const handleDetailCommentsScroll = (e) => {
        if (!showInChat) return;
        const el = e.currentTarget;
        const total = topLevelComments.length;
        if (total <= detailCommentWindow) return;
        if (el.scrollTop > 56) return;
        if (Date.now() - detailLoadMoreCooldownRef.current < 450) return;
        detailLoadMoreCooldownRef.current = Date.now();
        detailScrollRestoreRef.current = { top: el.scrollTop, height: el.scrollHeight };
        setDetailCommentWindow((w) => Math.min(w + 5, total));
    };

    useLayoutEffect(() => {
        if (!showMenu || !postMenuRef.current) {
            setPostMenuAlignStart(false);
            return;
        }
        const rect = postMenuRef.current.getBoundingClientRect();
        const pad = 12;
        const overflowLeft = rect.left < pad;
        const overflowRight = rect.right > window.innerWidth - pad;
        setPostMenuAlignStart(overflowLeft && !overflowRight);
    }, [showMenu, i18n.language]);

    const stopPostMedia = () => {
        setIsPlaying(false);
        setEmbedMuted(false);
        setPlaybackEpoch((e) => e + 1);
        if (videoRef.current) {
            videoRef.current.pause();
            try {
                videoRef.current.currentTime = 0;
            } catch (_) { /* ignore */ }
        }
        globalMediaManager.stop(post.id);
    };

    useEffect(() => {
        if (!mediaContainerRef.current) return;
        const type = post?.mediaType;
        const embedTypes = ['video', 'youtube', 'tiktok', 'instagram'];
        if (!embedTypes.includes(type)) return;

        const MIN_VISIBLE_RATIO = 0.35;

        const observer = new IntersectionObserver(([entry]) => {
            const visibleEnough = entry.isIntersecting && entry.intersectionRatio >= MIN_VISIBLE_RATIO;

            if (visibleEnough) {
                if (['youtube', 'tiktok', 'instagram'].includes(type)) {
                    if (type === 'youtube' && shouldMuteEmbedAutoplay()) {
                        setEmbedMuted(true);
                    } else {
                        setEmbedMuted(false);
                    }
                    setIsPlaying(true);
                } else if (type === 'video' && videoRef.current) {
                    videoRef.current.play().catch(() => {});
                    setIsPlaying(true);
                }
                globalMediaManager.play(post.id);
            } else {
                stopPostMedia();
            }
        }, { threshold: [0, 0.2, 0.35, 0.5, 0.75, 1] });

        observer.observe(mediaContainerRef.current);
        return () => {
            observer.disconnect();
            globalMediaManager.stop(post.id);
        };
    }, [post?.mediaType, post.id]);

    useEffect(() => {
        return globalMediaManager.subscribe((activeId) => {
            if (activeId !== post.id) {
                setIsPlaying(false);
                setEmbedMuted(false);
                setPlaybackEpoch((e) => e + 1);
                if (videoRef.current) {
                    videoRef.current.pause();
                    try {
                        videoRef.current.currentTime = 0;
                    } catch (_) { /* ignore */ }
                }
            }
        });
    }, [post.id]);

    const handlePlayMedia = (e) => {
        if (e) e.stopPropagation();
        setEmbedMuted(false);
        setIsPlaying(true);
        globalMediaManager.play(post.id);
    };

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

    const featuredDocId = post.featuredPostId || (post._isFeatured ? post.id : null);
    const collectionName = featuredDocId ? 'featured_posts' : 'communityPosts';
    const postDocId = featuredDocId || post.id;

    const handleHide = async (e) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure you want to hide this post? It will be moved to your drafts.")) return;
        try {
            await updateDoc(doc(db, collectionName, postDocId), { status: 'draft' });
            showToast("Post hidden from feed.", 'success');
        } catch (err) { showToast("Failed to hide post.", 'error'); }
        setShowMenu(false);
    };

    const handleEditClick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        setShowMenu(false);

        const core = post.type === 'repost' && post.originalPost ? post.originalPost : post;
        const featuredEditId =
            core.featuredPostId ||
            (core._isFeatured && core.type === 'elite_slide' ? core.id : null) ||
            (core.source === 'featured_post' ? core.featuredPostId || core.id : null);
        const motionEditId =
            core.motionPostId ||
            (core.motionPostSnapshot && typeof core.motionPostSnapshot === 'object'
                ? core.motionPostSnapshot.id
                : null);

        if (featuredEditId) {
            navigate('/create-featured-post', { state: { editFeaturedPostId: String(featuredEditId) } });
            return;
        }
        if (core.type === 'elite_slide' || core.source === 'featured_post') {
            navigate('/create-featured-post', { state: { editFeaturedPostId: String(core.id) } });
            return;
        }
        if (core.type === 'motion_post' || motionEditId) {
            navigate('/create-post', {
                state: { editMotionPostId: motionEditId ? String(motionEditId) : undefined },
            });
            return;
        }
        if (core.type === 'event') {
            navigate('/business-dashboard');
            return;
        }

        setEditedContent(core.content || core.caption || '');
        setIsEditing(true);
    };

    const handleSaveEdit = async (e) => {
        e.stopPropagation();
        if (!editedContent.trim() || savingEdit) return;
        setSavingEdit(true);
        try {
            await updateDoc(doc(db, collectionName, postDocId), {
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
            const postRef = doc(db, collectionName, postDocId);
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
            await deleteFeedPostCascade(post);
            showToast(t('post_delete_success'), 'success');
        } catch (error) {
            console.error('Error deleting post:', error);
            showToast(t('post_delete_failed'), 'error');
        }
    };

    const handleAddComment = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!currentUser || !newComment.trim() || submitting) return;

        setSubmitting(true);
        const replyTarget = replyingTo;
        try {
            const postRef = doc(db, collectionName, postDocId);
            const comment = {
                id: Date.now().toString(),
                userId: currentUser.uid,
                userName: currentUser.displayName || 'User',
                userPhoto: getSafeAvatar(userProfile || currentUser),
                userGender: userProfile?.gender || currentUser?.gender || '',
                text: newComment.trim(),
                createdAt: new Date().toISOString(),
                likes: [],
                ...(replyTarget?.id
                    ? { parentId: resolveReplyParentId(replyTarget, sortedComments) }
                    : {}),
            };

            await updateDoc(postRef, {
                comments: arrayUnion(comment)
            });

            setNewComment('');
            if (replyTarget?.id) {
                const threadRootId = getCommentThreadRootId(replyTarget, sortedComments);
                if (threadRootId) {
                    setExpandedReplyIds((prev) => new Set(prev).add(threadRootId));
                }
            }
            setReplyingTo(null);

            const commenterName =
                userProfile?.displayName || userProfile?.display_name || currentUser.displayName || 'Someone';
            notifyPostCommentActivity({
                post,
                comment,
                replyTarget,
                postAuthorId: authorId,
                commenterUid: currentUser.uid,
                commenterName,
            });
        } catch (error) {
            console.error('Error adding comment:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCommentLike = async (comment) => {
        if (!currentUser || !comment?.id) return;
        const cid = comment.id;
        const wasLiked = Array.isArray(comment.likes) && comment.likes.includes(currentUser.uid);
        const nextComments = sortedComments.map((c) => {
            if (c.id !== cid) return c;
            const likes = Array.isArray(c.likes) ? [...c.likes] : [];
            const idx = likes.indexOf(currentUser.uid);
            if (idx >= 0) likes.splice(idx, 1);
            else likes.push(currentUser.uid);
            return { ...c, likes };
        });
        try {
            const postRef = doc(db, collectionName, postDocId);
            await updateDoc(postRef, { comments: nextComments });
            if (!wasLiked) {
                const likerName =
                    userProfile?.displayName || userProfile?.display_name || currentUser.displayName || 'Someone';
                notifyCommentLikeActivity({
                    post,
                    comment,
                    commenterUid: currentUser.uid,
                    commenterName: likerName,
                });
            }
        } catch (error) {
            console.error('Error liking comment:', error);
        }
    };

    const handleReplyToComment = (comment) => {
        setReplyingTo(comment);
        setShowComments(true);
        const threadRootId = getCommentThreadRootId(comment, sortedComments);
        if (threadRootId) {
            setExpandedReplyIds((prev) => new Set(prev).add(threadRootId));
        }
    };

    const handleCommentAuthorClick = (uid) => {
        if (!uid) return;
        navigate(`/profile/${uid}`);
    };

    const toggleReplyThread = (parentId) => {
        setExpandedReplyIds((prev) => {
            const next = new Set(prev);
            if (next.has(parentId)) next.delete(parentId);
            else next.add(parentId);
            return next;
        });
    };

    const composerPlaceholder = replyingTo
        ? t('comment_reply_to', 'Reply to {{name}}', { name: replyingTo.userName })
        : t('comment_as', 'Comment as {{name}}', { name: commenterDisplayName });

    const commentsRaw = post.comments || [];

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
    const isMotionPost = isCommunityMotionPost(displayPost);
    const motionDoc = useMemo(() => motionDocFromPost(displayPost), [displayPost]);
    const isVideoPost = displayPost.mediaType === 'video';
    const isYoutubeShort = isYoutubeShortPost(displayPost);
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
            className={`post-card${showInChat ? ' in-chat' : ''}${isVideoPost ? ' post-card--video' : ''}${isYoutubeShort ? ' post-card--youtube-short' : ''}`}
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
                    style={{ width: '40px', height: '40px', cursor: 'pointer' }}
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

                <div className="post-card-actions">
                    <button
                        type="button"
                        className="icon-btn-small"
                        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px' }}
                        aria-expanded={showMenu}
                        aria-haspopup="menu"
                    >
                        <FaEllipsisH size={16} />
                    </button>

                    {showMenu ? (
                        <div
                            ref={postMenuRef}
                            className={`post-card-menu${postMenuAlignStart ? ' post-card-menu--align-start' : ''}`}
                            role="menu"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {currentUser?.uid === authorId ? (
                                <>
                                    <button type="button" className="post-card-menu__item" role="menuitem" onClick={handleEditClick}>
                                        <FaEdit size={14} aria-hidden />
                                        {t('edit', 'Edit')}
                                    </button>
                                    <button type="button" className="post-card-menu__item" role="menuitem" onClick={handleHide}>
                                        <FaEyeSlash size={14} aria-hidden />
                                        {t('hide', 'Hide')}
                                    </button>
                                    <button
                                        type="button"
                                        className="post-card-menu__item post-card-menu__item--danger"
                                        role="menuitem"
                                        onClick={handleDelete}
                                    >
                                        <FaTrash size={14} aria-hidden />
                                        {t('delete', 'Delete')}
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    className="post-card-menu__item"
                                    role="menuitem"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        showToast('Reported.', 'success');
                                        setShowMenu(false);
                                    }}
                                >
                                    {t('report_post', 'Report Post')}
                                </button>
                            )}
                        </div>
                    ) : null}
                </div>
            </div>

            {/* CONTENT BODY (Full Width) */}
            <div className="post-content-body" style={{ width: '100%' }}>
                {isMotionPost && motionDoc ? (
                    <div
                        className="motion-post-card__canvas"
                        style={{ padding: '0 16px 12px', width: '100%', boxSizing: 'border-box' }}
                    >
                        <MotionPostBody
                            post={motionDoc}
                            scrollReveal={!showInChat}
                            playOnMount={showInChat}
                        />
                    </div>
                ) : isFeaturedSlide(displayPost) ? (
                    <div
                        className="post-featured-slide-wrap"
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            width: '100%',
                            borderRadius: 12,
                            overflow: 'hidden',
                            border: '1px solid var(--border-color)',
                            marginBottom: 8,
                        }}
                    >
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
                    /* Regular post content (not motion studio canvas) */
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
                                <div className="composer-field composer-field--post">
                                    <textarea
                                        className="composer-field__input"
                                        value={editedContent}
                                        onChange={(e) => setEditedContent(e.target.value)}
                                        style={{ minHeight: '80px', resize: 'vertical' }}
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                                    <button onClick={(e) => { e.stopPropagation(); setIsEditing(false); }} style={{ padding: '6px 14px', borderRadius: '20px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer' }}>{t('cancel', 'Cancel')}</button>
                                    <button onClick={handleSaveEdit} disabled={savingEdit || !editedContent.trim()} style={{ padding: '6px 14px', borderRadius: '20px', background: 'var(--primary)', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                                        {savingEdit ? t('saving', 'Saving...') : t('save', 'Save')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            !isMotionPost &&
                            (displayPost.postTitle || displayPost.content || (!displayPost.overlayText && displayPost.caption)) && (
                                <div style={{ padding: '0 16px', marginBottom: '12px' }}>
                                    {displayPost.postTitle ? (
                                        <div
                                            className="post-headline"
                                            style={{
                                                whiteSpace: 'pre-wrap',
                                                fontSize: '1.2rem',
                                                fontWeight: 800,
                                                lineHeight: 1.35,
                                                textAlign: displayPost.textStyle?.textAlign || 'left',
                                                color: 'inherit',
                                                marginBottom: displayPost.content || displayPost.caption ? '6px' : 0,
                                            }}
                                        >
                                            {displayPost.postTitle}
                                        </div>
                                    ) : null}
                                    {(displayPost.content || displayPost.caption) ? (
                                        <div className="post-text" style={{
                                            whiteSpace: 'pre-wrap',
                                            fontSize: displayPost.textStyle?.fontSize ? `${displayPost.textStyle.fontSize}px` : '0.9rem',
                                            textAlign: displayPost.textStyle?.textAlign || 'left',
                                            fontWeight: displayPost.textStyle?.fontWeight || 'normal',
                                            fontStyle: displayPost.textStyle?.fontStyle || 'normal',
                                            lineHeight: '1.5',
                                            color: 'inherit',
                                        }}>
                                            {displayPost.content || displayPost.caption}
                                        </div>
                                    ) : null}
                                </div>
                            )
                        )}

                        {/* Media Container (Video/YouTube/TikTok/Images) */}
                        {!isMotionPost &&
                        (displayPost.mediaUrl || displayPost.images?.length > 0 || displayPost.image) && (
                            <div
                                ref={mediaContainerRef}
                                className={`post-media-container${isYoutubeShort ? ' post-media-container--vertical' : ''}`}
                                onClick={() => { if (!isEditing) navigate(post._isFeatured ? `/post/featured/${post.id}` : `/post/${post.id}`); }}
                            >
                                {displayPost.mediaType === 'youtube' ? (
                                    isPlaying ? (
                                        <div
                                            className={`post-embed-player${isYoutubeShort ? ' post-embed-player--vertical' : ''}`}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <iframe
                                                key={`yt-${displayPost.mediaUrl}-${embedMuted ? 'm' : 'u'}-${playbackEpoch}`}
                                                width="100%"
                                                height="100%"
                                                src={buildYoutubeEmbedSrc(displayPost.mediaUrl, {
                                                    autoplay: true,
                                                    mute: embedMuted
                                                })}
                                                frameBorder="0"
                                                allow={YOUTUBE_EMBED_ALLOW}
                                                allowFullScreen
                                                title="YouTube"
                                            />
                                            {embedMuted && isIosLikeDevice() && (
                                                <button
                                                    type="button"
                                                    className="post-embed-unmute-hint"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEmbedMuted(false);
                                                    }}
                                                >
                                                    <FaPlay size={10} />
                                                    {t('tap_for_sound', 'Tap for sound')}
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div
                                            className={`post-media-preview${isYoutubeShort ? ' post-media-preview--vertical post-media-preview--short' : ''}`}
                                            onClick={(e) => { e.stopPropagation(); handlePlayMedia(e); }}
                                        >
                                            <img
                                                src={getYoutubeThumbnailUrl(displayPost.mediaUrl, { isShort: isYoutubeShort })}
                                                alt="YouTube"
                                                className="post-media-preview__img"
                                                onError={(e) => {
                                                    e.currentTarget.onerror = null;
                                                    e.currentTarget.src = `https://img.youtube.com/vi/${displayPost.mediaUrl}/hqdefault.jpg`;
                                                }}
                                            />
                                            <div className="post-media-preview__play">
                                                <span className="post-media-preview__play-icon">
                                                    <FaYoutube size={22} color="#ff0000" />
                                                </span>
                                            </div>
                                        </div>
                                    )
                                ) : displayPost.mediaType === 'tiktok' ? (
                                    isPlaying ? (
                                        <div className="post-embed-shell" onClick={(e) => e.stopPropagation()}>
                                            <iframe
                                                key={`tt-${displayPost.mediaUrl}-${playbackEpoch}`}
                                                src={`https://www.tiktok.com/embed/v2/${displayPost.mediaUrl}?autoplay=1`}
                                                width="100%"
                                                height="600"
                                                frameBorder="0"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                                title="TikTok"
                                            />
                                        </div>
                                    ) : (
                                        <div
                                            className="post-media-preview post-media-preview--tall"
                                            onClick={(e) => { e.stopPropagation(); handlePlayMedia(e); }}
                                        >
                                            <div className="post-media-preview__play">
                                                <span className="post-media-preview__play-icon">
                                                    <FaTiktok size={22} />
                                                </span>
                                            </div>
                                        </div>
                                    )
                                ) : displayPost.mediaType === 'instagram' ? (
                                    isPlaying ? (
                                        <iframe
                                            key={`ig-${displayPost.mediaUrl}-${playbackEpoch}`}
                                            width="100%"
                                            height="450"
                                            src={`https://www.instagram.com/p/${displayPost.mediaUrl}/embed/captioned`}
                                            frameBorder="0"
                                            scrolling="no"
                                            title="Instagram"
                                        />
                                    ) : (
                                        <div
                                            className="post-media-preview"
                                            onClick={(e) => { e.stopPropagation(); handlePlayMedia(e); }}
                                        >
                                            <div className="post-media-preview__play">
                                                <span className="post-media-preview__play-icon">
                                                    <FaInstagram size={22} />
                                                </span>
                                            </div>
                                        </div>
                                    )
                                ) : displayPost.mediaType === 'video' ? (
                                    <video
                                        ref={videoRef}
                                        src={displayPost.mediaUrl}
                                        className="post-video"
                                        controls={isPlaying}
                                        autoPlay={isPlaying}
                                        playsInline
                                        onClick={(e) => { e.stopPropagation(); if (!isPlaying) handlePlayMedia(e); }}
                                    />
                                ) : (
                                    <img
                                        src={displayPost.mediaUrl || displayPost.image}
                                        alt="Post media"
                                        className="post-media-content"
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

                {/* Engagement row — post layer: post likes only | comment count only */}
                {(localLikes.length > 0 || commentsRaw.length > 0) && (
                    <div
                        className="post-engagement-row"
                        onClick={(e) => {
                            if (commentsRaw.length > 0) {
                                e.stopPropagation();
                                setShowComments(true);
                            }
                        }}
                    >
                        <div className="post-engagement-row__left">
                            {localLikes.length > 0 ? (
                                <span className="post-engagement-row__stat post-engagement-row__stat--likes">
                                    <AiFillHeart size={14} aria-hidden />
                                    {localLikes.length}
                                </span>
                            ) : null}
                        </div>
                        <div className="post-engagement-row__right">
                            {commentsRaw.length > 0 ? (
                                <span
                                    className="post-engagement-row__stat post-engagement-row__stat--link"
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.stopPropagation();
                                            setShowComments(true);
                                        }
                                    }}
                                >
                                    {commentsRaw.length} {t('comments', 'Comments')}
                                </span>
                            ) : null}
                        </div>
                    </div>
                )}

                {/* Actions Bar */}
                <div className="post-actions">
                    {/* Like */}
                    <button
                        className={`action-item like ${hasLiked ? 'liked' : ''}`}
                        onClick={handleLike}
                    >
                        {hasLiked ? <AiFillHeart size={20} /> : <AiOutlineHeart size={20} />}
                        <span>{t('like', 'Like')}</span>
                        {localLikes.length > 0 ? (
                            <span className="action-count">{localLikes.length}</span>
                        ) : null}
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
                        {commentsRaw.length > 0 ? (
                            <span className="action-count">{commentsRaw.length}</span>
                        ) : null}
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

                {/* Feed preview: last comment with avatar (Facebook-style) */}
                {!showInChat && !showComments && lastCommentPreview && (
                    <div
                        role="button"
                        tabIndex={0}
                        className={`post-comments-preview-fb${isVideoPost ? ' post-comments-preview--video' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowComments(true);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowComments(true);
                            }
                        }}
                    >
                        {commentsRaw.length > 1 ? (
                            <div className="post-comments-preview-fb__count">
                                {t('comment_view_all', 'View all {{count}} comments', { count: commentsRaw.length })}
                            </div>
                        ) : null}
                        <PostCommentRow
                            comment={lastCommentPreview}
                            postAuthorId={authorId}
                            currentUserId={currentUser?.uid}
                            onLike={handleCommentLike}
                            onReply={handleReplyToComment}
                            onAuthorClick={handleCommentAuthorClick}
                            replyCount={
                                lastCommentPreview?.id && !lastCommentPreview.parentId
                                    ? (repliesByParentId[lastCommentPreview.id] || []).length
                                    : 0
                            }
                            t={t}
                        />
                    </div>
                )}

                {/* Expanded comments — Facebook-style panel */}
                {showComments && (
                    <div
                        className={`comments-section fb-comments-panel${
                            showInChat ? ' comments-section--detail' : ' comments-section--chat'
                        }${isVideoPost ? (showInChat ? ' comments-section--video-detail' : ' comments-section--video-feed') : ''}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {commentsRaw.length > 0 ? (
                            <div className="fb-comments-panel__header-count" aria-live="polite">
                                {commentsRaw.length} {t('comments', 'Comments')}
                            </div>
                        ) : null}
                        <button type="button" className="fb-comments-sort" onClick={(e) => e.stopPropagation()}>
                            {t('comments_most_relevant', 'Most relevant')}
                            <span className="fb-comments-sort__chevron" aria-hidden>
                                ▾
                            </span>
                        </button>

                        {showInChat && !replyingTo ? (
                            <PostCommentComposer
                                currentUser={currentUser}
                                userProfile={userProfile}
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                onSubmit={handleAddComment}
                                submitting={submitting}
                                placeholder={composerPlaceholder}
                            />
                        ) : null}

                        <div
                            ref={showInChat ? detailCommentsScrollRef : undefined}
                            className={showInChat ? 'fb-comments-panel__scroll' : undefined}
                            onScroll={showInChat ? handleDetailCommentsScroll : undefined}
                        >
                            {showInChat && sortedComments.length > detailCommentWindow ? (
                                <div className="fb-comments-panel__scroll-hint">
                                    {t('comments_scroll_load_older', 'Scroll up for older comments')}
                                </div>
                            ) : null}
                            <PostCommentsList
                                topLevelComments={
                                    showInChat
                                        ? topLevelComments.slice(
                                              -Math.min(
                                                  detailCommentWindow,
                                                  topLevelComments.length
                                              )
                                          )
                                        : topLevelComments
                                }
                                repliesByParentId={repliesByParentId}
                                expandedReplyIds={expandedReplyIds}
                                onToggleReplies={toggleReplyThread}
                                postAuthorId={authorId}
                                currentUserId={currentUser?.uid}
                                onLike={handleCommentLike}
                                onReply={handleReplyToComment}
                                onAuthorClick={handleCommentAuthorClick}
                                replyingTo={replyingTo}
                                replyComposerProps={{
                                    currentUser,
                                    userProfile,
                                    value: newComment,
                                    onChange: (e) => setNewComment(e.target.value),
                                    onSubmit: handleAddComment,
                                    submitting,
                                    placeholder: composerPlaceholder,
                                    onCancel: () => setReplyingTo(null),
                                }}
                                t={t}
                            />
                        </div>

                        {!showInChat && !replyingTo ? (
                            <PostCommentComposer
                                currentUser={currentUser}
                                userProfile={userProfile}
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                onSubmit={handleAddComment}
                                submitting={submitting}
                                placeholder={composerPlaceholder}
                                sticky
                            />
                        ) : null}
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
                            url={
                                typeof window !== 'undefined'
                                    ? `${window.location.origin}${
                                          post._isFeatured ? `/post/featured/${post.id}` : `/post/${post.id}`
                                      }`
                                    : ''
                            }
                            title={`Post by ${authorName}`}
                            description={
                                typeof displayPost.content === 'string'
                                    ? displayPost.content
                                    : displayPost.caption ||
                                      displayPost.content?.description ||
                                      'Check out this post on DineBuddies!'
                            }
                            type="post"
                            sharedData={{
                                type: 'post',
                                id: post.id,
                                title: `Post by ${authorName}`,
                                description:
                                    typeof displayPost.content === 'string'
                                        ? displayPost.content
                                        : displayPost.caption || displayPost.content?.description || '',
                                image:
                                    displayPost.mediaUrl ||
                                    displayPost.image ||
                                    displayPost.thumbnailUrl ||
                                    motionDoc?.media?.imageUrl ||
                                    null,
                                mediaType: displayPost.mediaType || 'image',
                                authorName: authorName,
                                authorAvatar: authorAvatar,
                                url:
                                    typeof window !== 'undefined'
                                        ? `${window.location.origin}${
                                              post._isFeatured ? `/post/featured/${post.id}` : `/post/${post.id}`
                                          }`
                                        : '',
                            }}
                            storyData={{
                                title: `Post by ${authorName}`,
                                image:
                                    displayPost.mediaUrl ||
                                    displayPost.image ||
                                    displayPost.thumbnailUrl ||
                                    motionDoc?.media?.imageUrl ||
                                    null,
                                description:
                                    typeof displayPost.content === 'string'
                                        ? displayPost.content
                                        : displayPost.caption || displayPost.content?.description,
                                hostName: authorName,
                                hostImage: authorAvatar,
                                mediaType: displayPost.mediaType || 'image',
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
