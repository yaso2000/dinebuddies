import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaUtensils, FaEdit, FaTimes, FaPlus, FaSave, FaTrash, FaFileImage } from 'react-icons/fa';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { uploadImage, deleteImage } from '../utils/imageUpload';
import './MenuShowcase.css';

const MENU_CATEGORIES = [
    { id: 'starters', label: 'Starters', icon: '🥗', color: '#10b981' },
    { id: 'mains', label: 'Main Courses', icon: '🍽️', color: '#f59e0b' },
    { id: 'desserts', label: 'Desserts', icon: '🍰', color: '#ec4899' },
    { id: 'drinks', label: 'Drinks', icon: '🥤', color: '#3b82f6' }
];

const MenuShowcase = ({ partnerId, menuData = [], isOwner }) => {
    const { t } = useTranslation();
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [editingItem, setEditingItem] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [menuItems, setMenuItems] = useState(menuData);

    // New item form state
    const [newItem, setNewItem] = useState({
        name: '',
        description: '',
        price: '',
        category: 'mains',
        image: null,
        imageUrl: ''
    });

    // Filter menu items by category
    const filteredItems = selectedCategory === 'all'
        ? menuItems
        : menuItems.filter(item => item.category === selectedCategory);

    // Get category stats
    const getCategoryStats = () => {
        const stats = { all: menuItems.length };
        MENU_CATEGORIES.forEach(cat => {
            stats[cat.id] = menuItems.filter(item => item.category === cat.id).length;
        });
        return stats;
    };

    const stats = getCategoryStats();

    // Handle image upload
    const handleImageUpload = async (file, itemId = null) => {
        if (!file) return null;

        try {
            setUploadingImage(true);
            const timestamp = Date.now();
            const path = `menus/${partnerId}/${itemId || 'new'}_${timestamp}.jpg`;

            const options = {
                maxSizeMB: 0.5,
                maxWidthOrHeight: 800,
                useWebWorker: true,
                fileType: 'image/jpeg',
                initialQuality: 0.85
            };

            const downloadURL = await uploadImage(file, path, null, options);
            return downloadURL;
        } catch (error) {
            console.error('Error uploading image:', error);
            alert(t('upload_error', 'Failed to upload image'));
            return null;
        } finally {
            setUploadingImage(false);
        }
    };

    // Add new menu item
    const handleAddItem = async () => {
        if (!newItem.name.trim() || !newItem.price) {
            alert(t('fill_required_fields', 'Please fill in required fields'));
            return;
        }

        try {
            let imageUrl = newItem.imageUrl;

            // Upload image if selected
            if (newItem.image) {
                imageUrl = await handleImageUpload(newItem.image);
                if (!imageUrl) return;
            }

            const item = {
                id: Date.now().toString(),
                name: newItem.name.trim(),
                description: newItem.description.trim(),
                price: parseFloat(newItem.price),
                category: newItem.category,
                imageUrl: imageUrl || '',
                addedAt: new Date().toISOString()
            };

            const updatedMenu = [...menuItems, item];
            setMenuItems(updatedMenu);

            // Update Firestore
            const partnerRef = doc(db, 'users', partnerId);
            await updateDoc(partnerRef, {
                'businessInfo.menu': updatedMenu
            });

            // Reset form
            setNewItem({
                name: '',
                description: '',
                price: '',
                category: 'mains',
                image: null,
                imageUrl: ''
            });

            alert(t('item_added', 'Menu item added!'));
        } catch (error) {
            console.error('Error adding menu item:', error);
            alert(t('add_error', 'Failed to add item'));
        }
    };

    // Delete menu item
    const handleDeleteItem = async (itemId) => {
        if (!window.confirm(t('confirm_delete_item', 'Delete this menu item?'))) return;

        try {
            const updatedMenu = menuItems.filter(item => item.id !== itemId);
            setMenuItems(updatedMenu);

            const partnerRef = doc(db, 'users', partnerId);
            await updateDoc(partnerRef, {
                'businessInfo.menu': updatedMenu
            });
        } catch (error) {
            console.error('Error deleting item:', error);
            alert(t('delete_error', 'Failed to delete item'));
        }
    };

    // Update menu item
    const handleUpdateItem = async (itemId, updates) => {
        try {
            const updatedMenu = menuItems.map(item =>
                item.id === itemId ? { ...item, ...updates } : item
            );
            setMenuItems(updatedMenu);

            const partnerRef = doc(db, 'users', partnerId);
            await updateDoc(partnerRef, {
                'businessInfo.menu': updatedMenu
            });

            setEditingItem(null);
        } catch (error) {
            console.error('Error updating item:', error);
            alert(t('update_error', 'Failed to update item'));
        }
    };

    return (
        <div className="menu-showcase-section">
            {/* Header */}
            <div className="menu-header">
                <h3>
                    <FaUtensils style={{ color: '#f59e0b' }} />
                    {t('menu', 'Menu')} ({menuItems.length})
                </h3>
                {isOwner && (
                    <button
                        className={`edit-menu-btn ${isEditMode ? 'active' : ''}`}
                        onClick={() => setIsEditMode(!isEditMode)}
                    >
                        {isEditMode ? <><FaTimes /> {t('done', 'Done')}</> : <><FaEdit /> {t('edit', 'Edit')}</>}
                    </button>
                )}
            </div>

            {/* Category Filter */}
            <div className="category-filter">
                <button
                    className={`category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedCategory('all')}
                >
                    <span className="category-icon">🍴</span>
                    <span className="category-label">{t('all', 'All')}</span>
                    <span className="category-count">{stats.all}</span>
                </button>
                {MENU_CATEGORIES.map(cat => (
                    <button
                        key={cat.id}
                        className={`category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(cat.id)}
                        style={{
                            borderColor: selectedCategory === cat.id ? cat.color : 'var(--border-color)',
                            color: selectedCategory === cat.id ? cat.color : 'var(--text-main)'
                        }}
                    >
                        <span className="category-icon">{cat.icon}</span>
                        <span className="category-label">{t(cat.id, cat.label)}</span>
                        <span className="category-count">{stats[cat.id] || 0}</span>
                    </button>
                ))}
            </div>

            {/* Add New Item Form (Edit Mode) */}
            {isEditMode && (
                <div className="add-item-form">
                    <h4>{t('add_menu_item', 'Add Menu Item')}</h4>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>{t('item_name', 'Item Name')} *</label>
                            <input
                                type="text"
                                value={newItem.name}
                                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                                placeholder={t('item_name_placeholder', 'e.g., Margherita Pizza')}
                            />
                        </div>
                        <div className="form-group">
                            <label>{t('price', 'Price')} * (AUD)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={newItem.price}
                                onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="form-group full-width">
                            <label>{t('description', 'Description')}</label>
                            <textarea
                                value={newItem.description}
                                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                                placeholder={t('description_placeholder', 'Describe this item...')}
                                rows={2}
                            />
                        </div>
                        <div className="form-group">
                            <label>{t('category', 'Category')}</label>
                            <select
                                value={newItem.category}
                                onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                            >
                                {MENU_CATEGORIES.map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.icon} {t(cat.id, cat.label)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>{t('image', 'Image')} ({t('optional', 'Optional')})</label>
                            <label className="image-upload-btn">
                                <FaFileImage />
                                {newItem.image ? newItem.image.name : t('choose_image', 'Choose Image')}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setNewItem({ ...newItem, image: e.target.files[0] })}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>
                    </div>
                    <button
                        className="add-item-btn"
                        onClick={handleAddItem}
                        disabled={uploadingImage || !newItem.name.trim() || !newItem.price}
                    >
                        <FaPlus />
                        {uploadingImage ? t('uploading', 'Uploading...') : t('add_item', 'Add Item')}
                    </button>
                </div>
            )}

            {/* Menu Items Grid */}
            {filteredItems.length === 0 ? (
                <div className="menu-empty">
                    <div className="empty-icon">🍽️</div>
                    <p>{isEditMode
                        ? t('add_first_item', 'Add your first menu item above')
                        : t('no_menu_items', 'No menu items yet')
                    }</p>
                </div>
            ) : (
                <div className="menu-grid">
                    {filteredItems.map(item => {
                        const category = MENU_CATEGORIES.find(c => c.id === item.category);
                        const isEditing = editingItem === item.id;

                        return (
                            <div key={item.id} className="menu-item-card">
                                {/* Image */}
                                {item.imageUrl && (
                                    <div className="item-image">
                                        <img src={item.imageUrl} alt={item.name} />
                                        <div
                                            className="category-badge"
                                            style={{ background: category?.color }}
                                        >
                                            {category?.icon}
                                        </div>
                                    </div>
                                )}

                                {/* Content */}
                                <div className="item-content">
                                    <div className="item-header">
                                        <h4>{item.name}</h4>
                                        <div className="item-price">${item.price.toFixed(2)}</div>
                                    </div>
                                    {item.description && (
                                        <p className="item-description">{item.description}</p>
                                    )}
                                    {!item.imageUrl && (
                                        <div className="category-tag" style={{ background: category?.color }}>
                                            {category?.icon} {t(category?.id, category?.label)}
                                        </div>
                                    )}
                                </div>

                                {/* Edit Controls */}
                                {isEditMode && (
                                    <div className="item-controls">
                                        <button
                                            className="control-btn delete-btn"
                                            onClick={() => handleDeleteItem(item.id)}
                                            title={t('delete', 'Delete')}
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MenuShowcase;
