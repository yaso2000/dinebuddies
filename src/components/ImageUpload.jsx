import React, { useState, useRef, useEffect } from 'react';
import { FaCamera, FaTimes } from 'react-icons/fa';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { prepareImageFileForUpload } from '../utils/imageUpload';
import ImageCropModal from './ImageCropModal';
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
 * Preview via JPEG blob URL (not FileReader data-URLs).
 * Keep the local blob until the saved remote URL actually loads — otherwise a
 * brief 404/race looks like the photo was deleted.
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
  enableCrop = false,
  cropShape = 'round',
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [localPreview, setLocalPreview] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [cropSourceUrl, setCropSourceUrl] = useState(null);
  const fileInputRef = useRef(null);
  const objectUrlRef = useRef(null);
  const cropSourceUrlRef = useRef(null);

  const revokeCropSource = () => {
    if (cropSourceUrlRef.current) {
      URL.revokeObjectURL(cropSourceUrlRef.current);
      cropSourceUrlRef.current = null;
    }
    setCropSourceUrl(null);
  };

  useEffect(() => () => revokeCropSource(), []);

  const revokeLocalPreview = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setLocalPreview(null);
  };

  useEffect(() => () => revokeLocalPreview(), []);

  // When Firestore/Storage URL arrives, only drop the blob after that URL actually loads.
  useEffect(() => {
    const remote = typeof currentImage === 'string' ? currentImage.trim() : '';
    if (!remote || remote.startsWith('blob:') || !localPreview) return undefined;

    let cancelled = false;
    const probe = new Image();
    probe.onload = () => {
      if (!cancelled) revokeLocalPreview();
    };
    probe.onerror = () => {
      // Keep local preview — remote missing usually means Storage delete race.
    };
    probe.src = remote;
    return () => {
      cancelled = true;
      probe.onload = null;
      probe.onerror = null;
    };
  }, [currentImage, localPreview]);

  const displaySrc = localPreview || currentImage || null;
  const isBusy = busy || preparing;

  const commitFile = async (finalFile) => {
    revokeLocalPreview();
    const objectUrl = URL.createObjectURL(finalFile);
    objectUrlRef.current = objectUrl;
    setLocalPreview(objectUrl);

    if (onImageSelect) {
      await Promise.resolve(onImageSelect(finalFile));
    }
  };

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
    let enteredCropFlow = false;
    try {
      const prepared = await prepareImageFileForUpload(file);

      if (enableCrop) {
        revokeCropSource();
        const objectUrl = URL.createObjectURL(prepared);
        cropSourceUrlRef.current = objectUrl;
        setCropSourceUrl(objectUrl);
        enteredCropFlow = true;
        return;
      }

      await commitFile(prepared);
    } catch (err) {
      console.error('Image prepare failed:', err);
      showToast(
        t('image_upload_type_error', 'Could not read this photo. Please choose a JPG or PNG.'),
        'error'
      );
      revokeLocalPreview();
    } finally {
      if (!enteredCropFlow) setPreparing(false);
    }
  };

  const handleCropSave = async (croppedFile) => {
    revokeCropSource();
    try {
      await commitFile(croppedFile);
    } finally {
      setPreparing(false);
    }
  };

  const handleCropCancel = () => {
    revokeCropSource();
    setPreparing(false);
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

      {enableCrop && cropSourceUrl ? (
        <ImageCropModal
          imageSrc={cropSourceUrl}
          cropShape={cropShape}
          onCancel={handleCropCancel}
          onSave={handleCropSave}
        />
      ) : null}
    </div>
  );
};

export default ImageUpload;
