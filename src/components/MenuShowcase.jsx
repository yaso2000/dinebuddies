import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaUtensils, FaEdit, FaTimes, FaPlus, FaSave, FaTrash, FaFileImage, FaGripVertical } from 'react-icons/fa';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { uploadImage } from '../utils/imageUpload';
import { useToast } from '../context/ToastContext';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './MenuShowcase.css';

function SortableMenuItem({ item, category, isOwner, tc, th, t, editingId, editForm, setEditForm, uploadingEdit, openEdit, setEditingId, handleSaveEdit, handleDelete, uploadMenuImage, setUploadingEdit }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    const isEditing = editingId === item.id;
    return (
        <div
            ref={setNodeRef}
            className="menu-item-card"
            style={{
                ...(tc ? { background: tc.badgeBg, border: `1px solid ${tc.border}`, boxShadow: tc.cardShadow } : {}),
                ...style,
                opacity: isDragging ? 0.9 : 1,
            }}
        >
            {isOwner && (
                <div {...attributes} {...listeners} className="menu-drag-handle" title={t('drag_to_reorder', 'Drag to reorder')}>
                    <FaGripVertical size={12} />
                </div>
            )}
            {item.imageUrl && (
                <div className="item-image">
                    <img src={item.imageUrl} alt={item.name} />
                    <div className="category-badge" style={{ background: tc ? tc.accent : category?.color }}>{category?.icon}</div>
                </div>
            )}
            <div className="item-content">
                <div className="item-header">
                    <h4 style={{ color: th(tc?.accent, 'var(--text-main)') }}>{item.name}</h4>
                    <div className="item-price" style={tc ? { color: tc.accent, textShadow: `0 0 8px ${tc.accent}66`, background: tc.badgeBg, border: `1px solid ${tc.border}`, borderRadius: '8px', padding: '2px 8px' } : {}}>
                        {typeof item.price === 'number' ? `$${item.price.toFixed(2)}` : item.price?.toString().startsWith('$') ? item.price : `$${item.price}`}
                    </div>
                </div>
                {item.description && <p className="item-description">{item.description}</p>}
                {!item.imageUrl && (
                    <div className="category-tag" style={{ background: tc ? tc.accent : category?.color, color: tc ? tc.accentText : '#fff' }}>
                        {category?.icon} {t(category?.id, category?.label)}
                    </div>
                )}
            </div>
            {isOwner && (
                <div className="item-action-bar">
                    <button className="item-action-btn item-edit-action" onClick={() => isEditing ? setEditingId(null) : openEdit(item)}>
                        {isEditing ? <FaTimes size={13} /> : <FaEdit size={13} />}
                        {isEditing ? t('cancel', 'Cancel') : t('edit', 'Edit')}
                    </button>
                    <button className="item-action-btn item-delete-action" onClick={() => handleDelete(item.id)}>
                        <FaTrash size={13} /> {t('delete', 'Delete')}
                    </button>
                </div>
            )}
            {isEditing && (
                <div className="item-edit-form">
                    <div className="item-edit-grid">
                        <div className="form-group">
                            <label>{t('item_name', 'Item Name')}</label>
                            <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>{t('price', 'Price')} (AUD)</label>
                            <input type="number" step="0.01" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>{t('description', 'Description')}</label>
                            <textarea rows={2} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>{t('category', 'Category')}</label>
                            <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                                {MENU_CATEGORIES.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.icon} {t(cat.id, cat.label)}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>{t('image', 'Image')} ({t('optional', 'Optional')})</label>
                            <label className="image-upload-btn">
                                <FaFileImage />
                                {editForm.image ? editForm.image.name : t('change_image', 'Change Image')}
                                <input type="file" accept="image/*" onChange={e => setEditForm(f => ({ ...f, image: e.target.files[0] }))} style={{ display: 'none' }} />
                            </label>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button className="add-item-btn" style={{ flex: 1, padding: '8px' }} disabled={uploadingEdit} onClick={() => handleSaveEdit(item.id)}>
                            <FaSave /> {uploadingEdit ? t('saving', 'Saving...') : t('save', 'Save')}
                        </button>
                        <button onClick={() => setEditingId(null)} style={{ padding: '8px 14px', borderRadius: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('cancel', 'Cancel')}</button>
                    </div>
                </div>
            )}
        </div>
    );
}

const MENU_CATEGORIES = [
    { id: 'starters', label: 'Starters', icon: '🥗', color: '#10b981' },
    { id: 'mains', label: 'Main Courses', icon: '🍽️', color: '#f59e0b' },
    { id: 'desserts', label: 'Desserts', icon: '🍰', color: '#ec4899' },
    { id: 'drinks', label: 'Drinks', icon: '🥤', color: '#3b82f6' }
];

const EMPTY_FORM = {
    name: '',
    description: '',
    price: '',
    category: 'mains',
    image: null,
    imageUrl: ''
};

const MenuShowcase = ({ partnerId, profileId, menuData = [], isOwner, isPaid = true, theme }) => {
    const businessId = partnerId ?? profileId;
    const { t } = useTranslation();
    const { showToast } = useToast();
    const tc = theme?.colors || null;
    const th = (themed, fallback) => tc ? themed : fallback;

    const [menuItems, setMenuItems] = useState(menuData);
    const [selectedCategory, setSelectedCategory] = useState('all');

    // Add form
    const [showAddForm, setShowAddForm] = useState(false);
    const [addForm, setAddForm] = useState(EMPTY_FORM);
    const [uploadingAdd, setUploadingAdd] = useState(false);

    // Pending items (not yet saved to Firestore)
    const [pendingItems, setPendingItems] = useState([]);
    const [savingAll, setSavingAll] = useState(false);

    // Edit form
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState(EMPTY_FORM);
    const [uploadingEdit, setUploadingEdit] = useState(false);

    const hasPending = pendingItems.length > 0;
    const [showDraftBanner, setShowDraftBanner] = useState(false);

    // Warn on browser close/refresh if pending items
    useEffect(() => {
        const handler = (e) => {
            if (!hasPending) return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [hasPending]);

    // Hide entire section from guests if no items
    if (menuItems.length === 0 && !isOwner) return null;

    /* ---- helpers -------------------------------------------------- */
    const getStats = () => {
        const stats = { all: menuItems.length };
        MENU_CATEGORIES.forEach(cat => {
            stats[cat.id] = menuItems.filter(
                item => (item.category || 'mains').toLowerCase() === cat.id
            ).length;
        });
        return stats;
    };
    const stats = getStats();

    const filteredItems = selectedCategory === 'all'
        ? menuItems
        : menuItems.filter(item =>
            (item.category || 'mains').toLowerCase() === selectedCategory
        );

    const saveToFirestore = async (updatedMenu) => {
        const ref = doc(db, 'users', businessId);
        await updateDoc(ref, { 'businessInfo.menu': updatedMenu });
    };

    const handleReorder = async (oldIndex, newIndex) => {
        if (oldIndex === newIndex) return;
        try {
            const updated = arrayMove(menuItems, oldIndex, newIndex);
            setMenuItems(updated);
            await saveToFirestore(updated);
            showToast(t('order_updated', 'Order updated'), 'success');
        } catch {
            showToast(t('update_error', 'Update failed'), 'error');
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor)
    );

    const uploadMenuImage = async (file, itemId, setUploading) => {
        if (!file) return null;
        setUploading(true);
        try {
            const path = `menus/${businessId}/${itemId || 'new'}_${Date.now()}.jpg`;
            return await uploadImage(file, path, null, {
                maxSizeMB: 0.5, maxWidthOrHeight: 800,
                useWebWorker: true, fileType: 'image/jpeg', initialQuality: 0.85
            });
        } catch {
            showToast(t('upload_error', 'Failed to upload image'), 'error');
            return null;
        } finally {
            setUploading(false);
        }
    };

    /* ---- add (local only) ----------------------------------------- */
    const handleAdd = async () => {
        if (!addForm.name.trim() || !addForm.price) {
            showToast(t('fill_required_fields', 'Please fill in required fields'), 'error');
            return;
        }
        let imageUrl = addForm.imageUrl;
        if (addForm.image) {
            imageUrl = await uploadMenuImage(addForm.image, null, setUploadingAdd);
            if (!imageUrl) return;
        }
        const newItem = {
            id: Date.now().toString(),
            name: addForm.name.trim(),
            description: addForm.description.trim(),
            price: parseFloat(addForm.price),
            category: addForm.category,
            imageUrl: imageUrl || '',
            addedAt: new Date().toISOString()
        };
        // Add to pending list (not saved yet)
        setPendingItems(prev => [...prev, newItem]);
        // Reset form for next item
        setAddForm(EMPTY_FORM);
    };

    /* ---- save all pending items ------------------------------------ */
    const handleSaveAll = async () => {
        if (pendingItems.length === 0) {
            setShowAddForm(false);
            return;
        }
        setSavingAll(true);
        try {
            const updated = [...menuItems, ...pendingItems];
            setMenuItems(updated);
            await saveToFirestore(updated);
            setPendingItems([]);
            setAddForm(EMPTY_FORM);
            setShowAddForm(false);
            // Show draft warning for free plan users
            if (!isPaid) {
                setShowDraftBanner(true);
                setTimeout(() => setShowDraftBanner(false), 30000);
            }
        } catch (err) {
            showToast('Save failed', 'error');
        } finally {
            setSavingAll(false);
        }
    };

    /* ---- discard pending ------------------------------------------ */
    const handleDiscardPending = () => {
        setPendingItems([]);
        setAddForm(EMPTY_FORM);
        setShowAddForm(false);
    };

    /* ---- delete --------------------------------------------------- */
    const handleDelete = async (itemId) => {
        if (!window.confirm(t('confirm_delete_item', 'Delete this menu item?'))) return;
        const updated = menuItems.filter(i => i.id !== itemId);
        setMenuItems(updated);
        await saveToFirestore(updated);
    };

    /* ---- edit ----------------------------------------------------- */
    const openEdit = (item) => {
        setEditingId(item.id);
        setEditForm({
            name: item.name,
            description: item.description || '',
            price: item.price,
            category: item.category || 'mains',
            image: null,
            imageUrl: item.imageUrl || ''
        });
    };

    const handleSaveEdit = async (itemId) => {
        let imageUrl = editForm.imageUrl;
        if (editForm.image) {
            imageUrl = await uploadMenuImage(editForm.image, itemId, setUploadingEdit);
            if (!imageUrl) return;
        }
        const updated = menuItems.map(i =>
            i.id === itemId ? {
                ...i,
                name: editForm.name.trim(),
                description: editForm.description.trim(),
                price: parseFloat(editForm.price),
                category: editForm.category,
                imageUrl: imageUrl || i.imageUrl || ''
            } : i
        );
        setMenuItems(updated);
        await saveToFirestore(updated);
        setEditingId(null);
    };

    /* ---- render --------------------------------------------------- */
    return (
        <>
            <div className="menu-showcase-section" style={{ background: th(tc?.cardBg, undefined) }}>

                {/* ── Free Plan Draft Banner ── */}
                {showDraftBanner && (
                    <div style={{
                        margin: '0 0 16px',
                        padding: '14px 18px',
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(239,68,68,0.08) 100%)',
                        border: '1px solid rgba(245,158,11,0.35)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        animation: 'fadeIn 0.3s ease',
                    }}>
                        <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>⚠️</span>
                        <div style={{ flex: 1 }}>
                            <p style={{ margin: '0 0 6px', fontWeight: '700', fontSize: '0.95rem', color: '#f59e0b' }}>
                                Saved as Draft
                            </p>
                            <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                Your menu items were saved, but they <strong>won't appear on your public profile</strong> until you upgrade your plan.
                            </p>
                            <a
                                href="/pricing"
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    padding: '6px 14px', borderRadius: '8px',
                                    background: 'rgba(245,158,11,0.15)',
                                    border: '1px solid rgba(245,158,11,0.4)',
                                    color: '#f59e0b', fontSize: '0.85rem',
                                    fontWeight: '700', textDecoration: 'none',
                                    transition: 'all 0.2s',
                                }}
                            >
                                🚀 Upgrade Plan
                            </a>
                        </div>
                        <button
                            onClick={() => setShowDraftBanner(false)}
                            style={{
                                background: 'none', border: 'none', color: 'var(--text-muted)',
                                fontSize: '1.1rem', cursor: 'pointer', padding: '2px', flexShrink: 0,
                            }}
                        >✕</button>
                    </div>
                )}

                {/* ── Header ── */}
                <div className="menu-header">
                    <h3 style={{ color: th(tc?.accent, 'var(--text-main)') }}>
                        <FaUtensils style={{ color: th(tc?.accent, '#f59e0b') }} />
                        {t('menu', 'Menu')} ({menuItems.length})
                    </h3>
                    {isOwner && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {/* Plan badges — توضيح أن هذه الميزة لخطة Pro فصاعداً */}
                            <div style={{ display: 'flex', gap: 4 }}>
                                <span title="Professional Plan" style={{
                                    fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px',
                                    borderRadius: 20, border: '1px solid #8b5cf6',
                                    color: '#a78bfa', background: 'rgba(139,92,246,0.12)',
                                    display: 'flex', alignItems: 'center', gap: 3
                                }}>⚡ Pro</span>
                                <span title="Elite Plan" style={{
                                    fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px',
                                    borderRadius: 20, border: '1px solid #f59e0b',
                                    color: '#fbbf24', background: 'rgba(245,158,11,0.12)',
                                    display: 'flex', alignItems: 'center', gap: 3
                                }}>👑 Elite</span>
                            </div>

                            {/* Add / Close button */}
                            <button
                                onClick={() => { setShowAddForm(v => !v); setEditingId(null); }}
                                title={showAddForm ? t('cancel', 'Cancel') : t('add_item', 'Add Item')}
                                style={{
                                    width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
                                    border: `1px solid ${showAddForm ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.35)'}`,
                                    background: showAddForm ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                                    color: showAddForm ? '#ef4444' : '#10b981',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {showAddForm ? <FaTimes size={15} /> : <FaPlus size={15} />}
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Add Form ── */}
                {isOwner && showAddForm && (
                    <div className="add-item-form">
                        <h4><FaPlus style={{ color: '#10b981' }} /> {t('add_menu_item', 'Add Menu Item')}</h4>

                        {/* Pending items preview */}
                        {pendingItems.length > 0 && (
                            <div style={{
                                marginBottom: '1rem',
                                padding: '0.75rem',
                                background: 'rgba(16,185,129,0.08)',
                                border: '1px solid rgba(16,185,129,0.25)',
                                borderRadius: '10px',
                            }}>
                                <p style={{ margin: '0 0 6px', fontSize: '0.8rem', fontWeight: '700', color: '#10b981' }}>
                                    ✅ {pendingItems.length} item{pendingItems.length > 1 ? 's' : ''} ready to save:
                                </p>
                                {pendingItems.map((item, i) => (
                                    <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>• {item.name}</span>
                                        <span style={{ opacity: 0.7 }}>{item.price} AUD</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="form-grid">
                            <div className="form-group">
                                <label>{t('item_name', 'Item Name')} *</label>
                                <input
                                    type="text"
                                    value={addForm.name}
                                    onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder={t('item_name_placeholder', 'e.g., Margherita Pizza')}
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('price', 'Price')} * (AUD)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={addForm.price}
                                    onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="form-group full-width">
                                <label>{t('description', 'Description')}</label>
                                <textarea
                                    value={addForm.description}
                                    onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder={t('description_placeholder', 'Describe this item...')}
                                    rows={2}
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('category', 'Category')}</label>
                                <select value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}>
                                    {MENU_CATEGORIES.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.icon} {t(cat.id, cat.label)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>{t('image', 'Image')} ({t('optional', 'Optional')})</label>
                                <label className="image-upload-btn">
                                    <FaFileImage />
                                    {addForm.image ? addForm.image.name : t('choose_image', 'Choose Image')}
                                    <input
                                        type="file" accept="image/*"
                                        onChange={e => setAddForm(f => ({ ...f, image: e.target.files[0] }))}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {/* + Add another item */}
                            <button
                                className="add-item-btn"
                                onClick={handleAdd}
                                disabled={uploadingAdd || !addForm.name.trim() || !addForm.price}
                                style={tc ? {
                                    background: tc.footerBg, border: `1px solid ${tc.border}`,
                                    color: tc.accentText || '#fff', boxShadow: tc.btnShadow,
                                    borderRadius: tc.btnBorderRadius, flex: 1
                                } : { flex: 1 }}
                            >
                                <FaPlus />
                                {uploadingAdd ? t('uploading', 'Uploading...') : t('add_another', '+ Add')}
                            </button>

                            {/* 💾 Save all */}
                            <button
                                onClick={handleSaveAll}
                                disabled={savingAll || pendingItems.length === 0}
                                style={{
                                    flex: 2,
                                    padding: '0.65rem 1rem',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(16,185,129,0.4)',
                                    background: pendingItems.length > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                                    color: pendingItems.length > 0 ? '#10b981' : 'var(--text-muted)',
                                    fontWeight: '700',
                                    fontSize: '0.9rem',
                                    cursor: pendingItems.length > 0 ? 'pointer' : 'not-allowed',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    transition: 'all 0.2s',
                                }}
                            >
                                <FaSave />
                                {savingAll ? 'Saving...' : `Save (${pendingItems.length})`}
                            </button>

                            {/* ✕ Close / Discard */}
                            <button
                                onClick={handleDiscardPending}
                                style={{
                                    padding: '0.65rem 0.9rem',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(239,68,68,0.3)',
                                    background: 'rgba(239,68,68,0.08)',
                                    color: '#ef4444',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                                title="Discard all pending"
                            >
                                <FaTimes />
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Category Filter ── */}
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
                        style={tc && selectedCategory === 'all' ? {
                            background: tc.tabBgColor || 'rgba(255,255,255,0.95)',
                            borderColor: tc.tabBorderColor || tc.accent,
                            borderWidth: '2px',
                            color: tc.tabTextColor || tc.tabBorderColor || tc.accent,
                            boxShadow: `0 2px 12px ${tc.tabBorderColor || tc.accent}33`,
                            fontWeight: '800'
                        } : tc ? { borderColor: `${tc.accent}44`, color: 'var(--text-secondary)', background: 'transparent' } : {}}
                    >
                        <span className="category-icon">🍴</span>
                        <span className="category-label">{t('all', 'All')}</span>
                        <span className="category-count">{stats.all}</span>
                    </button>
                    {MENU_CATEGORIES
                        .filter(cat => isOwner || (stats[cat.id] > 0))
                        .map(cat => (
                            <button
                                key={cat.id}
                                className={`category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                                onClick={() => setSelectedCategory(cat.id)}
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
                                <span className="category-icon">{cat.icon}</span>
                                <span className="category-label">{t(cat.id, cat.label)}</span>
                                <span className="category-count">{stats[cat.id] || 0}</span>
                            </button>
                        ))}
                </div>

                {/* ── Items Grid ── */}
                {filteredItems.length === 0 ? (
                    <div className="menu-empty">
                        <div className="empty-icon">🍽️</div>
                        <p>{isOwner
                            ? t('add_first_item', 'Press + above to add your first menu item')
                            : t('no_menu_items', 'No menu items yet')
                        }</p>
                    </div>
                ) : (
                    <div className="menu-grid">
                        {isOwner && selectedCategory === 'all' && filteredItems.length > 1 ? (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={(event) => {
                                    const { active, over } = event;
                                    if (!over || active.id === over.id) return;
                                    const oldIndex = menuItems.findIndex(i => i.id === active.id);
                                    const newIndex = menuItems.findIndex(i => i.id === over.id);
                                    if (oldIndex >= 0 && newIndex >= 0) handleReorder(oldIndex, newIndex);
                                }}
                            >
                                <SortableContext items={menuItems.map(i => i.id)} strategy={rectSortingStrategy}>
                                    {menuItems.map(item => (
                                        <SortableMenuItem
                                            key={item.id}
                                            item={item}
                                            category={MENU_CATEGORIES.find(c => c.id === item.category)}
                                            isOwner={isOwner}
                                            tc={tc}
                                            th={th}
                                            t={t}
                                            editingId={editingId}
                                            editForm={editForm}
                                            setEditForm={setEditForm}
                                            uploadingEdit={uploadingEdit}
                                            openEdit={openEdit}
                                            setEditingId={setEditingId}
                                            handleSaveEdit={handleSaveEdit}
                                            handleDelete={handleDelete}
                                            uploadMenuImage={uploadMenuImage}
                                            setUploadingEdit={setUploadingEdit}
                                        />
                                    ))}
                                </SortableContext>
                            </DndContext>
                        ) : (
                        filteredItems.map(item => {
                            const category = MENU_CATEGORIES.find(c => c.id === item.category);
                            const isEditing = editingId === item.id;

                            return (
                                <div key={item.id} className="menu-item-card" style={tc ? {
                                    background: tc.badgeBg,
                                    border: `1px solid ${tc.border}`,
                                    boxShadow: tc.cardShadow
                                } : {}}>

                                    {/* Image */}
                                    {item.imageUrl && (
                                        <div className="item-image">
                                            <img src={item.imageUrl} alt={item.name} />
                                            <div className="category-badge"
                                                style={{ background: tc ? tc.accent : category?.color }}>
                                                {category?.icon}
                                            </div>
                                        </div>
                                    )}

                                    {/* Content */}
                                    <div className="item-content">
                                        <div className="item-header">
                                            <h4 style={{ color: th(tc?.accent, 'var(--text-main)') }}>{item.name}</h4>
                                            <div className="item-price" style={tc ? {
                                                color: tc.accent,
                                                textShadow: `0 0 8px ${tc.accent}66`,
                                                background: tc.badgeBg,
                                                border: `1px solid ${tc.border}`,
                                                borderRadius: '8px',
                                                padding: '2px 8px'
                                            } : {}}>
                                                {typeof item.price === 'number'
                                                    ? `$${item.price.toFixed(2)}`
                                                    : item.price?.toString().startsWith('$')
                                                        ? item.price
                                                        : `$${item.price}`}
                                            </div>
                                        </div>
                                        {item.description && (
                                            <p className="item-description">{item.description}</p>
                                        )}
                                        {!item.imageUrl && (
                                            <div className="category-tag"
                                                style={{ background: tc ? tc.accent : category?.color, color: tc ? tc.accentText : '#fff' }}>
                                                {category?.icon} {t(category?.id, category?.label)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Owner Action Bar — fixed row at bottom of card */}
                                    {isOwner && (
                                        <div className="item-action-bar">
                                            <button
                                                className="item-action-btn item-edit-action"
                                                onClick={() => isEditing ? setEditingId(null) : openEdit(item)}
                                            >
                                                {isEditing ? <FaTimes size={13} /> : <FaEdit size={13} />}
                                                {isEditing ? t('cancel', 'Cancel') : t('edit', 'Edit')}
                                            </button>
                                            <button
                                                className="item-action-btn item-delete-action"
                                                onClick={() => handleDelete(item.id)}
                                            >
                                                <FaTrash size={13} />
                                                {t('delete', 'Delete')}
                                            </button>
                                        </div>
                                    )}

                                    {/* Inline Edit Form */}
                                    {isEditing && (
                                        <div className="item-edit-form">
                                            <div className="item-edit-grid">
                                                <div className="form-group">
                                                    <label>{t('item_name', 'Item Name')}</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.name}
                                                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>{t('price', 'Price')} (AUD)</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={editForm.price}
                                                        onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                                    <label>{t('description', 'Description')}</label>
                                                    <textarea
                                                        rows={2}
                                                        value={editForm.description}
                                                        onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>{t('category', 'Category')}</label>
                                                    <select
                                                        value={editForm.category}
                                                        onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                                                    >
                                                        {MENU_CATEGORIES.map(cat => (
                                                            <option key={cat.id} value={cat.id}>{cat.icon} {t(cat.id, cat.label)}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="form-group">
                                                    <label>{t('image', 'Image')} ({t('optional', 'Optional')})</label>
                                                    <label className="image-upload-btn">
                                                        <FaFileImage />
                                                        {editForm.image ? editForm.image.name : t('change_image', 'Change Image')}
                                                        <input
                                                            type="file" accept="image/*"
                                                            onChange={e => setEditForm(f => ({ ...f, image: e.target.files[0] }))}
                                                            style={{ display: 'none' }}
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                                <button
                                                    className="add-item-btn"
                                                    style={{ flex: 1, padding: '8px' }}
                                                    disabled={uploadingEdit}
                                                    onClick={() => handleSaveEdit(item.id)}
                                                >
                                                    <FaSave />
                                                    {uploadingEdit ? t('saving', 'Saving...') : t('save', 'Save')}
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    style={{
                                                        padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                                                        background: 'rgba(255,255,255,0.06)',
                                                        border: '1px solid rgba(255,255,255,0.12)',
                                                        color: 'var(--text-secondary)', fontWeight: 600
                                                    }}
                                                >
                                                    {t('cancel', 'Cancel')}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                </div>
                            );
                        })
                        )}
                    </div>
                )}
            </div>

        </>
    );
};

export default MenuShowcase;
