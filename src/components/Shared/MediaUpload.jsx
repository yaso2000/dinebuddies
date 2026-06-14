import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FaImage, FaVideo, FaTimes } from 'react-icons/fa';
import { validateVideo, getVideoDuration } from '../../utils/videoCompression';
import { generateThumbnailURL } from '../../utils/thumbnailGenerator';
import { getImageUploadErrorMessage } from '../../utils/imageModerationErrors';
import ImageModerationOverlay from './ImageModerationOverlay';
import './MediaUpload.css';

const MediaUpload = ({
    type = 'image', // 'image', 'video', or 'both'
    onMediaSelect,
    onCancel,
    maxSize = 25, // MB
    maxDuration = 15, // for videos (seconds)
    aspectRatio = null, // e.g., 1 for square, 16/9 for wide
    title = 'Upload Media',
    className = '',
    /** When true, onMediaSelect may return a Promise; preview shows only after it resolves. */
    awaitMediaSelect = false,
}) => {
    const { t } = useTranslation();
    const [uploading, setUploading] = useState(false);
    const [moderationStatus, setModerationStatus] = useState(null);
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
        setModerationStatus(null);

        try {
            const isVideoFile = file.type.startsWith('video/');
            const isImageFile = file.type.startsWith('image/');

            if (type === 'both') {
                if (!isVideoFile && !isImageFile) {
                    setError(t('media_invalid_file', { defaultValue: 'Please choose a photo or video file.' }));
                    return;
                }
            }

            if (type === 'video' || (type === 'both' && isVideoFile)) {
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

                if (onMediaSelect && awaitMediaSelect) {
                    setUploading(true);
                    setModerationStatus('checking');
                    setProgress(5);
                    try {
                        await Promise.resolve(onMediaSelect(file, previewUrl, 'image'));
                        setProgress(100);
                        setPreview(previewUrl);
                        setSelectedFile(file);
                        setModerationStatus(null);
                    } catch (err) {
                        setPreview(previewUrl);
                        setSelectedFile(null);
                        setModerationStatus('rejected');
                        setError(getImageUploadErrorMessage(err, t));
                    } finally {
                        setUploading(false);
                    }
                } else {
                    setPreview(previewUrl);
                    setSelectedFile(file);
                    if (onMediaSelect) {
                        onMediaSelect(file, previewUrl, 'image');
                    }
                }
            }
        } catch (err) {
            console.error('Error processing file:', err);
            setError(getImageUploadErrorMessage(err, t, 'failed_upload_image'));
            setUploading(false);
            setModerationStatus(null);
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
        setModerationStatus(null);

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
                accept={type === 'video' ? 'video/*' : type === 'both' ? 'image/*,video/*' : 'image/*'}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />

            {!preview ? (
                <div className="upload-area">
                    <button
                        type="button"
                        className="upload-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                    >
                        {type === 'video' ? <FaVideo size={32} /> : type === 'both' ? <FaImage size={32} /> : <FaImage size={32} />}
                        <span>
                            {uploading && moderationStatus === 'checking'
                                ? t('image_upload_checking')
                                : uploading
                                    ? `${t('processing', 'Processing…')} ${progress}%`
                                    : type === 'both'
                                        ? t('media_select_photo_or_video', { defaultValue: 'Choose photo or video' })
                                        : `Select ${type === 'video' ? 'Video' : 'Photo'}`}
                        </span>
                        {(type === 'video' || type === 'both') && (
                            <small>{t('media_video_limits', { defaultValue: 'Video max {{duration}}s, {{size}}MB', duration: maxDuration, size: maxSize })}</small>
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
                            <button type="button" onClick={() => setError(null)}>Dismiss</button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="preview-area">
                    <div className="preview-container">
                        {type === 'video' || (type === 'both' && selectedFile?.type?.startsWith('video/')) ? (
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
                        ) : moderationStatus === 'rejected' ? (
                            <ImageModerationOverlay status="rejected">
                                <img
                                    src={preview}
                                    alt=""
                                    className="preview-image"
                                    style={{ filter: 'grayscale(0.4)', opacity: 0.5 }}
                                />
                            </ImageModerationOverlay>
                        ) : (
                            <ImageModerationOverlay status={moderationStatus === 'checking' ? 'checking' : null}>
                                <img
                                    src={preview}
                                    alt="Preview"
                                    className="preview-image"
                                />
                            </ImageModerationOverlay>
                        )}

                        <button
                            type="button"
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
