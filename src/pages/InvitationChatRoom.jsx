import { useTranslation } from 'react-i18next';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  FaArrowLeft, FaPaperPlane, FaMicrophone, FaTrash,
  FaImage, FaUsers } from
'react-icons/fa';
import { startRecording, uploadVoiceMessage, uploadImage, formatDuration } from '../utils/mediaUtils';
import { notifyImageUploadError } from '../utils/imageModerationErrors';
import { getSafeAvatar, pickSafeDisplayImageUrl } from '../utils/avatarUtils';
import UserAvatar from '../components/UserAvatar';
import CommunityChatMessages from '../components/community/CommunityChatMessages';
import EmojiPickerPortal from '../components/EmojiPickerPortal';
import { handleEmojiButtonClick, showComposerEmojiButton } from '../utils/emojiInputMode';
import './CommunityChatRoom.css';
import '../styles/chatReferenceTheme.css';
import '../components/community/community-chat-theme.css';
import '../components/community/CommunityChatSwipePager.css';
import { createNotification } from '../utils/notificationHelpers';
import { goToLogin } from '../utils/goToLogin';
import { attachChatShellToVisualViewport } from '../utils/chatVisualViewportLock';
import {
  getHostedInvitationChatPath,
  getHostedInvitationDetailsPath } from
'../utils/hostedInvitationRoutes';
import { AppText, AppTextInput } from "../components/base";
import { syncMessageReceiptDocs } from '../utils/chatMessageReceipts';
import { useChatTheme } from '../hooks/useChatTheme';
import ChatThemePicker from '../components/chat/ChatThemePicker';

const InvitationChatRoom = () => {
  const { t, i18n } = useTranslation();
  const { id: invitationId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile, isGuest } = useAuth();
  const { showToast } = useToast();
  const { themeId: chatThemeId, setThemeId: setChatThemeId, themeStyle: chatThemeStyle } = useChatTheme();

  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [invitation, setInvitation] = useState(null);
  // Tracks which Firestore collection this invitation lives in
  const [collectionName, setCollectionName] = useState('invitations');

  useEffect(() => {
    if (!loading && (!currentUser || isGuest)) {
      goToLogin();
    }
  }, [currentUser, isGuest, loading, navigate]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Refs
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiBtnRef = useRef(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const latestMessageDocsRef = useRef([]);
  const readReceiptTimeoutRef = useRef(null);

  const containerRef = useRef(null);
  const composerRef = useRef(null);

  // Audio State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingRef = useRef(null);
  const timerRef = useRef(null);

  const hostId = invitation?.authorId || invitation?.author?.id || invitation?.hostId || null;
  const chatMessages = useMemo(
    () =>
      messages.map((msg) => {
        if (msg.type === 'image') {
          return { ...msg, text: msg.imageUrl || msg.text || '' };
        }
        if (msg.type === 'audio' || msg.type === 'voice') {
          return { ...msg, text: msg.audioUrl || msg.text || '' };
        }
        return msg;
      }),
    [messages]
  );

  useEffect(() => {
    const { detach } = attachChatShellToVisualViewport(() => containerRef.current);
    return detach;
  }, []);

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

  // --- 1. Fetch Invitation & Verify Access ---
  useEffect(() => {
    const fetchInvitation = async () => {
      if (!invitationId) return;
      // Wait for auth to be ready before trying to verify membership
      if (!currentUser || !currentUser.uid) return;
      try {
        // Try public invitations first, fall back to private
        let invSnap = await getDoc(doc(db, 'invitations', invitationId));
        let resolvedCollection = 'invitations';

        if (!invSnap.exists()) {
          invSnap = await getDoc(doc(db, 'social_invitations', invitationId));
          resolvedCollection = 'social_invitations';
        }

        if (invSnap.exists()) {
          const data = invSnap.data();
          setInvitation(data);
          setCollectionName(resolvedCollection);

          // Robust Access Check
          const hostId = data.authorId || data.author?.id;
          const isHost = hostId === currentUser.uid;

          const members = data.joinedMembers || data.joined || [];
          const isPrivateAccepted = resolvedCollection === 'social_invitations' &&
          data.rsvps?.[currentUser.uid] === 'accepted';
          const isParticipant = members.includes(currentUser.uid) || isPrivateAccepted;

          if (!isHost && !isParticipant) {
            showToast(t('not_group_member'), 'error');
            const detailsPath =
            resolvedCollection === 'social_invitations' ?
            getHostedInvitationDetailsPath({ id: invitationId, ...data }) :
            `/invitation/${invitationId}`;
            navigate(detailsPath);
          }
        } else {
          navigate('/', { replace: true, state: { message: t('invitation_ended') } });
        }
      } catch (error) {
        console.error("Error fetching invitation:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchInvitation();
  }, [invitationId, currentUser?.uid, navigate]);

  // Resilience: if invitation is deleted while in chat (e.g. by Cloud Function), redirect to home
  useEffect(() => {
    if (!invitationId || !collectionName || !invitation) return;
    const invRef = doc(db, collectionName, invitationId);
    const unsubscribe = onSnapshot(invRef, (snapshot) => {
      if (!snapshot.exists()) {
        navigate('/', { replace: true, state: { message: t('invitation_ended') } });
      }
    }, (err) => {
      console.error('Invitation snapshot error:', err);
    });
    return () => unsubscribe();
  }, [invitationId, collectionName, invitation, navigate]);

  // --- 2. Real-time Messages ---
  useEffect(() => {
    if (!invitationId || !collectionName) return;

    const q = query(
      collection(db, collectionName, invitationId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      latestMessageDocsRef.current = snapshot.docs;
      const msgs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setMessages(msgs);
      if (currentUser?.uid) {
        void syncMessageReceiptDocs({
          db,
          messageDocs: snapshot.docs,
          viewerId: currentUser.uid,
          markRead: false
        });
      }
    });

    return () => unsubscribe();
  }, [invitationId, collectionName, currentUser?.uid]);

  useEffect(() => {
    if (readReceiptTimeoutRef.current) {
      clearTimeout(readReceiptTimeoutRef.current);
      readReceiptTimeoutRef.current = null;
    }
    if (!invitationId || !collectionName || !currentUser?.uid || messages.length === 0) {
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
    }, 900);

    return () => {
      if (readReceiptTimeoutRef.current) {
        clearTimeout(readReceiptTimeoutRef.current);
        readReceiptTimeoutRef.current = null;
      }
    };
  }, [collectionName, currentUser?.uid, invitationId, messages]);

  // Cleanup recording timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // --- Handlers ---

  // Image Handlers
  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const imageUrl = await uploadImage(file, currentUser.uid);
      await addDoc(collection(db, collectionName, invitationId, 'messages'), {
        text: '',
        imageUrl: imageUrl,
        senderId: currentUser.uid,
        senderName: userProfile?.display_name || currentUser.displayName || 'User',
        senderAvatar: getSafeAvatar(userProfile || currentUser),
        createdAt: serverTimestamp(),
        type: 'image',
        status: 'sent',
        deliveredTo: [],
        readBy: []
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      notifyImageUploadError(showToast, error, t);
    } finally {
      setIsUploadingImage(false);
      e.target.value = '';
    }
  };

  // Voice Handlers
  const handleStartRecording = async () => {
    try {
      const start = await startRecording();
      recordingRef.current = start.stop;
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Mic Error:", error);
      showToast(t('no_mic_access'), 'error');
    }
  };

  const handleStopRecording = async (shouldSend = true) => {
    if (!recordingRef.current) return;

    clearInterval(timerRef.current);
    const audioBlob = await recordingRef.current();
    setIsRecording(false);
    setRecordingDuration(0);
    recordingRef.current = null;

    if (shouldSend && audioBlob) {
      await sendVoiceMessage(audioBlob);
    }
  };

  const sendVoiceMessage = async (audioBlob) => {
    try {
      const url = await uploadVoiceMessage(audioBlob, currentUser.uid);
      await addDoc(collection(db, collectionName, invitationId, 'messages'), {
        text: '',
        audioUrl: url,
        senderId: currentUser.uid,
        senderName: userProfile?.display_name || currentUser.displayName || 'User',
        senderAvatar: getSafeAvatar(userProfile || currentUser),
        createdAt: serverTimestamp(),
        type: 'audio',
        duration: recordingDuration,
        status: 'sent',
        deliveredTo: [],
        readBy: []
      });
    } catch (error) {
      console.error("Error sending voice:", error);
      showToast(t('failed_send_voice'), 'error');
    }
  };

  // Text Handler
  const handleSendMessage = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newMessage.trim()) return;

    const text = newMessage.trim();

    try {
      await addDoc(collection(db, collectionName, invitationId, 'messages'), {
        text: text,
        senderId: currentUser.uid,
        senderName: userProfile?.display_name || currentUser.displayName || 'User',
        senderAvatar: getSafeAvatar(userProfile || currentUser),
        createdAt: serverTimestamp(),
        type: 'text',
        status: 'sent',
        deliveredTo: [],
        readBy: []
      });
      setNewMessage('');
      setTimeout(() => inputRef.current?.focus(), 10);

      // Notify all participants (host + joined members) except the sender
      const hostId = invitation?.authorId || invitation?.author?.id;
      const members = invitation?.joinedMembers || invitation?.joined || [];
      const recipients = [hostId, ...members].filter((id) => id && id !== currentUser.uid);
      const senderName = userProfile?.display_name || 'Someone';
      const actionUrl =
      collectionName === 'social_invitations' ?
      getHostedInvitationChatPath({ id: invitationId, ...invitation }) :
      `/invitation/${invitationId}/chat`;
      recipients.forEach((userId) => {
        createNotification({
          userId,
          type: 'message',
          title: senderName,
          message: text.slice(0, 80),
          actionUrl
        }).catch(() => {});
      });
    } catch (error) {
      console.error("Error sending:", error);
      showToast(t('failed_send_message'), 'error');
    }
  };

  if (loading) return (
    <div dir={i18n.dir()} className="chat-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t("loading_chat")}</div>
        </div>);


  const invImage = pickSafeDisplayImageUrl(
    invitation?.customImage,
    invitation?.restaurantImage,
    invitation?.image
  );

  return (
    <div
      ref={containerRef}
      dir={i18n.dir()}
      className="chat-screen invitation-chat-root community-chat-root"
      data-chat-theme={chatThemeId}
      style={chatThemeStyle}
    >

            {/* Subtle dot-grid overlay for depth */}
            <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle, var(--accent-color, rgba(99,102,241,0.06)) 1px, transparent 1px)',
        backgroundSize: '26px 26px', opacity: 0.08,
        pointerEvents: 'none', zIndex: 0
      }} />

            {/* â•â•â•â•â•â•â•â•â•â•  HEADER  â•â•â•â•â•â•â•â•â•â• */}
            <header className="chat-header" style={{
        flexShrink: 0,
        position: 'relative',
        zIndex: 50,
        overflow: 'visible',
        background: 'var(--header-bg)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid var(--border-color, rgba(99,102,241,0.15))',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
      }}>
                {/* Invitation image ghost behind header */}
                {invImage &&
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${invImage})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: 0.07, filter: 'blur(10px)', transform: 'scale(1.15)',
          pointerEvents: 'none'
        }} />
        }

                {/* Top row: back + avatar + info + members */}
                <div style={{
          position: 'relative', zIndex: 1,
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 14px',
          minHeight: '64px'
        }}>
                    {/* Back btn */}
                    <button
            onClick={() =>
            navigate(
              collectionName === 'social_invitations' ?
              getHostedInvitationDetailsPath({ id: invitationId, ...invitation }) :
              `/invitation/${invitationId}`,
              { replace: true }
            )
            }
            style={{
              background: 'rgba(108,92,231,0.15)',
              border: '1px solid rgba(108,92,231,0.3)',
              color: 'var(--text-primary)', width: '36px', height: '36px',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s'
            }}>
            
                        <FaArrowLeft size={14} style={{ transform: i18n.language === 'ar' ? 'rotate(180deg)' : 'none' }} />
                    </button>

                    {/* Host avatar with gold ring + HOST badge */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                        <UserAvatar
              src={getSafeAvatar(invitation?.author)}
              user={invitation?.author}
              alt="Host"
              style={{
                width: '44px', height: '44px', minWidth: '44px', minHeight: '44px', maxWidth: '44px', maxHeight: '44px',
                objectFit: 'cover',
                border: '2px solid #fbbf24',
                borderRadius: '50%',
                boxShadow: '0 0 14px rgba(251,191,36,0.35)'
              }} />
            
                        <div style={{
              position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)',
              background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
              color: '#000', fontSize: '6.5px', fontWeight: '900',
              padding: '1.5px 4px', borderRadius: '4px', letterSpacing: '0.5px',
              whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
            }}>{t("host_badge")}</div>
                    </div>

                    {/* Invitation title + location + date */}
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <AppText as="h2" style={{
              margin: '0 0 3px', fontSize: '0.92rem', fontWeight: '800',
              color: 'var(--text-primary)', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2
            }}>
                            {invitation?.title || t('group_chat')}
                        </AppText>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                            {invitation?.location &&
              <AppText as="span" style={{
                fontSize: '0.68rem', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: '2px',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px'
              }}>
                                    📍 {invitation.location}
                                </AppText>
              }
                            {invitation?.date &&
              <AppText as="span" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                                    📅 {new Date(invitation.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                                    {invitation.time && ` · ${invitation.time}`}
                                </AppText>
              }
                        </div>
                    </div>

                    {/* Members pill */}
                    <div style={{
            background: 'rgba(108,92,231,0.15)',
            border: '1px solid rgba(108,92,231,0.3)',
            borderRadius: '20px', padding: '5px 10px',
            display: 'flex', alignItems: 'center', gap: '5px',
            flexShrink: 0
          }}>
                        <FaUsers size={11} style={{ color: 'var(--accent-color)' }} />
                        <AppText as="span" style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--accent-color)' }}>
                            {(invitation?.joinedMembers || invitation?.joined || []).length + 1}
                        </AppText>
                    </div>
                    <ChatThemePicker value={chatThemeId} onChange={setChatThemeId} />
                </div>
            </header>

            <div className="chat-body-column">
            <CommunityChatMessages
              messages={chatMessages}
              currentUserId={currentUser?.uid}
              partnerId={hostId}
              isHost={Boolean(currentUser?.uid && hostId && currentUser.uid === hostId)}
              emptyContent={
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', minHeight: '250px', gap: '16px', padding: '32px 24px'
                }}>
                  {invImage ? (
                    <div style={{
                      width: '90px', height: '90px', borderRadius: '18px', overflow: 'hidden',
                      border: '2px solid rgba(108,92,231,0.4)',
                      boxShadow: '0 8px 20px rgba(0,0,0,0.2)'
                    }}>
                      <img src={invImage} alt="Venue" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : null}
                  <div style={{ textAlign: 'center' }}>
                    <AppText as="p" style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px' }}>{t('say_hello')} 👋</AppText>
                    <AppText as="p" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>{t('start_conversation_first')}</AppText>
                  </div>
                </div>
              }
            />

            <div className="chat-footer-stack">
            {isUploadingImage &&
          <div
            role="status"
            style={{
              padding: '10px 14px',
              textAlign: 'center',
              fontSize: '0.9rem',
              color: 'var(--text-secondary, #94a3b8)',
              background: 'var(--bg-darker)',
              borderTop: '1px solid var(--border-color)'
            }}>
            
                    {t('image_upload_checking')}
                </div>
          }
            <div ref={composerRef} className="chat-composer-row">
                <div className="input-wrapper chat-composer-input">
                    {/* Image Input (Hidden) */}
                    <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleImageUpload} />
              

                    {isRecording ?
              <div className="recording-ui" style={{ flex: 1, color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FaMicrophone className="recording-pulse" />
                                <AppText as="span">{formatDuration(recordingDuration)}</AppText>
                            </div>
                            <button onClick={() => handleStopRecording(false)} style={{ background: 'none', border: 'none', color: '#94a3b8' }}>
                                <FaTrash />
                            </button>
                        </div> :

              <>
                            <AppTextInput
                  ref={inputRef}
                  type="text"
                  className="message-input"
                  placeholder={t("type_message")}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(e)}
                  autoComplete="off" />
                
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
                  onClick={handleImageClick}
                  aria-label={t('attach_photo', { defaultValue: 'Attach photo' })}>
                                <FaImage size={18} />
                            </button>
                        </>
              }
                </div>

                <button
              className={`send-btn-circle chat-send-btn${isRecording ? ' chat-send-btn--recording' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                if (isRecording) handleStopRecording(true);else
                handleSendMessage(e);
              }}>
              
                    {isRecording ? <FaPaperPlane /> : newMessage.trim() ? <FaPaperPlane /> : <FaMicrophone onMouseDown={(e) => {e.preventDefault();e.stopPropagation();handleStartRecording();}} />}
                </button>
            </div>

          <EmojiPickerPortal
            open={emojiPickerOpen}
            onClose={() => setEmojiPickerOpen(false)}
            anchorRef={emojiBtnRef}
            onEmojiClick={handleEmojiClick} />
            </div>
            </div>
        </div>);


};

export default InvitationChatRoom;


