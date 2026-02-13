import React, { useState, useRef } from 'react';
import { FaImage, FaVideo, FaCloud, FaTimes } from 'react-icons/fa';
import { validateVideo, getVideoDuration } from '../../utils/videoCompression';
import { generateThumbnailURL } from '../../utils/thumbnailGenerator';
import './MediaUpload.css';

const MediaUpload = ({
    type = 'image', // 'image' | 'video'
    maxDuration = 60, // for videos (seconds)
    maxSize = 100, // MB
    onMediaSelect,
    onCancel,
    className = ''
}) => {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [videoDuration, setVideoDuration] = useState(0);

    const fileInputRef = useRef(null);

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setError(null);
        setProgress(0);

        try {
            if (type === 'video') {
                // Validate video
                setUploading(true);
                setProgress(10);

                const validation = await validateVideo(file, {
                    maxDuration,
                    maxSize: maxSize * 1024 * 1024
                });

                if (!validation.valid) {
                    setError(validation.error);
                    setUploading(false);
                    return;
                }

                setProgress(30);

                // Get duration
                const duration = await getVideoDuration(file);
                setVideoDuration(Math.round(duration));

                setProgress(60);

                // Generate thumbnail for poster
                let thumbnailBlobUrl = null;
                try {
                    thumbnailBlobUrl = await generateThumbnailURL(file);
                } catch (thumbError) {
                    console.warn('Thumbnail generation failed:', thumbError);
                }

                // Create video URL
                const videoUrl = URL.createObjectURL(file);
                setPreview(videoUrl); // Use video URL as preview state for consistency

                setProgress(100);
                setSelectedFile(file);

                if (onMediaSelect) {
                    // Pass VIDEO URL as the preview, so MediaSelector can play it
                    onMediaSelect(file, videoUrl, 'video');
                }

                setUploading(false);
            } else {
                // Image
                const maxFileSize = maxSize * 1024 * 1024;

                if (file.size > maxFileSize) {
                    setError(`Image too large. Maximum size is ${maxSize}MB`);
                    return;
                }

                const previewUrl = URL.createObjectURL(file);
                setPreview(previewUrl);
                setSelectedFile(file);

                if (onMediaSelect) {
                    onMediaSelect(file, previewUrl, 'image');
                }
            }
        } catch (err) {
            console.error('Error processing file:', err);
            setError(err.message || 'Failed to process file');
            setUploading(false);
        }
    };

    const handleRemove = () => {
        if (preview) {
            URL.revokeObjectURL(preview);
        }
        setPreview(null);
        setSelectedFile(null);
        setProgress(0);
        setError(null);
        setVideoDuration(0);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }

        if (onCancel) {
            onCancel();
        }
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`media-upload ${className}`}>
            <input
                ref={fileInputRef}
                type="file"
                accept={type === 'video' ? 'video/*' : 'image/*'}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />

            {!preview ? (
                <div className="upload-area">
                    <button
                        className="upload-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                    >
                        {type === 'video' ? <FaVideo size={32} /> : <FaImage size={32} />}
                        <span>
                            {uploading ? `Processing... ${progress}%` : `Select ${type === 'video' ? 'Video' : 'Photo'}`}
                        </span>
                        {type === 'video' && (
                            <small>Max {maxDuration}s, {maxSize}MB</small>
                        )}
                    </button>

                    {uploading && (
                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    )}

                    {error && (
                        <div className="error-message">
                            <p>{error}</p>
                            <button onClick={() => setError(null)}>Dismiss</button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="preview-area">
                    <div className="preview-container">
                        {type === 'video' ? (
                            <>
                                <video
                                    src={preview}
                                    controls
                                    className="preview-video"
                                />
                                <div className="video-info">
                                    <span className="duration">{formatDuration(videoDuration)}</span>
                                </div>
                            </>
                        ) : (
                            <img
                                src={preview}
                                alt="Preview"
                                className="preview-image"
                            />
                        )}

                        <button
                            className="remove-btn"
                            onClick={handleRemove}
                        >
                            <FaTimes />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MediaUpload;
