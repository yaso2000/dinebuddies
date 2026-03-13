import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaImages, FaEdit, FaTimes, FaPlus, FaUtensils, FaBuilding, FaUsers, FaCalendar, FaTrash, FaShare, FaGripVertical } from 'react-icons/fa';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { uploadImage, deleteImage } from '../utils/imageUpload';
import { useToast } from '../context/ToastContext';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    rectSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './EnhancedGallery.css';

const CATEGORIES = [
    { id: 'food', label: 'Food', icon: FaUtensils, color: '#f59e0b' },
    { id: 'venue', label: 'Venue', icon: FaBuilding, color: '#3b82f6' },
    { id: 'team', label: 'Team', icon: FaUsers, color: '#10b981' },
    { id: 'events', label: 'Events', icon: FaCalendar, color: '#8b5cf6' }
];

function SortableGalleryItem({
    id, image, actualIndex, category, Icon, tc, th, t, isEditMode, captionEdit, setCaptionEdit,
    handleUpdateCaption, handleDeleteImage, handleMoveToCategory, moveMenuForIndex, setMoveMenuForIndex,
    moveMenuRef, moveButtonRef, moveMenuPosition, CATEGORIES, setLightboxIndex, setLightboxOpen
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    return (
        <div
            ref={setNodeRef}
            className="gallery-item"
            style={{
                ...(tc ? { background: tc.badgeBg, border: `1px solid ${tc.border}`, boxShadow: tc.cardShadow } : {}),
                ...style,
                opacity: isDragging ? 0.8 : 1,
            }}
        >
            {isEditMode && (
                <div
                    {...attributes}
                    {...listeners}
                    className="gallery-drag-handle"
                    title={t('drag_to_reorder', 'Drag to reorder')}
                >
                    <FaGripVertical size={14} />
                </div>
            )}
            <div className="gallery-img-container" style={{ position: 'relative', overflow: 'hidden' }}>
                <img
                    src={image.url}
                    alt={image.caption || `${category?.label} ${actualIndex + 1}`}
                    onClick={() => {
                        if (!isEditMode) {
                            setLightboxIndex(actualIndex);
                            setLightboxOpen(true);
                        }
                    }}
                    style={{ display: 'block', width: '100%', cursor: isEditMode ? 'default' : 'pointer' }}
                />
                {tc && (
                    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, transparent 50%, ${tc.accent}55 100%)`, pointerEvents: 'none' }} />
                )}
                {isEditMode && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', pointerEvents: 'none', zIndex: 2 }} />
                )}
            </div>
            {(image.caption || captionEdit === actualIndex) && (
                <div className="image-caption" style={{ color: th(tc?.accent, undefined), zIndex: 4 }}>
                    {captionEdit === actualIndex ? (
                        <div className="caption-edit">
                            <input
                                type="text"
                                defaultValue={image.caption}
                                onBlur={(e) => handleUpdateCaption(actualIndex, e.target.value)}
                                onKeyPress={(e) => { if (e.key === 'Enter') handleUpdateCaption(actualIndex, e.target.value); }}
                                autoFocus
                                placeholder={t('add_caption', 'Add caption...')}
                            />
                        </div>
                    ) : (
                        <p onClick={() => isEditMode && setCaptionEdit(actualIndex)}>{image.caption}</p>
                    )}
                </div>
            )}
            {isEditMode && (
                <div className="image-actions-container">
                    <button className="gallery-action-btn gallery-caption-btn" onClick={(e) => { e.stopPropagation(); setCaptionEdit(actualIndex); }} title={t('edit_caption', 'Edit caption')}>
                        <FaEdit size={16} />
                    </button>
                    <div style={{ position: 'relative' }}>
                        <button
                            ref={moveMenuForIndex === actualIndex ? moveButtonRef : null}
                            className="gallery-action-btn"
                            onClick={(e) => { e.stopPropagation(); setMoveMenuForIndex(prev => prev === actualIndex ? null : actualIndex); }}
                            title={t('move_to_category', 'Move to category')}
                            style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.5)', color: '#3b82f6', width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                        >
                            <FaShare size={14} />
                        </button>
                        {moveMenuForIndex === actualIndex && createPortal(
                            <ul ref={moveMenuRef} className="gallery-move-menu" style={{ position: 'fixed', top: moveMenuPosition.top, left: moveMenuPosition.left, margin: 0, padding: '6px 0', listStyle: 'none', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', minWidth: 140, zIndex: 10000 }}>
                                {CATEGORIES.filter(c => c.id !== (image.category || 'venue')).map(cat => {
                                    const CatIcon = cat.icon;
                                    return (
                                        <li key={cat.id}>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); handleMoveToCategory(actualIndex, cat.id); }} style={{ width: '100%', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '0.9rem', cursor: 'pointer', textAlign: 'left' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-input)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                                                <CatIcon style={{ color: cat.color, flexShrink: 0 }} size={16} /> {t(cat.id, cat.label)}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>,
                            document.body
                        )}
                    </div>
                    <button className="gallery-action-btn gallery-delete-btn" onClick={(e) => { e.stopPropagation(); handleDeleteImage(actualIndex); }} title={t('delete', 'Delete')}>
                        <FaTrash size={15} />
                    </button>
                </div>
            )}
        </div>
    );
}

const EnhancedGallery = ({ profileId, business, isOwner, theme }) => {
    const partnerId = profileId;
    const { t } = useTranslation();
    const { showToast } = useToast();
    const tc = theme?.colors || null;
    const th = (themed, fallback) => tc ? themed : fallback;
    const [isEditMode, setIsEditMode] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [captionEdit, setCaptionEdit] = useState(null);
    const [moveMenuForIndex, setMoveMenuForIndex] = useState(null);
    const [moveMenuPosition, setMoveMenuPosition] = useState({ top: 0, left: 0 });
    const moveMenuRef = useRef(null);
    const moveButtonRef = useRef(null);

    const gallery = business?.businessInfo?.galleryEnhanced || [];

    useEffect(() => {
        if (moveMenuForIndex === null) return;
        const updatePosition = () => {
            if (moveButtonRef.current) {
                const rect = moveButtonRef.current.getBoundingClientRect();
                setMoveMenuPosition({ top: rect.bottom + 4, left: rect.left });
            }
        };
        updatePosition();
        const handleClickOutside = (e) => {
            if (moveMenuRef.current && !moveMenuRef.current.contains(e.target) && !moveButtonRef.current?.contains(e.target)) setMoveMenuForIndex(null);
        };
        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [moveMenuForIndex]);

    // Tier-based limits
    const tier = business?.subscriptionTier || 'free';
    const MAX_IMAGES = tier === 'elite' ? 20 : tier === 'professional' ? 6 : 20;

    const handleImageUpload = async (e, category) => {
        const file = e.target.files[0];
        if (!file) return;

        if (gallery.length >= MAX_IMAGES) {
            showToast(t('gallery_max_reached', `Your current plan allows up to ${MAX_IMAGES} images. Upgrade to add more.`), 'error');
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
            showToast(t('upload_error', 'Failed to upload image'), 'error');
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
            showToast(t('delete_error', 'Failed to delete image'), 'error');
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
            showToast(t('update_error', 'Failed to update caption'), 'error');
        }
    };

    const handleMoveToCategory = async (index, newCategoryId) => {
        try {
            const updatedGallery = [...gallery];
            updatedGallery[index] = { ...updatedGallery[index], category: newCategoryId };

            const partnerRef = doc(db, 'users', partnerId);
            await updateDoc(partnerRef, {
                'businessInfo.galleryEnhanced': updatedGallery
            });

            setMoveMenuForIndex(null);
            showToast(t('image_moved', 'Image moved'), 'success');
        } catch (error) {
            console.error('Error moving image:', error);
            showToast(t('move_error', 'Failed to move image'), 'error');
        }
    };

    const handleReorder = async (oldIndex, newIndex) => {
        if (oldIndex === newIndex) return;
        try {
            const updatedGallery = arrayMove(gallery, oldIndex, newIndex);
            const partnerRef = doc(db, 'users', partnerId);
            await updateDoc(partnerRef, { 'businessInfo.galleryEnhanced': updatedGallery });
            showToast(t('order_updated', 'Order updated'), 'success');
        } catch (error) {
            console.error('Error reordering:', error);
            showToast(t('update_error', 'Failed to update'), 'error');
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor)
    );

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
                <h3 style={{ color: 'var(--text-main)', textShadow: 'none' }}>
                    <FaImages style={{ color: th(tc?.accent, '#8b5cf6'), marginRight: '0.5rem' }} />
                    {t('gallery', 'Gallery')}
                    <span style={{
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        color: 'var(--text-secondary)',
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
            <div className="category-filter">
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

            {/* Upload Buttons (Edit Mode) - always visible so owner can add more until limit */}
            {isEditMode && (
                <div className="upload-section">
                    <div className="upload-hint">
                        <FaPlus style={{ fontSize: '0.9rem' }} />
                        <span>{t('add_images_above', 'Add images by category:')}</span>
                        {gallery.length >= MAX_IMAGES && (
                            <span className="upload-limit-hint" style={{ marginLeft: '0.5rem', opacity: 0.85, fontSize: '0.85rem' }}>
                                ({t('gallery_limit_reached', 'Limit reached')} {gallery.length}/{MAX_IMAGES})
                            </span>
                        )}
                    </div>
                    <div className="upload-grid">
                        {CATEGORIES.map(cat => {
                            const Icon = cat.icon;
                            const atLimit = gallery.length >= MAX_IMAGES;
                            return (
                                <label
                                    key={cat.id}
                                    className={`upload-btn ${atLimit ? 'upload-btn-disabled' : ''}`}
                                    style={{ borderColor: cat.color, opacity: atLimit ? 0.7 : 1 }}
                                    title={atLimit ? t('gallery_max_reached', `Max ${MAX_IMAGES} images`) : `${t('add', 'Add')} ${t(cat.id, cat.label)}`}
                                >
                                    <Icon style={{ color: cat.color, fontSize: '1.8rem' }} />
                                    <span className="upload-label">{t(cat.id, cat.label)}</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleImageUpload(e, cat.id)}
                                        disabled={uploadingImage || atLimit}
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
                <div className="gallery-grid-wrapper">
                <div className={`gallery-grid ${isEditMode && selectedCategory === 'all' ? 'gallery-grid-sortable' : ''}`}>
                    {isEditMode && selectedCategory === 'all' && gallery.length > 1 ? (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={(event) => {
                                const { active, over } = event;
                                if (!over || active.id === over.id) return;
                                const oldIndex = Number(active.id);
                                const newIndex = Number(over.id);
                                if (!isNaN(oldIndex) && !isNaN(newIndex)) handleReorder(oldIndex, newIndex);
                            }}
                        >
                            <SortableContext items={gallery.map((_, i) => i)} strategy={rectSortingStrategy}>
                                {gallery.map((image, actualIndex) => {
                                    const category = CATEGORIES.find(c => c.id === image.category);
                                    const Icon = category?.icon || FaImages;
                                    return (
                                        <SortableGalleryItem
                                            key={actualIndex}
                                            id={actualIndex}
                                            image={image}
                                            actualIndex={actualIndex}
                                            category={category}
                                            Icon={Icon}
                                            tc={tc}
                                            th={th}
                                            t={t}
                                            isEditMode={isEditMode}
                                            captionEdit={captionEdit}
                                            setCaptionEdit={setCaptionEdit}
                                            handleUpdateCaption={handleUpdateCaption}
                                            handleDeleteImage={handleDeleteImage}
                                            handleMoveToCategory={handleMoveToCategory}
                                            moveMenuForIndex={moveMenuForIndex}
                                            setMoveMenuForIndex={setMoveMenuForIndex}
                                            moveMenuRef={moveMenuRef}
                                            moveButtonRef={moveButtonRef}
                                            moveMenuPosition={moveMenuPosition}
                                            CATEGORIES={CATEGORIES}
                                            setLightboxIndex={setLightboxIndex}
                                            setLightboxOpen={setLightboxOpen}
                                        />
                                    );
                                })}
                            </SortableContext>
                        </DndContext>
                    ) : (
                        filteredGallery.map((image, index) => {
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

                                        <div style={{ position: 'relative' }}>
                                            <button
                                                ref={moveMenuForIndex === actualIndex ? moveButtonRef : null}
                                                className="gallery-action-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setMoveMenuForIndex(prev => prev === actualIndex ? null : actualIndex);
                                                }}
                                                title={t('move_to_category', 'Move to category')}
                                                style={{
                                                    background: 'rgba(59, 130, 246, 0.2)',
                                                    border: '1px solid rgba(59, 130, 246, 0.5)',
                                                    color: '#3b82f6',
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: 8,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <FaShare size={14} />
                                            </button>
                                            {moveMenuForIndex === actualIndex && createPortal(
                                                <ul
                                                    ref={moveMenuRef}
                                                    className="gallery-move-menu"
                                                    style={{
                                                        position: 'fixed',
                                                        top: moveMenuPosition.top,
                                                        left: moveMenuPosition.left,
                                                        margin: 0,
                                                        padding: '6px 0',
                                                        listStyle: 'none',
                                                        background: 'var(--bg-card)',
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: 10,
                                                        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                                                        minWidth: 140,
                                                        zIndex: 10000,
                                                    }}
                                                >
                                                    {CATEGORIES.filter(c => c.id !== (image.category || 'venue')).map(cat => {
                                                        const CatIcon = cat.icon;
                                                        return (
                                                            <li key={cat.id}>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleMoveToCategory(actualIndex, cat.id);
                                                                    }}
                                                                    style={{
                                                                        width: '100%',
                                                                        padding: '8px 14px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: 8,
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        color: 'var(--text-main)',
                                                                        fontSize: '0.9rem',
                                                                        cursor: 'pointer',
                                                                        textAlign: 'left',
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        e.currentTarget.style.background = 'var(--bg-input)';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.currentTarget.style.background = 'none';
                                                                    }}
                                                                >
                                                                    <CatIcon style={{ color: cat.color, flexShrink: 0 }} size={16} />
                                                                    {t(cat.id, cat.label)}
                                                                </button>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>,
                                                document.body
                                            )}
                                        </div>

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
                    }))}
                </div>
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
