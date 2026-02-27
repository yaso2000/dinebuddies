import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PremiumOfferCard from './PremiumOfferCard';
import { getSafeAvatar } from '../utils/avatarUtils';
import { FaImage, FaTimes } from 'react-icons/fa';
import AnimatedOfferIcon from './AnimatedOfferIcons';

const PremiumOfferEditor = ({ onPublish, businessProfile, initialData = null, onClose, isFullPage = false }) => {
    const { t } = useTranslation();
    const [offerData, setOfferData] = useState({
        title: initialData?.title || '',
        description: initialData?.description || '',
        theme: initialData?.theme || 'Luxurious Gold',
        shine: initialData?.shine || 'None',
        identityMode: initialData?.identityMode || 'logo',
        selectedIcon: initialData?.selectedIcon || 'Sparkles',
        imageUrl: initialData?.imageUrl || null,
        logoUrl: initialData?.logoUrl || getSafeAvatar(businessProfile),
        fontFamily: initialData?.fontFamily || 'Default', // Legacy support
        headerFontFamily: initialData?.headerFontFamily || "'Montserrat', sans-serif",
        headerFontWeight: initialData?.headerFontWeight || '700',
        bodyFontFamily: initialData?.bodyFontFamily || "'Inter', sans-serif",
        bodyFontWeight: initialData?.bodyFontWeight || '400',
        isBold: initialData?.isBold || false,
        isItalic: initialData?.isItalic || false,
        titleFontSize: initialData?.titleFontSize || 1.0,
        descriptionFontSize: initialData?.descriptionFontSize || 1.0,
        file: null
    });

    const fontPairs = [
        { name: 'Tech / Business', h: "'Montserrat', sans-serif", b: "'Inter', sans-serif", hw: '700', bw: '400' },
        { name: 'Sports / Exciting', h: "'Bebas Neue', cursive", b: "'Montserrat', sans-serif", hw: '400', bw: '500' },
        { name: 'Fashion / Lifestyle', h: "'Inter', sans-serif", b: "'Lato', sans-serif", hw: '700', bw: '300' },
        { name: 'Edu / Explanatory', h: "'Poppins', sans-serif", b: "'Roboto', sans-serif", hw: '600', bw: '400' },
    ];

    const handlePairChange = (pair) => {
        setOfferData({
            ...offerData,
            headerFontFamily: pair.h,
            bodyFontFamily: pair.b,
            headerFontWeight: pair.hw,
            bodyFontWeight: pair.bw
        });
    };

    const getDynamicLimit = (baseLimit, scale) => {
        // Smart Formula: base limit decreases as font size increases
        // scale ranges from 0.8 to 2.5
        // At 1.0 (default), limit is baseLimit
        // At 2.5 (max), limit is roughly 40% of base
        return Math.floor(baseLimit / scale);
    };

    const themes = [
        { name: 'Midnight Lux', color: '#0f0f0f', border: '#D4AF37' },
        { name: 'Luxurious Gold', color: '#302404', border: '#ffd700' },
        { name: 'Pristine Silver', color: '#20242b', border: '#e5e7eb' },
        { name: 'Rich Bronze', color: '#2b1705', border: '#cd7f32' },
        { name: 'Sapphire Blue', color: '#003366', border: '#E0E0E0' },
        { name: 'Amethyst Purple', color: '#4a0066', border: '#D4AF37' },
        { name: 'Neon Spring', color: '#32CD32', border: '#00FA9A' },
        { name: 'Crimson Blaze', color: '#FF0000', border: '#FF4500' },
        { name: 'Sunset Orange', color: '#FF8C00', border: '#FFA500' },
        { name: 'Solar Yellow', color: '#FFD700', border: '#FFFF00' },
        { name: 'Sky Blue', color: '#00BFFF', border: '#87CEEB' }
    ];

    const handlePublish = () => {
        onPublish(offerData, offerData.file, initialData?.id);
    };

    return (
        <div style={{
            background: isFullPage ? 'transparent' : 'var(--bg-card)',
            borderRadius: isFullPage ? '0' : '16px',
            width: '100%',
            maxWidth: isFullPage ? 'none' : '650px',
            maxHeight: isFullPage ? 'none' : '90vh',
            display: 'flex',
            flexDirection: 'column',
            border: isFullPage ? 'none' : '1px solid var(--border-color)',
            boxShadow: isFullPage ? 'none' : '0 25px 50px -12px rgba(0,0,0,0.8)',
            overflow: isFullPage ? 'visible' : 'hidden'
        }}>
            {/* Header */}
            {!isFullPage && (
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--bg-body)'
                }}>
                    <h2 style={{
                        fontSize: '1.2rem',
                        fontWeight: '800',
                        margin: 0,
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        ✨ {initialData ? 'Edit Premium Offer' : 'Create Premium Offer'}
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: 'none',
                            color: 'var(--text-muted)',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    >
                        <FaTimes />
                    </button>
                </div>
            )}

            {/* Fixed/Sticky Preview Area at the Top (Floating Tape) */}
            <div style={{
                position: isFullPage ? 'fixed' : 'sticky',
                top: isFullPage ? '60px' : '0',
                left: isFullPage ? '50%' : 'auto',
                transform: isFullPage ? 'translateX(-50%)' : 'none',
                width: isFullPage ? '100%' : '100%',
                maxWidth: isFullPage ? 'var(--max-width)' : 'none',
                zIndex: 110,
                padding: '20px 0',
                background: 'rgba(20, 20, 20, 0.9)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 15px 30px rgba(0,0,0,0.5)'
            }}>
                <div style={{ maxWidth: '650px', margin: '0 auto', padding: '0 20px' }}>
                    <label style={{ ...labelStyle, color: '#D4AF37', marginBottom: '12px', fontSize: '0.75rem' }}>
                        Live Premium Preview
                    </label>
                </div>
                {/* 100% width card rendering for the tape effect */}
                <div style={{ width: '100%', minHeight: '90px' }}>
                    <PremiumOfferCard offer={{ ...offerData, status: 'active' }} compactHeight={true} />
                </div>
            </div>

            {/* Scrollable Form Body */}
            <div style={{
                flex: 1,
                overflowY: isFullPage ? 'visible' : 'auto',
                display: 'flex',
                flexDirection: 'column',
            }}>
                {/* Spacer for Fixed Header in Full Page mode */}
                {isFullPage && <div style={{ height: '170px' }} />}

                <div style={{
                    padding: isFullPage ? '24px 20px' : '24px 20px',
                    maxWidth: '650px',
                    width: '100%',
                    margin: '0 auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px'
                }}>
                    {/* Font Pairings Preset */}
                    <div>
                        <label style={labelStyle}>Font Style (Pairs)</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                            {fontPairs.map(pair => (
                                <button
                                    key={pair.name}
                                    onClick={() => handlePairChange(pair)}
                                    style={{
                                        ...btnStyle,
                                        height: 'auto',
                                        padding: '10px 6px',
                                        fontSize: '0.75rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '4px',
                                        background: pair.h === offerData.headerFontFamily && pair.b === offerData.bodyFontFamily ? 'rgba(212, 175, 55, 0.2)' : 'var(--bg-body)',
                                        border: `1px solid ${pair.h === offerData.headerFontFamily && pair.b === offerData.bodyFontFamily ? '#D4AF37' : 'var(--border-color)'}`,
                                        color: pair.h === offerData.headerFontFamily && pair.b === offerData.bodyFontFamily ? '#D4AF37' : 'var(--text-muted)'
                                    }}
                                >
                                    <span style={{ fontWeight: 'bold' }}>{pair.name}</span>
                                    <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>Heading + Body</span>
                                </button>
                            ))}
                        </div>

                        <label style={labelStyle}>Typography & Title</label>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <select
                                value={offerData.headerFontFamily}
                                onChange={(e) => setOfferData({ ...offerData, headerFontFamily: e.target.value })}
                                style={{ ...inputStyle, flex: 1, padding: '0 8px', height: '36px', fontSize: '0.85rem' }}
                            >
                                <option value="'Montserrat', sans-serif">Montserrat</option>
                                <option value="'Bebas Neue', cursive">Bebas Neue</option>
                                <option value="'Inter', sans-serif">Inter</option>
                                <option value="'Poppins', sans-serif">Poppins</option>
                                <option value="'Cairo', sans-serif">Cairo</option>
                                <option value="'Tajawal', sans-serif">Tajawal</option>
                            </select>
                            <button
                                onClick={() => setOfferData({ ...offerData, isBold: !offerData.isBold })}
                                style={{
                                    ...btnStyle,
                                    height: '36px',
                                    width: '36px',
                                    padding: 0,
                                    background: offerData.isBold ? 'rgba(212, 175, 55, 0.2)' : 'var(--bg-body)',
                                    color: offerData.isBold ? '#D4AF37' : 'var(--text-muted)',
                                    border: `1px solid ${offerData.isBold ? '#D4AF37' : 'var(--border-color)'}`,
                                    fontWeight: 'bold'
                                }}
                                title="Bold"
                            >
                                B
                            </button>
                            <button
                                onClick={() => setOfferData({ ...offerData, isItalic: !offerData.isItalic })}
                                style={{
                                    ...btnStyle,
                                    height: '36px',
                                    width: '36px',
                                    padding: 0,
                                    background: offerData.isItalic ? 'rgba(212, 175, 55, 0.2)' : 'var(--bg-body)',
                                    color: offerData.isItalic ? '#D4AF37' : 'var(--text-muted)',
                                    border: `1px solid ${offerData.isItalic ? '#D4AF37' : 'var(--border-color)'}`,
                                    fontStyle: 'italic',
                                    fontFamily: 'serif'
                                }}
                                title="Italic"
                            >
                                I
                            </button>
                        </div>
                        <input
                            type="text"
                            value={offerData.title}
                            onChange={e => {
                                const newTitle = e.target.value;
                                const limit = getDynamicLimit(40, offerData.titleFontSize);
                                if (newTitle.length <= limit) {
                                    setOfferData({ ...offerData, title: newTitle });
                                }
                            }}
                            style={inputStyle}
                            placeholder="e.g. 50% Off Signature Dish"
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Font Size</span>
                                <input
                                    type="range"
                                    min="0.8"
                                    max="2.5"
                                    step="0.1"
                                    value={offerData.titleFontSize}
                                    onChange={(e) => {
                                        const newScale = parseFloat(e.target.value);
                                        const limit = getDynamicLimit(40, newScale);
                                        const truncatedTitle = offerData.title.substring(0, limit);
                                        setOfferData({
                                            ...offerData,
                                            titleFontSize: newScale,
                                            title: truncatedTitle
                                        });
                                    }}
                                    style={{ flex: 1, height: '4px', cursor: 'pointer', accentColor: '#D4AF37' }}
                                />
                                <span style={{ fontSize: '0.7rem', color: '#D4AF37', fontWeight: 'bold', minWidth: '30px' }}>
                                    {offerData.titleFontSize}x
                                </span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: offerData.title.length >= getDynamicLimit(40, offerData.titleFontSize) ? '#ef4444' : 'var(--text-muted)' }}>
                                {offerData.title.length}/{getDynamicLimit(40, offerData.titleFontSize)}
                            </div>
                        </div>
                    </div>

                    {/* Offer Description */}
                    <div>
                        <label style={labelStyle}>Short Description</label>
                        <select
                            value={offerData.bodyFontFamily}
                            onChange={(e) => setOfferData({ ...offerData, bodyFontFamily: e.target.value })}
                            style={{ ...inputStyle, marginBottom: '8px', padding: '0 8px', height: '36px', fontSize: '0.85rem' }}
                        >
                            <option value="'Inter', sans-serif">Inter</option>
                            <option value="'Montserrat', sans-serif">Montserrat</option>
                            <option value="'Lato', sans-serif">Lato</option>
                            <option value="'Roboto', sans-serif">Roboto</option>
                            <option value="'Cairo', sans-serif">Cairo</option>
                        </select>
                        <textarea
                            value={offerData.description}
                            rows={2}
                            onChange={e => {
                                const newDesc = e.target.value;
                                const limit = getDynamicLimit(100, offerData.descriptionFontSize);
                                if (newDesc.length <= limit) {
                                    setOfferData({ ...offerData, description: newDesc });
                                }
                            }}
                            style={{ ...inputStyle, resize: 'none', height: 'auto' }}
                            placeholder="Briefly describe your premium offer..."
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Font Size</span>
                                <input
                                    type="range"
                                    min="0.8"
                                    max="2.5"
                                    step="0.1"
                                    value={offerData.descriptionFontSize}
                                    onChange={(e) => {
                                        const newScale = parseFloat(e.target.value);
                                        const limit = getDynamicLimit(100, newScale);
                                        const truncatedDesc = offerData.description.substring(0, limit);
                                        setOfferData({
                                            ...offerData,
                                            descriptionFontSize: newScale,
                                            description: truncatedDesc
                                        });
                                    }}
                                    style={{ flex: 1, height: '4px', cursor: 'pointer', accentColor: '#D4AF37' }}
                                />
                                <span style={{ fontSize: '0.7rem', color: '#D4AF37', fontWeight: 'bold', minWidth: '30px' }}>
                                    {offerData.descriptionFontSize}x
                                </span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: offerData.description.length >= getDynamicLimit(100, offerData.descriptionFontSize) ? '#ef4444' : 'var(--text-muted)' }}>
                                {offerData.description.length}/{getDynamicLimit(100, offerData.descriptionFontSize)}
                            </div>
                        </div>
                    </div>

                    {/* Image Upload */}
                    <div>
                        <label style={labelStyle}>Feature Image</label>
                        <label style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            padding: '24px 16px',
                            background: 'var(--bg-body)',
                            borderRadius: '12px',
                            border: '1px dashed var(--border-color)',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            gap: '12px',
                            transition: 'all 0.2s'
                        }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(212, 175, 55, 0.05)';
                                e.currentTarget.style.borderColor = '#D4AF37';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'var(--bg-body)';
                                e.currentTarget.style.borderColor = 'var(--border-color)';
                            }}>
                            <input
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={e => {
                                    const file = e.target.files[0];
                                    if (file) {
                                        const previewUrl = URL.createObjectURL(file);
                                        setOfferData({ ...offerData, imageUrl: previewUrl, file });
                                    }
                                }}
                            />
                            <FaImage style={{ fontSize: '1.5rem', color: offerData.file ? '#D4AF37' : 'rgba(255,255,255,0.2)' }} />
                            <span style={{ textAlign: 'center' }}>
                                {offerData.file ?
                                    <span style={{ color: '#D4AF37', fontWeight: 'bold' }}>✓ {offerData.file.name}</span> :
                                    <span>Click here to select a <b>high-resolution</b> image</span>
                                }
                            </span>
                        </label>
                    </div>

                    {/* Identity Display section... (Icon Selection) */}
                    <div>
                        <label style={labelStyle}>Identity Display</label>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                            {[
                                { id: 'logo', label: 'Business Logo' },
                                { id: 'icon', label: 'Animated Icon' }
                            ].map(mode => (
                                <button
                                    key={mode.id}
                                    onClick={() => setOfferData({ ...offerData, identityMode: mode.id })}
                                    style={{
                                        ...btnStyle,
                                        height: '36px',
                                        flex: 1,
                                        background: offerData.identityMode === mode.id ? 'rgba(212, 175, 55, 0.15)' : 'var(--bg-body)',
                                        color: offerData.identityMode === mode.id ? '#D4AF37' : 'var(--text-muted)',
                                        border: `1px solid ${offerData.identityMode === mode.id ? '#D4AF37' : 'var(--border-color)'}`,
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    {mode.label}
                                </button>
                            ))}
                        </div>

                        {offerData.identityMode === 'icon' && (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(5, 1fr)',
                                gap: '8px',
                                background: 'rgba(0,0,0,0.2)',
                                padding: '10px',
                                borderRadius: '12px'
                            }}>
                                {['PoliceLight', 'Loudspeaker', 'Fire', 'Sparkles', 'Collision', 'Discount10', 'Discount20', 'Discount30', 'Discount40', 'Discount50'].map(iconName => (
                                    <button
                                        key={iconName}
                                        onClick={() => setOfferData({ ...offerData, selectedIcon: iconName })}
                                        title={iconName}
                                        style={{
                                            aspectRatio: '1',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: offerData.selectedIcon === iconName ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                                            border: `1px solid ${offerData.selectedIcon === iconName ? '#D4AF37' : 'rgba(255,255,255,0.1)'}`,
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            padding: '5px'
                                        }}
                                    >
                                        <AnimatedOfferIcon type={iconName} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Visual Theme Selection */}
                    <div>
                        <label style={labelStyle}>Select Visual Theme</label>
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '12px'
                        }}>
                            {themes.map(t => (
                                <button
                                    key={t.name}
                                    onClick={() => setOfferData({ ...offerData, theme: t.name })}
                                    title={t.name}
                                    style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '50%',
                                        background: t.color,
                                        border: offerData.theme === t.name ? `3px solid ${t.border}` : `1px solid rgba(255,255,255,0.2)`,
                                        boxShadow: offerData.theme === t.name ? `0 0 12px ${t.border}` : 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        padding: 0
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Animated Shine Selection */}
                    <div>
                        <label style={labelStyle}>Animated Shine Effect</label>
                        <div style={{
                            display: 'flex',
                            gap: '8px'
                        }}>
                            {['None', 'Gold', 'Silver', 'Bronze'].map(shineOption => (
                                <button
                                    key={shineOption}
                                    onClick={() => setOfferData({ ...offerData, shine: shineOption })}
                                    style={{
                                        ...btnStyle,
                                        height: '32px',
                                        padding: '0 12px',
                                        fontSize: '0.8rem',
                                        borderRadius: '8px',
                                        background: offerData.shine === shineOption ? 'rgba(212, 175, 55, 0.2)' : 'var(--bg-body)',
                                        color: offerData.shine === shineOption ? '#D4AF37' : 'var(--text-muted)',
                                        border: `1px solid ${offerData.shine === shineOption ? '#D4AF37' : 'var(--border-color)'}`,
                                    }}
                                >
                                    {shineOption}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div >

            {/* Footer with safety area for mobile navbars */}
            <div style={{
                padding: '12px 0 24px 0',
                borderTop: '1px solid var(--border-color)',
                background: 'rgba(20, 20, 20, 0.5)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
            }}>
                <div style={{
                    maxWidth: '650px',
                    margin: '0 auto',
                    padding: '0 20px',
                    display: 'flex',
                    gap: '16px',
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            ...btnStyle,
                            flex: 1,
                            border: '1px solid var(--border-color)',
                            background: 'transparent',
                            color: 'var(--text-primary)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handlePublish}
                        disabled={!offerData.title || !offerData.description}
                        style={{
                            ...btnStyle,
                            flex: 2,
                            background: 'linear-gradient(135deg, #FFD700, #D4AF37)',
                            color: '#000',
                            border: 'none',
                            boxShadow: '0 4px 15px rgba(212, 175, 55, 0.3)',
                            opacity: (!offerData.title || !offerData.description) ? 0.5 : 1
                        }}
                    >
                        {initialData ? 'Save Changes' : 'Publish'}
                    </button>
                </div>
            </div >
        </div >
    );
};

const labelStyle = {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
};

const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-body)',
    color: 'var(--text-primary)',
    fontFamily: "'Inter', sans-serif",
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s',
};

const btnStyle = {
    padding: '0 20px',
    height: '48px',
    borderRadius: '10px',
    fontSize: '0.95rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const getIconPlaceholder = (name) => {
    switch (name) {
        case 'Crown': return '👑';
        case 'Star': return '⭐';
        case 'Fire': return '🔥';
        case 'Gift': return '🎁';
        case 'Percent': return '%';
        case 'Gem': return '💎';
        default: return '✨';
    }
};

export default PremiumOfferEditor;
