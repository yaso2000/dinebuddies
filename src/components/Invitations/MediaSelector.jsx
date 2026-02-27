import React, { useState, useEffect } from 'react';
import { FaImage, FaVideo, FaStore, FaCamera, FaUpload, FaTimes } from 'react-icons/fa';
import MediaUpload from '../Shared/MediaUpload';
import UnifiedCamera from '../UnifiedCamera';

import './MediaSelector.css';

const MediaSelector = ({ restaurant, suggestedImages = [], onMediaSelect, initialData = null, className = '' }) => {

    const [source, setSource] = useState(initialData?.source || null); // 'venue' | 'custom_image' | 'custom_video'
    const [videoMode, setVideoMode] = useState(null); // 'upload' | 'record'
    const [photoMode, setPhotoMode] = useState(null); // 'upload' | 'capture'
    const [selectedMedia, setSelectedMedia] = useState(initialData || null);


    const handleSourceChange = (newSource) => {
        setSource(newSource);
        setVideoMode(null);
        setPhotoMode(null);
        setSelectedMedia(null);

        if (newSource === 'venue') {
            const restaurantImage = restaurant?.image || restaurant?.restaurantImage;

            // If there's only one option (restaurant image and no suggestions, or 1 suggestion and no restaurant image), select it immediately
            if (restaurantImage && (!suggestedImages || suggestedImages.length === 0)) {
                const mediaData = {
                    source: 'restaurant',
                    url: restaurantImage,
                    type: 'image'
                };
                onMediaSelect(mediaData);
                setSelectedMedia(mediaData);
            } else if (!restaurantImage && suggestedImages?.length === 1) {
                // Auto-select google image logic - skipping async save for now to avoid UX delay on open
                // User can re-select or we can improve this later
                const mediaData = {
                    source: 'google_place',
                    url: suggestedImages[0],
                    type: 'image'
                };
                onMediaSelect(mediaData);
                setSelectedMedia(mediaData);
            }
            // Otherwise, we wait for user to pick from the grid
        }
    };

    const handleVenueImageSelect = (url) => {
        // Simple select - defer uploading to the submission phase
        const mediaData = {
            source: 'venue', // could be 'restaurant' or 'google_place'
            url: url,
            type: 'image'
        };
        setSelectedMedia(mediaData);
        onMediaSelect(mediaData);
    };

    const handleCustomMedia = (file, preview, type) => {
        const mediaData = {
            source: type === 'video' ? 'custom_video' : 'custom_image',
            file,
            preview,
            type
        };

        setSelectedMedia(mediaData);
        onMediaSelect(mediaData);
    };

    const handleRecording = (file, previewUrl) => {
        const mediaData = {
            source: 'custom_video',
            file: file,
            preview: previewUrl,
            type: 'video'
        };
        setSelectedMedia(mediaData);
        onMediaSelect(mediaData);
    };

    const handlePhotoCapture = (file, previewUrl) => {
        const mediaData = {
            source: 'custom_image',
            file: file,
            preview: previewUrl,
            type: 'image'
        };
        setSelectedMedia(mediaData);
        onMediaSelect(mediaData);
    };

    // Auto-select 'venue' source when images are available (e.g. after location select)
    useEffect(() => {
        const hasRestaurantImage = restaurant && (restaurant.image || restaurant.restaurantImage);
        const hasSuggested = suggestedImages && suggestedImages.length > 0;

        if (hasRestaurantImage || hasSuggested) {
            // Only set source to venue if no source is selected yet
            if (!source) {
                setSource('venue');
            }

            // If only one image exists, select it automatically.
            // ONLY if nothing is already selected.
            if (!selectedMedia) {
                if (hasRestaurantImage && (!suggestedImages || suggestedImages.length === 0)) {
                    const mediaData = {
                        source: 'restaurant',
                        url: restaurant.image || restaurant.restaurantImage,
                        type: 'image'
                    };
                    setSelectedMedia(mediaData);
                    onMediaSelect(mediaData);
                } else if (!hasRestaurantImage && suggestedImages?.length === 1) {
                    const mediaData = {
                        source: 'google_place',
                        url: suggestedImages[0],
                        type: 'image'
                    };
                    setSelectedMedia(mediaData);
                    onMediaSelect(mediaData);
                } else {
                    // Multiple images available: show grid
                    // Don't reset if we already have something!
                }
            }
        }
    }, [suggestedImages, restaurant]);

    const resetSelection = () => {
        setSource(null);
        setVideoMode(null);
        setPhotoMode(null);
        setSelectedMedia(null);
        onMediaSelect(null);
    };

    // Determine if we have any venue images available
    const hasRestaurantImage = restaurant && (restaurant.image || restaurant.restaurantImage);
    const hasSuggestedImages = suggestedImages && suggestedImages.length > 0;
    const hasVenueImages = hasRestaurantImage || hasSuggestedImages;

    return (
        <div className={`media-selector ${className}`}>
            {/* Tabs Header */}
            <div className="media-tabs" style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '16px',
                overflowX: 'auto',
                paddingBottom: '4px',
                borderBottom: '1px solid var(--border-color)',
                padding: '10px 0'
            }}>
                {hasVenueImages && (
                    <button
                        type="button"
                        onClick={() => handleSourceChange('venue')}
                        style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '12px',
                            background: source === 'venue' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                            color: source === 'venue' ? 'white' : 'var(--text-secondary)',
                            border: source === 'venue' ? 'none' : '1px solid transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontWeight: source === 'venue' ? 'bold' : 'normal'
                        }}
                    >
                        <FaStore />
                        <span style={{ fontSize: '0.9rem' }}>{hasRestaurantImage ? 'Rest. Photos' : 'Google Photos'}</span>
                    </button>
                )}

                <button
                    type="button"
                    onClick={() => handleSourceChange('custom_image')}
                    style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '12px',
                        background: source === 'custom_image' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                        color: source === 'custom_image' ? 'white' : 'var(--text-secondary)',
                        border: source === 'custom_image' ? 'none' : '1px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontWeight: source === 'custom_image' ? 'bold' : 'normal'
                    }}
                >
                    <FaImage />
                    <span style={{ fontSize: '0.9rem' }}>Upload</span>
                </button>

                <button
                    type="button"
                    onClick={() => handleSourceChange('custom_video')}
                    style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '12px',
                        background: source === 'custom_video' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                        color: source === 'custom_video' ? 'white' : 'var(--text-secondary)',
                        border: source === 'custom_video' ? 'none' : '1px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontWeight: source === 'custom_video' ? 'bold' : 'normal'
                    }}
                >
                    <FaVideo />
                    <span style={{ fontSize: '0.9rem' }}>Video</span>
                </button>
            </div>

            {/* Content Area */}
            <div className="tab-content">
                {/* 1. Venue Images */}
                {source === 'venue' && hasVenueImages && (
                    <div className="venue-images-container">
                        {!selectedMedia ? (
                            <div className="venue-images-grid" style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                                gap: '10px',
                                marginTop: '10px'
                            }}>
                                {hasRestaurantImage && (
                                    <div
                                        onClick={() => handleVenueImageSelect(restaurant.image || restaurant.restaurantImage)}
                                        style={{
                                            cursor: 'pointer',
                                            borderRadius: '12px',
                                            overflow: 'hidden',
                                            height: '90px',
                                            border: '2px solid transparent',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                                        }}
                                    >
                                        <img
                                            src={restaurant.image || restaurant.restaurantImage}
                                            alt="Official"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    </div>
                                )}
                                {suggestedImages.map((url, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => handleVenueImageSelect(url)}
                                        style={{
                                            cursor: 'pointer',
                                            borderRadius: '12px',
                                            overflow: 'hidden',
                                            height: '90px',
                                            border: '2px solid transparent',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                            position: 'relative'
                                        }}
                                    >
                                        <img
                                            src={url}
                                            alt={`Suggested ${idx}`}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="media-preview" style={{ position: 'relative' }}>
                                <img
                                    src={selectedMedia.url}
                                    alt="Selected Venue"
                                    className="preview-image"
                                    style={{
                                        width: '100%',
                                        maxHeight: '250px',
                                        objectFit: 'cover',
                                        borderRadius: '12px'
                                    }}
                                />
                                {selectedMedia.url && selectedMedia.url.includes('google') && !selectedMedia.url.includes('firebasestorage') && (
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '10px',
                                        left: '10px',
                                        background: 'rgba(0,0,0,0.7)',
                                        color: '#4ade80',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        ✨ Will be saved permanently
                                    </div>
                                )}
                                <button
                                    type="button"
                                    className="remove-preview-btn"
                                    onClick={() => setSelectedMedia(null)}
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
                                    }}
                                >
                                    Change Selection
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* 2. Custom Image */}
                {source === 'custom_image' && (
                    <div className="custom-image-container">
                        {!selectedMedia && !photoMode && (
                            <div className="video-mode-selection">
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem', textAlign: 'center' }}>Choose how to add your photo:</p>
                                <div className="mode-buttons" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <button
                                        type="button"
                                        className="mode-btn"
                                        onClick={() => setPhotoMode('capture')}
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
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <div className="icon-circle" style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '10px', borderRadius: '50%' }}>
                                            <FaCamera size={20} style={{ color: 'var(--primary)' }} />
                                        </div>
                                        <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Take Photo</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="mode-btn"
                                        onClick={() => setPhotoMode('upload')}
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
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <div className="icon-circle" style={{ background: 'rgba(236, 72, 153, 0.1)', padding: '10px', borderRadius: '50%' }}>
                                            <FaUpload size={20} style={{ color: 'var(--secondary)' }} />
                                        </div>
                                        <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Upload</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {photoMode === 'capture' && !selectedMedia && (
                            <UnifiedCamera
                                mode="photo"
                                onMediaCaptured={handlePhotoCapture}
                                stopCamera={() => setPhotoMode(null)}
                            />
                        )}

                        {photoMode === 'upload' && !selectedMedia && (
                            <div className="upload-wrapper" style={{ position: 'relative' }}>
                                <button
                                    type="button"
                                    onClick={() => setPhotoMode(null)}
                                    style={{
                                        position: 'absolute',
                                        top: '-40px',
                                        right: '0',
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                    }}
                                >
                                    <FaTimes /> Cancel
                                </button>
                                <MediaUpload
                                    type="image"
                                    maxSize={10}
                                    onMediaSelect={handleCustomMedia}
                                />
                            </div>
                        )}

                        {selectedMedia && (
                            <div className="media-preview" style={{ position: 'relative' }}>
                                <img
                                    src={selectedMedia.preview}
                                    alt="Selected"
                                    className="preview-image"
                                    style={{
                                        width: '100%',
                                        maxHeight: '300px',
                                        objectFit: 'cover',
                                        borderRadius: '12px'
                                    }}
                                />
                                <button
                                    type="button"
                                    className="remove-preview-btn"
                                    onClick={() => setSelectedMedia(null)}
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
                                    }}
                                >
                                    Remove
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* 3. Custom Video */}
                {source === 'custom_video' && (
                    <div className="custom-video-container">
                        {!videoMode && !selectedMedia && (
                            <div className="video-mode-selection">
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem', textAlign: 'center' }}>Choose how to add your video:</p>
                                <div className="mode-buttons" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <button
                                        type="button"
                                        className="mode-btn"
                                        onClick={() => setVideoMode('record')}
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
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <FaCamera size={24} style={{ color: 'var(--primary)' }} />
                                        <span style={{ fontSize: '0.9rem' }}>Record</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="mode-btn"
                                        onClick={() => setVideoMode('upload')}
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
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <FaUpload size={24} style={{ color: 'var(--secondary)' }} />
                                        <span style={{ fontSize: '0.9rem' }}>Upload</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {videoMode === 'record' && !selectedMedia && (
                            <UnifiedCamera
                                mode="video"
                                maxDuration={30}
                                onMediaCaptured={handleRecording}
                                stopCamera={() => setVideoMode(null)}
                            />
                        )}

                        {videoMode === 'upload' && !selectedMedia && (
                            <MediaUpload
                                type="video"
                                maxDuration={30}
                                maxSize={50}
                                onMediaSelect={handleCustomMedia}
                                onCancel={() => setVideoMode(null)}
                            />
                        )}

                        {selectedMedia && (
                            <div className="media-preview" style={{ position: 'relative' }}>
                                <video
                                    src={selectedMedia.preview}
                                    controls
                                    playsInline
                                    className="preview-video"
                                    style={{
                                        width: '100%',
                                        borderRadius: '12px',
                                        maxHeight: '400px'
                                    }}
                                />
                                <button
                                    type="button"
                                    className="remove-preview-btn"
                                    onClick={() => {
                                        setSelectedMedia(null);
                                        setVideoMode(null);
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
                                    }}
                                >
                                    Remove
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
