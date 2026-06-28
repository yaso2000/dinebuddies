import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { uploadPostMedia } from '../utils/imageUpload';
import { notifyImageUploadError } from '../utils/imageModerationErrors';
import { getSafeAvatar } from '../utils/avatarUtils';
import { parseAiStudioImageFromState } from '../utils/aiStudioImagePayload';
import { publishGeoFirestoreFields, resolvePostPublishGeo } from '../utils/postPublishGeo';
import { extractAIContentFields } from '../utils/aiContentFieldMapper';
import { buildRegularPostAiUserPrompt } from '../utils/aiPromptLocale';
import AIFloatingLauncher from './AIFloatingLauncher';
import FeedAiImageLauncher from './FeedAiImageLauncher';
import { FaImage, FaTimes, FaSmile, FaPaperPlane } from 'react-icons/fa';
import TikTokEmbed from './TikTokEmbed';
import { buildYoutubeEmbedSrc, parseYoutubeLink, YOUTUBE_EMBED_ALLOW } from '../utils/videoEmbedUtils';
import { useEditorSessionAutosave } from '../hooks/useEditorSessionAutosave';
import {
  inlinePostDraftKey,
  isInlinePostDraftEmpty,
  restoreEditorMedia,
  serializeEditorMedia } from
'../utils/editorSessionDraft';
import { AppText, AppTextInput } from "./base";

const POST_TITLE_MAX = 100;
const POST_BODY_MAX = 300;

const CUSTOM_EMOJIS = [
'😀', '😂', '🤣', '😍', '🥰', '😘', '😋', '😎', '🥳', '🤩', '😡', '😭', '😱', '🤔', '😴',
'🍔', '🍟', '🍕', '🌭', '🌮', '🌯', '🥗', '🍝', '🍜', '🍣', '🍤', '🍦', '🍩', '🍪', '🎂', '🍰', '🍫',
'☕', '🍵', '🧋', '🍺', '🍷', '🥂', '🍹',
'🎈', '🎆', '🎁', '🎊', '🎉', '🕯️', '🎵', '🎶', '💃', '🕺'];


const extractAndRemoveLink = (inputText) => {
  let newText = inputText;
  let embed = null;

  const ytParsed = parseYoutubeLink(newText);
  if (ytParsed?.id) {
    const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})[^\s]*/i;
    const ytMatch = newText.match(ytRegex);
    embed = { type: 'youtube', id: ytParsed.id, isShort: ytParsed.isShort };
    if (ytMatch?.[0]) newText = newText.replace(ytMatch[0], '').trim();
    return { text: newText, embed };
  }

  const ttRegex = /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[a-zA-Z0-9_.]+\/video\/([0-9]+)[^\s]*/i;
  const igRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel)\/([a-zA-Z0-9_-]+)[^\s]*/i;

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

const InlinePostEditor = ({
  attachedInvitation: attachedInvitationProp = null,
  onClearAttachedInvitation,
  initialAiStudioImage = null,
  onClearInitialAiStudioImage
}) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar' || i18n.language?.startsWith('ar');
  const { currentUser, userProfile } = useAuth();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [media, setMedia] = useState(null);
  const [embedData, setEmbedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isCheckingImage, setIsCheckingImage] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachedInvitation, setAttachedInvitation] = useState(attachedInvitationProp);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const [authorInfo, setAuthorInfo] = useState({
    name: userProfile?.display_name || userProfile?.name || currentUser?.displayName || 'User',
    avatar: getSafeAvatar(userProfile || currentUser)
  });

  useEffect(() => {
    if (attachedInvitationProp) {
      setAttachedInvitation(attachedInvitationProp);
    }
  }, [attachedInvitationProp]);

  useEffect(() => {
    const studio = parseAiStudioImageFromState(initialAiStudioImage);
    if (!studio) return;
    setMedia({ type: 'image', preview: studio.publishedUrl, url: studio.publishedUrl });
    setEmbedData(null);
  }, [initialAiStudioImage]);

  useEffect(() => {
    if (userProfile) {
      setAuthorInfo({
        name: userProfile.display_name || userProfile.name || userProfile.businessInfo?.businessName || currentUser?.displayName || 'User',
        avatar: getSafeAvatar(userProfile || currentUser)
      });
    } else if (currentUser?.uid) {
      getDoc(doc(db, 'users', currentUser.uid)).then((snap) => {
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
    e.target.value = null;
  };

  const buildRegularPostAiPrompt = useCallback(
    () => buildRegularPostAiUserPrompt({ title, text, attachedInvitation }),
    [title, text, attachedInvitation]
  );

  const handleRegularPostAiContent = useCallback((data) => {
    const fields = extractAIContentFields('regular_post', data);
    if (fields.title) setTitle(fields.title.slice(0, POST_TITLE_MAX));
    if (fields.text) setText(fields.text.slice(0, POST_BODY_MAX));
  }, []);

  const handleAiImageInsert = useCallback(({ url, preview }) => {
    if (!url) return;
    setMedia({ type: 'image', preview: preview || url, url });
    setEmbedData(null);
  }, []);

  const draftStorageKey = useMemo(
    () => currentUser?.uid ? inlinePostDraftKey(currentUser.uid) : null,
    [currentUser?.uid]
  );

  const buildSessionDraftPayload = useCallback(
    async () => ({
      title,
      text,
      media: await serializeEditorMedia(media),
      embedData: embedData || null
    }),
    [embedData, media, text, title]
  );

  const applySessionDraftPayload = useCallback(async (draft) => {
    if (typeof draft.title === 'string') setTitle(draft.title);
    if (typeof draft.text === 'string') setText(draft.text);
    if (draft.embedData) setEmbedData(draft.embedData);
    const restoredMedia = await restoreEditorMedia(draft.media);
    if (restoredMedia) setMedia(restoredMedia);
  }, []);

  const { clearDraft: clearSessionDraft } = useEditorSessionAutosave({
    enabled: Boolean(currentUser?.uid),
    storageKey: draftStorageKey,
    ready: true,
    skipRestore: Boolean(attachedInvitationProp || initialAiStudioImage),
    buildPayload: buildSessionDraftPayload,
    applyPayload: applySessionDraftPayload,
    isEmpty: isInlinePostDraftEmpty,
    onRestored: () =>
    showToast(t('post_draft_restored', 'Your unsaved post was restored.'), 'info'),
    deps: [title, text, media, embedData]
  });

  const canPost = Boolean(title.trim() || text.trim() || media || embedData || attachedInvitation);

  const handleSubmit = async () => {
    if (!canPost || loading) return;
    setLoading(true);
    setUploadProgress(0);
    setIsCheckingImage(false);

    try {
      let mediaUrl = null;
      let mediaType = media?.type || null;

      if (embedData) {
        mediaUrl = embedData.id;
        mediaType = embedData.type;
      } else if (media?.file) {
        const safeName = String(media.file.name || 'image.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `community-posts/${currentUser.uid}/post_${Date.now()}_${safeName}`;
        setIsCheckingImage(true);
        mediaUrl = await uploadPostMedia(
          media.file,
          currentUser.uid,
          path,
          (p) => setUploadProgress(Math.round(p)),
          'image'
        );
      } else if (media?.url) {
        mediaUrl = media.url;
        mediaType = 'image';
      }

      const publishGeo = await resolvePostPublishGeo(userProfile);

      const postData = {
        author: {
          id: currentUser.uid,
          name: authorInfo.name,
          avatar: authorInfo.avatar
        },
        authorId: currentUser.uid,
        postTitle: title.trim() || null,
        content: text.trim(),
        mediaUrl: mediaUrl,
        mediaType: mediaType,
        ...(embedData?.type === 'youtube' && embedData.isShort ?
        { youtubeShort: true, mediaAspect: '9:16' } :
        {}),
        textStyle: {
          fontSize: 16,
          textAlign: isRtl ? 'right' : 'left',
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
        ...publishGeoFirestoreFields(publishGeo),
        authorInterests: Array.isArray(userProfile?.interests) ?
        userProfile.interests :
        Array.isArray(userProfile?.hobbies) ?
        userProfile.hobbies :
        [],
        attachedInvitation: attachedInvitation || null
      };

      await addDoc(collection(db, 'communityPosts'), postData);
      clearSessionDraft();

      // Revert state after success
      setTitle('');
      setText('');
      setMedia(null);
      setEmbedData(null);
      setAttachedInvitation(null);
      setShowEmojiPicker(false);
      onClearAttachedInvitation?.();
      onClearInitialAiStudioImage?.();
      setUploadProgress(0);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.blur();
      }
      showToast(t('post_created', 'Post created successfully!'), 'success');

    } catch (error) {
      console.error("Error creating post:", error);
      notifyImageUploadError(showToast, error, t, 'post_failed');
    } finally {
      setLoading(false);
      setIsCheckingImage(false);
      setUploadProgress(0);
    }
  };

  return (
    <div
      className="inline-post-editor composer-shell composer-shell--post"
      style={{ borderRadius: 8, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      
            {attachedInvitation ?
      <div
        style={{
          display: 'flex',
          gap: '10px',
          padding: '10px',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          background: 'var(--hover-overlay)',
          alignItems: 'center'
        }}>
        
                    <img
          src={attachedInvitation.image || 'https://via.placeholder.com/80'}
          alt=""
          style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
        
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                            {attachedInvitation.title}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            📅 {attachedInvitation.date} • ⏰ {attachedInvitation.time}
                        </div>
                    </div>
                    <button
          type="button"
          onClick={() => {
            setAttachedInvitation(null);
            onClearAttachedInvitation?.();
          }}
          aria-label={t('remove', 'Remove')}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 4
          }}>
          
                        <FaTimes />
                    </button>
                </div> :
      null}
            <div className="inline-post-editor__compose">
                <div
          className="composer-field composer-field--post"
          style={{ textAlign: isRtl ? 'right' : 'left', direction: isRtl ? 'rtl' : 'ltr' }}>
          
                    <AppTextInput
            type="text"
            className="composer-field__title"
            placeholder={t('post_headline_placeholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, POST_TITLE_MAX))}
            maxLength={POST_TITLE_MAX} />
          
                    <AppTextInput as="textarea"
          ref={textareaRef}
          className="composer-field__input"
          placeholder={t('whats_on_your_mind', "What's on your mind?")}
          value={text}
          onChange={handleTextChange}
          maxLength={POST_BODY_MAX} />
          
                    <div className="composer-field__footer">
                        <div className="composer-field__ai-actions">
                        <AIFloatingLauncher
              postType="regular_post"
              onTextSuccess={handleRegularPostAiContent}
              buildContextPrompt={buildRegularPostAiPrompt}
              disabled={loading}
              iconOnly
              className="ai-floating-launcher--feed-inline" />
                        <FeedAiImageLauncher disabled={loading} onInsert={handleAiImageInsert} />
                        </div>
                        <button
              type="button"
              className="composer-field__post-btn"
              onClick={handleSubmit}
              disabled={!canPost || loading}
              aria-label={t('post', 'Post')}>
              
                            <FaPaperPlane size={13} />
                        </button>
                    </div>
                </div>

                {loading && media?.file &&
        <div role="status" className="inline-post-editor__upload-status">
                        {isCheckingImage ?
          t('image_upload_checking') :
          t('uploading_image_progress', 'Uploading image... {{progress}}%', { progress: uploadProgress })}
                        {isCheckingImage && uploadProgress > 0 && uploadProgress < 100 ? ` (${uploadProgress}%)` : ''}
                    </div>
        }

                <div
          className={`inline-post-editor__char-count${
          text.length >= POST_BODY_MAX ? ' inline-post-editor__char-count--max' : ''}`
          }
          title={t('post_body_char_limit', {
            defaultValue: 'Post text (not the AI prompt)',
            max: POST_BODY_MAX
          })}>
          
                    <AppText as="span" className="inline-post-editor__char-count-label">
                        {t('post_body_label', { defaultValue: 'Post' })}
                    </AppText>
                    <AppText as="span" dir="ltr" style={{ unicodeBidi: 'isolate' }}>
                        {text.length} / {POST_BODY_MAX}
                    </AppText>
                </div>

                {media && !embedData &&
        <div className="inline-post-editor__media-preview">
                        <button
            type="button"
            onClick={() => setMedia(null)}
            className="inline-post-editor__media-remove"
            aria-label={t('remove', 'Remove')}>
            
                            <FaTimes size={12} />
                        </button>
                        <img src={media.preview} alt="Preview" />
                    </div>
        }

                {embedData &&
        <div className={`inline-post-editor__embed-preview${embedData.type === 'youtube' && embedData.isShort ? ' inline-post-editor__embed-preview--vertical' : ''}`}>
                        <button
            type="button"
            onClick={() => setEmbedData(null)}
            className="inline-post-editor__media-remove"
            aria-label={t('remove', 'Remove')}>
            
                            <FaTimes size={12} />
                        </button>
                        {embedData.type === 'youtube' && (
          embedData.isShort ?
          <div className="inline-post-editor__embed-vertical">
                                    <iframe
              width="100%"
              height="100%"
              src={buildYoutubeEmbedSrc(embedData.id, { autoplay: false })}
              frameBorder="0"
              allow={YOUTUBE_EMBED_ALLOW}
              allowFullScreen
              title="YouTube Short" />
            
                                </div> :

          <iframe width="100%" height="250" src={buildYoutubeEmbedSrc(embedData.id, { autoplay: false })} frameBorder="0" allow={YOUTUBE_EMBED_ALLOW} allowFullScreen title="YouTube" />)

          }
                        {embedData.type === 'tiktok' &&
          <TikTokEmbed videoId={embedData.id} />
          }
                        {embedData.type === 'instagram' &&
          <iframe width="100%" height="300" src={`https://www.instagram.com/p/${embedData.id}/embed/captioned`} frameBorder="0" scrolling="no" title="Instagram" />
          }
                    </div>
        }
            </div>

            <div className="inline-post-editor__toolbar-divider" />

            <div className="inline-post-editor__toolbar">
                <div className="inline-post-editor__toolbar-actions">
                    <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: '8px' }}>
            
                        <FaImage size={18} color="#45bd62" /> {t('photo', 'Photo')}
                    </button>

                    <div style={{ position: 'relative' }}>
                        <button
              type="button"
              onClick={() => setShowEmojiPicker((v) => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: '8px' }}>
              
                            <FaSmile size={18} color="#f59e0b" /> {t('emoji', 'Emoji')}
                        </button>

                        {showEmojiPicker &&
            <>
                                <div
                role="presentation"
                onClick={() => setShowEmojiPicker(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 1000 }} />
              
                                <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  insetInlineStart: 0,
                  zIndex: 1001,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  borderRadius: '12px',
                  padding: '12px',
                  width: '280px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  justifyContent: 'center',
                  marginTop: '8px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                
                                    {CUSTOM_EMOJIS.map((emoji, index) =>
                <button
                  type="button"
                  key={index}
                  onClick={() => {setText((prev) => prev + emoji);}}
                  style={{ background: 'transparent', border: 'none', fontSize: '1.4rem', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}>
                  
                                            {emoji}
                                        </button>
                )}
                                </div>
                            </>
            }
                    </div>
                </div>
            </div>

            <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        style={{ display: 'none' }} />
      
        </div>);

};

export default InlinePostEditor;