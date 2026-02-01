import React, { useState, useRef } from 'react';
import { FaCamera, FaTrash, FaTimes, FaCheck } from 'react-icons/fa';
import './ImageUpload.css';

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
    const [preview, setPreview] = useState(currentImage);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileSelect = (file) => {
        if (!file) return;

        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            alert('Only JPG, PNG, and WebP images are allowed');
            return;
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image size must be less than 5MB');
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
                onDrop={handleDrop}
            >
                {showPreview && preview ? (
                    <div className="image-preview">
                        <img src={preview} alt="Preview" />
                        {allowRemove && (
                            <button
                                className="remove-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemove();
                                }}
                            >
                                <FaTimes />
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="upload-placeholder">
                        <FaCamera className="camera-icon" />
                        <span className="upload-text">{label}</span>
                    </div>
                )}
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleInputChange}
                style={{ display: 'none' }}
            />
        </div>
    );
};

export default ImageUpload;
