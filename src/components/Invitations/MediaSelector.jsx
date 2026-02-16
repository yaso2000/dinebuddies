import React, { useState, useEffect } from 'react';
import { FaImage, FaVideo, FaStore, FaCamera, FaUpload } from 'react-icons/fa';
import MediaUpload from '../Shared/MediaUpload';
import VideoRecorder from '../Shared/VideoRecorder';
import './MediaSelector.css';

const MediaSelector = ({ restaurant, suggestedImages = [], onMediaSelect, className = '' }) => {
    const [source, setSource] = useState(null); // 'venue' | 'custom_image' | 'custom_video'
    const [videoMode, setVideoMode] = useState(null); // 'upload' | 'record'
    const [photoMode, setPhotoMode] = useState(null); // 'upload' | 'capture'
    const [selectedMedia, setSelectedMedia] = useState(null);

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
        const mediaData = {
            source: 'venue', // could be 'restaurant' or 'google_place' but 'venue' is generic enough
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

    const handleRecording = (file) => {
        const previewUrl = URL.createObjectURL(file);
        const mediaData = {
            source: 'custom_video',
            file: file,
            preview: previewUrl,
            type: 'video'
        };
        setSelectedMedia(mediaData);
        onMediaSelect(mediaData);
    };

    const handlePhotoCapture = (file) => {
        const previewUrl = URL.createObjectURL(file);
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
            setSource('venue');

            // If only one image exists, select it automatically. Otherwise show grid.
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
                setSelectedMedia(null);
                onMediaSelect(null);
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
            {!source ? (
                <div className="source-options">
                    {/* Venue Images (Partner or Google) */}
                    {hasVenueImages && (
                        <button
                            type="button"
                            className="source-option"
                            onClick={() => handleSourceChange('venue')}
                        >
                            <div className="option-icon">
                                <FaStore size={32} />
                            </div>
                            <h5>Venue Photos</h5>
                            <p>Select from venue</p>
                        </button>
                    )}

                    {/* Custom Image */}
                    <button
                        type="button"
                        className="source-option"
                        onClick={() => handleSourceChange('custom_image')}
                    >
                        <div className="option-icon">
                            <FaImage size={32} />
                        </div>
                        <h5>Your Photo</h5>
                        <p>Upload from device</p>
                    </button>

                    {/* Custom Video */}
                    <button
                        type="button"
                        className="source-option"
                        onClick={() => handleSourceChange('custom_video')}
                    >
                        <div className="option-icon">
                            <FaVideo size={32} />
                        </div>
                        <h5>Video</h5>
                        <p>Record or upload (30s max)</p>
                    </button>
                </div>
            ) : (
                <div className="selected-source">
                    {/* Source Header */}
                    <div className="source-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 'bold' }}>
                            {source === 'venue' && '📷 Venue Photos'}
                            {source === 'custom_image' && '📸 Your Photo'}
                            {source === 'custom_video' && '🎬 Video'}
                        </h5>
                        <button
                            type="button"
                            className="change-btn"
                            onClick={resetSelection}
                            style={{
                                background: 'rgba(255,255,255,0.1)',
                                border: 'none',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                color: 'var(--text-secondary)',
                                fontSize: '0.8rem',
                                cursor: 'pointer'
                            }}
                        >
                            Change
                        </button>
                    </div>

                    {/* Venue Image Selection Grid */}
                    {source === 'venue' && (
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

                    {/* Custom Image - Choose Mode */}
                    {source === 'custom_image' && !selectedMedia && !photoMode && (
                        <div className="video-mode-selection">
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Choose how to add your photo:</p>
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

                    {/* Photo Capture Mode */}
                    {source === 'custom_image' && photoMode === 'capture' && !selectedMedia && (
                        <div className="capture-wrapper">
                            <VideoRecorder
                                mode="photo"
                                onRecordingComplete={handlePhotoCapture}
                                onCancel={() => setPhotoMode(null)}
                            />
                        </div>
                    )}

                    {/* Image Upload Mode */}
                    {source === 'custom_image' && photoMode === 'upload' && !selectedMedia && (
                        <div className="upload-wrapper" style={{ position: 'relative' }}>
                            <button
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

                    {/* Custom Image Preview */}
                    {source === 'custom_image' && selectedMedia && (
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

                    {/* Custom Video - Choose Mode */}
                    {source === 'custom_video' && !videoMode && !selectedMedia && (
                        <div className="video-mode-selection">
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Choose how to add your video:</p>
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

                    {/* Video Recording */}
                    {source === 'custom_video' && videoMode === 'record' && !selectedMedia && (
                        <VideoRecorder
                            maxDuration={30}
                            onRecordingComplete={handleRecording}
                            onCancel={() => setVideoMode(null)}
                        />
                    )}

                    {/* Video Upload */}
                    {source === 'custom_video' && videoMode === 'upload' && !selectedMedia && (
                        <MediaUpload
                            type="video"
                            maxDuration={30}
                            maxSize={50}
                            onMediaSelect={handleCustomMedia}
                            onCancel={() => setVideoMode(null)}
                        />
                    )}

                    {/* Video Preview */}
                    {source === 'custom_video' && selectedMedia && (
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
    );
};

export default MediaSelector;
