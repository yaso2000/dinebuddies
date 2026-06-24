import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FaUtensils, FaEdit, FaTimes, FaPlus, FaSave, FaTrash, FaFileImage, FaGripVertical, FaBriefcase } from 'react-icons/fa';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { uploadImage } from '../utils/imageUpload';
import { ImageUploadZone } from '../services/imageUploadZones';
import { useToast } from '../context/ToastContext';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors } from
'@dnd-kit/core';
import { arrayMove, SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './MenuShowcase.css';
import { AppText, AppTextInput } from "./base";
import BusinessServiceIconPicker from './BusinessServiceIconPicker';

function normalizeMenuData(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.
  map((item, index) => {
    if (!item || typeof item !== 'object') return null;
    return {
      ...item,
      id: String(item.id ?? `menu-item-${index}`),
      name: typeof item.name === 'string' ? item.name : String(item.name ?? ''),
      description: typeof item.description === 'string' ? item.description : ''
    };
  }).
  filter(Boolean);
}

function getListingFormCopy(t, isServicesMode) {
  if (isServicesMode) {
    return {
      nameLabel: t('service_item_name', 'Service name'),
      namePlaceholder: t('service_item_name_placeholder', 'e.g., Haircut & styling'),
      descriptionPlaceholder: t('service_description_placeholder', 'Describe this service...')
    };
  }
  return {
    nameLabel: t('item_name', 'Item Name'),
    namePlaceholder: t('item_name_placeholder', 'e.g., Margherita Pizza'),
    descriptionPlaceholder: t('description_placeholder', 'Describe this item...')
  };
}

function renderItemMedia({ item, category, tc, isServicesMode }) {
  if (isServicesMode) {
    return (
      <div className="item-service-icon">
        <span className="item-service-icon__emoji" aria-hidden>{item.serviceIcon || '⚙️'}</span>
      </div>);

  }
  if (!item.imageUrl) return null;
  return (
    <div className="item-image">
      <img src={item.imageUrl} alt={item.name} />
      <div className="category-badge" style={{ background: tc ? tc.accent : category?.color }}>{category?.icon}</div>
    </div>);

}

function SortableMenuItem({ item, category, isOwner, t, tc, isServicesMode, editingId, editForm, setEditForm, uploadingEdit, openEdit, setEditingId, handleSaveEdit, handleDelete, uploadMenuImage, setUploadingEdit, serviceIconSearch, setServiceIconSearch, formatItemPrice }) {
  const formCopy = getListingFormCopy(t, isServicesMode);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(item.id) });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const isEditing = editingId === item.id;
  return (
    <div
      ref={setNodeRef}
      className="menu-item-card"
      style={{
        ...(tc ? { background: tc.badgeBg, border: `1px solid ${tc.border}`, boxShadow: tc.cardShadow } : {}),
        ...style,
        opacity: isDragging ? 0.9 : 1
      }}>

            {isOwner &&
      <div {...attributes} {...listeners} className="menu-drag-handle" title={t('drag_to_reorder', 'Drag to reorder')}>
                    <FaGripVertical size={12} />
                </div>
      }
            {renderItemMedia({ item, category, tc, isServicesMode })}
            <div className="item-content">
                <div className="item-header">
                    <AppText as="h4" style={{ color: 'var(--brand-primary)' }}>{item.name}</AppText>
                    {formatItemPrice(item.price) ?
      <div className="item-price" style={tc ? { color: tc.accent, textShadow: `0 0 8px ${tc.accent}66`, background: tc.badgeBg, border: `1px solid ${tc.border}`, borderRadius: '8px', padding: '2px 8px' } : {}}>
                        {formatItemPrice(item.price)}
                    </div> :
      null}
                </div>
                {item.description && <AppText as="p" className="item-description">{item.description}</AppText>}
                {!isServicesMode && !item.imageUrl &&
        <div className="category-tag" style={{ background: tc ? tc.accent : category?.color, color: tc ? tc.accentText : '#fff' }}>
                        {category?.icon} {t(category?.id, category?.label)}
                    </div>
        }
            </div>
            {isOwner &&
      <div className="item-action-bar">
                    <button className="item-action-btn item-edit-action" onClick={() => isEditing ? setEditingId(null) : openEdit(item)}>
                        {isEditing ? <FaTimes size={13} /> : <FaEdit size={13} />}
                        {isEditing ? t('cancel', 'Cancel') : t('edit', 'Edit')}
                    </button>
                    <button className="item-action-btn item-delete-action" onClick={() => handleDelete(item.id)}>
                        <FaTrash size={13} /> {t('delete', 'Delete')}
                    </button>
                </div>
      }
            {isEditing &&
      <div className="item-edit-form">
                    <div className="item-edit-grid">
                        <div className="form-group">
                            <label>{formCopy.nameLabel}</label>
                            <AppTextInput type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder={formCopy.namePlaceholder} />
                        </div>
                        <div className="form-group">
                            <label>{t('price', 'Price')} (AUD){isServicesMode ? ` (${t('optional', 'Optional')})` : ''}</label>
                            <input type="number" step="0.01" value={editForm.price} onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))} />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <label style={{ margin: 0 }}>{t('description', 'Description')}</label>
                                <AppText as="span" style={{ fontSize: '0.7rem', color: (editForm.description?.length || 0) >= 150 ? 'var(--secondary)' : 'var(--text-muted)' }}>{editForm.description?.length || 0}/150</AppText>
                            </div>
                            <AppTextInput as="textarea" rows={2} maxLength={150} value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} placeholder={formCopy.descriptionPlaceholder} />
                        </div>
                        {!isServicesMode ?
            <>
                        <div className="form-group">
                            <label>{t('category', 'Category')}</label>
                            <select value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}>
                                {MENU_CATEGORIES.map((cat) =>
              <option key={cat.id} value={cat.id}>{cat.icon} {t(cat.id, cat.label)}</option>
              )}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>{t('image', 'Image')} ({t('optional', 'Optional')})</label>
                            <label className="image-upload-btn">
                                <FaFileImage />
                                {editForm.image ? editForm.image.name : t('change_image', 'Change Image')}
                                <input type="file" accept="image/*" onChange={(e) => setEditForm((f) => ({ ...f, image: e.target.files[0] }))} style={{ display: 'none' }} />
                            </label>
                        </div>
            </> :
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>{t('choose_service_icon', 'Choose icon')}</label>
                            <BusinessServiceIconPicker
              value={editForm.serviceIcon}
              onChange={(icon) => setEditForm((f) => ({ ...f, serviceIcon: icon }))}
              search={serviceIconSearch}
              onSearchChange={setServiceIconSearch}
              compact />

                        </div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button className="add-item-btn" style={{ flex: 1, padding: '8px' }} disabled={uploadingEdit} onClick={() => handleSaveEdit(item.id)}>
                            <FaSave /> {uploadingEdit ? t('saving', 'Saving...') : t('save', 'Save')}
                        </button>
                        <button onClick={() => setEditingId(null)} style={{ padding: '8px 14px', borderRadius: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('cancel', 'Cancel')}</button>
                    </div>
                </div>
      }
        </div>);

}

const MENU_CATEGORIES = [
{ id: 'starters', label: 'Starters', icon: '🥗', color: '#10b981' },
{ id: 'mains', label: 'Main Courses', icon: '🍽️', color: '#f59e0b' },
{ id: 'desserts', label: 'Desserts', icon: '🍰', color: '#ec4899' },
{ id: 'drinks', label: 'Drinks', icon: '🥤', color: '#3b82f6' }];


const EMPTY_FORM = {
  name: '',
  description: '',
  price: '',
  category: 'mains',
  image: null,
  imageUrl: '',
  serviceIcon: '⚙️'
};

const MenuShowcase = ({ partnerId, profileId, menuData = [], menuListingType = 'menu', isOwner, isPaid = true, theme, onListingTypeChange }) => {
  const businessId = partnerId ?? profileId;
  const { t } = useTranslation();
  const { showToast } = useToast();
  const tc = theme?.colors || null;
  const th = (themed, fallback) => tc ? themed : fallback;

  const [menuItems, setMenuItems] = useState(() => normalizeMenuData(menuData));
  const [listingType, setListingType] = useState(menuListingType === 'services' ? 'services' : 'menu');
  const isServicesMode = listingType === 'services';
  const formCopy = getListingFormCopy(t, isServicesMode);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [serviceIconSearch, setServiceIconSearch] = useState('');

  useEffect(() => {
    setMenuItems(normalizeMenuData(menuData));
  }, [menuData]);

  useEffect(() => {
    setListingType(menuListingType === 'services' ? 'services' : 'menu');
  }, [menuListingType]);

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

  /** Horizontal drag-to-scroll for category tabs (mouse / pen); touch uses native overflow-x pan. */
  const categoryFilterRef = useRef(null);
  const categoryPanRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    scrollLeft0: 0,
    moved: false
  });
  const suppressCategoryTabClick = useRef(false);

  const endCategoryPan = useCallback((e) => {
    const p = categoryPanRef.current;
    if (!p.active || e && e.pointerId !== p.pointerId) return;
    const el = categoryFilterRef.current;
    if (el) {
      el.classList.remove('category-filter--dragging');
      try {
        el.releasePointerCapture(p.pointerId);
      } catch {

        /* ignore */}
    }
    if (p.moved) suppressCategoryTabClick.current = true;
    categoryPanRef.current = {
      active: false,
      pointerId: null,
      startX: 0,
      scrollLeft0: 0,
      moved: false
    };
  }, []);

  const onCategoryFilterPointerDown = useCallback((e) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = categoryFilterRef.current;
    if (!el) return;
    categoryPanRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      scrollLeft0: el.scrollLeft,
      moved: false
    };
    el.classList.add('category-filter--dragging');
    try {
      el.setPointerCapture(e.pointerId);
    } catch {

      /* ignore */}
  }, []);

  const onCategoryFilterPointerMove = useCallback((e) => {
    const p = categoryPanRef.current;
    if (!p.active || e.pointerId !== p.pointerId) return;
    const el = categoryFilterRef.current;
    if (!el) return;
    const dx = e.clientX - p.startX;
    if (Math.abs(dx) > 6) p.moved = true;
    el.scrollLeft = p.scrollLeft0 - dx;
  }, []);

  const onCategoryFilterPointerUp = useCallback((e) => {
    endCategoryPan(e);
  }, [endCategoryPan]);

  const onCategoryFilterPointerCancel = useCallback((e) => {
    endCategoryPan(e);
  }, [endCategoryPan]);

  const onCategoryTabClick = useCallback((select) => (ev) => {
    if (suppressCategoryTabClick.current) {
      ev.preventDefault();
      suppressCategoryTabClick.current = false;
      return;
    }
    select();
  }, []);

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

  /* ---- helpers -------------------------------------------------- */
  const getStats = () => {
    const stats = { all: menuItems.length };
    MENU_CATEGORIES.forEach((cat) => {
      stats[cat.id] = menuItems.filter(
        (item) => (item.category || 'mains').toLowerCase() === cat.id
      ).length;
    });
    return stats;
  };
  const stats = getStats();

  const filteredItems = selectedCategory === 'all' ?
  menuItems :
  menuItems.filter((item) =>
  (item.category || 'mains').toLowerCase() === selectedCategory
  );

  const saveToFirestore = async (updatedMenu) => {
    const ref = doc(db, 'users', businessId);
    await updateDoc(ref, { 'businessInfo.menu': updatedMenu });
  };

  const saveListingType = async (nextType) => {
    if (nextType === listingType) return;
    const prev = listingType;
    setListingType(nextType);
    onListingTypeChange?.(nextType);
    setSelectedCategory('all');
    setShowAddForm(false);
    setEditingId(null);
    setServiceIconSearch('');
    try {
      await updateDoc(doc(db, 'users', businessId), { 'businessInfo.menuListingType': nextType });
    } catch {
      setListingType(prev);
      onListingTypeChange?.(prev);
      showToast(t('update_error', 'Update failed'), 'error');
    }
  };

  const formatItemPrice = (price) => {
    if (price === '' || price == null || Number.isNaN(Number(price))) return null;
    return typeof price === 'number' ?
    `$${price.toFixed(2)}` :
    price?.toString().startsWith('$') ?
    price :
    `$${price}`;
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
      }, {
        moderationZone: ImageUploadZone.MENU,
        userId: businessId
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
    if (!addForm.name.trim()) {
      showToast(t('fill_required_fields', 'Please fill in required fields'), 'error');
      return;
    }
    if (!isServicesMode && !addForm.price) {
      showToast(t('fill_required_fields', 'Please fill in required fields'), 'error');
      return;
    }
    let imageUrl = addForm.imageUrl;
    if (!isServicesMode && addForm.image) {
      imageUrl = await uploadMenuImage(addForm.image, null, setUploadingAdd);
      if (!imageUrl) return;
    }
    const parsedPrice = addForm.price === '' ? null : parseFloat(addForm.price);
    const newItem = {
      id: Date.now().toString(),
      name: addForm.name.trim(),
      description: addForm.description.trim(),
      price: parsedPrice,
      category: isServicesMode ? 'general' : addForm.category,
      imageUrl: isServicesMode ? '' : imageUrl || '',
      serviceIcon: isServicesMode ? addForm.serviceIcon || '⚙️' : '',
      listingKind: isServicesMode ? 'services' : 'menu',
      addedAt: new Date().toISOString()
    };
    // Add to pending list (not saved yet)
    setPendingItems((prev) => [...prev, newItem]);
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
    const updated = menuItems.filter((i) => i.id !== itemId);
    setMenuItems(updated);
    await saveToFirestore(updated);
  };

  /* ---- edit ----------------------------------------------------- */
  const openEdit = (item) => {
    setEditingId(item.id);
    setServiceIconSearch('');
    setEditForm({
      name: item.name,
      description: item.description || '',
      price: item.price ?? '',
      category: item.category || 'mains',
      image: null,
      imageUrl: item.imageUrl || '',
      serviceIcon: item.serviceIcon || '⚙️'
    });
  };

  const handleSaveEdit = async (itemId) => {
    let imageUrl = editForm.imageUrl;
    if (!isServicesMode && editForm.image) {
      imageUrl = await uploadMenuImage(editForm.image, itemId, setUploadingEdit);
      if (!imageUrl) return;
    }
    const parsedPrice = editForm.price === '' ? null : parseFloat(editForm.price);
    const updated = menuItems.map((i) =>
    i.id === itemId ? {
      ...i,
      name: editForm.name.trim(),
      description: editForm.description.trim(),
      price: parsedPrice,
      category: isServicesMode ? 'general' : editForm.category,
      imageUrl: isServicesMode ? '' : imageUrl || i.imageUrl || '',
      serviceIcon: isServicesMode ? editForm.serviceIcon || '⚙️' : i.serviceIcon || '',
      listingKind: isServicesMode ? 'services' : 'menu'
    } : i
    );
    setMenuItems(updated);
    await saveToFirestore(updated);
    setEditingId(null);
  };

  /* ---- render --------------------------------------------------- */
  if (menuItems.length === 0 && !isOwner) return null;

  return (
    <>
            <div className="menu-showcase-section" style={{ background: 'var(--bg-card)' }}>

                {/* ── Free Plan Draft Banner ── */}
                {showDraftBanner &&
        <div style={{
          margin: '0 0 16px',
          padding: '14px 18px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(239,68,68,0.08) 100%)',
          border: '1px solid rgba(245,158,11,0.35)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          animation: 'fadeIn 0.3s ease'
        }}>
                        <AppText as="span" style={{ fontSize: '1.4rem', flexShrink: 0 }}>⚠️</AppText>
                        <div style={{ flex: 1 }}>
                            <AppText as="p" style={{ margin: '0 0 6px', fontWeight: '700', fontSize: '0.95rem', color: '#f59e0b' }}>
                                Saved as Draft
                            </AppText>
                            <AppText as="p" style={{ margin: '0 0 10px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                Your menu items were saved, but they <strong>won't appear on your public profile</strong> until you upgrade your plan.
                            </AppText>
                            <a
              href="/settings/subscription"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', borderRadius: '8px',
                background: 'rgba(245,158,11,0.15)',
                border: '1px solid rgba(245,158,11,0.4)',
                color: '#f59e0b', fontSize: '0.85rem',
                fontWeight: '700', textDecoration: 'none',
                transition: 'all 0.2s'
              }}>

                                🚀 Upgrade Plan
                            </a>
                        </div>
                        <button
            onClick={() => setShowDraftBanner(false)}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: '1.1rem', cursor: 'pointer', padding: '2px', flexShrink: 0
            }}>
            ✕</button>
                    </div>
        }

                {/* ── Header ── */}
                <div className="menu-header">
                    <div className="menu-header__title-row">
                    <AppText as="h3" style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isServicesMode ?
            <FaBriefcase style={{ color: 'var(--brand-primary)' }} /> :
            <FaUtensils style={{ color: 'var(--brand-primary)' }} />}
                        {isServicesMode ?
            t('menu_listing_type_services', t('business_services', 'Services')) :
            t('menu_listing_type_menu', t('menu', 'Menu'))} ({menuItems.length})
                    </AppText>
                    {isOwner &&
          <div className="menu-listing-type-toggle" role="group" aria-label={t('menu_listing_type_label', 'Listing type')}>
                            <button
              type="button"
              className={`menu-listing-type-toggle__btn${listingType === 'menu' ? ' menu-listing-type-toggle__btn--active' : ''}`}
              onClick={() => saveListingType('menu')}>

                                {t('menu_listing_type_menu', t('menu', 'Menu'))}
                            </button>
                            <button
              type="button"
              className={`menu-listing-type-toggle__btn${listingType === 'services' ? ' menu-listing-type-toggle__btn--active' : ''}`}
              onClick={() => saveListingType('services')}>

                                {t('menu_listing_type_services', t('business_services', 'Services'))}
                            </button>
                        </div>
          }
                    </div>
                    {isOwner &&
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {/* Plan badges — توضيح أن هذه الميزة لخطة Pro فصاعداً */}
                            <div style={{ display: 'flex', gap: 4 }}>
                                <AppText as="span" title="Professional Plan" style={{
                fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px',
                borderRadius: 20, border: '1px solid #8b5cf6',
                color: '#a78bfa', background: 'rgba(139,92,246,0.12)',
                display: 'flex', alignItems: 'center', gap: 3
              }}>⚡ Pro</AppText>
                                <AppText as="span" title="Elite Plan" style={{
                fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px',
                borderRadius: 20, border: '1px solid #f59e0b',
                color: '#fbbf24', background: 'rgba(245,158,11,0.12)',
                display: 'flex', alignItems: 'center', gap: 3
              }}>👑 Elite</AppText>
                            </div>

                            {/* Add / Close button */}
                            <button
              onClick={() => {setShowAddForm((v) => !v);setEditingId(null);}}
              title={showAddForm ? t('cancel', 'Cancel') : t('add_item', 'Add Item')}
              style={{
                width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
                border: `1px solid ${showAddForm ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.35)'}`,
                background: showAddForm ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                color: showAddForm ? '#ef4444' : '#10b981',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s'
              }}>

                                {showAddForm ? <FaTimes size={15} /> : <FaPlus size={15} />}
                            </button>
                        </div>
          }
                </div>

                {/* ── Add Form ── */}
                {isOwner && showAddForm &&
        <div className="add-item-form">
                        <AppText as="h4">
                            <FaPlus style={{ color: '#10b981' }} />
                            {isServicesMode ?
              t('add_service_item', 'Add Service') :
              t('add_menu_item', 'Add Menu Item')}
                        </AppText>

                        {/* Pending items preview */}
                        {pendingItems.length > 0 &&
          <div style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: '10px'
          }}>
                                <AppText as="p" style={{ margin: '0 0 6px', fontSize: '0.8rem', fontWeight: '700', color: '#10b981' }}>
                                    ✅ {pendingItems.length} item{pendingItems.length > 1 ? 's' : ''} ready to save:
                                </AppText>
                                {pendingItems.map((item, i) =>
            <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                                        <AppText as="span">• {item.name}</AppText>
                                        <AppText as="span" style={{ opacity: 0.7 }}>
                                            {formatItemPrice(item.price) || t('optional', 'Optional')}
                                        </AppText>
                                    </div>
            )}
                            </div>
          }

                        <div className="form-grid">
                            <div className="form-group">
                                <label>{formCopy.nameLabel} *</label>
                                <AppTextInput
                type="text"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={formCopy.namePlaceholder} />

                            </div>
                            <div className="form-group">
                                <label>{t('price', 'Price')} {isServicesMode ? `(${t('optional', 'Optional')})` : '*'} (AUD)</label>
                                <input
                type="number"
                step="0.01"
                value={addForm.price}
                onChange={(e) => setAddForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="0.00" />

                            </div>
                            <div className="form-group full-width">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <label style={{ margin: 0 }}>{t('description', 'Description')}</label>
                                    <AppText as="span" style={{ fontSize: '0.75rem', color: (addForm.description?.length || 0) >= 150 ? 'var(--secondary)' : 'var(--text-muted)' }}>{addForm.description?.length || 0}/150</AppText>
                                </div>
                                <AppTextInput as="textarea"
              value={addForm.description}
              onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={formCopy.descriptionPlaceholder}
              rows={2}
              maxLength={150} />

                            </div>
                            {!isServicesMode ?
            <>
                            <div className="form-group">
                                <label>{t('category', 'Category')}</label>
                                <select value={addForm.category} onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}>
                                    {MENU_CATEGORIES.map((cat) =>
                <option key={cat.id} value={cat.id}>{cat.icon} {t(cat.id, cat.label)}</option>
                )}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>{t('image', 'Image')} ({t('optional', 'Optional')})</label>
                                <label className="image-upload-btn">
                                    <FaFileImage />
                                    {addForm.image ? addForm.image.name : t('choose_image', 'Choose Image')}
                                    <input
                  type="file" accept="image/*"
                  onChange={(e) => setAddForm((f) => ({ ...f, image: e.target.files[0] }))}
                  style={{ display: 'none' }} />

                                </label>
                            </div>
            </> :
            <div className="form-group full-width">
                                <label>{t('choose_service_icon', 'Choose icon')}</label>
                                <BusinessServiceIconPicker
                value={addForm.serviceIcon}
                onChange={(icon) => setAddForm((f) => ({ ...f, serviceIcon: icon }))}
                search={serviceIconSearch}
                onSearchChange={setServiceIconSearch} />

                            </div>}
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {/* + Add another item */}
                            <button
              className="add-item-btn"
              onClick={handleAdd}
              disabled={uploadingAdd || !addForm.name.trim() || (!isServicesMode && !addForm.price)}
              style={tc ? {
                background: tc.footerBg, border: `1px solid ${tc.border}`,
                color: tc.accentText || '#fff', boxShadow: tc.btnShadow,
                borderRadius: tc.btnBorderRadius, flex: 1
              } : { flex: 1 }}>

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
                transition: 'all 0.2s'
              }}>

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
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
              title="Discard all pending">

                                <FaTimes />
                            </button>
                        </div>
                    </div>
        }

                {/* ── Category Filter ── */}
                {!isServicesMode &&
        <div
          ref={categoryFilterRef}
          className="category-filter"
          onPointerDown={onCategoryFilterPointerDown}
          onPointerMove={onCategoryFilterPointerMove}
          onPointerUp={onCategoryFilterPointerUp}
          onPointerCancel={onCategoryFilterPointerCancel}
          style={{
            display: 'flex',
            flexWrap: 'nowrap',
            overflowX: 'auto',
            gap: '6px',
            paddingBottom: '4px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x',
            width: '100%',
            maxWidth: '100vw'
          }}>

                    <button
            type="button"
            className={`category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={onCategoryTabClick(() => setSelectedCategory('all'))}
            style={tc && selectedCategory === 'all' ? {
              background: tc.tabBgColor || 'rgba(255,255,255,0.95)',
              borderColor: tc.tabBorderColor || tc.accent,
              borderWidth: '2px',
              color: tc.tabTextColor || tc.tabBorderColor || tc.accent,
              boxShadow: `0 2px 12px ${tc.tabBorderColor || tc.accent}33`,
              fontWeight: '800',
              flexShrink: 0,
              whiteSpace: 'nowrap'
            } : tc ? { borderColor: `${tc.accent}44`, color: 'var(--text-secondary)', background: 'transparent', flexShrink: 0, whiteSpace: 'nowrap' } : { flexShrink: 0, whiteSpace: 'nowrap' }}>

                        <AppText as="span" className="category-icon">🍴</AppText>
                        <AppText as="span" className="category-label">{t('all', 'All')}</AppText>
                        <AppText as="span" className="category-count">{stats.all}</AppText>
                    </button>
                    {MENU_CATEGORIES.
          filter((cat) => isOwner || stats[cat.id] > 0).
          map((cat) =>
          <button
            type="button"
            key={cat.id}
            className={`category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
            onClick={onCategoryTabClick(() => setSelectedCategory(cat.id))}
            style={tc ? selectedCategory === cat.id ? {
              background: tc.tabBgColor || 'rgba(255,255,255,0.95)',
              borderColor: tc.tabBorderColor || tc.accent,
              borderWidth: '2px',
              color: tc.tabTextColor || tc.tabBorderColor || tc.accent,
              boxShadow: `0 2px 12px ${tc.tabBorderColor || tc.accent}33`,
              fontWeight: '800',
              flexShrink: 0,
              whiteSpace: 'nowrap'
            } : {
              borderColor: `${tc.accent}44`,
              color: 'var(--text-secondary)',
              background: 'transparent',
              flexShrink: 0,
              whiteSpace: 'nowrap'
            } : {
              borderColor: selectedCategory === cat.id ? cat.color : 'var(--border-color)',
              color: selectedCategory === cat.id ? cat.color : 'var(--text-main)',
              fontWeight: selectedCategory === cat.id ? '800' : '600',
              flexShrink: 0,
              whiteSpace: 'nowrap'
            }}>

                                <AppText as="span" className="category-icon">{cat.icon}</AppText>
                                <AppText as="span" className="category-label">{t(cat.id, cat.label)}</AppText>
                                <AppText as="span" className="category-count">{stats[cat.id] || 0}</AppText>
                            </button>
          )}
                </div>}

                {/* ── Items Grid ── */}
                {filteredItems.length === 0 ?
        <div className="menu-empty">
                        <div className="empty-icon">{isServicesMode ? '✨' : '🍽️'}</div>
                        <AppText as="p">{isOwner ?
            isServicesMode ?
            t('add_first_service_item', 'Press + above to add your first service') :
            t('add_first_item', 'Press + above to add your first menu item') :
            isServicesMode ?
            t('no_service_items', 'No services yet') :
            t('no_menu_items', 'No menu items yet')
            }</AppText>
                    </div> :

        <div className="menu-grid">
                        {isOwner && selectedCategory === 'all' && filteredItems.length > 1 ?
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => {
              const { active, over } = event;
              if (!over || active.id === over.id) return;
              const oldIndex = menuItems.findIndex((i) => i.id === active.id);
              const newIndex = menuItems.findIndex((i) => i.id === over.id);
              if (oldIndex >= 0 && newIndex >= 0) handleReorder(oldIndex, newIndex);
            }}>

                                <SortableContext items={menuItems.map((i) => String(i.id))} strategy={rectSortingStrategy}>
                                    {menuItems.map((item) =>
              <SortableMenuItem
                key={item.id}
                item={item}
                category={MENU_CATEGORIES.find((c) => c.id === item.category)}
                isOwner={isOwner}
                isServicesMode={isServicesMode}
                tc={tc}
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
                serviceIconSearch={serviceIconSearch}
                setServiceIconSearch={setServiceIconSearch}
                formatItemPrice={formatItemPrice} />

              )}
                                </SortableContext>
                            </DndContext> :

          filteredItems.map((item) => {
            const category = MENU_CATEGORIES.find((c) => c.id === item.category);
            const isEditing = editingId === item.id;

            return (
              <div key={item.id} className="menu-item-card" style={tc ? {
                background: tc.badgeBg,
                border: `1px solid ${tc.border}`,
                boxShadow: tc.cardShadow
              } : {}}>

                                    {renderItemMedia({ item, category, tc, isServicesMode })}

                                    {/* Content */}
                                    <div className="item-content">
                                        <div className="item-header">
                                            <AppText as="h4" style={{ color: 'var(--brand-primary)' }}>{item.name}</AppText>
                                            {formatItemPrice(item.price) ?
                    <div className="item-price" style={tc ? {
                      color: tc.accent,
                      textShadow: `0 0 8px ${tc.accent}66`,
                      background: tc.badgeBg,
                      border: `1px solid ${tc.border}`,
                      borderRadius: '8px',
                      padding: '2px 8px'
                    } : {}}>
                                                {formatItemPrice(item.price)}
                                            </div> :
                    null}
                                        </div>
                                        {item.description &&
                  <AppText as="p" className="item-description">{item.description}</AppText>
                  }
                                        {!isServicesMode && !item.imageUrl &&
                  <div className="category-tag"
                  style={{ background: tc ? tc.accent : category?.color, color: tc ? tc.accentText : '#fff' }}>
                                                {category?.icon} {t(category?.id, category?.label)}
                                            </div>
                  }
                                    </div>

                                    {/* Owner Action Bar — fixed row at bottom of card */}
                                    {isOwner &&
                <div className="item-action-bar">
                                            <button
                    className="item-action-btn item-edit-action"
                    onClick={() => isEditing ? setEditingId(null) : openEdit(item)}>

                                                {isEditing ? <FaTimes size={13} /> : <FaEdit size={13} />}
                                                {isEditing ? t('cancel', 'Cancel') : t('edit', 'Edit')}
                                            </button>
                                            <button
                    className="item-action-btn item-delete-action"
                    onClick={() => handleDelete(item.id)}>

                                                <FaTrash size={13} />
                                                {t('delete', 'Delete')}
                                            </button>
                                        </div>
                }

                                    {/* Inline Edit Form */}
                                    {isEditing &&
                <div className="item-edit-form">
                                            <div className="item-edit-grid">
                                                <div className="form-group">
                                                    <label>{formCopy.nameLabel}</label>
                                                    <AppTextInput
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder={formCopy.namePlaceholder} />

                                                </div>
                                                <div className="form-group">
                                                    <label>{t('price', 'Price')} (AUD){isServicesMode ? ` (${t('optional', 'Optional')})` : ''}</label>
                                                    <input
                        type="number"
                        step="0.01"
                        value={editForm.price}
                        onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))} />

                                                </div>
                                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                                    <label>{t('description', 'Description')}</label>
                                                    <AppTextInput as="textarea"
                      rows={2}
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder={formCopy.descriptionPlaceholder} />

                                                </div>
                                                {!isServicesMode ?
                        <>
                                                <div className="form-group">
                                                    <label>{t('category', 'Category')}</label>
                                                    <select
                        value={editForm.category}
                        onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}>

                                                        {MENU_CATEGORIES.map((cat) =>
                        <option key={cat.id} value={cat.id}>{cat.icon} {t(cat.id, cat.label)}</option>
                        )}
                                                    </select>
                                                </div>
                                                <div className="form-group">
                                                    <label>{t('image', 'Image')} ({t('optional', 'Optional')})</label>
                                                    <label className="image-upload-btn">
                                                        <FaFileImage />
                                                        {editForm.image ? editForm.image.name : t('change_image', 'Change Image')}
                                                        <input
                          type="file" accept="image/*"
                          onChange={(e) => setEditForm((f) => ({ ...f, image: e.target.files[0] }))}
                          style={{ display: 'none' }} />

                                                    </label>
                                                </div>
                        </> :
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                                    <label>{t('choose_service_icon', 'Choose icon')}</label>
                                                    <BusinessServiceIconPicker
                        value={editForm.serviceIcon}
                        onChange={(icon) => setEditForm((f) => ({ ...f, serviceIcon: icon }))}
                        search={serviceIconSearch}
                        onSearchChange={setServiceIconSearch}
                        compact />

                                                </div>}
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                                <button
                      className="add-item-btn"
                      style={{ flex: 1, padding: '8px' }}
                      disabled={uploadingEdit}
                      onClick={() => handleSaveEdit(item.id)}>

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
                      }}>

                                                    {t('cancel', 'Cancel')}
                                                </button>
                                            </div>
                                        </div>
                }

                                </div>);

          })
          }
                    </div>
        }
            </div>

        </>);

};

export default MenuShowcase;