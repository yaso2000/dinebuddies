import { useTranslation } from 'react-i18next';
import React, { Suspense, lazy, useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useInvitations } from '../context/InvitationContext';
import { messagingRestrictedBetweenUsers } from '../utils/userSocialLists';
import { useConversationConnectionAllowed } from '../hooks/useConversationConnectionAllowed';
import { getDirectConversationId } from '../utils/chatHelpers';
import { useChat } from '../context/ChatContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import {
  FaArrowLeft, FaCamera, FaMicrophone,
  FaPaperPlane, FaPlay, FaPause, FaFile,
  FaDownload, FaStop, FaPlus, FaArrowDown } from
'react-icons/fa';
import { FaLock, FaBan } from 'react-icons/fa6';
import { getSafeAvatar } from '../utils/avatarUtils';
import UserAvatar from '../components/UserAvatar';
import { uploadImage, uploadVoiceMessage, formatFileSize, formatDuration } from '../utils/mediaUtils';
import { ImageUploadZone } from '../services/imageUploadZones';
import { notifyImageUploadError } from '../utils/imageModerationErrors';
import NewReportModal from '../components/NewReportModal';
import SharedContentBubble from '../components/SharedContentBubble';
import EmojiPickerPortal from '../components/EmojiPickerPortal';
import { handleEmojiButtonClick, shouldUseAppEmojiPicker, showComposerEmojiButton } from '../utils/emojiInputMode';
import './Chat.css';
import '../styles/chatReferenceTheme.css';
import { attachChatShellToVisualViewport } from '../utils/chatVisualViewportLock';
import { AppText, AppTextInput } from "../components/base";
import { useAppBackNavigation } from '../hooks/useAppBackNavigation';
import {
  getMessageGroupPosition,
  messageCreatedAtMs,
  shouldShowChatDaySeparator,
  formatChatDaySeparator,
} from '../utils/chatMessageGrouping';
import { getMessageReceiptDisplay, syncMessageReceiptDocs } from '../utils/chatMessageReceipts';
import { formatAppTime } from '../utils/localeFormat';
import { useChatTheme } from '../hooks/useChatTheme';
import ChatThemePicker from '../components/chat/ChatThemePicker';

const LazyEmojiPicker = lazy(() => import('emoji-picker-react'));

const Chat = () => {
  const { t, i18n } = useTranslation();
  const { goBack: goBackFromChat } = useAppBackNavigation({ fallback: '/messages' });
  const { userId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const { currentUser: invitationUser } = useInvitations();
  const { isDark } = useTheme();
  const { getOrCreateConversation, sendMessage, markAsRead, setTypingStatus, addReaction } = useChat();
  const { showToast } = useToast();
  const { themeId: chatThemeId, setThemeId: setChatThemeId, themeStyle: chatThemeStyle } = useChatTheme();

  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [activeReactionMenu, setActiveReactionMenu] = useState(null);
  const [extendedReactionPicker, setExtendedReactionPicker] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [conversationError, setConversationError] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [messagingRestricted, setMessagingRestricted] = useState(false);
  const [connectionLocked, setConnectionLocked] = useState(false);

  const [isSupportPeer, setIsSupportPeer] = useState(false);

  const viewerFollowing =
    invitationUser?.following || userProfile?.following || [];
  const { allowed: connectionAllowed, loading: connectionCheckLoading } =
    useConversationConnectionAllowed(currentUser?.uid, userId, viewerFollowing, {
      enabled: Boolean(currentUser?.uid && userId),
      isSupportPeer,
    });

  useEffect(() => {
    if (connectionCheckLoading) return;
    if (messagingRestricted || isSupportPeer) {
      setConnectionLocked(false);
      return;
    }
    setConnectionLocked(!connectionAllowed);
  }, [connectionAllowed, connectionCheckLoading, messagingRestricted, isSupportPeer]);

  const composerBlocked = messagingRestricted || connectionLocked;
  const blockedVariant = messagingRestricted ? 'restricted' : connectionLocked ? 'connection' : null;

  const NEAR_BOTTOM_PX = 120;

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    pinnedToBottomRef.current = distanceFromBottom < NEAR_BOTTOM_PX;
    setShowScrollBottom(distanceFromBottom >= 150);
  };

  const pinMessagesToBottom = useCallback(() => {
    const list = messagesAreaRef.current;
    if (!list || !pinnedToBottomRef.current) return;
    list.scrollTop = list.scrollHeight;
    requestAnimationFrame(() => {
      if (!pinnedToBottomRef.current) return;
      list.scrollTop = list.scrollHeight;
      requestAnimationFrame(() => {
        if (pinnedToBottomRef.current) list.scrollTop = list.scrollHeight;
      });
    });
  }, []);

  const scrollToBottom = () => {
    pinnedToBottomRef.current = true;
    const list = messagesAreaRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
      requestAnimationFrame(() => {
        list.scrollTop = list.scrollHeight;
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    setShowScrollBottom(false);
  };

  // Media states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const messagesEndRef = useRef(null);
  const messagesAreaRef = useRef(null);
  const pinnedToBottomRef = useRef(true);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const imageInputRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const latestMessageDocsRef = useRef([]);
  const readReceiptTimeoutRef = useRef(null);

  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const emojiBtnRef = useRef(null);
  const containerRef = useRef(null);
  const composerRef = useRef(null);

  useEffect(() => {
    const { detach } = attachChatShellToVisualViewport(() => containerRef.current, {
      onViewportChange: () => pinMessagesToBottom(),
    });
    return detach;
  }, [pinMessagesToBottom]);

  const handleEmojiClick = (emojiData) => {
    const emoji = emojiData.emoji;
    const input = inputRef.current;

    setNewMessage((prevMessage) => {
      if (input) {
        const s = input.selectionStart ?? prevMessage.length;
        const e = input.selectionEnd ?? prevMessage.length;

        setTimeout(() => {
          input.setSelectionRange(s + emoji.length, s + emoji.length);
        }, 10);

        return prevMessage.slice(0, s) + emoji + prevMessage.slice(e);
      } else {
        return prevMessage + emoji;
      }
    });
  };

  const initInFlightRef = useRef(false);
  const initKeyRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const initConversation = async () => {
      if (!currentUser?.uid || !userId) {
        setLoading(false);
        return;
      }
      if (connectionCheckLoading) return;
      if (initInFlightRef.current) return;

      const initKey = `${userId}:${retryTrigger}`;
      setConversationError(false);

      initInFlightRef.current = true;
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (cancelled) return;

        const userData = userDoc.exists() ? userDoc.data() : {};
        const { restricted } = messagingRestrictedBetweenUsers(
          userProfile,
          currentUser.uid,
          userData,
          userId
        );
        setMessagingRestricted(restricted);

        const isSupport = userData.isSystemAccount === true;
        setIsSupportPeer(isSupport);

        if (userDoc.exists()) {
          setOtherUser({
            uid: userId,
            displayName: isSupport ?
            userData.display_name || userData.displayName || 'DineBuddies Support' :
            userData.display_name || userData.displayName || userData.email || 'User',
            photoURL: getSafeAvatar(userData),
            isOnline: userData.isOnline || false,
            lastSeen: userData.lastSeen || null,
            isSystemAccount: isSupport
          });
        } else {
          setOtherUser({
            uid: userId,
            displayName: 'User',
            photoURL: null,
            isOnline: false,
            lastSeen: null
          });
        }

        const mayMessage = isSupport || (!restricted && connectionAllowed);

        if (!mayMessage) {
          setConversationId(null);
          initKeyRef.current = null;
          setLoading(false);
          return;
        }

        const deterministicId = getDirectConversationId(currentUser.uid, userId);
        setConversationId(deterministicId);

        if (initKeyRef.current === initKey) {
          setLoading(false);
          return;
        }

        const convId = await getOrCreateConversation(userId);
        if (cancelled) return;

        initKeyRef.current = initKey;

        if (convId) {
          setConversationId(convId);
          setConversationError(false);
        } else if (!isSupport) {
          setConversationId(null);
          setConversationError(true);
        }
      } catch (error) {
        console.error('Error initializing conversation:', error);
        if (!cancelled) {
          setConversationId(null);
          setConversationError(true);
        }
      } finally {
        initInFlightRef.current = false;
        if (!cancelled) setLoading(false);
      }
    };

    initConversation();

    return () => {
      cancelled = true;
    };
  }, [
    userId,
    currentUser?.uid,
    getOrCreateConversation,
    retryTrigger,
    userProfile?.blockedUserIds,
    userProfile?.mutedUserIds,
    connectionAllowed,
    connectionCheckLoading,
  ]);

  useEffect(() => {
    if (!conversationId) return;
    const messagesQuery = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      latestMessageDocsRef.current = snapshot.docs;
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setLoading(false);
      if (!connectionLocked && currentUser?.uid) {
        void syncMessageReceiptDocs({
          db,
          messageDocs: snapshot.docs,
          viewerId: currentUser.uid,
          markRead: false
        });
      }
    });
    return () => unsubscribe();
  }, [connectionLocked, conversationId, currentUser?.uid]);

  useEffect(() => {
    if (readReceiptTimeoutRef.current) {
      clearTimeout(readReceiptTimeoutRef.current);
      readReceiptTimeoutRef.current = null;
    }
    if (!conversationId || connectionLocked || !currentUser?.uid || messages.length === 0) {
      return undefined;
    }
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return undefined;
    }

    readReceiptTimeoutRef.current = setTimeout(() => {
      void syncMessageReceiptDocs({
        db,
        messageDocs: latestMessageDocsRef.current,
        viewerId: currentUser.uid,
        markRead: true
      });
      void markAsRead(conversationId);
    }, 900);

    return () => {
      if (readReceiptTimeoutRef.current) {
        clearTimeout(readReceiptTimeoutRef.current);
        readReceiptTimeoutRef.current = null;
      }
    };
  }, [connectionLocked, conversationId, currentUser?.uid, markAsRead, messages]);

  useEffect(() => {
    if (!conversationId) return;
    const unsubscribe = onSnapshot(doc(db, 'conversations', conversationId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const typingData = data.typing || {};
        setOtherUserTyping(typingData[userId] || false);
      }
    });
    return () => unsubscribe();
  }, [conversationId, userId]);

  const [initialScrollDone, setInitialScrollDone] = useState(false);

  // Reset scroll when changing conversations
  useEffect(() => {
    setInitialScrollDone(false);
    pinnedToBottomRef.current = true;
  }, [conversationId]);

  useEffect(() => {
    if (messages.length === 0) return;
    if (!initialScrollDone) {
      pinnedToBottomRef.current = true;
      pinMessagesToBottom();
      setInitialScrollDone(true);
      return;
    }
    pinMessagesToBottom();
  }, [messages, initialScrollDone, pinMessagesToBottom]);

  // Keep last message above keyboard when viewport / shell height changes
  useEffect(() => {
    if (loading || connectionCheckLoading || conversationError) return undefined;

    const list = messagesAreaRef.current;
    const onViewportChange = () => pinMessagesToBottom();

    window.visualViewport?.addEventListener('resize', onViewportChange);
    window.visualViewport?.addEventListener('scroll', onViewportChange);
    window.addEventListener('resize', onViewportChange);

    const attrObserver = new MutationObserver(onViewportChange);
    attrObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-chat-keyboard-open', 'data-keyboard-open'],
    });

    const resizeObserver = list ? new ResizeObserver(onViewportChange) : null;
    if (list) resizeObserver.observe(list);

    // iOS keyboard animation settles after focus; pin again once height is final
    pinMessagesToBottom();

    return () => {
      window.visualViewport?.removeEventListener('resize', onViewportChange);
      window.visualViewport?.removeEventListener('scroll', onViewportChange);
      window.removeEventListener('resize', onViewportChange);
      attrObserver.disconnect();
      resizeObserver?.disconnect();
    };
  }, [
    pinMessagesToBottom,
    conversationId,
    loading,
    connectionCheckLoading,
    conversationError,
  ]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (activeReactionMenu && !event.target.closest('.reaction-popup-container')) {
        setActiveReactionMenu(null);
      }
      if (extendedReactionPicker && !event.target.closest('.extended-reaction-picker')) {
        setExtendedReactionPicker(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeReactionMenu, extendedReactionPicker]);

  const handleSendMessage = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (composerBlocked) return;
    if (!newMessage.trim()) return;
    if (!conversationId) return;

    const messageData = {
      type: 'text',
      text: newMessage.trim(),
      replyTo: replyTo || null
    };

    const messageId = await sendMessage(conversationId, messageData);
    if (messageId) {
      setNewMessage('');
      setReplyTo(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    setTypingStatus(conversationId, false);
  };

  const handleTyping = (value) => {
    if (composerBlocked) return;
    setNewMessage(value);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (!isTyping && value) {
      setIsTyping(true);
      setTypingStatus(conversationId, true);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setTypingStatus(conversationId, false);
    }, 2000);
  };

  const handleReaction = async (messageId, emoji) => {
    await addReaction(conversationId, messageId, emoji);
    setActiveReactionMenu(null);
  };

  // Image Upload
  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file || !conversationId || composerBlocked) return;

    try {
      setUploading(true);
      setUploadProgress(30);
      const imageUrl = await uploadImage(file, currentUser.uid, { zone: ImageUploadZone.PRIVATE_DM });
      setUploadProgress(80);

      const messageId = await sendMessage(conversationId, {
        type: 'image',
        text: imageUrl
      });
      if (!messageId) {
        setUploading(false);
        setUploadProgress(0);
        return;
      }
      setUploadProgress(100);
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 500);
    } catch (error) {
      console.error('Error uploading image:', error);
      notifyImageUploadError(showToast, error, t);
      setUploading(false);
      setUploadProgress(0);
    } finally {
      e.target.value = '';
    }
  };



  // Voice Recording
  const startRecording = async () => {
    if (composerBlocked) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());

        try {
          setUploading(true);
          const audioUrl = await uploadVoiceMessage(audioBlob, currentUser.uid);
          const messageId = await sendMessage(conversationId, {
            type: 'voice',
            text: audioUrl,
            duration: recordingDuration
          });
          if (!messageId) {
            setUploading(false);
            return;
          }
          setUploading(false);
        } catch (error) {
          console.error('Error uploading voice:', error);
          showToast(t('failed_send_voice'), 'error');
          setUploading(false);
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      showToast(t('no_mic_access'), 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
    }
  };

  const formatTime = (timestamp) => {
    const ms = messageCreatedAtMs({ createdAt: timestamp });
    if (ms == null) return '';
    return formatAppTime(ms, i18n.language);
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return t('offline');
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return t('just_now');
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return date.toLocaleDateString();
  };

  const handleRetryConversation = () => {
    setConversationError(false);
    setLoading(true);
    setRetryTrigger((t) => t + 1);
  };

  if ((loading || connectionCheckLoading) && !conversationError) {
    return (
      <div dir={i18n.dir()} className="chat-container" data-chat-theme={chatThemeId} style={chatThemeStyle}>
                <div className="chat-header">
                    <button className="back-btn" onClick={goBackFromChat}>
                        <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <div className="header-info" style={{ minWidth: 0, flex: 1 }}><AppText as="h3">{t("loading")}</AppText></div>
                </div>
            </div>);

  }

  if (conversationError) {
    return (
      <div dir={i18n.dir()} className="chat-container" data-chat-theme={chatThemeId} style={chatThemeStyle}>
                <div className="chat-header">
                    <button className="back-btn" onClick={goBackFromChat}>
                        <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <div className="header-info" style={{ minWidth: 0, flex: 1 }}><AppText as="h3">{t("chat_title")}</AppText></div>
                </div>
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <AppText as="p" style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>{t('chat_conversation_start_failed', "Couldn't start conversation.")}</AppText>
                    <button
            onClick={handleRetryConversation}
            style={{
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.95rem'
            }}>
            
                        {t('retry', 'Retry')}
                    </button>
                </div>
            </div>);

  }

  return (
    <div
      ref={containerRef}
      dir={i18n.dir()}
      className="chat-container chat-root"
      data-chat-theme={chatThemeId}
      style={chatThemeStyle}
    >
            <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageSelect} />

            {/* Header */}
            <div className="chat-header" style={{
        background: 'var(--header-bg)',
        borderBottom: '1px solid var(--border-color)',
        boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.06)',
        zIndex: 100
      }}>
                <button className="back-btn" onClick={goBackFromChat} style={{
          background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
          borderRadius: '50%',
          width: '38px',
          height: '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
          color: 'var(--text-main)',
          marginInlineEnd: '12px',
          border: '1px solid var(--border-color)'
        }}>
                    <FaArrowLeft size={18} />
                </button>
                {otherUser &&
        <>
                        <div className="header-avatar" style={{ position: 'relative', display: 'flex', width: '42px', height: '42px', minWidth: '42px', minHeight: '42px', flexShrink: 0, marginInlineEnd: '12px' }}>
                            <UserAvatar
              user={otherUser}
              alt={otherUser.displayName}
              style={{ width: '42px', height: '42px', minWidth: '42px', minHeight: '42px', maxWidth: '42px', maxHeight: '42px', borderRadius: '50%', objectFit: 'cover' }} />
            
                            {otherUser.isOnline && <div className="online-dot" style={{ position: 'absolute', bottom: -2, right: -2, width: '12px', height: '12px', background: '#10b981', borderRadius: '50%', border: '2px solid var(--bg-card)' }} />}
                        </div>
                        <div className="header-info" style={{ textAlign: 'start', minWidth: 0, flex: 1 }}>
                            <AppText as="h3" style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0 }}>{otherUser.displayName}</AppText>
                            <AppText as="p" className="status" style={{ fontSize: '0.8rem', opacity: 0.7 }}>{otherUserTyping ? t('typing') : otherUser.isOnline ? t('online') : formatLastSeen(otherUser.lastSeen)}</AppText>
                        </div>
                    </>
        }
                <ChatThemePicker value={chatThemeId} onChange={setChatThemeId} />
            </div>

            <div className="chat-body-column">
            {/* Messages */}
            {/* dir=ltr keeps own bubbles on the physical right in Arabic UI */}
            <div ref={messagesAreaRef} className="messages-area" dir="ltr" onScroll={handleScroll} style={{ paddingBottom: '16px' }}>
                {messages.map((msg, index) => {
            const daySep = shouldShowChatDaySeparator(messages, index);
            const dayLabel = daySep
              ? formatChatDaySeparator(messageCreatedAtMs(msg), i18n.language, t)
              : '';
            const dayChip = daySep && dayLabel ? (
              <div key={`day-${msg.id}`} className="chat-day-sep" aria-label={dayLabel}>
                <span className="chat-day-sep-chip">{dayLabel}</span>
              </div>
            ) : null;

            const isSystem = msg.type === 'system' || msg.isSystemMessage === true;
            if (isSystem) {
              return (
                <React.Fragment key={msg.id}>
                  {dayChip}
                  <div className="chat-system-message-row">
                                <div className="chat-system-message">
                                    <AppText as="span" className="chat-system-message__brand">
                                        {msg.senderName || 'DineBuddies'}
                                    </AppText>
                                    <AppText as="p" className="chat-system-message__text">{msg.text}</AppText>
                                    <AppText as="span" className="chat-system-message__time">{formatTime(msg.createdAt)}</AppText>
                                </div>
                            </div>
                </React.Fragment>);

            }

            const isOwn = msg.senderId === currentUser?.uid;
            const groupPosition = getMessageGroupPosition(messages, index);

            return (
              <React.Fragment key={msg.id}>
              {dayChip}
              <div
                className={`message-wrapper ${isOwn ? 'own' : 'other'} message-group-${groupPosition}`}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!isOwn) {
                    setActiveReactionMenu(msg.id);
                  }
                }}>
                            <div className="message-content-wrapper">
                                {msg.replyTo &&
                  <div className="reply-preview">
                                        <div className="reply-line" />
                                        <div className="reply-content"><AppText as="p" className="reply-text" dir="auto">{msg.replyTo.text}</AppText></div>
                                    </div>
                  }

                                <div className="message-bubble" style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                                    {msg.type === 'shared_content' &&
                    <div style={{ marginBottom: msg.text ? '8px' : '0' }}>
                                            <SharedContentBubble data={msg.sharedContent} />
                                        </div>
                    }
                                    {msg.type === 'image' && <img src={msg.text} alt="Shared" className="message-image" />}
                                    
                                    {msg.type === 'voice' &&
                    <div className="voice-message">
                                            <audio controls src={msg.text} style={{ maxWidth: '250px' }} />
                                            <AppText as="span" className="voice-duration">{formatDuration(msg.duration || 0)}</AppText>
                                        </div>
                    }
                                    {msg.type === 'file' &&
                    <div className="file-message">
                                            <FaFile size={24} />
                                            <div className="file-info">
                                                <AppText as="p" className="file-name">{msg.fileName || t('file_default')}</AppText>
                                                <AppText as="p" className="file-size">{formatFileSize(msg.fileSize || 0)}</AppText>
                                            </div>
                                            <a href={msg.text} download target="_blank" rel="noreferrer"><FaDownload /></a>
                                        </div>
                    }

                                    {/* Inline Text and Time */}
                                    <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: '4px 12px' }}>
                                        {(msg.type === 'text' || msg.type === 'shared_content' && msg.text) &&
                      <AppText as="span" dir="auto" className="message-text" style={{ flex: '1 1 auto', margin: 0, minWidth: 0, wordBreak: 'break-word', paddingTop: '2px' }}>
                                                {msg.text}
                                            </AppText>
                      }
                                        <div className="message-meta" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginInlineStart: 'auto', paddingBottom: 0, flexShrink: 0 }}>
                                            <AppText as="span" className="message-time" style={{ fontSize: '0.65rem', opacity: 0.8, whiteSpace: 'nowrap' }}>{formatTime(msg.createdAt)}</AppText>
                                            {(() => {
                                              const receipt = getMessageReceiptDisplay(msg, currentUser?.uid);
                                              return receipt ?
                                              <AppText as="span" className={`message-status message-status--${receipt.state}`} style={{ fontSize: '0.7rem', display: 'flex' }}>{receipt.ticks}</AppText> :
                                              null;
                                            })()}
                                        </div>
                                    </div>

                                    {/* Reaction Badge */}
                                    {msg.reactions && Object.keys(msg.reactions).length > 0 &&
                    <div className="message-reaction-badge">
                                            {Object.entries(msg.reactions).
                      filter(([_, users]) => users && users.length > 0).
                      slice(0, 3).
                      map(([emoji, users]) =>
                      <AppText as="span" key={emoji}>{emoji} {users.length > 1 && <AppText as="span" style={{ fontSize: '9px', marginLeft: '1px' }}>{users.length}</AppText>}</AppText>
                      )
                      }
                                        </div>
                    }
                                </div>

                                {/* Reaction Popup Menu */}
                                {activeReactionMenu === msg.id &&
                  <div className="reaction-popup-container" onClick={(e) => e.stopPropagation()}>
                                        {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) =>
                    <AppText as="span"
                    key={emoji}
                    className="reaction-popup-item"
                    onClick={() => handleReaction(msg.id, emoji)}>
                      
                                                {emoji}
                                            </AppText>
                    )}
                                        {shouldUseAppEmojiPicker() &&
                    <div
                      className="reaction-popup-item"
                      style={{ background: '#374151', borderRadius: '50%', padding: '2px', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }}
                      onClick={() => {
                        setExtendedReactionPicker(msg.id);
                        setActiveReactionMenu(null);
                      }}>
                      
                                                <FaPlus style={{ color: '#9CA3AF' }} />
                                            </div>
                    }
                                    </div>
                  }

                                {/* Extended Emoji Picker for Reactions (desktop - touch uses system keyboard) */}
                                {extendedReactionPicker === msg.id && shouldUseAppEmojiPicker() &&
                  <div className="extended-reaction-picker" style={{ position: 'absolute', bottom: '40px', left: '0', zIndex: 1001 }} onClick={(e) => e.stopPropagation()}>
                                        <Suspense fallback={<div style={{ width: 300, height: 350, background: '#111827' }} />}>
                                            <LazyEmojiPicker
                        onEmojiClick={(emojiObject) => {
                          handleReaction(msg.id, emojiObject.emoji);
                          setExtendedReactionPicker(null);
                        }}
                        width="300px"
                        height="350px"
                        theme="dark"
                        searchDisabled={true}
                        previewConfig={{ showPreview: false }} />
                      
                                        </Suspense>
                                    </div>
                  }
                            </div>
                        </div>
              </React.Fragment>);

          })}

                {otherUserTyping &&
          <div className="typing-indicator">
                        <div className="typing-dots"><AppText as="span"></AppText><AppText as="span"></AppText><AppText as="span"></AppText></div>
                    </div>
          }

                <div ref={messagesEndRef} />

                {showScrollBottom &&
          <button
            type="button"
            className="chat-scroll-fab"
            onClick={scrollToBottom}
            style={{
              background: 'var(--accent-color)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
              transition: 'all 0.3s ease'
            }}>
            
                        <FaArrowDown />
                    </button>
          }
            </div>

            {blockedVariant ? (
              <div className="chat-blocked-overlay" role="alert" aria-live="polite">
                <div className={`chat-blocked-card chat-blocked-card--${blockedVariant}`}>
                  <div className="chat-blocked-card__icon" aria-hidden>
                    {blockedVariant === 'restricted' ? <FaBan /> : <FaLock />}
                  </div>
                  <AppText as="h2" className="chat-blocked-card__title">
                    {blockedVariant === 'restricted'
                      ? t('chat_messaging_restricted_title', 'Messaging unavailable')
                      : t('chat_connection_locked_title', 'Chat locked')}
                  </AppText>
                  <AppText as="p" className="chat-blocked-card__desc">
                    {blockedVariant === 'restricted'
                      ? t(
                          'chat_messaging_restricted',
                          'Messaging is not available with this user.'
                        )
                      : t(
                          'chat_connection_locked',
                          'You need a mutual connection to chat - like, follow, or acquaintance match.'
                        )}
                  </AppText>
                  {blockedVariant === 'connection' && userId ? (
                    <button
                      type="button"
                      className="chat-blocked-card__action"
                      onClick={() => navigate(`/profile/${userId}`)}>
                      {t('chat_connection_locked_cta', 'View profile to connect')}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {!composerBlocked ? (
            <>
            {
        replyTo &&
        <div className="reply-bar">
                        <div className="reply-bar-content">
                            <div className="reply-line" />
                            <div className="reply-info">
                                <AppText as="p" className="reply-label">{t("replying_to")}</AppText>
                                <AppText as="p" className="reply-message">{replyTo.text}</AppText>
                            </div>
                        </div>
                        <button onClick={() => setReplyTo(null)} className="reply-close">×</button>
                    </div>

        }

            {
        uploading &&
        <div className="upload-progress-bar">
                        <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                        <AppText as="span">{t("uploading")} {uploadProgress}%</AppText>
                    </div>

        }

            <div className="chat-footer-stack">
            <div ref={composerRef} className="chat-composer-row">
                <div className="input-wrapper chat-composer-input">
                    {isRecording ?
              <div className="recording-ui" style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            <div className="recording-info" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="recording-pulse"></div>
                                <AppText as="span" className="recording-timer">{formatDuration(recordingDuration)}</AppText>
                            </div>
                            <button className="delete-recording-btn" onClick={stopRecording}>
                                <FaStop /> {t('chat_voice_stop', 'Stop')}
                            </button>
                        </div> :

              <>
                            <AppTextInput
                  ref={inputRef}
                  type="text"
                  name="chat-message-input"
                  autoComplete="off"
                  autoCorrect="off"
                  enterKeyHint="send"
                  placeholder={t("message_placeholder")}
                  value={newMessage}
                  onChange={(e) => handleTyping(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(e)}
                  onFocus={() => {
                    pinnedToBottomRef.current = true;
                    pinMessagesToBottom();
                    window.setTimeout(() => pinMessagesToBottom(), 120);
                    window.setTimeout(() => pinMessagesToBottom(), 320);
                  }}
                  className="chat-input-field" />
                
                {showComposerEmojiButton() ?
                <button
                  ref={emojiBtnRef}
                  type="button"
                  className="composer-icon-btn chat-composer-icon-btn composer-icon-btn--emoji"
                  onClick={() => handleEmojiButtonClick({ inputRef, setPickerOpen: setEmojiPickerOpen })}
                  title="Emoji">
                  
                                    😊
                                </button>
                : null}
                            <button
                  type="button"
                  className="composer-icon-btn chat-composer-icon-btn"
                  onClick={() => imageInputRef.current?.click()}
                  aria-label={t('attach_photo', { defaultValue: 'Attach photo' })}>
                                <FaCamera />
                            </button>
                        </>
              }
                </div>

                <button
              className={`chat-send-btn${isRecording ? ' chat-send-btn--recording' : ''}`}
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={newMessage.trim() ? handleSendMessage : startRecording}>
              
                    {isRecording ? <FaPaperPlane /> : newMessage.trim() ? <FaPaperPlane /> : <FaMicrophone />}
                </button>
            </div>

          <EmojiPickerPortal
            open={emojiPickerOpen}
            onClose={() => setEmojiPickerOpen(false)}
            anchorRef={emojiBtnRef}
            onEmojiClick={(data) => {
              handleEmojiClick(data);
            }} />
            </div>
            </>
            ) : null}
            </div>
        </div>);

};

export default Chat;


