import React, { useState, useEffect } from 'react';
import { FaVideo, FaStore, FaCamera, FaUpload, FaTrash } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import MediaUpload from '../Shared/MediaUpload';
import UnifiedCamera from '../UnifiedCamera';

import './MediaSelector.css';

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
    initialData = null,
    className = '',
}) => {
    const { t } = useTranslation();
    /** camera = capture photo/video | upload = image files from device */
    const [source, setSource] = useState(() => {
        if (initialData?.source === 'custom_video') return 'camera';
        if (initialData?.source === 'custom_image') return 'upload';
        return null;
    });
    const [cameraSubMode, setCameraSubMode] = useState(null);
    const [selectedMedia, setSelectedMedia] = useState(initialData || null);
    const [videoPersisting, setVideoPersisting] = useState(false);

    useEffect(() => {
        setSelectedMedia(parentMediaData ?? null);
    }, [parentMediaData]);

    useEffect(() => {
        if (parentMediaData?.type === 'video') setSource('camera');
    }, [parentMediaData?.type]);

    /** When editing with an existing uploaded/custom image, show Upload tab + preview. */
    useEffect(() => {
        if (
            parentMediaData?.source === 'custom_image' &&
            parentMediaData?.type === 'image' &&
            (parentMediaData?.preview || parentMediaData?.url)
        ) {
            setSource('upload');
        }
    }, [parentMediaData?.source, parentMediaData?.type, parentMediaData?.preview, parentMediaData?.url]);

    useEffect(() => {
        if (source !== null) return;
        setSource('camera');
    }, [source]);

    const handleSourceChange = (newSource) => {
        setCameraSubMode(null);
        setSource(newSource);
    };

    const handleRestaurantImageSelect = (url) => {
        const mediaData = {
            source: 'restaurant',
            url,
            type: 'image',
        };
        setSelectedMedia(mediaData);
        onMediaSelect(mediaData);
    };

    const isVenueSelection = selectedMedia?.source === 'restaurant' || selectedMedia?.source === 'google_place';
    const isUploadSelection = source === 'upload' && selectedMedia?.source === 'custom_image';
    const isCameraPhotoSelection =
        source === 'camera' && selectedMedia?.source === 'custom_image' && !!selectedMedia?.file;
    const isVenueUrlSelected = (url) =>
        isVenueSelection && selectedMedia?.type === 'image' && selectedMedia?.url === url;

    const handleCustomMedia = async (file, preview, type) => {
        if (type === 'video') {
            if (libraryVideo) return;
            if (onPersistSelfieVideo) {
                setVideoPersisting(true);
                try {
                    await onPersistSelfieVideo(file);
                } catch (e) {
                    console.error(e);
                } finally {
                    setVideoPersisting(false);
                }
                return;
            }
        }
        const mediaData = {
            source: type === 'video' ? 'custom_video' : 'custom_image',
            file,
            preview,
            type,
        };
        setSelectedMedia(mediaData);
        onMediaSelect(mediaData);
    };

    const handleRecording = async (file, previewUrl) => {
        if (libraryVideo) return;
        if (onPersistSelfieVideo) {
            setVideoPersisting(true);
            try {
                await onPersistSelfieVideo(file);
            } catch (e) {
                console.error(e);
            } finally {
                setVideoPersisting(false);
            }
            return;
        }
        const mediaData = {
            source: 'custom_video',
            file,
            preview: previewUrl,
            type: 'video',
        };
        setSelectedMedia(mediaData);
        onMediaSelect(mediaData);
    };

    const selectLibraryVideo = () => {
        if (!libraryVideo) return;
        const data = {
            source: 'custom_video',
            type: 'video',
            file: null,
            preview: libraryVideo.videoUrl,
            videoThumbnail: libraryVideo.thumbnailUrl,
            fromLibrary: true,
        };
        setSelectedMedia(data);
        onMediaSelect(data);
    };

    const isLibraryTileSelected =
        libraryVideo && selectedMedia?.type === 'video' && selectedMedia?.preview === libraryVideo.videoUrl;

    const handlePhotoCapture = (file, previewUrl) => {
        const mediaData = {
            source: 'custom_image',
            file,
            preview: previewUrl,
            type: 'image',
        };
        setSelectedMedia(mediaData);
        onMediaSelect(mediaData);
    };

    const selectLibraryImage = (url) => {
        if (!url) return;
        const mediaData = {
            source: 'custom_image',
            type: 'image',
            file: null,
            preview: url,
            fromLibrary: true,
        };
        setSelectedMedia(mediaData);
        onMediaSelect(mediaData);
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
        minWidth: '0',
    });

    return (
        <div className={`media-selector ${className}`}>
            {hasRestaurantImage && restaurantCoverUrl && (
                <div
                    className="media-selector-venue-cover"
                    style={{
                        marginBottom: 16,
                        padding: 14,
                        borderRadius: 14,
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-card)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <FaStore style={{ color: 'var(--primary)', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                            {t('media_dinebuddies_venue_cover', 'Venue on DineBuddies')}
                        </span>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.45 }}>
                        {t(
                            'media_dinebuddies_venue_cover_hint',
                            'Optional: use the cover image from the business profile you selected — not from map listings.'
                        )}
                    </p>
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
                                display: (restaurantCoverUrl && (restaurantCoverUrl.includes('/api/place-photo') || restaurantCoverUrl.includes('maps.googleapis.com'))) ? 'none' : 'block'
                            }}
                        >
                            <img
                                src={restaurantCoverUrl}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.parentElement.style.display = 'none';
                                }}
                            />
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
                                fontSize: '0.88rem',
                            }}
                        >
                            {t('media_use_venue_cover', 'Use this cover')}
                        </button>
                    </div>
                </div>
            )}

            <div
                className="media-tabs"
                style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '16px',
                    overflowX: 'auto',
                    paddingBottom: '4px',
                    borderBottom: '1px solid var(--border-color)',
                    padding: '10px 0',
                }}
            >
                <>
                    <button type="button" onClick={() => handleSourceChange('camera')} style={tabBtnStyle(source === 'camera')}>
                        <FaCamera />
                        <span style={{ fontSize: '0.9rem' }}>{t('media_tab_camera', 'Camera')}</span>
                    </button>
                    <button type="button" onClick={() => handleSourceChange('upload')} style={tabBtnStyle(source === 'upload')}>
                        <FaUpload />
                        <span style={{ fontSize: '0.9rem' }}>{t('media_tab_upload_photo', 'Upload photo')}</span>
                    </button>
                </>
            </div>

            <div className="tab-content">
                {source === 'camera' && (
                    <div className="custom-video-container">
                        {libraryVideo && (
                            <div style={{ marginBottom: 14 }}>
                                <p
                                    style={{
                                        fontSize: '0.85rem',
                                        color: 'var(--text-muted)',
                                        marginBottom: 10,
                                        lineHeight: 1.45,
                                    }}
                                >
                                    {t('video_library_hint', {
                                        defaultValue:
                                            'Your selfie video is saved. Tap to use it on the card, or delete it permanently to record or upload a different one.',
                                    })}
                                </p>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                                        gap: 10,
                                    }}
                                >
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            selectLibraryVideo();
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') selectLibraryVideo();
                                        }}
                                        style={{
                                            position: 'relative',
                                            borderRadius: 12,
                                            overflow: 'hidden',
                                            height: 120,
                                            cursor: 'pointer',
                                            border: isLibraryTileSelected ? '3px solid var(--primary)' : '2px solid var(--border-color)',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                            background: '#111',
                                        }}
                                    >
                                        <img
                                            src={libraryVideo.thumbnailUrl}
                                            alt=""
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                        <div
                                            style={{
                                                position: 'absolute',
                                                bottom: 0,
                                                left: 0,
                                                right: 0,
                                                padding: '6px 8px',
                                                background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                                                color: '#fff',
                                                fontSize: '0.72rem',
                                                fontWeight: 800,
                                            }}
                                        >
                                            {t('selfie_video', { defaultValue: 'Selfie video' })}
                                        </div>
                                        {onDeleteLibraryVideo && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteLibraryVideo();
                                                }}
                                                style={{
                                                    position: 'absolute',
                                                    top: 8,
                                                    right: 8,
                                                    background: 'rgba(220,38,38,0.92)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: 10,
                                                    padding: '6px 10px',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 800,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                }}
                                                title={t('delete_video_permanent', { defaultValue: 'Delete video permanently' })}
                                            >
                                                <FaTrash size={12} /> {t('delete', { defaultValue: 'Delete' })}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {!libraryVideo && (
                            <>
                                {!cameraSubMode && (
                                    <div className="video-mode-selection">
                                        <p
                                            style={{
                                                fontSize: '0.9rem',
                                                color: 'var(--text-muted)',
                                                marginBottom: '1rem',
                                                textAlign: 'center',
                                            }}
                                        >
                                            {t(
                                                'camera_tab_hint',
                                                { defaultValue: 'Take a photo or record a video with your camera (no file upload here).' }
                                            )}
                                        </p>
                                        <div className="mode-buttons" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <button
                                                type="button"
                                                className="mode-btn"
                                                disabled={videoPersisting}
                                                onClick={() => setCameraSubMode('video')}
                                                style={{
                                                    padding: '1rem',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '12px',
                                                    color: 'var(--text-main)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    cursor: videoPersisting ? 'not-allowed' : 'pointer',
                                                    opacity: videoPersisting ? 0.6 : 1,
                                                }}
                                            >
                                                <FaVideo size={24} style={{ color: 'var(--primary)' }} />
                                                <span style={{ fontSize: '0.9rem' }}>{t('record_video', 'Record video')}</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="mode-btn"
                                                disabled={videoPersisting}
                                                onClick={() => setCameraSubMode('photo')}
                                                style={{
                                                    padding: '1rem',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '12px',
                                                    color: 'var(--text-main)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    cursor: videoPersisting ? 'not-allowed' : 'pointer',
                                                    opacity: videoPersisting ? 0.6 : 1,
                                                }}
                                            >
                                                <FaCamera size={24} style={{ color: 'var(--secondary)' }} />
                                                <span style={{ fontSize: '0.9rem' }}>{t('take_photo', 'Take photo')}</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {cameraSubMode === 'photo' && (
                                    <UnifiedCamera
                                        mode="photo"
                                        allowFilePicker={false}
                                        onMediaCaptured={(file, url) => handlePhotoCapture(file, url)}
                                        stopCamera={() => setCameraSubMode(null)}
                                    />
                                )}

                                {cameraSubMode === 'video' && (
                                    <UnifiedCamera
                                        mode="video"
                                        maxDuration={15}
                                        allowFilePicker={false}
                                        onMediaCaptured={(file, url) => handleRecording(file, url)}
                                        stopCamera={() => setCameraSubMode(null)}
                                    />
                                )}
                            </>
                        )}

                        {videoPersisting && (
                            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 8 }}>
                                {t('saving_video', { defaultValue: 'Saving video…' })}
                            </p>
                        )}

                        {selectedMedia?.type === 'video' && selectedMedia?.preview && (
                            <div className="media-preview" style={{ position: 'relative', marginTop: 12 }}>
                                <video
                                    src={selectedMedia.preview}
                                    controls
                                    playsInline
                                    className="preview-video"
                                    style={{
                                        width: '100%',
                                        borderRadius: '12px',
                                        maxHeight: '400px',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedMedia(null);
                                        onMediaSelect(null);
                                    }}
                                    style={{
                                        marginTop: 8,
                                        background: 'rgba(0,0,0,0.55)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '20px',
                                        padding: '6px 14px',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {t('remove_preview', 'Remove')}
                                </button>
                            </div>
                        )}

                        {isCameraPhotoSelection && (
                            <div className="media-preview" style={{ position: 'relative', marginTop: 12 }}>
                                <img
                                    src={selectedMedia.preview}
                                    alt=""
                                    className="preview-image"
                                    style={{
                                        width: '100%',
                                        maxHeight: '300px',
                                        objectFit: 'cover',
                                        borderRadius: '12px',
                                    }}
                                />
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
                                        cursor: 'pointer',
                                    }}
                                >
                                    {t('remove_preview', 'Remove')}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {source === 'upload' && (
                    <div className="custom-image-container">
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12, textAlign: 'center' }}>
                            {t('upload_photo_only_hint', {
                                defaultValue:
                                    'Choose an image from your device. Videos are not accepted here — use the Camera tab to record.',
                            })}
                        </p>
                        {libraryImages.length > 0 && (
                            <div style={{ marginBottom: 14 }}>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                                    {t('saved_media_library', { defaultValue: 'Saved media library' })}
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 10 }}>
                                    {libraryImages.map((url, idx) => (
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
                                                    selectedMedia?.preview === url ? '3px solid var(--primary)' : '2px solid var(--border-color)',
                                            }}
                                        >
                                            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            {onDeleteLibraryImage && (
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
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    {t('delete', { defaultValue: 'Delete' })}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {!isUploadSelection && (
                            <MediaUpload
                                type="image"
                                maxSize={10}
                                onMediaSelect={async (file, preview, type) => {
                                    if (onPersistImage && type === 'image') {
                                        const persisted = await onPersistImage(file);
                                        if (persisted) {
                                            const mediaData = {
                                                source: 'custom_image',
                                                type: 'image',
                                                file: null,
                                                preview: persisted,
                                                fromLibrary: true,
                                            };
                                            setSelectedMedia(mediaData);
                                            onMediaSelect(mediaData);
                                            return;
                                        }
                                    }
                                    handleCustomMedia(file, preview, type);
                                }}
                            />
                        )}
                        {isUploadSelection && (selectedMedia.preview || selectedMedia.url) && (
                            <div className="media-preview" style={{ position: 'relative' }}>
                                <img
                                    src={selectedMedia.preview || selectedMedia.url}
                                    alt="Selected"
                                    className="preview-image"
                                    style={{
                                        width: '100%',
                                        maxHeight: '300px',
                                        objectFit: 'cover',
                                        borderRadius: '12px',
                                    }}
                                />
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
                                        cursor: 'pointer',
                                    }}
                                >
                                    {t('remove_preview', 'Remove')}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MediaSelector;
