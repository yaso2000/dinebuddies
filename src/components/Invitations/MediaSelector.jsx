import React, { useState, useEffect } from 'react';
import { FaStore, FaCamera, FaUpload, FaTrash } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import MediaUpload from '../Shared/MediaUpload';
import UnifiedCamera from '../UnifiedCamera';
import ImageModerationOverlay from '../Shared/ImageModerationOverlay';
import MagicCoverGeneratePanel from './MagicCoverGeneratePanel';

import './MediaSelector.css';
import { AppText } from "../base";

const MediaSelector = ({
  restaurant,
  onMediaSelect,
  mediaData: parentMediaData = null,
  libraryVideo = null,
  libraryImages = [],
  onPersistSelfieVideo,
  onPersistImage,
  onDeleteLibraryVideo,
  onDeleteLibraryImage,
  /** Called when moderated image upload fails (e.g. toast). */
  onImageUploadError,
  initialData = null,
  className = '',
  /** Hide venue cover block (e.g. dating flow). */
  hideVenueCover = false,
  /** Hide Camera / Upload tabs — parent supplies `externalSource`. */
  hideTabBar = false,
  /** When set to `camera` or `upload`, that panel is shown regardless of internal tab state. */
  externalSource = null,
  /** When set, shows invitation Magic Cover AI panel in the upload/gallery section. */
  magicCover = null,
  /** Two tabs only: device upload (photo or video) + camera. Hides venue cover, library, and sub-modes. */
  simplified = false
}) => {
  const { t } = useTranslation();
  /** camera = capture photo/video | upload = image files from device */
  const [source, setSource] = useState(() => {
    if (initialData?.source === 'custom_video') return 'camera';
    if (initialData?.source === 'custom_image') return 'upload';
    return null;
  });
  const [cameraSubMode, setCameraSubMode] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(initialData || null);
  const [imagePersisting, setImagePersisting] = useState(false);
  const [imageRejectedPreview, setImageRejectedPreview] = useState(null);

  useEffect(() => {
    setSelectedMedia(parentMediaData ?? null);
  }, [parentMediaData]);

  /** When editing with an existing uploaded/custom image, show Upload tab + preview. */
  useEffect(() => {
    if (
    parentMediaData?.source === 'custom_image' &&
    parentMediaData?.type === 'image' && (
    parentMediaData?.preview || parentMediaData?.url))
    {
      setSource('upload');
    }
  }, [parentMediaData?.source, parentMediaData?.type, parentMediaData?.preview, parentMediaData?.url]);

  useEffect(() => {
    if (hideTabBar && externalSource) return;
    if (source !== null) return;
    setSource(simplified ? 'upload' : 'camera');
  }, [source, hideTabBar, externalSource, simplified]);

  const effectiveSource = externalSource || source;

  const handleSourceChange = (newSource) => {
    setCameraSubMode(null);
    setSource(newSource);
    if (simplified) {
      setCameraOpen(newSource === 'camera');
    }
  };

  const handleRestaurantImageSelect = (url) => {
    const mediaData = {
      source: 'restaurant',
      url,
      type: 'image'
    };
    setSelectedMedia(mediaData);
    onMediaSelect(mediaData);
  };

  const isVenueSelection = selectedMedia?.source === 'restaurant' || selectedMedia?.source === 'google_place';
  const isUploadSelection =
  effectiveSource === 'upload' && (
  selectedMedia?.source === 'custom_image' || selectedMedia?.source === 'custom_video');
  const isCameraPhotoSelection =
  effectiveSource === 'camera' && selectedMedia?.source === 'custom_image' && !!selectedMedia?.file;
  const isVenueUrlSelected = (url) =>
  isVenueSelection && selectedMedia?.type === 'image' && selectedMedia?.url === url;

  const handleCustomMedia = async (file, preview, type) => {
    if (type === 'video') return;
    const mediaData = {
      source: 'custom_image',
      file,
      preview,
      type
    };
    setSelectedMedia(mediaData);
    onMediaSelect(mediaData);
  };

  const handlePhotoCapture = async (file, previewUrl) => {
    if (onPersistImage) {
      setImageRejectedPreview(null);
      setImagePersisting(true);
      try {
        const persisted = await onPersistImage(file);
        if (!persisted) throw new Error('image-rejected');
        const mediaData = {
          source: 'custom_image',
          type: 'image',
          file: null,
          preview: persisted,
          fromLibrary: true
        };
        setSelectedMedia(mediaData);
        onMediaSelect(mediaData);
      } catch (e) {
        console.error(e);
        setImageRejectedPreview(previewUrl);
        onImageUploadError?.(e);
      } finally {
        setImagePersisting(false);
      }
      return;
    }
    const mediaData = {
      source: 'custom_image',
      file,
      preview: previewUrl,
      type: 'image'
    };
    setSelectedMedia(mediaData);
    onMediaSelect(mediaData);
  };

  const handleCameraMediaCaptured = (file, previewUrl, type) => {
    if (type === 'video') return;
    handlePhotoCapture(file, previewUrl);
    setCameraOpen(false);
  };

  const selectLibraryImage = (url) => {
    if (!url) return;
    const mediaData = {
      source: 'custom_image',
      type: 'image',
      file: null,
      preview: url,
      fromLibrary: true
    };
    setSelectedMedia(mediaData);
    onMediaSelect(mediaData);
  };

  const handleMagicCoverImage = (url) => {
    if (!url) return;
    magicCover?.onImageGenerated?.(url);
    setSource('upload');
    selectLibraryImage(url);
  };

  const hasRestaurantImage = restaurant && (restaurant.image || restaurant.restaurantImage);
  const restaurantCoverUrl = hasRestaurantImage ? restaurant.image || restaurant.restaurantImage : null;

  const tabBtnStyle = (active) => ({
    flex: 1,
    padding: '10px',
    borderRadius: '12px',
    background: active ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
    color: active ? 'white' : 'var(--text-secondary)',
    border: active ? 'none' : '1px solid transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontWeight: active ? 'bold' : 'normal',
    minWidth: '0'
  });

  return (
    <div className={`media-selector ${className}`}>
            {!simplified && !hideVenueCover && hasRestaurantImage && restaurantCoverUrl &&
      <div
        className="media-selector-venue-cover"
        style={{
          marginBottom: 16,
          padding: 14,
          borderRadius: 14,
          border: '1px solid var(--border-color)',
          background: 'var(--bg-card)'
        }}>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <FaStore style={{ color: 'var(--primary)', flexShrink: 0 }} />
                        <AppText as="span" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                            {t('media_dinebuddies_venue_cover', 'Venue on DineBuddies')}
                        </AppText>
                    </div>
                    <AppText as="p" style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.45 }}>
                        {t(
            'media_dinebuddies_venue_cover_hint',
            'Optional: use the cover image from the business profile you selected — not from map listings.'
          )}
                    </AppText>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div
            role="button"
            tabIndex={0}
            onClick={() => handleRestaurantImageSelect(restaurantCoverUrl)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRestaurantImageSelect(restaurantCoverUrl);
            }}
            style={{
              width: 96,
              height: 96,
              borderRadius: 12,
              overflow: 'hidden',
              cursor: 'pointer',
              border: isVenueUrlSelected(restaurantCoverUrl) ? '3px solid var(--primary)' : '2px solid var(--border-color)',
              flexShrink: 0,
              // Hide if URL is blocked (Google photo)
              display: restaurantCoverUrl && (restaurantCoverUrl.includes('/api/place-photo') || restaurantCoverUrl.includes('maps.googleapis.com')) ? 'none' : 'block'
            }}>

                            <img
              src={restaurantCoverUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.style.display = 'none';
              }} />

                        </div>
                        <button
            type="button"
            onClick={() => handleRestaurantImageSelect(restaurantCoverUrl)}
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-input)',
              color: 'var(--text-main)',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.88rem'
            }}>

                            {t('media_use_venue_cover', 'Use this cover')}
                        </button>
                    </div>
                </div>
      }

            {magicCover?.enabled ?
      <MagicCoverGeneratePanel
        subType={magicCover.subType}
        venueType={magicCover.venueType}
        venueName={magicCover.venueName}
        aspectRatio={magicCover.aspectRatio}
        buildBrief={magicCover.buildBrief}
        onImageGenerated={handleMagicCoverImage}
        disabled={magicCover.disabled}
        requireVenue={magicCover.requireVenue !== false} /> :

      null}

            {!hideTabBar &&
      <div
        className="media-tabs"
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
          overflowX: 'auto',
          paddingBottom: '4px',
          borderBottom: simplified ? 'none' : '1px solid var(--border-color)',
          padding: '10px 0'
        }}>

                    <button type="button" onClick={() => handleSourceChange('upload')} style={tabBtnStyle(source === 'upload')}>
                        <FaUpload />
                        <AppText as="span" style={{ fontSize: '0.9rem' }}>
                            {simplified ?
            t('media_tab_upload_device', 'From device') :
            t('media_tab_upload_photo', 'Upload photo')}
                        </AppText>
                    </button>
                    <button
          type="button"
          onClick={() => {
            if (simplified && source === 'camera') {
              setCameraOpen(true);
              return;
            }
            handleSourceChange('camera');
          }}
          style={tabBtnStyle(source === 'camera')}>

                        <FaCamera />
                        <AppText as="span" style={{ fontSize: '0.9rem' }}>{t('media_tab_camera', 'Camera')}</AppText>
                    </button>
                </div>
      }

            <div className="tab-content">
                {effectiveSource === 'camera' &&
        <div className="custom-video-container">
                        {simplified && cameraOpen &&
          <UnifiedCamera
            mode="photo"
            allowFilePicker={false}
            onMediaCaptured={handleCameraMediaCaptured}
            stopCamera={() => setCameraOpen(false)} />

          }

                        {!simplified &&
          <UnifiedCamera
            mode="photo"
            allowFilePicker={false}
            onMediaCaptured={(file, url) => handlePhotoCapture(file, url)}
            stopCamera={() => setCameraSubMode(null)} />

          }

                        {imagePersisting &&
          <AppText as="p" role="status" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 8 }}>
                                {t('image_upload_checking')}
                            </AppText>
          }

                        {imageRejectedPreview &&
          <div style={{ marginTop: 12 }}>
                                <ImageModerationOverlay status="rejected">
                                    <img
                src={imageRejectedPreview}
                alt=""
                style={{ width: '100%', maxHeight: 300, objectFit: 'cover', display: 'block' }} />

                                </ImageModerationOverlay>
                                <button
              type="button"
              onClick={() => setImageRejectedPreview(null)}
              style={{
                marginTop: 8,
                width: '100%',
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-input)',
                color: 'var(--text-main)',
                fontWeight: 700,
                cursor: 'pointer'
              }}>

                                    {t('image_rejected_choose_another', 'Choose another photo')}
                                </button>
                            </div>
          }

                        {isCameraPhotoSelection && !imageRejectedPreview &&
          <div className="media-preview" style={{ position: 'relative', marginTop: 12 }}>
                                <ImageModerationOverlay status={imagePersisting ? 'checking' : null}>
                                    <img
                src={selectedMedia.preview}
                alt=""
                className="preview-image"
                style={{
                  width: '100%',
                  maxHeight: '300px',
                  objectFit: 'cover',
                  borderRadius: '12px'
                }} />

                                </ImageModerationOverlay>
                                <button
              type="button"
              onClick={() => {
                setSelectedMedia(null);
                onMediaSelect(null);
                setCameraSubMode(null);
              }}
              style={{
                marginTop: 8,
                background: 'rgba(0,0,0,0.55)',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}>

                                    {t('remove_preview', 'Remove')}
                                </button>
                            </div>
          }
                    </div>
        }

                {effectiveSource === 'upload' &&
        <div className="custom-image-container">
                        {!simplified &&
          <AppText as="p" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12, textAlign: 'center' }}>
                                {t('upload_photo_only_hint', {
              defaultValue:
              'Choose an image from your device. Videos are not accepted here — use the Camera tab to record.'
            })}
                            </AppText>
          }
                        {!simplified && libraryImages.length > 0 &&
          <div style={{ marginBottom: 14 }}>
                                <AppText as="p" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                                    {t('saved_media_library', { defaultValue: 'Saved media library' })}
                                </AppText>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 10 }}>
                                    {libraryImages.map((url, idx) =>
              <div
                key={`${url}-${idx}`}
                role="button"
                tabIndex={0}
                onClick={() => selectLibraryImage(url)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') selectLibraryImage(url);
                }}
                style={{
                  position: 'relative',
                  borderRadius: 10,
                  overflow: 'hidden',
                  height: 90,
                  cursor: 'pointer',
                  border:
                  selectedMedia?.preview === url ? '3px solid var(--primary)' : '2px solid var(--border-color)'
                }}>

                                            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            {onDeleteLibraryImage &&
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteLibraryImage(url);
                  }}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    background: 'rgba(220,38,38,0.9)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '3px 6px',
                    fontSize: '0.65rem',
                    cursor: 'pointer'
                  }}>

                                                    {t('delete', { defaultValue: 'Delete' })}
                                                </button>
                }
                                        </div>
              )}
                                </div>
                            </div>
          }
                        {imagePersisting && !isUploadSelection &&
          <AppText as="p" role="status" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 10 }}>
                                {t('image_upload_checking')}
                            </AppText>
          }

                        {imageRejectedPreview &&
          <div style={{ marginBottom: 12 }}>
                                <ImageModerationOverlay status="rejected">
                                    <img
                src={imageRejectedPreview}
                alt=""
                style={{ width: '100%', maxHeight: 300, objectFit: 'cover', display: 'block' }} />

                                </ImageModerationOverlay>
                                <button
              type="button"
              onClick={() => setImageRejectedPreview(null)}
              style={{
                marginTop: 8,
                width: '100%',
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-input)',
                color: 'var(--text-main)',
                fontWeight: 700,
                cursor: 'pointer'
              }}>

                                    {t('image_rejected_choose_another', 'Choose another photo')}
                                </button>
                            </div>
          }

                        {!isUploadSelection && !imageRejectedPreview &&
          <MediaUpload
            type="image"
            maxSize={10}
            awaitMediaSelect={!!onPersistImage}
            onMediaSelect={async (file, preview, type) => {
              if (onPersistImage && type === 'image') {
                setImageRejectedPreview(null);
                setImagePersisting(true);
                try {
                  const persisted = await onPersistImage(file);
                  if (!persisted) throw new Error('image-rejected');
                  const mediaData = {
                    source: 'custom_image',
                    type: 'image',
                    file: null,
                    preview: persisted,
                    fromLibrary: true
                  };
                  setSelectedMedia(mediaData);
                  onMediaSelect(mediaData);
                } catch (e) {
                  console.error(e);
                  setImageRejectedPreview(preview);
                  onImageUploadError?.(e);
                  throw e;
                } finally {
                  setImagePersisting(false);
                }
                return;
              }
              handleCustomMedia(file, preview, type);
            }} />

          }
                        {isUploadSelection && (selectedMedia.preview || selectedMedia.url) && !imageRejectedPreview &&
          <div className="media-preview" style={{ position: 'relative' }}>
                                {selectedMedia.type === 'video' ?
            // Uploaded video is no longer supported — hide the old video instead of playing it.
            null :

            <ImageModerationOverlay status={imagePersisting ? 'checking' : null}>
                                        <img
                src={selectedMedia.preview || selectedMedia.url}
                alt="Selected"
                className="preview-image"
                style={{
                  width: '100%',
                  maxHeight: '300px',
                  objectFit: 'cover',
                  borderRadius: '12px'
                }} />

                                    </ImageModerationOverlay>
            }
                                <button
              type="button"
              className="remove-preview-btn"
              onClick={() => {
                setSelectedMedia(null);
                onMediaSelect(null);
              }}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(0,0,0,0.6)',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                padding: '5px 12px',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}>

                                    {t('remove_preview', 'Remove')}
                                </button>
                            </div>
          }
                    </div>
        }
            </div>
        </div>);

};

export default MediaSelector;