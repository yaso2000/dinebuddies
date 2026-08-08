import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useTranslation } from 'react-i18next';
import { FaHeart, FaRegHeart, FaTimes, FaPaperPlane, FaRegCommentDots, FaRegSmile } from 'react-icons/fa';
import StoryCommentStream from './StoryCommentStream';
import './StoryViewer.css';
import { handleEmojiButtonClick, shouldUseAppEmojiPicker, showComposerEmojiButton } from '../utils/emojiInputMode';

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
  const { t } = useTranslation();

  const { allUserStories, initialUserIndex } = viewingData;

  const [currentUserGroupIndex, setCurrentUserGroupIndex] = useState(initialUserIndex);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // Interactive Swipe States
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [touchStartX, setTouchStartX] = useState(0);
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

  const STORY_DURATION = 10000;

  const currentUserStories = allUserStories[currentUserGroupIndex];
  const initialStory = currentUserStories?.stories[currentStoryIndex];
  const [realTimeStory, setRealTimeStory] = useState(initialStory);

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

    const sorted = [...(currentStory.reactions || [])].sort(
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
  }, [currentStory?.reactions, currentStory?.id, isOwnStory]);

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
    const reactionCount = currentStory?.reactions?.length || 0;
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

    const sorted = [...(currentStory.reactions || [])].sort(
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
      const lift = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
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
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [isInputFocused, showEmojiPicker]);


  const startTimer = () => {
    clearTimers();
    startTimeRef.current = Date.now();
    const remainingTime = STORY_DURATION - elapsedRef.current;

    if (remainingTime <= 0) {
      handleNext();
      return;
    }

    progressIntervalRef.current = setInterval(() => {
      const currentElapsed = elapsedRef.current + (Date.now() - startTimeRef.current);
      const newProgress = currentElapsed / STORY_DURATION * 100;

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
      await updateDoc(storyRef, {
        views: arrayUnion(currentUser.uid)
      });
    } catch (error) {
      console.error('Error marking story as viewed:', error);
    }
  };

  const handleLike = async () => {
    if (!currentUser || !currentStory) return;
    try {
      const storyRef = doc(db, 'stories', currentStory.id);
      const hasLiked = currentStory.likes?.includes(currentUser.uid);
      if (hasLiked) {
        await updateDoc(storyRef, { likes: arrayRemove(currentUser.uid) });
      } else {
        // Record reaction only if the liker is NOT the story owner
        if (!isOwnStory) {
          const reaction = {
            id: `${currentUser.uid}_like_${Date.now()}`,
            userId: currentUser.uid,
            userName: userProfile?.name || userProfile?.displayName || currentUser.displayName || 'User',
            userPhoto: userProfile?.photo || currentUser.photoURL || '',
            content: '❤️',
            type: 'like',
            createdAt: Date.now()
          };
          await updateDoc(storyRef, {
            likes: arrayUnion(currentUser.uid),
            reactions: arrayUnion(reaction)
          });
        } else {
          await updateDoc(storyRef, { likes: arrayUnion(currentUser.uid) });
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
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
  const onTouchStart = (e) => {
    if (isInputFocused || isStoryChromeTarget(e)) return;
    setTouchStartX(e.targetTouches[0].clientX);
    setIsDragging(true);
    setDragOffset(0);
  };

  const onTouchMove = (e) => {
    if (!isDragging || isStoryChromeTarget(e)) return;
    const currentX = e.targetTouches[0].clientX;
    const diff = currentX - touchStartX;

    // Prevent swiping before first or after last user group with resistance
    if (currentUserGroupIndex === 0 && diff > 0) {
      setDragOffset(diff * 0.3);
    } else if (currentUserGroupIndex === allUserStories.length - 1 && diff < 0) {
      setDragOffset(diff * 0.3);
    } else {
      setDragOffset(diff);
    }
  };

  const onTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

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
    if (isInputFocused || isDragging || Math.abs(dragOffset) > 5) return;

    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      clearTimeout(singleTapTimerRef.current);
      const alreadyLiked = currentStory.likes?.includes(currentUser?.uid);
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
        const reaction = {
          id: `${currentUser.uid}_${Date.now()}`,
          userId: currentUser.uid,
          userName: userProfile?.name || userProfile?.displayName || currentUser.displayName || 'User',
          userPhoto: userProfile?.photo || currentUser.photoURL || '',
          content: textToSend,
          type: content ? 'emoji' : 'text',
          createdAt: Date.now()
        };
        const storyRef = doc(db, 'stories', currentStory.id);
        await updateDoc(storyRef, { reactions: arrayUnion(reaction) });
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

  const hasLiked = currentStory.likes?.includes(currentUser?.uid);
  const likesCount = currentStory.likes?.length || 0;
  const textReactions = (currentStory.reactions || []).filter((r) => r.type === 'text' && String(r.content || '').trim());
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
  if (isOwnStory && currentStory?.reactions) {
    const uniqueUsersMap = new Map();
    for (let i = currentStory.reactions.length - 1; i >= 0; i--) {
      const r = currentStory.reactions[i];
      if (!uniqueUsersMap.has(r.userId)) {
        uniqueUsersMap.set(r.userId, r);
      }
    }
    uniqueInteractors = Array.from(uniqueUsersMap.values()).reverse();
  }

  const ownerReactionCount = currentStory?.reactions?.length || 0;

  const shrinkFrameForKeyboard =
  isComposerOpen && viewportRect.height > 0 && keyboardLift > 24;

  return ReactDOM.createPortal(
    <div
      className={`story-viewer-portal${shrinkFrameForKeyboard ? ' story-viewer-portal--composer' : ''}`}>
      
            <div
        className="story-viewer-portal__frame"
        style={
        shrinkFrameForKeyboard ?
        {
          height: `${viewportRect.height}px`,
          marginTop: `${viewportRect.offsetTop}px`,
          maxWidth: '100vw'
        } :
        undefined
        }>
        
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
              display: 'flex', gap: '4px', padding: '12px 10px',
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
                const storyToRender = groupIndex === currentUserGroupIndex ? currentStory : userGroup.stories[0];
                if (!storyToRender) return null;
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
                                            </div> :
              null :

              <div
                className="story-footer story-footer--owner"
                onClick={(e) => e.stopPropagation()}>
                
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
        </div>,
    document.body
  );
};

export default StoryViewer;