import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaImages, FaEdit, FaTimes, FaPlus, FaUtensils, FaBuilding, FaUsers, FaCalendar, FaTrash } from 'react-icons/fa';
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

const EnhancedGallery = ({ partnerId, partner, isOwner, theme }) => {
    const { t } = useTranslation();
    const tc = theme?.colors || null;
    const th = (themed, fallback) => tc ? themed : fallback;
    const [isEditMode, setIsEditMode] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [captionEdit, setCaptionEdit] = useState(null);

    const gallery = partner?.businessInfo?.galleryEnhanced || [];

    // Tier-based limits
    const tier = partner?.subscriptionTier || 'free';
    const MAX_IMAGES = tier === 'elite' || tier === 'premium' ? 20 : tier === 'professional' ? 6 : 1;

    const handleImageUpload = async (e, category) => {
        const file = e.target.files[0];
        if (!file) return;

        if (gallery.length >= MAX_IMAGES) {
            alert(t('gallery_max_reached', `Your current plan allows up to ${MAX_IMAGES} images. Upgrade to add more.`));
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

    // For public view: hide entire section if gallery is empty
    if (!isOwner && gallery.length === 0) return null;

    return (
        <div className="enhanced-gallery-section" style={{ background: th(tc?.cardBg, undefined), position: 'relative' }}>
            {/* Header */}
            <div className="gallery-header">
                <h3 style={{ color: th(tc?.badgeText || tc?.safeText, 'white'), textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                    <FaImages style={{ color: th(tc?.accent, '#f59e0b'), marginRight: '0.5rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                    {t('gallery', 'Gallery')}
                    <span style={{
                        fontSize: '0.9rem',
                        fontWeight: '500',
                        color: th(tc?.badgeText ? tc.badgeText + 'cc' : 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0.7)'),
                        marginLeft: '0.5rem'
                    }}>
                        ({gallery.length}/{MAX_IMAGES})
                    </span>
                </h3>
                {isOwner && (
                    <button
                        onClick={() => setIsEditMode(!isEditMode)}
                        title={isEditMode ? t('done', 'Done') : t('edit', 'Edit')}
                        style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            background: isEditMode ? 'rgba(239, 68, 68, 0.1)' : 'rgba(139, 92, 246, 0.1)', cursor: 'pointer',
                            border: `1px solid ${isEditMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`,
                            color: isEditMode ? '#ef4444' : '#8b5cf6',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            transition: 'all 0.2s', position: 'absolute', top: 16, right: 16
                        }}
                    >
                        {isEditMode ? <FaTimes size={16} /> : <FaEdit size={16} />}
                    </button>
                )}
            </div>

            {/* Category Filter - Icon Mode */}
            <div className="category-filter" style={{
                display: 'flex',
                flexWrap: 'nowrap',
                overflowX: 'auto',
                gap: '6px',
                paddingBottom: '4px',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
            }}>
                <button
                    className={`category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedCategory('all')}
                    title={t('all', 'All')}
                    style={tc && selectedCategory === 'all' ? {
                        background: tc.tabBgColor || 'rgba(255,255,255,0.95)',
                        borderColor: tc.tabBorderColor || tc.accent,
                        borderWidth: '2px',
                        color: tc.tabTextColor || tc.tabBorderColor || tc.accent,
                        boxShadow: `0 2px 12px ${tc.tabBorderColor || tc.accent}33`,
                        fontWeight: '800'
                    } : tc ? {
                        borderColor: `${tc.accent}44`,
                        color: 'var(--text-secondary)',
                        background: 'transparent'
                    } : {}}
                >
                    <FaImages />
                    <span className="category-label">{t('all', 'All')}</span>
                    <span className="category-count">{stats.all}</span>
                </button>
                {CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    // For public view: hide categories with 0 images
                    if (!isOwner && stats[cat.id] === 0) return null;
                    return (
                        <button
                            key={cat.id}
                            className={`category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(cat.id)}
                            title={t(cat.id, cat.label)}
                            style={tc ? (selectedCategory === cat.id ? {
                                background: tc.tabBgColor || 'rgba(255,255,255,0.95)',
                                borderColor: tc.tabBorderColor || tc.accent,
                                borderWidth: '2px',
                                color: tc.tabTextColor || tc.tabBorderColor || tc.accent,
                                boxShadow: `0 2px 12px ${tc.tabBorderColor || tc.accent}33`,
                                fontWeight: '800'
                            } : {
                                borderColor: `${tc.accent}44`,
                                color: 'var(--text-secondary)',
                                background: 'transparent'
                            }) : {
                                borderColor: selectedCategory === cat.id ? cat.color : 'var(--border-color)',
                                color: selectedCategory === cat.id ? cat.color : 'var(--text-main)',
                                fontWeight: selectedCategory === cat.id ? '800' : '600'
                            }}
                        >
                            <Icon style={{
                                color: tc
                                    ? (selectedCategory === cat.id
                                        ? (tc.tabTextColor || tc.tabBorderColor || tc.accent)
                                        : tc.accent)
                                    : cat.color
                            }} />
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
                            <div
                                key={actualIndex}
                                className="gallery-item"
                                style={tc ? {
                                    background: tc.badgeBg,
                                    border: `1px solid ${tc.border}`,
                                    boxShadow: tc.cardShadow
                                } : {}}
                            >

                                {/* Image with theme overlay */}
                                <div className="gallery-img-container" style={{ position: 'relative', overflow: 'hidden' }}>
                                    <img
                                        src={image.url}
                                        alt={image.caption || `${category?.label} ${index + 1}`}
                                        onClick={() => {
                                            if (!isEditMode) {
                                                setLightboxIndex(actualIndex);
                                                setLightboxOpen(true);
                                            }
                                        }}
                                        style={{ display: 'block', width: '100%', cursor: isEditMode ? 'default' : 'pointer' }}
                                    />
                                    {/* Theme accent overlay on image */}
                                    {tc && (
                                        <div style={{
                                            position: 'absolute',
                                            inset: 0,
                                            background: `linear-gradient(to bottom, transparent 50%, ${tc.accent}55 100%)`,
                                            pointerEvents: 'none'
                                        }} />
                                    )}
                                    {/* Edit Mode Dark Overlay to highlight buttons */}
                                    {isEditMode && (
                                        <div style={{
                                            position: 'absolute',
                                            inset: 0,
                                            background: 'rgba(0,0,0,0.5)',
                                            pointerEvents: 'none',
                                            zIndex: 2
                                        }} />
                                    )}
                                </div>

                                {/* Caption */}
                                {(image.caption || captionEdit === actualIndex) && (
                                    <div className="image-caption" style={{ color: th(tc?.accent, undefined), zIndex: 4 }}>
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

                                {/* Action Buttons Container */}
                                {isEditMode && (
                                    <div className="image-actions-container">
                                        <button
                                            className="gallery-action-btn gallery-caption-btn"
                                            onClick={(e) => { e.stopPropagation(); setCaptionEdit(actualIndex); }}
                                            title={t('edit_caption', 'Edit caption')}
                                        >
                                            <FaEdit size={16} />
                                        </button>

                                        <button
                                            className="gallery-action-btn gallery-delete-btn"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteImage(actualIndex); }}
                                            title={t('delete', 'Delete')}
                                        >
                                            <FaTrash size={15} />
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
                    <button
                        className="lightbox-close"
                        onClick={() => setLightboxOpen(false)}
                        style={tc ? {
                            border: `2px solid ${tc.accent}`,
                            color: tc.accent,
                            boxShadow: `0 0 12px ${tc.accent}55`
                        } : {}}
                    >
                        <FaTimes />
                    </button>

                    <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={gallery[lightboxIndex]?.url}
                            alt={gallery[lightboxIndex]?.caption || 'Gallery'}
                            style={tc ? { boxShadow: tc.headerGlow } : {}}
                        />

                        {gallery[lightboxIndex]?.caption && (
                            <div
                                className="lightbox-caption"
                                style={tc ? {
                                    background: tc.cardBg,
                                    color: tc.accent,
                                    border: `1px solid ${tc.border}`,
                                    borderRadius: '8px'
                                } : {}}
                            >
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
                                    style={tc ? { border: `2px solid ${tc.accent}99`, color: tc.accent } : {}}
                                >
                                    ‹
                                </button>
                                <button
                                    className="lightbox-nav next"
                                    onClick={() => setLightboxIndex(prev =>
                                        prev === gallery.length - 1 ? 0 : prev + 1
                                    )}
                                    style={tc ? { border: `2px solid ${tc.accent}99`, color: tc.accent } : {}}
                                >
                                    ›
                                </button>
                            </>
                        )}

                        <div
                            className="lightbox-counter"
                            style={tc ? { background: tc.badgeBg, color: tc.accent, border: `1px solid ${tc.border}` } : {}}
                        >
                            {lightboxIndex + 1} / {gallery.length}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnhancedGallery;
