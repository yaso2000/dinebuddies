import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaImages, FaEdit, FaTimes, FaPlus, FaUtensils, FaBuilding, FaUsers, FaCalendar } from 'react-icons/fa';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { uploadImage, deleteImage } from '../utils/imageUpload';
import './EnhancedGallery.css';

const CATEGORIES = [
    { id: 'food', label: 'Food', icon: FaUtensils, color: '#f59e0b' },
    { id: 'venue', label: 'Venue', icon: FaBuilding, color: '#3b82f6' },
    { id: 'team', label: 'Team', icon: FaUsers, color: '#10b981' },
    { id: 'events', label: 'Events', icon: FaCalendar, color: '#8b5cf6' }
];

const EnhancedGallery = ({ partnerId, partner, isOwner }) => {
    const { t } = useTranslation();
    const [isEditMode, setIsEditMode] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [captionEdit, setCaptionEdit] = useState(null);

    const gallery = partner?.businessInfo?.galleryEnhanced || [];
    const MAX_IMAGES = 20;

    const handleImageUpload = async (e, category) => {
        const file = e.target.files[0];
        if (!file) return;

        if (gallery.length >= MAX_IMAGES) {
            alert(t('gallery_max_reached', `Maximum ${MAX_IMAGES} images allowed`));
            return;
        }

        try {
            setUploadingImage(true);

            const timestamp = Date.now();
            const path = `gallery/${partnerId}/${category}_${timestamp}.jpg`;

            const options = {
                maxSizeMB: 0.5,
                maxWidthOrHeight: 1200,
                useWebWorker: true,
                fileType: 'image/jpeg',
                initialQuality: 0.85
            };

            const downloadURL = await uploadImage(file, path, null, options);

            const newImage = {
                url: downloadURL,
                category: category,
                caption: '',
                addedAt: new Date().toISOString()
            };

            const updatedGallery = [...gallery, newImage];
            const partnerRef = doc(db, 'users', partnerId);
            await updateDoc(partnerRef, {
                'businessInfo.galleryEnhanced': updatedGallery
            });

        } catch (error) {
            console.error('Error uploading image:', error);
            alert(t('upload_error', 'Failed to upload image'));
        } finally {
            setUploadingImage(false);
        }
    };

    const handleDeleteImage = async (index) => {
        if (!window.confirm(t('confirm_delete_image', 'Delete this image?'))) return;

        try {
            const imageToDelete = gallery[index];

            // Delete from storage
            try {
                await deleteImage(imageToDelete.url);
            } catch (err) {
                console.warn('Could not delete from storage:', err);
            }

            // Update Firestore
            const updatedGallery = gallery.filter((_, i) => i !== index);
            const partnerRef = doc(db, 'users', partnerId);
            await updateDoc(partnerRef, {
                'businessInfo.galleryEnhanced': updatedGallery
            });

        } catch (error) {
            console.error('Error deleting image:', error);
            alert(t('delete_error', 'Failed to delete image'));
        }
    };

    const handleUpdateCaption = async (index, caption) => {
        try {
            const updatedGallery = [...gallery];
            updatedGallery[index].caption = caption;

            const partnerRef = doc(db, 'users', partnerId);
            await updateDoc(partnerRef, {
                'businessInfo.galleryEnhanced': updatedGallery
            });

            setCaptionEdit(null);
        } catch (error) {
            console.error('Error updating caption:', error);
            alert(t('update_error', 'Failed to update caption'));
        }
    };

    const filteredGallery = selectedCategory === 'all'
        ? gallery
        : gallery.filter(img => img.category === selectedCategory);

    const getCategoryStats = () => {
        const stats = { all: gallery.length };
        CATEGORIES.forEach(cat => {
            stats[cat.id] = gallery.filter(img => img.category === cat.id).length;
        });
        return stats;
    };

    const stats = getCategoryStats();

    return (
        <div className="enhanced-gallery-section">
            {/* Header */}
            <div className="gallery-header">
                <h3>
                    <FaImages style={{ color: '#f59e0b', marginRight: '0.5rem' }} />
                    {t('gallery', 'Gallery')}
                    <span style={{
                        fontSize: '0.9rem',
                        fontWeight: '500',
                        color: 'var(--text-muted)',
                        marginLeft: '0.5rem'
                    }}>
                        ({gallery.length}/{MAX_IMAGES})
                    </span>
                </h3>
                {isOwner && (
                    <button
                        className={`edit-gallery-btn ${isEditMode ? 'active' : ''}`}
                        onClick={() => setIsEditMode(!isEditMode)}
                        title={isEditMode ? t('done', 'Done') : t('edit', 'Edit')}
                    >
                        {isEditMode ? <><FaTimes /> {t('done', 'Done')}</> : <><FaEdit /> {t('edit', 'Edit')}</>}
                    </button>
                )}
            </div>

            {/* Category Filter - Icon Mode */}
            <div className="category-filter">
                <button
                    className={`category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedCategory('all')}
                    title={t('all', 'All')}
                >
                    <FaImages />
                    <span className="category-label">{t('all', 'All')}</span>
                    <span className="category-count">{stats.all}</span>
                </button>
                {CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    return (
                        <button
                            key={cat.id}
                            className={`category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(cat.id)}
                            title={t(cat.id, cat.label)}
                            style={{
                                borderColor: selectedCategory === cat.id ? cat.color : 'var(--border-color)',
                                color: selectedCategory === cat.id ? cat.color : 'var(--text-main)'
                            }}
                        >
                            <Icon style={{ color: cat.color }} />
                            <span className="category-label">{t(cat.id, cat.label)}</span>
                            <span className="category-count">{stats[cat.id] || 0}</span>
                        </button>
                    );
                })}
            </div>

            {/* Upload Buttons (Edit Mode) - Icon-First Design */}
            {isEditMode && gallery.length < MAX_IMAGES && (
                <div className="upload-section">
                    <div className="upload-hint">
                        <FaPlus style={{ fontSize: '0.9rem' }} />
                        <span>{t('add_images_above', 'Add images by category:')}</span>
                    </div>
                    <div className="upload-grid">
                        {CATEGORIES.map(cat => {
                            const Icon = cat.icon;
                            return (
                                <label
                                    key={cat.id}
                                    className="upload-btn"
                                    style={{ borderColor: cat.color }}
                                    title={`${t('add', 'Add')} ${t(cat.id, cat.label)}`}
                                >
                                    <Icon style={{ color: cat.color, fontSize: '1.8rem' }} />
                                    <span className="upload-label">{t(cat.id, cat.label)}</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleImageUpload(e, cat.id)}
                                        disabled={uploadingImage}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}

            {uploadingImage && (
                <div className="uploading-indicator">
                    ⏳ {t('uploading', 'Uploading...')}
                </div>
            )}

            {/* Gallery Grid */}
            {filteredGallery.length === 0 ? (
                <div className="gallery-empty">
                    <FaImages style={{ fontSize: '3rem', opacity: 0.3 }} />
                    <p>{t('no_images', 'No images yet')}</p>
                    {isEditMode && (
                        <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                            {t('add_images_above', 'Add images using the buttons above')}
                        </p>
                    )}
                </div>
            ) : (
                <div className="gallery-grid">
                    {filteredGallery.map((image, index) => {
                        const actualIndex = gallery.indexOf(image);
                        const category = CATEGORIES.find(c => c.id === image.category);
                        const Icon = category?.icon || FaImages;

                        return (
                            <div key={actualIndex} className="gallery-item">
                                {/* Category Badge */}
                                <div
                                    className="category-badge"
                                    style={{ background: category?.color || '#666' }}
                                >
                                    <Icon />
                                </div>

                                {/* Image */}
                                <img
                                    src={image.url}
                                    alt={image.caption || `${category?.label} ${index + 1}`}
                                    onClick={() => {
                                        setLightboxIndex(actualIndex);
                                        setLightboxOpen(true);
                                    }}
                                />

                                {/* Caption */}
                                {(image.caption || captionEdit === actualIndex) && (
                                    <div className="image-caption">
                                        {captionEdit === actualIndex ? (
                                            <div className="caption-edit">
                                                <input
                                                    type="text"
                                                    defaultValue={image.caption}
                                                    onBlur={(e) => handleUpdateCaption(actualIndex, e.target.value)}
                                                    onKeyPress={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleUpdateCaption(actualIndex, e.target.value);
                                                        }
                                                    }}
                                                    autoFocus
                                                    placeholder={t('add_caption', 'Add caption...')}
                                                />
                                            </div>
                                        ) : (
                                            <p onClick={() => isEditMode && setCaptionEdit(actualIndex)}>
                                                {image.caption}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Edit Controls */}
                                {isEditMode && (
                                    <div className="image-controls">
                                        <button
                                            className="control-btn caption-btn"
                                            onClick={() => setCaptionEdit(actualIndex)}
                                            title={t('edit_caption', 'Edit caption')}
                                        >
                                            <FaEdit />
                                        </button>
                                        <button
                                            className="control-btn delete-btn"
                                            onClick={() => handleDeleteImage(actualIndex)}
                                            title={t('delete', 'Delete')}
                                        >
                                            <FaTimes />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Lightbox */}
            {lightboxOpen && (
                <div className="gallery-lightbox" onClick={() => setLightboxOpen(false)}>
                    <button className="lightbox-close" onClick={() => setLightboxOpen(false)}>
                        <FaTimes />
                    </button>

                    <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={gallery[lightboxIndex]?.url}
                            alt={gallery[lightboxIndex]?.caption || 'Gallery'}
                        />

                        {gallery[lightboxIndex]?.caption && (
                            <div className="lightbox-caption">
                                {gallery[lightboxIndex].caption}
                            </div>
                        )}

                        {/* Navigation */}
                        {gallery.length > 1 && (
                            <>
                                <button
                                    className="lightbox-nav prev"
                                    onClick={() => setLightboxIndex(prev =>
                                        prev === 0 ? gallery.length - 1 : prev - 1
                                    )}
                                >
                                    ‹
                                </button>
                                <button
                                    className="lightbox-nav next"
                                    onClick={() => setLightboxIndex(prev =>
                                        prev === gallery.length - 1 ? 0 : prev + 1
                                    )}
                                >
                                    ›
                                </button>
                            </>
                        )}

                        <div className="lightbox-counter">
                            {lightboxIndex + 1} / {gallery.length}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnhancedGallery;
