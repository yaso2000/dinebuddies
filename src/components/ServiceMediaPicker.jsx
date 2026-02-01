import React, { useState } from 'react';
import { FaImage, FaIcons, FaTimes, FaCheck } from 'react-icons/fa';
import { serviceIcons, iconCategories, ServiceIcon } from '../utils/serviceIcons.jsx';
import ImageUpload from './ImageUpload';

/**
 * Service Icon/Image Picker Component
 * Allows users to either select an icon or upload an image for a service
 */
const ServiceMediaPicker = ({ value, onChange, onClose }) => {
    const [mode, setMode] = useState(value?.type || 'icon'); // 'icon' or 'image'
    const [selectedIcon, setSelectedIcon] = useState(value?.type === 'icon' ? value?.iconId : null);
    const [selectedImage, setSelectedImage] = useState(value?.type === 'image' ? value?.imageUrl : null);
    const [activeCategory, setActiveCategory] = useState('mainDishes');

    // When switching modes, clear the other selection
    const handleModeChange = (newMode) => {
        setMode(newMode);
        if (newMode === 'icon') {
            setSelectedImage(null);
        } else {
            setSelectedIcon(null);
        }
    };

    const handleSave = () => {
        if (mode === 'icon' && selectedIcon) {
            onChange({ type: 'icon', iconId: selectedIcon });
            onClose();
        } else if (mode === 'image' && selectedImage) {
            onChange({ type: 'image', imageUrl: selectedImage });
            onClose();
        } else {
            // Allow saving without media (optional)
            onChange(null);
            onClose();
        }
    };

    const handleClearSelection = () => {
        onChange(null);
        onClose();
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
        }}>
            <div style={{
                background: 'var(--bg-card)',
                borderRadius: '20px',
                maxWidth: '600px',
                width: '100%',
                maxHeight: '90vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0 }}>
                        Choose Icon or Image
                    </h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '1.5rem',
                            padding: '0.5rem'
                        }}
                    >
                        <FaTimes />
                    </button>
                </div>

                {/* Mode Selector */}
                <div style={{
                    padding: '1rem 1.5rem',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    gap: '1rem'
                }}>
                    <button
                        onClick={() => handleModeChange('icon')}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            background: mode === 'icon' ? 'var(--primary)' : 'var(--bg-body)',
                            border: mode === 'icon' ? 'none' : '1px solid var(--border-color)',
                            borderRadius: '12px',
                            color: 'white',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <FaIcons /> Choose Icon
                    </button>
                    <button
                        onClick={() => handleModeChange('image')}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            background: mode === 'image' ? 'var(--primary)' : 'var(--bg-body)',
                            border: mode === 'image' ? 'none' : '1px solid var(--border-color)',
                            borderRadius: '12px',
                            color: 'white',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <FaImage /> Upload Image
                    </button>
                </div>

                {/* Content */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '1.5rem'
                }}>
                    {mode === 'icon' ? (
                        <div>
                            {/* Category Tabs */}
                            <div style={{
                                display: 'flex',
                                gap: '0.5rem',
                                marginBottom: '1.5rem',
                                overflowX: 'auto',
                                paddingBottom: '0.5rem'
                            }}>
                                {iconCategories.map(category => (
                                    <button
                                        key={category.key}
                                        onClick={() => setActiveCategory(category.key)}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            background: activeCategory === category.key
                                                ? 'rgba(139, 92, 246, 0.2)'
                                                : 'var(--bg-body)',
                                            border: `1px solid ${activeCategory === category.key
                                                ? 'var(--primary)'
                                                : 'var(--border-color)'}`,
                                            borderRadius: '10px',
                                            color: activeCategory === category.key
                                                ? 'var(--primary)'
                                                : 'var(--text-muted)',
                                            fontWeight: '600',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {category.emoji} {category.label}
                                    </button>
                                ))}
                            </div>

                            {/* Icons Grid */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                                gap: '0.75rem'
                            }}>
                                {serviceIcons[activeCategory]?.map(icon => (
                                    <button
                                        key={icon.id}
                                        onClick={() => setSelectedIcon(icon.id)}
                                        style={{
                                            padding: '1rem',
                                            background: selectedIcon === icon.id
                                                ? 'rgba(139, 92, 246, 0.2)'
                                                : 'var(--bg-body)',
                                            border: `2px solid ${selectedIcon === icon.id
                                                ? 'var(--primary)'
                                                : 'var(--border-color)'}`,
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            transition: 'all 0.2s',
                                            position: 'relative'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (selectedIcon !== icon.id) {
                                                e.currentTarget.style.borderColor = 'var(--primary)';
                                                e.currentTarget.style.transform = 'scale(1.05)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (selectedIcon !== icon.id) {
                                                e.currentTarget.style.borderColor = 'var(--border-color)';
                                                e.currentTarget.style.transform = 'scale(1)';
                                            }
                                        }}
                                    >
                                        <ServiceIcon iconId={icon.id} size={32} />
                                        <span style={{
                                            fontSize: '0.7rem',
                                            color: 'var(--text-muted)',
                                            textAlign: 'center',
                                            lineHeight: '1.2'
                                        }}>
                                            {icon.name}
                                        </span>
                                        {selectedIcon === icon.id && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '4px',
                                                right: '4px',
                                                background: 'var(--primary)',
                                                borderRadius: '50%',
                                                width: '20px',
                                                height: '20px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                fontSize: '0.7rem'
                                            }}>
                                                <FaCheck />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <p style={{
                                color: 'var(--text-muted)',
                                marginBottom: '1rem',
                                fontSize: '0.9rem'
                            }}>
                                Upload an image for this service (recommended: 400x400px)
                            </p>
                            <ImageUpload
                                onImageSelect={(file) => {
                                    // Create preview URL
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                        setSelectedImage(reader.result);
                                    };
                                    reader.readAsDataURL(file);
                                }}
                                currentImage={selectedImage}
                            />
                            {selectedImage && (
                                <div style={{
                                    marginTop: '1rem',
                                    textAlign: 'center'
                                }}>
                                    <img
                                        src={selectedImage}
                                        alt="Preview"
                                        style={{
                                            maxWidth: '200px',
                                            maxHeight: '200px',
                                            borderRadius: '12px',
                                            border: '2px solid var(--primary)'
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '1.5rem',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    gap: '0.75rem'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            background: 'var(--bg-body)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            color: 'white',
                            fontWeight: '700',
                            cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>

                    {/* Clear button - only show if there's a selection */}
                    {(selectedIcon || selectedImage) && (
                        <button
                            onClick={handleClearSelection}
                            style={{
                                flex: 1,
                                padding: '0.75rem',
                                background: 'transparent',
                                border: '1px solid #ef4444',
                                borderRadius: '12px',
                                color: '#ef4444',
                                fontWeight: '700',
                                cursor: 'pointer'
                            }}
                        >
                            No Media
                        </button>
                    )}

                    <button
                        onClick={handleSave}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            background: 'var(--primary)',
                            border: 'none',
                            borderRadius: '12px',
                            color: 'white',
                            fontWeight: '700',
                            cursor: 'pointer'
                        }}
                    >
                        {selectedIcon || selectedImage ? 'Save' : 'Save (No Media)'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ServiceMediaPicker;
