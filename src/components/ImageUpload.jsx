import React, { useState, useRef, useEffect } from 'react';
import { FaCamera, FaTimes } from 'react-icons/fa';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { prepareImageFileForUpload } from '../utils/imageUpload';
import './ImageUpload.css';
import { AppText } from './base';

function isAcceptableImageFile(file) {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(type)) {
    return true;
  }
  if (!type || type === 'application/octet-stream' || type === 'image/*') {
    if (!name) return true;
    return /\.(jpe?g|png|webp|heic|heif)$/i.test(name);
  }
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(name);
}

/**
 * Never uses FileReader data-URLs (break on Android WebView for camera photos).
 * Converts to JPEG first, then previews via blob: URL.
 */
const ImageUpload = ({
  currentImage = null,
  onImageSelect,
  onImageRemove = null,
  shape = 'circle',
  size = 'medium',
  label = 'Upload Image',
  showPreview = true,
  allowRemove = true,
  busy = false,
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [localPreview, setLocalPreview] = useState(null);
  const [brokenRemote, setBrokenRemote] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const objectUrlRef = useRef(null);

  const revokeLocalPreview = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setLocalPreview(null);
  };

  useEffect(() => {
    if (currentImage && typeof currentImage === 'string' && !currentImage.startsWith('blob:')) {
      revokeLocalPreview();
      setBrokenRemote(false);
    }
  }, [currentImage]);

  useEffect(() => () => revokeLocalPreview(), []);

  const displaySrc = localPreview || (!brokenRemote ? currentImage : null);
  const isBusy = busy || preparing;

  const handleFileSelect = async (file) => {
    if (!file || isBusy) return;

    if (!isAcceptableImageFile(file)) {
      showToast(t('image_upload_type_error', 'Only JPG, PNG, and WebP images are allowed'), 'error');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      showToast(t('image_upload_size_error', 'Image size must be less than 25MB'), 'error');
      return;
    }

    setPreparing(true);
    try {
      const prepared = await prepareImageFileForUpload(file);
      revokeLocalPreview();
      const objectUrl = URL.createObjectURL(prepared);
      objectUrlRef.current = objectUrl;
      setLocalPreview(objectUrl);
      setBrokenRemote(false);

      if (onImageSelect) {
        await Promise.resolve(onImageSelect(prepared));
      }
    } catch (err) {
      console.error('Image prepare failed:', err);
      showToast(
        t('image_upload_type_error', 'Could not read this photo. Please choose a JPG or PNG.'),
        'error'
      );
      revokeLocalPreview();
    } finally {
      setPreparing(false);
    }
  };

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) void handleFileSelect(file);
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFileSelect(file);
  };

  const handleRemove = () => {
    if (isBusy) return;
    revokeLocalPreview();
    setBrokenRemote(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (onImageRemove) onImageRemove();
  };

  const handleClick = () => {
    if (isBusy) return;
    fileInputRef.current?.click();
  };

  return (
    <div className={`image-upload-container size-${size}`}>
      <div
        className={`image-upload-wrapper ${shape} ${isDragging ? 'dragging' : ''} ${displaySrc ? 'has-image' : ''}${isBusy ? ' is-busy' : ''}`}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-busy={isBusy || undefined}
      >
        {showPreview && displaySrc ? (
          <div className="image-preview">
            <img
              src={displaySrc}
              alt=""
              onError={() => {
                if (localPreview && displaySrc === localPreview) {
                  revokeLocalPreview();
                } else {
                  setBrokenRemote(true);
                }
              }}
            />
          </div>
        ) : (
          <div className="upload-placeholder">
            <FaCamera className="camera-icon" />
            <AppText as="span" className="upload-text">{label}</AppText>
          </div>
        )}
      </div>

      {showPreview && displaySrc ? (
        <div className="image-upload-actions">
          <button
            type="button"
            className="change-btn"
            disabled={isBusy}
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            title={label}
            aria-label={label}
          >
            <FaCamera className="change-btn__icon" aria-hidden />
          </button>
          {allowRemove ? (
            <button
              type="button"
              className="remove-btn"
              disabled={isBusy}
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              title="Remove photo"
              aria-label="Remove photo"
            >
              <FaTimes className="remove-btn__icon" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default ImageUpload;
