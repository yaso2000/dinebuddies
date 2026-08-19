import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { FaFont, FaPalette, FaTimes, FaPhotoVideo, FaSmile, FaCamera, FaPlus, FaTrash, FaVideo } from 'react-icons/fa';
import UnifiedCamera from '../components/UnifiedCamera';

import { uploadImage } from '../utils/imageUpload';
import { uploadVideoWithThumbnail } from '../services/mediaService';
import { validateVideo, getVideoDuration } from '../utils/videoCompression';
import { ImageUploadZone } from '../services/imageUploadZones';
import { notifyImageUploadError } from '../utils/imageModerationErrors';
import { db } from '../firebase/config';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { getSafeAvatar } from '../utils/avatarUtils';
import './CreateStory.css';
import { AppText, AppTextInput } from "../components/base";
import { handleEmojiButtonClick, shouldUseAppEmojiPicker, showComposerEmojiButton } from '../utils/emojiInputMode';

const GRADIENTS = [
{ id: 'black', bg: '#000000', label: 'Black' },
{ id: 'white', bg: '#ffffff', label: 'White' },
{ id: 'classic', bg: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', label: 'Classic' },
{ id: 'purple', bg: 'linear-gradient(to bottom right, #8B5CF6, #3B82F6)', label: 'Galaxy' },
{ id: 'ocean', bg: 'linear-gradient(to bottom right, #00c6ff, #0072ff)', label: 'Ocean' },
{ id: 'sunset', bg: 'linear-gradient(to top right, #ff0844, #ffb199)', label: 'Sunset' },
{ id: 'neon', bg: 'linear-gradient(to right, #00f260, #0575e6)', label: 'Neon' },
{ id: 'gold', bg: 'linear-gradient(to right, #bf953f, #fcf6ba, #b38728, #fbf5b7, #aa771c)', label: 'Gold' }];


const FONTS = [
{ id: 'modern', family: "'Outfit', sans-serif", label: 'Modern' },
{ id: 'typewriter', family: "'Courier New', monospace", label: 'Typewriter' },
{ id: 'hand', family: "'Comic Sans MS', cursive", label: 'Playful' },
{ id: 'bold', family: "Impact, sans-serif", label: 'Strong' }];


const TEXT_COLORS = [
'#ffffff', '#000000', '#ff0000', '#ffff00', '#00ff00', '#0000ff', '#800080'];


const MOOD_EMOJIS = [
'😄', '🥰', '🤤', '😋', '🥳', '🎂', '☕', '🍕', '🍔', '🥂', '🔥', '✨'];

const MAX_REEL_ITEMS = 10;
const MAX_VIDEO_DURATION_SEC = 15;
const VIDEO_ALLOWED_FORMATS = [
'video/mp4', 'video/quicktime', 'video/x-msvideo',
// MediaRecorder output (in-app camera) commonly lands here, not in the gallery-file formats above.
'video/webm', 'video/webm;codecs=h264', 'video/webm;codecs=vp8', 'video/webm;codecs=vp9'];

const IMAGE_STORY_DURATION_MS = 5000;

let localIdCounter = 0;
const nextLocalId = () => `story-item-${Date.now()}-${localIdCounter++}`;

const createBlankItem = () => ({
  localId: nextLocalId(),
  backgroundType: 'GRADIENT', // 'GRADIENT' | 'IMAGE' | 'VIDEO'
  mediaFile: null,
  mediaPreview: null,
  videoDurationSec: null,
  text: '',
  textMode: true, // caption box shown — independent of backgroundType (overlays photo/video too)
  bgIndex: 0,
  fontIndex: 0,
  textColorIndex: 0
});

const CreateStory = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser, userProfile, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [items, setItems] = useState(() => [createBlankItem()]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeItem = items[activeIndex];

  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadStep, setUploadStep] = useState(null); // { index, total } while sharing
  const [showCamera, setShowCamera] = useState(false);

  const fileInputRef = useRef(null);
  const storyTextRef = useRef(null);
  const moodPickerRef = useRef(null);

  const updateActiveItem = (patch) => {
    setItems((prev) => prev.map((it, i) => i === activeIndex ? { ...it, ...patch } : it));
  };

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
        showToast(t('guests_no_story', 'Guests cannot post stories. Please sign up.'), 'error');
        navigate('/');
      }
    }
  }, [authLoading, userProfile, navigate, currentUser]);

  // Revoke blob previews on unmount to avoid leaking memory across a multi-item session.
  useEffect(() => {
    return () => {
      items.forEach((it) => {
        if (it.mediaPreview) {
          try { URL.revokeObjectURL(it.mediaPreview); } catch { /* ignore */ }
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = () => setShowCamera(true);

  const itemHasContent = (it) =>
    it.backgroundType === 'GRADIENT' ? Boolean(it.text.trim()) : Boolean(it.mediaFile);

  const addNewItem = () => {
    if (items.length >= MAX_REEL_ITEMS) {
      showToast(t('story_reel_limit', `You can add up to ${MAX_REEL_ITEMS} items per story.`), 'error');
      return;
    }
    if (!itemHasContent(activeItem)) {
      showToast(t('story_finish_current_item', 'Add a photo, video, or text to this one first.'), 'error');
      return;
    }
    setItems((prev) => [...prev, createBlankItem()]);
    setActiveIndex(items.length);
  };

  const removeItem = (index) => {
    if (items.length <= 1) return;
    const removed = items[index];
    if (removed.mediaPreview) {
      try { URL.revokeObjectURL(removed.mediaPreview); } catch { /* ignore */ }
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
    setActiveIndex((prev) => Math.max(0, prev >= index ? prev - (prev === index ? 0 : 1) : prev));
  };

  const acceptVideoFile = async (file) => {
    const validation = await validateVideo(file, {
      maxDuration: MAX_VIDEO_DURATION_SEC,
      allowedFormats: VIDEO_ALLOWED_FORMATS
    });
    if (!validation.valid) {
      showToast(validation.error || t('invalid_video', 'This video cannot be used.'), 'error');
      return;
    }
    let durationSec = MAX_VIDEO_DURATION_SEC;
    try {
      durationSec = Math.min(await getVideoDuration(file), MAX_VIDEO_DURATION_SEC);
    } catch { /* keep cap as fallback */ }
    updateActiveItem({
      backgroundType: 'VIDEO',
      mediaFile: file,
      mediaPreview: URL.createObjectURL(file),
      videoDurationSec: durationSec
    });
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type.startsWith('video/')) {
      await acceptVideoFile(file);
    } else if (file.type.startsWith('image/')) {
      updateActiveItem({
        backgroundType: 'IMAGE',
        mediaFile: file,
        mediaPreview: URL.createObjectURL(file),
        videoDurationSec: null
      });
    } else {
      showToast(t('only_media_stories', 'Only photo or video files are supported for stories.'), 'error');
    }
    e.target.value = "";
  };

  const cycleTextColor = () => {
    updateActiveItem({ textColorIndex: (activeItem.textColorIndex + 1) % TEXT_COLORS.length });
  };

  const cycleBackground = () => {
    if (activeItem.backgroundType !== 'GRADIENT') {
      if (activeItem.mediaPreview) {
        try { URL.revokeObjectURL(activeItem.mediaPreview); } catch { /* ignore */ }
      }
      updateActiveItem({ backgroundType: 'GRADIENT', mediaFile: null, mediaPreview: null, videoDurationSec: null });
    } else {
      updateActiveItem({ bgIndex: (activeItem.bgIndex + 1) % GRADIENTS.length });
    }
  };

  const cycleFont = () => {
    updateActiveItem({ fontIndex: (activeItem.fontIndex + 1) % FONTS.length });
  };

  const handleShare = async () => {
    if (loading) return;
    const usableItems = items.filter(itemHasContent);
    if (usableItems.length === 0) return;

    setLoading(true);
    setUploadStep({ index: 0, total: usableItems.length });
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await import('firebase/firestore').then(({ getDoc }) => getDoc(userDocRef));
      const freshUserData = userDocSnap.exists() ? userDocSnap.data() : {};

      const finalUserName = freshUserData.businessInfo?.businessName || freshUserData.name || freshUserData.displayName || currentUser.displayName || 'User';
      const finalUserPhoto = getSafeAvatar(freshUserData || currentUser);

      const sessionId = doc(collection(db, 'stories')).id;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const batch = writeBatch(db);

      for (let i = 0; i < usableItems.length; i++) {
        setUploadStep({ index: i + 1, total: usableItems.length });
        const it = usableItems[i];

        let mediaUrl = null;
        let posterUrl = null;
        let finalType = 'text';
        let mediaDurationMs = IMAGE_STORY_DURATION_MS;

        if (it.backgroundType === 'VIDEO' && it.mediaFile) {
          const { videoUrl, thumbnailUrl } = await uploadVideoWithThumbnail(
            it.mediaFile,
            currentUser.uid,
            'stories',
            { enforceThumbnailModeration: true }
          );
          mediaUrl = videoUrl;
          posterUrl = thumbnailUrl;
          finalType = 'video';
          mediaDurationMs = Math.round((it.videoDurationSec || MAX_VIDEO_DURATION_SEC) * 1000);
        } else if (it.backgroundType === 'IMAGE' && it.mediaFile) {
          const sanitizedName = it.mediaFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const path = `stories/${currentUser.uid}/${Date.now()}_${i}_${sanitizedName}`;
          mediaUrl = await uploadImage(it.mediaFile, path, null, {}, {
            moderationZone: ImageUploadZone.STORY,
            userId: currentUser.uid
          });
          finalType = 'image';
        }

        const storyRef = doc(collection(db, 'stories'));
        batch.set(storyRef, {
          userId: String(currentUser.uid),
          userPhoto: finalUserPhoto,
          userName: finalUserName,
          type: finalType,
          url: mediaUrl,
          posterUrl,
          text: it.text.trim(),
          fontFamily: FONTS[it.fontIndex].family,
          textColor: TEXT_COLORS[it.textColorIndex],
          backgroundColor: it.backgroundType === 'GRADIENT' ? GRADIENTS[it.bgIndex].bg : null,
          sessionId,
          order: i,
          mediaDurationMs,
          views: {},
          likes: {},
          createdAt: serverTimestamp(),
          expiresAt
        });
      }

      await batch.commit();
      navigate('/');
    } catch (error) {
      console.error("Error creating story:", error);
      notifyImageUploadError(showToast, error, t, 'failed_share_story');
    } finally {
      setLoading(false);
      setUploadStep(null);
    }
  };

  const textColor = TEXT_COLORS[activeItem.textColorIndex];
  const isGradientOnly = activeItem.backgroundType === 'GRADIENT';
  const showCaptionInput = activeItem.textMode;

  // Auth loading check — after all hooks so hook call order stays constant across renders.
  if (authLoading) {
    return <div className="loading-spinner" />;
  }

  return (
    <div className="create-story-container" style={{ zIndex: 100000 }}>
            <div className="story-header">
                <button onClick={() => {navigate(-1);}} className="icon-btn"><FaTimes /></button>
                <div className="story-title">{isGradientOnly ? t('create_story_title', 'Create Story') : t('edit_story_title', 'Edit Story')}</div>
                <button
          onClick={handleShare}
          className="share-btn"
          disabled={loading || !items.some(itemHasContent)}>

                    {loading ?
          uploadStep && uploadStep.total > 1 ?
          t('posting_n_of_total', 'Posting {{index}}/{{total}}...', uploadStep) :
          t('posting', 'Posting...') :
          t('share_btn', 'Share')}
                </button>
            </div>

            {items.length > 1 &&
      <div className="story-item-strip">
                    {items.map((it, index) =>
        <div
          key={it.localId}
          role="button"
          tabIndex={0}
          className={`story-item-thumb${index === activeIndex ? ' active' : ''}`}
          onClick={() => setActiveIndex(index)}
          onKeyDown={(e) => {if (e.key === 'Enter' || e.key === ' ') setActiveIndex(index);}}
          style={{
            backgroundColor: it.backgroundType === 'GRADIENT' && !GRADIENTS[it.bgIndex].bg.includes('gradient') ? GRADIENTS[it.bgIndex].bg : '#000',
            backgroundImage: it.backgroundType === 'GRADIENT' && GRADIENTS[it.bgIndex].bg.includes('gradient') ?
            GRADIENTS[it.bgIndex].bg :
            it.mediaPreview ? `url(${it.mediaPreview})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}>

                            {it.backgroundType === 'VIDEO' && <FaVideo className="story-item-thumb__video-icon" size={10} />}
                            {items.length > 1 &&
          <button
            type="button"
            className="story-item-thumb__remove"
            onClick={(e) => {e.stopPropagation();removeItem(index);}}>

                                    <FaTrash size={9} />
                                </button>
          }
                        </div>
        )}
                </div>
      }

            {/* Canvas */}
            <div
        className="story-canvas"
        style={{
          backgroundColor: activeItem.backgroundType === 'GRADIENT' && !GRADIENTS[activeItem.bgIndex].bg.includes('gradient') ? GRADIENTS[activeItem.bgIndex].bg : '#000',
          backgroundImage: activeItem.backgroundType === 'GRADIENT' && GRADIENTS[activeItem.bgIndex].bg.includes('gradient') ?
          GRADIENTS[activeItem.bgIndex].bg :
          activeItem.backgroundType === 'IMAGE' && activeItem.mediaPreview ? `url(${activeItem.mediaPreview})` : 'none',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          fontFamily: FONTS[activeItem.fontIndex].family
        }}>

                {activeItem.backgroundType === 'VIDEO' && activeItem.mediaPreview &&
        <video
          key={activeItem.localId}
          src={activeItem.mediaPreview}
          className="story-video-preview"
          style={{ position: 'absolute', inset: 0 }}
          autoPlay
          loop
          muted
          playsInline />

        }

                {showCaptionInput &&
        <AppTextInput as="textarea"
        ref={storyTextRef}
        value={activeItem.text}
        onChange={(e) => updateActiveItem({ text: e.target.value })}
        placeholder={activeItem.backgroundType === 'GRADIENT' ? t('tap_to_type', "Tap to type...") : t('add_a_caption', "Add a caption...")}
        className={`story-textarea ${activeItem.backgroundType !== 'GRADIENT' ? 'text-overlay' : ''}`}
        style={{ fontFamily: FONTS[activeItem.fontIndex].family, color: textColor }}
        maxLength={200} />

        }
                <style>
                    {`
                        .story-canvas {
                            font-family: ${FONTS[activeItem.fontIndex].family} !important;
                        }
                        .story-textarea {
                            color: ${textColor} !important;
                            font-family: ${FONTS[activeItem.fontIndex].family} !important;
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
                <button className={`tool-btn ${showCaptionInput ? 'active' : ''}`} onClick={() => updateActiveItem({ textMode: !activeItem.textMode })} title={t('tool_text', 'Text')}>
                    <FaFont />
                </button>

                {showCaptionInput &&
        <>
                        <button className="tool-btn" onClick={cycleFont}>
                            <AppText as="span" style={{ fontFamily: FONTS[(activeItem.fontIndex + 1) % FONTS.length].family, fontSize: '1rem', fontWeight: 'bold' }}>Aa</AppText>
                        </button>
                        <button className="tool-btn" onClick={cycleTextColor}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: textColor, border: '2px solid white' }}></div>
                        </button>
                    </>
        }

                {showCaptionInput && showComposerEmojiButton() &&
        <div style={{ position: 'relative' }} ref={moodPickerRef}>
                        <button
                          className={`tool-btn ${showMoodPicker ? 'active' : ''}`}
                          onClick={() => handleEmojiButtonClick({ inputRef: storyTextRef, setPickerOpen: setShowMoodPicker })}
                        >
                            <FaSmile />
                        </button>
                        {showMoodPicker && shouldUseAppEmojiPicker() &&
          <div style={{
            position: 'absolute', right: '60px', top: '-20px', background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)', borderRadius: '16px', padding: '12px', zIndex: 100,
            display: 'flex', flexDirection: 'column', minWidth: '160px'
          }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    <AppText as="span" style={{ color: 'white', fontSize: '0.8rem', fontWeight: 'bold', paddingLeft: '4px' }}>{t('emojis_label', 'Emojis')}</AppText>
                                    <button onClick={() => setShowMoodPicker(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                                        <FaTimes size={14} />
                                    </button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                    {MOOD_EMOJIS.map((emoji) =>
              <button
                key={emoji} onClick={() => {updateActiveItem({ text: activeItem.text + emoji });}}
                onMouseDown={(e) => e.preventDefault()}
                style={{ background: 'transparent', border: 'none', fontSize: '1.8rem', cursor: 'pointer' }}>
                 {emoji} </button>
              )}
                                </div>
                            </div>
          }
                    </div>
        }

                {activeItem.backgroundType === 'GRADIENT' &&
        <button className="tool-btn" onClick={cycleBackground} title={t('tool_bg', 'Background')}>
                        <FaPalette />
                    </button>
        }

                <button className={`tool-btn ${activeItem.backgroundType === 'IMAGE' || activeItem.backgroundType === 'VIDEO' ? 'active' : ''}`} onClick={() => fileInputRef.current?.click()} title={t('upload_media', 'Upload Photo/Video')}>
                    <FaPhotoVideo />
                </button>

                <button className="tool-btn" onClick={startCamera} title={t('tool_camera', 'Camera')}>
                    <FaCamera />
                </button>

                {activeItem.backgroundType !== 'GRADIENT' &&
        <button
          className="tool-btn"
          onClick={cycleBackground}
          style={{ background: 'rgba(239, 68, 68, 0.6)', marginTop: '4px' }}>

                        <FaTimes />
                    </button>
        }

                <button
          className="tool-btn"
          onClick={addNewItem}
          title={t('story_add_item', 'Add another')}
          style={{ background: 'rgba(255,255,255,0.15)', marginTop: '8px' }}>

                    <FaPlus />
                </button>
            </div>

            {/* CAMERA OVERLAY — photo + video (max 15s) */}
            {showCamera &&
      <UnifiedCamera
        stopCamera={() => setShowCamera(false)}
        onMediaCaptured={async (file, previewUrl, type) => {
          setShowCamera(false);
          if (type === 'video') {
            let durationSec = MAX_VIDEO_DURATION_SEC;
            try {
              durationSec = Math.min(await getVideoDuration(file), MAX_VIDEO_DURATION_SEC);
            } catch { /* keep cap as fallback */ }
            updateActiveItem({
              backgroundType: 'VIDEO',
              mediaFile: file,
              mediaPreview: previewUrl,
              videoDurationSec: durationSec
            });
            return;
          }
          updateActiveItem({ backgroundType: 'IMAGE', mediaFile: file, mediaPreview: previewUrl, videoDurationSec: null });
        }}
        maxDuration={MAX_VIDEO_DURATION_SEC}
        mode="both" />

      }

            <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileSelect} />
        </div>);

};
export default CreateStory;
