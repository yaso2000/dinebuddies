import React, { useState, useRef } from 'react';
import { FaCamera, FaTimes } from 'react-icons/fa';
import { useToast } from '../context/ToastContext';
import './ImageUpload.css';
import { AppText } from "./base";

const ImageUpload = ({
  currentImage = null,
  onImageSelect,
  onImageRemove = null,
  shape = 'circle', // 'circle' or 'square'
  size = 'medium', // 'small', 'medium', 'large'
  label = 'Upload Image',
  showPreview = true,
  allowRemove = true
}) => {
  const { showToast } = useToast();
  const [preview, setPreview] = useState(currentImage);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (file) => {
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      showToast('Only JPG, PNG, and WebP images are allowed', 'error');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size must be less than 5MB', 'error');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Pass file to parent
    if (onImageSelect) {
      onImageSelect(file);
    }
  };

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
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
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onImageRemove) {
      onImageRemove();
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`image-upload-container size-${size}`}>
            <div
        className={`image-upload-wrapper ${shape} ${isDragging ? 'dragging' : ''} ${preview ? 'has-image' : ''}`}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}>
        
                {showPreview && preview ?
        <div className="image-preview">
                        <img src={preview} alt="Preview" />
                    </div> :

        <div className="upload-placeholder">
                        <FaCamera className="camera-icon" />
                        <AppText as="span" className="upload-text">{label}</AppText>
                    </div>
        }
            </div>

            {showPreview && preview &&
      <div className="image-upload-actions">
                    <button
          type="button"
          className="change-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          title={label}
          aria-label={label}>
          
                        <FaCamera className="change-btn__icon" aria-hidden />
                    </button>
                    {allowRemove &&
        <button
          type="button"
          className="remove-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleRemove();
          }}
          title="Remove photo"
          aria-label="Remove photo">
          
                            <FaTimes className="remove-btn__icon" aria-hidden />
                        </button>
        }
                </div>
      }

            <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleInputChange}
        style={{ display: 'none' }} />
      
        </div>);

};

export default ImageUpload;