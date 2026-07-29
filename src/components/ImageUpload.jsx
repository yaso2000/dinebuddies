import React, { useState, useRef, useEffect } from 'react';
import { FaCamera, FaTimes } from 'react-icons/fa';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';
import './ImageUpload.css';
import { AppText } from "./base";

function isAcceptableImageFile(file) {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(type)) {
    return true;
  }
  // Android / iOS gallery often returns empty or octet-stream MIME.
  if (!type || type === 'application/octet-stream' || type === 'image/*') {
    if (!name) return true;
    return /\.(jpe?g|png|webp|heic|heif)$/i.test(name);
  }
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(name);
}

const ImageUpload = ({
  currentImage = null,
  onImageSelect,
  onImageRemove = null,
  shape = 'circle', // 'circle' or 'square'
  size = 'medium', // 'small', 'medium', 'large'
  label = 'Upload Image',
  showPreview = true,
  allowRemove = true,
  busy = false,
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [preview, setPreview] = useState(currentImage);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setPreview(currentImage);
  }, [currentImage]);

  const handleFileSelect = (file) => {
    if (!file || busy) return;

    if (!isAcceptableImageFile(file)) {
      showToast(t('image_upload_type_error', 'Only JPG, PNG, and WebP images are allowed'), 'error');
      return;
    }

    // Allow large camera photos — upload pipeline compresses to JPEG.
    if (file.size > 25 * 1024 * 1024) {
      showToast(t('image_upload_size_error', 'Image size must be less than 25MB'), 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);

    if (onImageSelect) {
      onImageSelect(file);
    }
  };

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Allow selecting the same file again on mobile.
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
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemove = () => {
    if (busy) return;
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onImageRemove) {
      onImageRemove();
    }
  };

  const handleClick = () => {
    if (busy) return;
    fileInputRef.current?.click();
  };

  return (
    <div className={`image-upload-container size-${size}`}>
      <div
        className={`image-upload-wrapper ${shape} ${isDragging ? 'dragging' : ''} ${preview ? 'has-image' : ''}${busy ? ' is-busy' : ''}`}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-busy={busy || undefined}
      >
        {showPreview && preview ? (
          <div className="image-preview">
            <img src={preview} alt="Preview" />
          </div>
        ) : (
          <div className="upload-placeholder">
            <FaCamera className="camera-icon" />
            <AppText as="span" className="upload-text">{label}</AppText>
          </div>
        )}
      </div>

      {showPreview && preview ? (
        <div className="image-upload-actions">
          <button
            type="button"
            className="change-btn"
            disabled={busy}
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
              disabled={busy}
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
        accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,image/*"
        onChange={handleInputChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default ImageUpload;
