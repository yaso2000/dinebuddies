import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { doc, updateDoc, deleteDoc, deleteField, serverTimestamp, addDoc, collection, query, orderBy, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { FaHeart, FaRegHeart, FaTimes, FaPaperPlane, FaRegCommentDots, FaRegSmile, FaShareAlt, FaDownload, FaTrashAlt } from 'react-icons/fa';
import StoryCommentStream from './StoryCommentStream';
import './StoryViewer.css';
import { handleEmojiButtonClick, shouldUseAppEmojiPicker, showComposerEmojiButton } from '../utils/emojiInputMode';
import { isAppleWebKitTouch } from '../utils/chatVisualViewportLock';
import { deleteFilesAtFirebaseDownloadUrls } from '../utils/firebaseStorageDelete';
import { downloadStoryMedia } from '../utils/storyMediaExport';
import { getAppOrigin } from '../utils/appOrigin';
import ShareButtons from './ShareButtons';
import { useConfirm } from '../context/ConfirmContext';

/** Shown inline in the footer bar (Instagram-style). */import { AppText, AppTextInput } from "./base";
const INLINE_EMOJIS = ['😂', '🥰', '🥺'];

/** Full picker grid when the message field is focused. */
const PICKER_EMOJIS = ['😍', '😂', '😳', '🤩', '❤️', '👏', '🔥', '🎉'];

function isStoryChromeTarget(event) {
  const el = event.target;
  if (!(el instanceof Element)) return false;
  return Boolean(el.closest('button, a, input, textarea, select, [role="button"], .story-viewer-header, .story-footer'));
}

function reactionCreatedMs(reaction) {
  const ts = reaction?.createdAt;
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (ts.seconds != null) return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1e6;
  return 0;
}

function getReactionId(reaction) {
  return reaction.id || `${reaction.userId}_${reactionCreatedMs(reaction)}`;
}

const StoryViewer = ({ partnerStories: viewingData, onClose }) => {
  const { currentUser, userProfile } = useAuth();
  const { sendMessage, getOrCreateConversation } = useChat();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const confirm = useConfirm();

  const { allUserStories, initialUserIndex } = viewingData;

  const [currentUserGroupIndex, setCurrentUserGroupIndex] = useState(initialUserIndex);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // Interactive Swipe States
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [verticalDragOffset, setVerticalDragOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Pausing Logic
  const [isPaused, setIsPaused] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const timerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const elapsedRef = useRef(0);
  const lastTapRef = useRef(0); // for double-tap detection
  const singleTapTimerRef = useRef(null); // to cancel single-tap nav on double-tap

  // Double-tap heart animation position
  const [heartPos, setHeartPos] = useState(null);

  // Live comment stream (owner-only) — sequential queue, fixed spawn interval
  const [streamItems, setStreamItems] = useState([]);
  const enqueuedReactionIdsRef = useRef(new Set());
  const reactionQueueRef = useRef([]);
  const streamDrainTimerRef = useRef(null);
  const streamSpawnSeqRef = useRef(0);
  const replyInputRef = useRef(null);
  const [keyboardLift, setKeyboardLift] = useState(0);
  const [viewportRect, setViewportRect] = useState({ height: 0, offsetTop: 0 });

  // Input Text State
  const [replyText, setReplyText] = useState('');
  const [sendingFeedback, setSendingFeedback] = useState(null);
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [ownerWaterfallVisible, setOwnerWaterfallVisible] = useState(true);
  const [ownerCommentsFocus, setOwnerCommentsFocus] = useState(false);
  const ownerCommentsFocusRef = useRef(false);
  const ownerCommentsFocusStartedRef = useRef(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const DEFAULT_STORY_DURATION_MS = 5000;
  const LEGACY_STORY_DURATION_MS = 10000; // pre-Phase-1 docs have no mediaDurationMs field
  const MAX_VIDEO_DURATION_MS = 15000;

  /** Video/photo/text each carry their own timing hint; legacy docs fall back to the old flat value. */
  const getStoryDurationMs = (story) => {
    if (!story) return LEGACY_STORY_DURATION_MS;
    if (typeof story.mediaDurationMs === 'number' && story.mediaDurationMs > 0) {
      return story.type === 'video' ?
      Math.min(story.mediaDurationMs, MAX_VIDEO_DURATION_MS) :
      story.mediaDurationMs;
    }
    return story.type ? DEFAULT_STORY_DURATION_MS : LEGACY_STORY_DURATION_MS;
  };

  const currentUserStories = allUserStories[currentUserGroupIndex];
  const initialStory = currentUserStories?.stories[currentStoryIndex];
  const [realTimeStory, setRealTimeStory] = useState(initialStory);
  const [storyReactions, setStoryReactions] = useState([]);

  // Effect 1: Real-time listener
  useEffect(() => {
    if (!initialStory?.id) return;
    const unsubscribe = onSnapshot(doc(db, 'stories', initialStory.id), (docSnapshot) => {
      if (docSnapshot.exists()) {
        setRealTimeStory({ id: docSnapshot.id, ...docSnapshot.data() });
      }
    });
    return () => unsubscribe();
  }, [initialStory?.id]);

  const currentStory = realTimeStory || initialStory;

  // Effect 1b: Reactions now live in a subcollection (map/subcollection security model)
  // instead of an array field on the story doc — separate live listener, ordered by creation.
  useEffect(() => {
    if (!initialStory?.id) {
      setStoryReactions([]);
      return undefined;
    }
    const q = query(collection(db, 'stories', initialStory.id, 'reactions'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStoryReactions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error('Error listening to story reactions:', error);
    });
    return () => unsubscribe();
  }, [initialStory?.id]);

  const activeStoryOwnerId = String(currentUserStories?.userId || '');
  const isOwnStory = Boolean(currentUser?.uid) && activeStoryOwnerId === String(currentUser.uid);

  // Effect 2a: Mark story as viewed — only fires once per story change
  useEffect(() => {
    if (currentStory?.id && currentUser) {
      markAsViewed(currentStory.id);
    }
  }, [currentStory?.id]);

  // Escape closes the viewer (especially when touch handlers interfere)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Effect 2b: Timer Logic
  useEffect(() => {
    // Pause timer during dragging or transitioning
    const shouldPlay = !isPaused && !ownerCommentsFocus && !isInputFocused && !isDragging && !isTransitioning && !showEmojiPicker;

    if (shouldPlay) {
      startTimer();
    } else {
      pauseTimer();
    }

    return () => {
      clearTimers();
    };
  }, [currentUserGroupIndex, currentStoryIndex, isPaused, ownerCommentsFocus, isInputFocused, isDragging, isTransitioning, showEmojiPicker]);

  useEffect(() => {
    ownerCommentsFocusRef.current = ownerCommentsFocus;
  }, [ownerCommentsFocus]);



  // Reset states when user group or story changes
  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
    setRealTimeStory(null);
    setStoryReactions([]);
    setStreamItems([]);
    setShowCommentsPanel(false);
    setOwnerWaterfallVisible(true);
    setOwnerCommentsFocus(false);
    ownerCommentsFocusRef.current = false;
    ownerCommentsFocusStartedRef.current = false;
    setShowEmojiPicker(false);
    enqueuedReactionIdsRef.current = new Set();
    reactionQueueRef.current = [];
    streamSpawnSeqRef.current = 0;
    if (streamDrainTimerRef.current) {
      window.clearInterval(streamDrainTimerRef.current);
      streamDrainTimerRef.current = null;
    }
  }, [currentUserGroupIndex, currentStoryIndex]);

  const makeStreamItem = useCallback((key, reaction) => {
    return {
      key,
      reaction,
      spawn: { x: Math.floor(Math.random() * 10) - 5, actualY: 0 }
    };
  }, []);

  const STORY_STREAM_SPAWN_MS = 1200;
  const STORY_STREAM_MAX = 12;
  const STORY_STREAM_SEED_COUNT = 10;

  const drainOneStreamReaction = useCallback(() => {
    const next = reactionQueueRef.current.shift();
    if (!next) return;

    const id = getReactionId(next);
    streamSpawnSeqRef.current += 1;
    const key = `${id}_q${streamSpawnSeqRef.current}`;
    setStreamItems((prev) => [...prev, makeStreamItem(key, next)].slice(-STORY_STREAM_MAX));
  }, [makeStreamItem]);

  // Owner: enqueue reactions in chronological order (one dequeue per fixed interval)
  useEffect(() => {
    if (!isOwnStory || !currentStory?.id) return;

    const sorted = [...storyReactions].sort(
      (a, b) => reactionCreatedMs(a) - reactionCreatedMs(b)
    );

    let pending = sorted.filter((reaction) => {
      const id = getReactionId(reaction);
      return id && !enqueuedReactionIdsRef.current.has(id);
    });

    if (
    !ownerCommentsFocusRef.current &&
    enqueuedReactionIdsRef.current.size === 0 &&
    pending.length > STORY_STREAM_SEED_COUNT)
    {
      pending = pending.slice(-STORY_STREAM_SEED_COUNT);
    }

    for (const reaction of pending) {
      const id = getReactionId(reaction);
      enqueuedReactionIdsRef.current.add(id);
      reactionQueueRef.current.push(reaction);
    }
  }, [storyReactions, currentStory?.id, isOwnStory]);

  // Owner: drain queue — one comment starts rising every STORY_STREAM_SPAWN_MS
  useEffect(() => {
    if (!isOwnStory || !currentStory?.id) return undefined;

    drainOneStreamReaction();
    streamDrainTimerRef.current = window.setInterval(drainOneStreamReaction, STORY_STREAM_SPAWN_MS);

    return () => {
      if (streamDrainTimerRef.current) {
        window.clearInterval(streamDrainTimerRef.current);
        streamDrainTimerRef.current = null;
      }
    };
  }, [currentStory?.id, isOwnStory, drainOneStreamReaction]);

  const expireStreamItem = useCallback((key) => {
    setStreamItems((prev) => {
      const next = prev.filter((item) => item.key !== key);
      if (
      ownerCommentsFocusRef.current &&
      ownerCommentsFocusStartedRef.current &&
      reactionQueueRef.current.length === 0 &&
      next.length === 0)
      {
        queueMicrotask(() => {
          ownerCommentsFocusRef.current = false;
          ownerCommentsFocusStartedRef.current = false;
          setOwnerCommentsFocus(false);
        });
      }
      return next;
    });
  }, []);

  const handleOwnerCommentsClick = () => {
    const reactionCount = storyReactions.length || 0;
    if (!reactionCount) return;

    if (ownerCommentsFocus) {
      ownerCommentsFocusRef.current = false;
      ownerCommentsFocusStartedRef.current = false;
      setOwnerCommentsFocus(false);
      reactionQueueRef.current = [];
      setStreamItems([]);
      return;
    }

    ownerCommentsFocusRef.current = true;
    setOwnerCommentsFocus(true);
    ownerCommentsFocusStartedRef.current = true;
    setOwnerWaterfallVisible(true);
    setStreamItems([]);
    streamSpawnSeqRef.current = 0;

    const sorted = [...storyReactions].sort(
      (a, b) => reactionCreatedMs(a) - reactionCreatedMs(b)
    );
    enqueuedReactionIdsRef.current = new Set();
    reactionQueueRef.current = [];
    for (const reaction of sorted) {
      const id = getReactionId(reaction);
      enqueuedReactionIdsRef.current.add(id);
      reactionQueueRef.current.push(reaction);
    }
    drainOneStreamReaction();
  };

  // Mobile only: shrink/lift frame when the on-screen keyboard opens
  useEffect(() => {
    const composerActive = isInputFocused || showEmojiPicker;
    const isMobileLayout =
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 767px)').matches;
    if (
    !composerActive ||
    !isMobileLayout ||
    typeof window === 'undefined' ||
    !window.visualViewport)
    {
      setKeyboardLift(0);
      setViewportRect({ height: 0, offsetTop: 0 });
      return undefined;
    }
    const vv = window.visualViewport;
    const update = () => {
      // iOS keeps window.innerHeight fixed and shrinks visualViewport.height instead —
      // the keyboard opening can also scroll the document itself, which throws this off,
      // so reset scroll before reading (mirrors the chat keyboard shell's approach).
      if (isAppleWebKitTouch()) {
        window.scrollTo(0, 0);
        if (document.documentElement) document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;
      }
      // `window.innerHeight` and `document.documentElement.clientHeight` can disagree for a
      // moment right as the keyboard opens on iOS Safari — especially with the
      // interactive-widget=resizes-content meta tag (index.html), which shrinks one before
      // the other repaints. Taking the larger of the two avoids under-lifting (composer left
      // hidden behind the keyboard) if either reading is momentarily stale — same class of
      // fix already applied to the chat composer in chatVisualViewportLock.js.
      const referenceHeight = Math.max(
        window.innerHeight,
        document.documentElement?.clientHeight || 0
      );
      const lift = Math.max(0, referenceHeight - vv.height - vv.offsetTop);
      setKeyboardLift(lift);
      if (lift > 24) {
        setViewportRect({ height: vv.height, offsetTop: vv.offsetTop });
      } else {
        setViewportRect({ height: 0, offsetTop: 0 });
      }
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);

    // iOS: a single synchronous read right when the field focuses is unreliable — the
    // viewport hasn't finished animating yet, so `resize` alone can arrive late or not at
    // all inside this portaled overlay. Re-read a few more times as the keyboard settles.
    let staggeredTimers = [];
    if (isAppleWebKitTouch()) {
      staggeredTimers = [0, 50, 120, 280, 500, 800].map((ms) => window.setTimeout(update, ms));
    }

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      staggeredTimers.forEach((id) => window.clearTimeout(id));
    };
  }, [isInputFocused, showEmojiPicker]);


  const startTimer = () => {
    clearTimers();
    startTimeRef.current = Date.now();
    const storyDurationMs = getStoryDurationMs(currentStory);
    const remainingTime = storyDurationMs - elapsedRef.current;

    if (remainingTime <= 0) {
      handleNext();
      return;
    }

    progressIntervalRef.current = setInterval(() => {
      const currentElapsed = elapsedRef.current + (Date.now() - startTimeRef.current);
      const newProgress = currentElapsed / storyDurationMs * 100;

      if (newProgress >= 100) {
        setProgress(100);
        clearInterval(progressIntervalRef.current);
      } else {
        setProgress(newProgress);
      }
    }, 50);

    timerRef.current = setTimeout(() => {
      handleNext();
    }, remainingTime);
  };

  const pauseTimer = () => {
    if (startTimeRef.current) {
      elapsedRef.current += Date.now() - startTimeRef.current;
    }
    clearTimers();
  };

  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    startTimeRef.current = null;
  };

  const markAsViewed = async (storyId) => {
    if (!currentUser) return;
    try {
      const storyRef = doc(db, 'stories', storyId);
      // `views` is now a {uid: timestamp} map — dot-path update sets only this caller's
      // own key, matching the security rules (each viewer may only touch their own entry).
      await updateDoc(storyRef, {
        [`views.${currentUser.uid}`]: serverTimestamp()
      });
    } catch (error) {
      console.error('Error marking story as viewed:', error);
    }
  };

  const handleLike = async () => {
    if (!currentUser || !currentStory) return;
    try {
      const storyRef = doc(db, 'stories', currentStory.id);
      const hasLiked = Boolean(currentStory.likes?.[currentUser.uid]);
      if (hasLiked) {
        await updateDoc(storyRef, { [`likes.${currentUser.uid}`]: deleteField() });
      } else {
        await updateDoc(storyRef, { [`likes.${currentUser.uid}`]: true });
        // Record reaction only if the liker is NOT the story owner
        if (!isOwnStory) {
          await addDoc(collection(storyRef, 'reactions'), {
            userId: currentUser.uid,
            userName: userProfile?.name || userProfile?.displayName || currentUser.displayName || 'User',
            userPhoto: userProfile?.photo || currentUser.photoURL || '',
            content: '❤️',
            type: 'like',
            createdAt: serverTimestamp()
          });
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleShareStory = () => {
    if (!currentStory) return;
    setIsPaused(true);
    setShowShareModal(true);
  };

  const closeShareModal = () => {
    setShowShareModal(false);
    setIsPaused(false);
  };

  const handleDownloadStory = async () => {
    if (!currentStory?.url) return;
    setIsPaused(true);
    const result = await downloadStoryMedia({
      mediaUrl: currentStory.url,
      kind: currentStory.type === 'video' ? 'video' : 'image',
      text: currentStory.text || ''
    });
    setIsPaused(false);
    if (result === 'downloaded') {
      showToast(t('story_download_started', 'Download started.'), 'success');
    } else if (result === 'failed' || result === 'unavailable') {
      showToast(t('story_download_failed', 'Could not download this story.'), 'error');
    }
  };

  const handleDeleteStory = async () => {
    if (!currentStory?.id || !isOwnStory) return;
    const confirmed = (await confirm({ message: t('story_delete_confirm', 'Delete this story? This cannot be undone.'), tone: 'danger' }));
    if (!confirmed) return;
    try {
      const storyId = currentStory.id;
      const storyRef = doc(db, 'stories', storyId);
      const reactionsSnap = await getDocs(collection(storyRef, 'reactions'));
      await Promise.all(reactionsSnap.docs.map((d) => deleteDoc(d.ref)));
      await deleteDoc(storyRef);
      const mediaUrls = [currentStory.url, currentStory.posterUrl].filter(Boolean);
      if (mediaUrls.length) {
        deleteFilesAtFirebaseDownloadUrls(mediaUrls).catch(() => {});
      }
      const hasMoreInTray = currentStoryIndex < currentUserStories.stories.length - 1;
      if (hasMoreInTray) {
        handleNext();
      } else if (allUserStories.length > 1) {
        handleNextUser();
      } else {
        onClose();
      }
    } catch (error) {
      console.error('Error deleting story:', error);
      showToast(t('story_delete_failed', 'Could not delete this story.'), 'error');
    }
  };

  const handleNextUser = () => {
    if (currentUserGroupIndex < allUserStories.length - 1) {
      setIsTransitioning(true);
      setCurrentUserGroupIndex((prev) => prev + 1);
      setCurrentStoryIndex(0);
      setTimeout(() => setIsTransitioning(false), 300); // Back to normal after animation
    } else {
      onClose();
    }
  };

  const handlePreviousUser = () => {
    if (currentUserGroupIndex > 0) {
      setIsTransitioning(true);
      setCurrentUserGroupIndex((prev) => prev - 1);
      setCurrentStoryIndex(0);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  };

  const handleNext = () => {
    if (currentStoryIndex < currentUserStories.stories.length - 1) {
      setCurrentStoryIndex((prev) => prev + 1);
    } else {
      handleNextUser();
    }
  };

  const handlePrevious = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex((prev) => prev - 1);
    } else {
      handlePreviousUser();
    }
  };

  // --- Interactive Swipe Tracking ---
  // A gesture starts undecided; the first move past AXIS_LOCK_PX picks horizontal
  // (switch user) or vertical-down (dismiss) so the two never fight each other.
  // A touch that never moves past that threshold and lingers becomes tap-and-hold-to-pause.
  const AXIS_LOCK_PX = 8;
  const HOLD_THRESHOLD_MS = 220;
  const gestureAxisRef = useRef(null); // null | 'horizontal' | 'vertical'
  const holdTimerRef = useRef(null);
  const isHoldingRef = useRef(false);
  const justReleasedHoldRef = useRef(false);

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const onTouchStart = (e) => {
    if (isInputFocused || isStoryChromeTarget(e)) return;
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
    setIsDragging(true);
    setDragOffset(0);
    setVerticalDragOffset(0);
    gestureAxisRef.current = null;
    clearHoldTimer();
    holdTimerRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      setIsPaused(true);
    }, HOLD_THRESHOLD_MS);
  };

  const onTouchMove = (e) => {
    if (!isDragging || isStoryChromeTarget(e)) return;
    const currentX = e.targetTouches[0].clientX;
    const currentY = e.targetTouches[0].clientY;
    const diffX = currentX - touchStartX;
    const diffY = currentY - touchStartY;

    if (!gestureAxisRef.current && (Math.abs(diffX) > AXIS_LOCK_PX || Math.abs(diffY) > AXIS_LOCK_PX)) {
      gestureAxisRef.current = Math.abs(diffY) > Math.abs(diffX) && diffY > 0 ? 'vertical' : 'horizontal';
      clearHoldTimer();
    }

    if (gestureAxisRef.current === 'vertical') {
      setVerticalDragOffset(Math.max(0, diffY));
      return;
    }

    // Prevent swiping before first or after last user group with resistance
    if (currentUserGroupIndex === 0 && diffX > 0) {
      setDragOffset(diffX * 0.3);
    } else if (currentUserGroupIndex === allUserStories.length - 1 && diffX < 0) {
      setDragOffset(diffX * 0.3);
    } else {
      setDragOffset(diffX);
    }
  };

  const onTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    clearHoldTimer();

    if (gestureAxisRef.current === 'vertical') {
      const dismissThreshold = window.innerHeight * 0.15;
      gestureAxisRef.current = null;
      if (verticalDragOffset > dismissThreshold) {
        onClose();
        return;
      }
      setIsTransitioning(true);
      setVerticalDragOffset(0);
      setTimeout(() => setIsTransitioning(false), 250);
      return;
    }
    gestureAxisRef.current = null;

    if (isHoldingRef.current) {
      isHoldingRef.current = false;
      setIsPaused(false);
      justReleasedHoldRef.current = true;
      setTimeout(() => {
        justReleasedHoldRef.current = false;
      }, 50);
      return;
    }

    const threshold = window.innerWidth * 0.2; // 20% of screen

    if (dragOffset < -threshold && currentUserGroupIndex < allUserStories.length - 1) {
      handleNextUser();
    } else if (dragOffset > threshold && currentUserGroupIndex > 0) {
      handlePreviousUser();
    }

    // Animated snap back
    setIsTransitioning(true);
    setDragOffset(0);
    setTimeout(() => setIsTransitioning(false), 300);
  };

  const handleClose = (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    onClose();
  };

  const handleTap = (e) => {
    if (isStoryChromeTarget(e)) return;
    if (justReleasedHoldRef.current) return;
    if (isInputFocused || isDragging || Math.abs(dragOffset) > 5) return;

    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      clearTimeout(singleTapTimerRef.current);
      const alreadyLiked = Boolean(currentUser?.uid && currentStory.likes?.[currentUser.uid]);
      if (!alreadyLiked) {
        handleLike();
      }
      setHeartPos({ x: e.clientX, y: e.clientY });
      setTimeout(() => setHeartPos(null), 600);
      lastTapRef.current = 0;
      return;
    }

    lastTapRef.current = now;

    // Delay single-tap navigation so double-tap can cancel it
    singleTapTimerRef.current = setTimeout(() => {
      const clickX = e.clientX;
      const screenWidth = window.innerWidth;
      if (clickX < screenWidth / 3) {
        handlePrevious();
      } else {
        handleNext();
      }
    }, 310);
  };

  const handleQuickEmoji = (emoji, e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    if (isOwnStory) return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setIsInputFocused(false);
    setShowEmojiPicker(false);
    handleSendReply(emoji);
  };

  const storyOwnerName =
  currentUserStories?.partnerName ||
  currentUserStories?.userName ||
  t('story_owner', { defaultValue: 'them' });

  const handleSendReply = async (content = null) => {
    const textToSend = content || replyText;
    if (!textToSend.trim()) return;

    setIsPaused(true);
    if (content) setSendingFeedback({ emoji: content });else
    setSendingFeedback({ emoji: '✅' });

    try {
      const targetId = currentUserStories.userId;
      // 1. Send DM as before
      const convoId = await getOrCreateConversation(targetId);
      if (convoId) {
        await sendMessage(convoId, { text: textToSend, type: 'text' });
      }

      // 2. Save as a reaction on the story — only when VIEWER (not owner)
      if (!isOwnStory) {
        const storyRef = doc(db, 'stories', currentStory.id);
        await addDoc(collection(storyRef, 'reactions'), {
          userId: currentUser.uid,
          userName: userProfile?.name || userProfile?.displayName || currentUser.displayName || 'User',
          userPhoto: userProfile?.photo || currentUser.photoURL || '',
          content: textToSend,
          type: content ? 'emoji' : 'text',
          createdAt: serverTimestamp()
        });
      }

      setReplyText('');
      if (!content) {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        setIsInputFocused(false);
      }
      setTimeout(() => {
        setSendingFeedback(null);
        setIsPaused(false);
      }, 1500);
    } catch (err) {
      console.error("Error sending reply:", err);
      setSendingFeedback(null);
      setIsPaused(false);
    }
  };


  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff = new Date() - date;
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    if (hours < 1) return t('just_now');
    if (hours < 24) return t('hours_ago', { count: hours });
    return t('days_ago_story', { count: days });
  };

  if (!currentStory) return null;

  const hasLiked = Boolean(currentUser?.uid && currentStory.likes?.[currentUser.uid]);
  const likesCount = currentStory.likes ? Object.keys(currentStory.likes).length : 0;
  const textReactions = storyReactions.filter((r) => r.type === 'text' && String(r.content || '').trim());
  const privateThread = isOwnStory ?
  textReactions :
  textReactions.filter((r) => r.userId === currentUser?.uid);
  const commentsCount = privateThread.length;
  const isComposerOpen = isInputFocused || showEmojiPicker;

  const openComposer = () => {
    setIsPaused(true);
    setIsInputFocused(true);
    setShowEmojiPicker(false);
    requestAnimationFrame(() => replyInputRef.current?.focus());
  };

  const handleReplyFocus = () => {
    setIsInputFocused(true);
    setIsPaused(true);
  };

  const handleReplyBlur = () => {
    if (sendingFeedback) return;
    setIsInputFocused(false);
    setIsPaused(false);
    window.setTimeout(() => {
      setShowEmojiPicker(false);
    }, 150);
  };

  const renderStoryComposer = () => {
    if (isOwnStory || !isComposerOpen) return null;

    return (
      <div
        className="story-composer-layer"
        style={{ bottom: keyboardLift > 0 ? `${keyboardLift}px` : 0 }}
        onClick={(e) => e.stopPropagation()}>
        
                {showEmojiPicker && shouldUseAppEmojiPicker() ?
        <div className="story-emoji-float">
                        <div className="story-emoji-float__grid" role="listbox" aria-label={t('quick_emojis', 'Quick reactions')}>
                            {PICKER_EMOJIS.map((emoji) =>
            <button
              key={emoji}
              type="button"
              className="story-emoji-float__cell"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => handleQuickEmoji(emoji, e)}
              aria-label={emoji}>
              
                                    {emoji}
                                </button>
            )}
                        </div>
                    </div> :
        null}

                <div className="story-footer story-footer--composer">
                    <div className="story-footer__field story-footer__field--composer">
                        <button
              type="button"
              className="story-footer__composer-send"
              aria-label={t('send', 'Send')}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                if (replyText.trim()) handleSendReply();
              }}>
              
                            <FaPaperPlane size={18} />
                        </button>
                        <AppTextInput
              ref={replyInputRef}
              className="story-footer__input"
              type="text"
              inputMode="text"
              placeholder={t('story_message_placeholder', {
                defaultValue: 'Message {{name}}…',
                name: storyOwnerName
              })}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onFocus={handleReplyFocus}
              onBlur={handleReplyBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                  handleSendReply();
                }
              }} />
            
                        {showComposerEmojiButton() ? (
                        <button
              type="button"
              className="story-footer__tool"
              aria-label={t('quick_emojis', 'Quick reactions')}
              aria-expanded={showEmojiPicker}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                handleEmojiButtonClick({ inputRef: replyInputRef, setPickerOpen: setShowEmojiPicker });
              }}>
              
                            <FaRegSmile size={22} />
                        </button>
                        ) : null}
                    </div>
                </div>
            </div>);

  };

  // --- Prepare interactions overview for Owner ---
  let uniqueInteractors = [];
  if (isOwnStory && storyReactions.length) {
    const uniqueUsersMap = new Map();
    for (let i = storyReactions.length - 1; i >= 0; i--) {
      const r = storyReactions[i];
      if (!uniqueUsersMap.has(r.userId)) {
        uniqueUsersMap.set(r.userId, r);
      }
    }
    uniqueInteractors = Array.from(uniqueUsersMap.values()).reverse();
  }

  const ownerReactionCount = storyReactions.length || 0;

  const shrinkFrameForKeyboard =
  isComposerOpen && viewportRect.height > 0 && keyboardLift > 24;

  return ReactDOM.createPortal(
    <div
      className={`story-viewer-portal${shrinkFrameForKeyboard ? ' story-viewer-portal--composer' : ''}`}>
      
            <div
        className="story-viewer-portal__frame"
        style={{
          ...(shrinkFrameForKeyboard ?
          {
            height: `${viewportRect.height}px`,
            marginTop: `${viewportRect.offsetTop}px`,
            maxWidth: '100vw'
          } :
          null),
          ...(verticalDragOffset > 0 ?
          {
            transform: `translateY(${verticalDragOffset}px) scale(${Math.max(0.85, 1 - verticalDragOffset / 1400)})`,
            opacity: Math.max(0.4, 1 - verticalDragOffset / 500),
            transition: isTransitioning ? 'transform 0.25s ease, opacity 0.25s ease' : 'none',
            borderRadius: '20px'
          } :
          isTransitioning ?
          { transition: 'transform 0.25s ease, opacity 0.25s ease' } :
          null)
        }}>
        
                {/* Sliding Container that holds ALL users */}
                <div style={{
          display: 'flex',
          height: '100%',
          width: `${allUserStories.length * 100}%`,
          transform: `translateX(calc(-${currentUserGroupIndex * (100 / allUserStories.length)}% + ${dragOffset / allUserStories.length}px))`,
          transition: isTransitioning ? 'transform 0.3s cubic-bezier(0.23, 1, 0.32, 1)' : 'none',
          willChange: 'transform'
        }}>
                    {allUserStories.map((userGroup, groupIndex) =>
          <div key={userGroup.userId} style={{
            width: `${100 / allUserStories.length}%`,
            height: '100%',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            background: 'black'
          }}>

                            {/* Progress Bars (Only visible for active group) */}
                            <div style={{
              display: 'flex', gap: '4px',
              padding: 'max(12px, calc(env(safe-area-inset-top, 0px) + 8px)) 10px 0',
              position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
              pointerEvents: 'none',
              opacity: groupIndex === currentUserGroupIndex ? 1 : 0
            }}>
                                {userGroup.stories.map((_, idx) =>
              <div key={idx} style={{
                flex: 1, height: '2px',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '2px', overflow: 'hidden'
              }}>
                                        <div style={{
                  width: groupIndex < currentUserGroupIndex ? '100%' :
                  groupIndex > currentUserGroupIndex ? '0%' :
                  idx < currentStoryIndex ? '100%' : idx === currentStoryIndex ? `${progress}%` : '0%',
                  height: '100%',
                  background: 'white'
                }} />
                                    </div>
              )}
                            </div>

                            <div className="story-viewer-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: `url("${userGroup.partnerLogo || 'https://via.placeholder.com/150'}") center/cover`,
                  border: '1px solid rgba(255,255,255,0.8)'
                }} />
                                    <div>
                                        <div style={{ color: 'white', fontWeight: '600', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {userGroup.partnerName}
                                            {groupIndex === currentUserGroupIndex &&
                    <AppText as="span" style={{ opacity: 0.6, fontSize: '0.75rem', fontWeight: '400' }}>{formatDate(currentStory.createdAt)}</AppText>
                    }
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div
              className="story-viewer-media"
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', overflow: 'hidden', background: '#1a1a1a',
                borderRadius: '16px', margin: '10px 0'
              }}
              onClick={handleTap}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}>
              
                                {/* Render only stories for current and adjacent users for performance */}
                                {Math.abs(groupIndex - currentUserGroupIndex) <= 1 && (() => {
                const isActiveGroup = groupIndex === currentUserGroupIndex;
                const storyToRender = isActiveGroup ? currentStory : userGroup.stories[0];
                if (!storyToRender) return null;

                // Video stories are no longer supported — show the poster frame (or the raw
                // url as a last resort for older docs with no poster) as a still image instead
                // of ever creating a <video> element, for both legacy and any stray future docs.
                if (storyToRender.type === 'video') {
                  return storyToRender.posterUrl || storyToRender.url ?
                  <img
                    src={storyToRender.posterUrl || storyToRender.url}
                    alt="Story"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> :

                  <div style={{
                    width: '100%', height: '100%',
                    background: storyToRender.backgroundColor || 'linear-gradient(135deg, #8b5cf6, #ec4899)'
                  }} />;

                }

                return storyToRender.url || storyToRender.image ?
                <img
                  src={storyToRender.url || storyToRender.image}
                  alt="Story"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> :


                <div style={{
                  width: '100%', height: '100%',
                  background: storyToRender.backgroundColor || 'linear-gradient(135deg, #8b5cf6, #ec4899)'
                }} />;

              })()}

                                {/* Preload the NEXT item in this user's own tray (not just the neighbor's first item)
                                    so tapping/advancing to it is instant instead of a blank flash. */}
                                {groupIndex === currentUserGroupIndex && (() => {
                const nextItem = currentUserStories?.stories?.[currentStoryIndex + 1];
                if (!nextItem?.url) return null;
                const hiddenStyle = { position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' };
                const preloadSrc = nextItem.type === 'video' ? nextItem.posterUrl || nextItem.url : nextItem.url;
                return <img key={`preload-${nextItem.id}`} src={preloadSrc} alt="" style={hiddenStyle} />;

              })()}

                                {groupIndex === currentUserGroupIndex && currentStory.text &&
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
                pointerEvents: 'none'
              }}>
                                        <AppText as="p" style={{
                  color: currentStory.textColor || 'white',
                  fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
                  textAlign: 'center', fontWeight: 'bold',
                  textShadow: '0 2px 4px rgba(0,0,0,0.6)'
                }}>{currentStory.text}</AppText>
                                    </div>
              }

                                {groupIndex === currentUserGroupIndex && isOwnStory &&
              <StoryCommentStream
                items={streamItems}
                onExpire={expireStreamItem}
                visible={ownerWaterfallVisible && ownerReactionCount > 0} />

              }

                            </div>

                            {/* Interaction Layer */}
                            {groupIndex === currentUserGroupIndex &&
            <>
                                    {showCommentsPanel && !isOwnStory &&
              <div
                className="story-comments-panel"
                onClick={(e) => e.stopPropagation()}>
                
                                            <div className="story-comments-panel__head">
                                                {isOwnStory ? t('story_comments', 'Comments') : t('social_replies', 'Private replies')} ({commentsCount})
                                            </div>
                                            <div className="story-comments-panel__privacy">
                                                {isOwnStory ?
                  t('story_owner_privacy_note', 'Only you can see these replies') :
                  t('story_viewer_privacy_note', 'Visible only to you and the story owner')}
                                            </div>
                                            <div className="story-comments-panel__list">
                                                {commentsCount === 0 ?
                  <div className="story-comments-panel__empty">
                                                        {t('no_comments_yet', 'No comments yet')}
                                                    </div> :

                  privateThread.slice(-14).reverse().map((comment) =>
                  <div key={comment.id} className="story-comments-panel__row">
                                                            <div className="story-comments-panel__avatar">
                                                                {comment.userPhoto ?
                      <img src={comment.userPhoto} alt="" /> :
                      null}
                                                            </div>
                                                            <div className="story-comments-panel__body">
                                                                <div className="story-comments-panel__name">
                                                                    {comment.userName}
                                                                </div>
                                                                <div className="story-comments-panel__text">
                                                                    {comment.content}
                                                                </div>
                                                            </div>
                                                        </div>
                  )
                  }
                                            </div>
                                        </div>
              }

                                    {!isOwnStory ?
              !isComposerOpen ?
              <div
                className="story-footer story-footer--idle"
                onClick={(e) => e.stopPropagation()}>
                
                                                <button
                  type="button"
                  className="story-footer__field story-footer__field--idle"
                  onClick={openComposer}>
                  
                                                    {t('story_message_short', { defaultValue: 'Message…' })}
                                                </button>

                                                <div className="story-footer__inline-emojis" role="toolbar" aria-label={t('quick_emojis', 'Quick reactions')}>
                                                    {INLINE_EMOJIS.map((emoji) =>
                  <button
                    key={emoji}
                    type="button"
                    className="story-footer__inline-emoji"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => handleQuickEmoji(emoji, e)}
                    aria-label={emoji}>
                    
                                                            {emoji}
                                                        </button>
                  )}
                                                </div>

                                                <button
                  type="button"
                  className={`story-footer__action story-footer__action--heart${hasLiked ? ' is-liked' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLike();
                  }}
                  aria-label={t('like_label', 'Like')}>
                  
                                                    {hasLiked ? <FaHeart size={24} /> : <FaRegHeart size={24} />}
                                                </button>

                                                <button
                  type="button"
                  className="story-footer__action story-footer__action--send"
                  onClick={(e) => {
                    e.stopPropagation();
                    openComposer();
                  }}
                  aria-label={t('send', 'Send')}>

                                                    <FaPaperPlane size={20} />
                                                </button>

                                                <button
                  type="button"
                  className="story-footer__action story-footer__action--share"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShareStory();
                  }}
                  aria-label={t('share', 'Share')}>

                                                    <FaShareAlt size={19} />
                                                </button>
                                            </div> :
              null :

              <div
                className="story-footer story-footer--owner"
                onClick={(e) => e.stopPropagation()}>

                                            <div className="story-footer__owner-actions">
                                                <button
                  type="button"
                  className="story-footer__action story-footer__action--share"
                  onClick={handleShareStory}
                  aria-label={t('share', 'Share')}>

                                                    <FaShareAlt size={17} />
                                                </button>
                                                {currentStory?.url ?
                <button
                  type="button"
                  className="story-footer__action story-footer__action--download"
                  onClick={handleDownloadStory}
                  aria-label={t('download', 'Download')}>

                                                        <FaDownload size={17} />
                                                    </button> :
                null}
                                                <button
                  type="button"
                  className="story-footer__action story-footer__action--delete"
                  onClick={handleDeleteStory}
                  aria-label={t('delete', 'Delete')}>

                                                    <FaTrashAlt size={16} />
                                                </button>
                                            </div>

                                            <button
                  type="button"
                  className={`story-footer__owner-comments${ownerCommentsFocus ? ' is-active' : ''}`}
                  onClick={handleOwnerCommentsClick}>
                  
                                                <FaRegCommentDots size={18} />
                                                <AppText as="span">
                                                    {t('story_comments', 'Comments')}
                                                    {ownerReactionCount > 0 ? ` · ${ownerReactionCount}` : ''}
                                                </AppText>
                                                {uniqueInteractors.length > 0 ?
                  <AppText as="span" className="story-footer__owner-people">
                                                        · {uniqueInteractors.length}{' '}
                                                        {uniqueInteractors.length === 1 ?
                    t('person', 'Person') :
                    t('people', 'People')}
                                                    </AppText> :
                  null}
                                            </button>
                                            {ownerCommentsFocus ?
                <AppText as="p" className="story-footer__owner-hint">
                                                    {t(
                    'story_owner_comments_playing',
                    'Showing all comments — story paused. Tap again to skip.'
                  )}
                                                </AppText> :
                ownerReactionCount === 0 ?
                <AppText as="p" className="story-footer__owner-hint">
                                                    {t('story_owner_no_comments', 'Reactions and replies will appear here.')}
                                                </AppText> :

                <AppText as="p" className="story-footer__owner-hint">
                                                    {t(
                    'story_owner_hint',
                    'Tap comments to watch all reactions — story will pause until done.'
                  )}
                                                </AppText>
                }
                                        </div>
              }
                                </>
            }
                        </div>
          )}
                </div>
            </div>

            <button
        type="button"
        className="story-viewer-header__close story-viewer-header__close--portal"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={handleClose}
        aria-label={t('close', 'Close')}>
        
                <FaTimes />
            </button>

            {renderStoryComposer()}

            {/* Feedback Animation Layer */}
            {sendingFeedback &&
      <div className="story-feedback-burst">
                    <div className="story-feedback-burst__emoji">{sendingFeedback.emoji}</div>
                </div>
      }

            {heartPos &&
      <div
        className="story-double-tap-heart"
        style={{ left: heartPos.x, top: heartPos.y }}>

                    ❤️
                </div>
      }

            {showShareModal && currentStory &&
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={(e) => {e.stopPropagation();closeShareModal();}}>

                    <div
          style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', maxWidth: '90%', width: '320px' }}
          onClick={(e) => e.stopPropagation()}>

                        <AppText as="h3" style={{ textAlign: 'center', marginBottom: '16px', color: 'var(--text-main)' }}>
                            {t('share_story', 'Share Story')}
                        </AppText>
                        <ShareButtons
            url={`${getAppOrigin()}/story/${currentStory.id}`}
            title={t('story_share_title', { defaultValue: "{{name}}'s Story", name: storyOwnerName })}
            description={currentStory.text || ''}
            type="story"
            storyData={{
              title: t('story_share_title', { defaultValue: "{{name}}'s Story", name: storyOwnerName }),
              image: currentStory.type === 'video' ? currentStory.posterUrl : currentStory.url || currentStory.posterUrl,
              description: currentStory.text || '',
              hostName: storyOwnerName,
              shareUrl: `${getAppOrigin()}/story/${currentStory.id}`
            }}
            sharedData={{
              type: 'story',
              id: currentStory.id,
              title: t('story_share_title', { defaultValue: "{{name}}'s Story", name: storyOwnerName }),
              description: currentStory.text || '',
              image: currentStory.type === 'video' ? currentStory.posterUrl : currentStory.url || currentStory.posterUrl,
              mediaType: 'image',
              authorName: storyOwnerName,
              authorAvatar: currentUserStories?.partnerLogo || '',
              url: `${getAppOrigin()}/story/${currentStory.id}`
            }} />

                    </div>
                </div>
      }
        </div>,
    document.body
  );
};

export default StoryViewer;