import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './OfferEditor.css';
import './OffersBanner.css';
import { getSafeAvatar } from '../utils/avatarUtils';
import { FaPercentage, FaFire, FaStar, FaTag, FaGem } from 'react-icons/fa';

const OfferEditor = ({ onPublish, businessProfile, initialData = null }) => {
    const { t } = useTranslation();
    const [offerData, setOfferData] = useState(initialData || {
        title: '',
        description: '',
        expirationType: 'fixed', // fixed or perpetual
        endDate: '',
        status: 'active', // active, draft
        mediaUrl: null,
        identityType: 'logo', // logo, badge
        badgeId: null,
        visual: {
            theme: 'midnight',
            isGlass: true,
            hasShimmer: false
        }
    });

    // Sync state when initialData changes (for editing)
    useEffect(() => {
        if (initialData) {
            let localDate = '';
            if (initialData.logic?.expiryDate) {
                const date = typeof initialData.logic.expiryDate.toDate === 'function'
                    ? initialData.logic.expiryDate.toDate()
                    : new Date(initialData.logic.expiryDate);
                localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            }

            setOfferData({
                title: initialData.content?.title || '',
                description: initialData.content?.description || '',
                expirationType: initialData.logic?.expirationType || 'fixed',
                endDate: localDate,
                status: initialData.visibility?.status || 'active',
                identityType: initialData.visibility?.identityType || 'logo',
                badgeId: initialData.visibility?.badgeId || null,
                mediaUrl: initialData.content?.mediaUrl || null,
                visual: initialData.visual || { theme: 'midnight', isGlass: true, hasShimmer: false }
            });
        }
    }, [initialData?.id]); // Only sync if the ID changes

    const badgePresets = [
        { id: 'discount', icon: <FaPercentage />, className: 'badge-pulse', label: t('badge_discount', 'Discount') },
        { id: 'hot', icon: <FaFire />, className: 'badge-flicker', label: t('badge_hot', 'Hot') },
        { id: 'special', icon: <FaStar />, className: 'badge-spin', label: t('badge_special', 'Special') },
        { id: 'sale', icon: <FaTag />, className: 'badge-shake', label: t('badge_sale', 'Sale') },
        { id: 'premium', icon: <FaGem />, className: 'badge-flicker', label: t('badge_premium', 'Premium') }
    ];

    const themes = [
        { id: 'midnight', name: 'Midnight Lux' },
        { id: 'purple', name: 'Luxury Purple' },
        { id: 'gold', name: 'Royal Gold' },
        { id: 'emerald', name: 'Emerald Green' },
        { id: 'ruby', name: 'Ruby Red' }
    ];

    // Preview contents
    return (
        <div className="editor-wrapper">
            <h2 className="editor-title">{t('create_special_offer', 'Create Special Offer')}</h2>

            {/* Preview Section - Dynamic Luxury Styles */}
            <div className="preview-section">
                <p className="label">{t('banner_preview_label', 'Banner Preview:')}</p>
                <div className={`offer-banner-card preview-card theme-${offerData.visual.theme} ${offerData.visual.isGlass ? 'glass-effect' : ''} ${offerData.visual.hasShimmer ? 'has-shimmer' : ''}`}>
                    <div className="offer-image-wrapper">
                        <div className="placeholder-img">
                            {offerData.mediaUrl ? (
                                <img src={offerData.mediaUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }} />
                            ) : '📷'}
                        </div>
                    </div>
                    <div className="offer-details">
                        <h3>{offerData.title || t('offer_title_placeholder_preview', "Offer Title here...")}</h3>
                        <p>{offerData.description || t('offer_desc_placeholder_preview', "Short description will appear here...")}</p>
                    </div>

                    <div className="offer-business-identity">
                        {offerData.identityType === 'badge' ? (
                            <div className={`ad-badge-container ${badgePresets.find(b => b.id === offerData.badgeId)?.className || 'badge-pulse'}`}>
                                {badgePresets.find(b => b.id === offerData.badgeId)?.icon || <FaTag />}
                            </div>
                        ) : (
                            <img
                                src={getSafeAvatar(businessProfile)}
                                alt="Logo"
                                className="business-logo-mini"
                            />
                        )}
                        <span className="business-name-mini">
                            {offerData.identityType === 'badge'
                                ? (badgePresets.find(b => b.id === offerData.badgeId)?.label || t('offer', 'Offer'))
                                : (businessProfile?.display_name || t('your_business', 'Business'))
                            }
                        </span>
                    </div>
                </div>
            </div>

            {/* Form Section - Follows App Theme */}
            <div className="form-section">
                <div className="theme-selection-area">
                    <label>{t('select_theme_label', 'Select Visual Theme:')}</label>
                    <div className="theme-selector">
                        {themes.map(theme => (
                            <div
                                key={theme.id}
                                className={`theme-option ${theme.id} ${offerData.visual.theme === theme.id ? 'active' : ''}`}
                                title={theme.name}
                                onClick={() => setOfferData({
                                    ...offerData,
                                    visual: { ...offerData.visual, theme: theme.id }
                                })}
                            />
                        ))}
                    </div>
                </div>

                <div className="visual-toggles">
                    <label className="toggle-item">
                        <input
                            type="checkbox"
                            checked={offerData.visual.isGlass}
                            onChange={(e) => setOfferData({
                                ...offerData,
                                visual: { ...offerData.visual, isGlass: e.target.checked }
                            })}
                        />
                        <span>{t('glass_effect_toggle', 'Glassmorphism')}</span>
                    </label>

                    <label className="toggle-item">
                        <input
                            type="checkbox"
                            checked={offerData.visual.hasShimmer}
                            onChange={(e) => setOfferData({
                                ...offerData,
                                visual: { ...offerData.visual, hasShimmer: e.target.checked }
                            })}
                        />
                        <span>{t('shimmer_effect_toggle', 'Animated Shimmer')}</span>
                    </label>
                </div>

                <label>{t('offer_info_label', 'Basic Offer Information:')}</label>
                <input
                    type="text"
                    placeholder={t('offer_title_placeholder', 'Offer Title (e.g. 20% Discount)')}
                    maxLength="50"
                    value={offerData.title}
                    onChange={(e) => setOfferData({ ...offerData, title: e.target.value })}
                />

                <textarea
                    placeholder={t('offer_desc_placeholder', 'Offer Description (Appears in banner)')}
                    maxLength="100"
                    value={offerData.description}
                    onChange={(e) => setOfferData({ ...offerData, description: e.target.value })}
                />

                <div className="media-upload-section" style={{ marginBottom: '20px' }}>
                    <label>{t('offer_image_label', 'Offer Image:')}</label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    setOfferData({ ...offerData, mediaUrl: reader.result, file: file });
                                };
                                reader.readAsDataURL(file);
                            }
                        }}
                    />
                </div>

                <div className="identity-selection" style={{ marginBottom: '20px' }}>
                    <label>{t('select_identity_type', 'Display Identity:')}</label>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button
                            className={`id-btn ${offerData.identityType === 'logo' ? 'active' : ''}`}
                            onClick={() => setOfferData({ ...offerData, identityType: 'logo', badgeId: null })}
                        >
                            {t('use_logo', 'Logo')}
                        </button>
                        <button
                            className={`id-btn ${offerData.identityType === 'badge' ? 'active' : ''}`}
                            onClick={() => setOfferData({ ...offerData, identityType: 'badge', badgeId: 'discount' })}
                        >
                            {t('use_badge', 'Badge')}
                        </button>
                    </div>

                    {offerData.identityType === 'badge' && (
                        <div className="badge-selector-grid">
                            {badgePresets.map(badge => (
                                <div
                                    key={badge.id}
                                    onClick={() => setOfferData({ ...offerData, badgeId: badge.id })}
                                    className={`badge-item ${badge.className} ${offerData.badgeId === badge.id ? 'active' : ''}`}
                                    title={badge.label}
                                >
                                    {badge.icon}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="compact-grid">
                <div className="grid-item">
                    <label>{t('offer_status_label', 'Status:')}</label>
                    <select
                        value={offerData.status}
                        onChange={(e) => setOfferData({ ...offerData, status: e.target.value })}
                    >
                        <option value="active">{t('status_active', 'Active')}</option>
                        <option value="draft">{t('status_draft', 'Draft')}</option>
                    </select>
                </div>

                <div className="grid-item">
                    <label>{t('expiration_type_label', 'Expire:')}</label>
                    <select
                        value={offerData.expirationType}
                        onChange={(e) => setOfferData({ ...offerData, expirationType: e.target.value })}
                    >
                        <option value="fixed">{t('fixed', 'Fixed')}</option>
                        <option value="perpetual">{t('perpetual', 'Always')}</option>
                    </select>
                </div>

                {offerData.expirationType === 'fixed' && (
                    <div className="grid-item full-width">
                        <label>{t('expiration_date_label', 'Ends:')}</label>
                        <input
                            type="datetime-local"
                            value={offerData.endDate}
                            onChange={(e) => setOfferData({ ...offerData, endDate: e.target.value })}
                        />
                    </div>
                )}
            </div>

            <button
                className="publish-btn"
                onClick={() => onPublish(offerData, offerData.file, initialData?.id)}
                disabled={!offerData.title || !offerData.description}
                style={{ opacity: (!offerData.title || !offerData.description) ? 0.6 : 1 }}
            >
                {initialData ? t('update_offer', 'Update Offer') : t('publish_offer_now', 'Publish Offer Now')}
            </button>
        </div>
    );
};

export default OfferEditor;
