import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaMapMarkerAlt, FaCalendarPlus, FaShare, FaDownload, FaTimes, FaStar } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { generateShareCardBlob } from '../utils/shareCardCanvas';
import { shareNativeOrFallback } from '../utils/shareNativeOrFallback';
import { getSafeAvatar, getSafeCoverImage } from '../utils/avatarUtils';
import { getContrastText } from '../utils/colorUtils';
import { getTheme } from '../utils/businessThemes';

const BusinessCard = ({ business, averageRating: propRating, reviewCount: propCount }) => {
    const navigate = useNavigate();
    const { isBusiness: viewerIsBusiness } = useAuth();
    const { t } = useTranslation();
    const info = business.businessInfo || {};
    const brandKit = info.brandKit || {};
    const brandFont = 'sans-serif';

    // ── Theme colors (free for all businesses) ──────────────────────────────────
    const theme = getTheme(info.theme || 'default');
    const tc = theme?.colors || null; // null = default styling
    const th = (themed, fallback) => (tc && themed !== undefined) ? themed : fallback;

    // Accent color: theme accent → brandKit primaryColor → CSS var
    const accent = 'var(--brand-primary)' || brandKit.primaryColor || null;
    const brandRadius = brandKit.buttonStyle || var(--brand-primary) || '16px';
    const [isSharing, setIsSharing] = useState(false);
    const [cardPreviewUrl, setCardPreviewUrl] = useState(null);
    const [previewShareUrl, setPreviewShareUrl] = useState(null);
    const [cardFile, setCardFile] = useState(null);

    const isBusinessAccount = viewerIsBusiness;

    const handleCreateInvitation = (e) => {
        e.stopPropagation();
        navigate('/create/manual', {
            state: {
                restaurantData: {
                    id: business.uid,
                    name: info.businessName,
                    type: info.businessType,
                    location: `${info.address || ''} ${info.city || ''}`.trim(),
                    image: info.coverImage,
                    lat: info.coordinates?.lat ?? info.lat,
                    lng: info.coordinates?.lng ?? info.lng,
                    countryCode: info.countryCode,
                },
            },
        });
    };

    const handleCardClick = () => {
        navigate(`/business/${business.uid}`);
    };

    // ── Share: generate card → OS app picker directly (image + link text)
    const handleShare = async (e) => {
        e.stopPropagation();
        const shareTitle = info.businessName || 'DineBuddies Partner';
        const shareUrl = `${window.location.origin}/business/${business.uid}`;
        const shareText = `Check out ${shareTitle} on DineBuddies!\n\n🔗 ${shareUrl}`;
        const storyData = {
            title: shareTitle,
            image: info.coverImage || getSafeAvatar(business),
            description: info.description,
            location: info.address || info.city,
            hostName: shareTitle,
            hostImage: getSafeAvatar(business),
            shareUrl,
        };

        try {
            setIsSharing(true);
            const blob = await generateShareCardBlob(storyData, 'business');
            if (!blob) throw new Error('No blob');
            const file = new File([blob], 'business-card.png', { type: 'image/png' });

            // Always show the overlay — let the user share from fresh gesture (like BusinessProfile)
            setCardFile(file);
            setPreviewShareUrl(shareUrl);
            setCardPreviewUrl(URL.createObjectURL(blob));
        } catch (err) {
            console.error('Share error:', err);
        } finally {
            setIsSharing(false);
        }
    };

    const handleShareFromOverlay = async (e) => {
        e?.stopPropagation();
        if (!cardFile) return;
        const shareTitle = info.businessName || 'DineBuddies Partner';
        const shareUrl = previewShareUrl;
        const shareText = `Check out ${shareTitle} on DineBuddies!\n\n🔗 ${shareUrl}`;

        await shareNativeOrFallback({
            file: cardFile,
            title: shareTitle,
            text: shareText,
            url: shareUrl,
            skipExternalFallback: false,
        });
    };

    const closePreview = (e) => {
        e?.stopPropagation();
        if (cardPreviewUrl) URL.revokeObjectURL(cardPreviewUrl);
        setCardPreviewUrl(null);
        setCardFile(null);
        setPreviewShareUrl(null);
    };


    return (
        <div
            onClick={handleCardClick}
            style={{
                background: 'var(--bg-card)',
                border: accent ? `1px solid ${accent}44` : '1px solid var(--border-color)',
                borderRadius: '24px',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                aspectRatio: '4 / 6',
                boxShadow: 'var(--brand-primary)' || (accent ? `0 4px 20px ${accent}22` : '0 4px 20px rgba(0,0,0,0.05)')
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.boxShadow = 'var(--brand-primary)' || (accent ? `0 15px 30px ${accent}44` : '0 15px 30px rgba(0,0,0,0.1)');
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--brand-primary)' || '0 4px 20px rgba(0,0,0,0.05)';
            }}
        >
            {/* Card preview overlay (shown when native file share not supported) */}
            {cardPreviewUrl && (
                <div
                    onClick={closePreview}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        background: 'rgba(0,0,0,0.75)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '20px',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: '#1e1e2e', borderRadius: 16, padding: 16,
                            maxWidth: 360, width: '100%', position: 'relative',
                        }}
                    >
                        <button
                            onClick={closePreview}
                            style={{
                                position: 'absolute', top: 8, right: 8,
                                width: 28, height: 28, borderRadius: '50%', border: 'none',
                                background: 'rgba(255,255,255,0.15)', color: 'white',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        ><FaTimes size={11} /></button>
                        {previewShareUrl ? (
                            <a href={previewShareUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginBottom: 12 }}>
                                <img
                                    src={cardPreviewUrl}
                                    alt="Business Card"
                                    style={{ width: '100%', borderRadius: 10, display: 'block', cursor: 'pointer' }}
                                />
                            </a>
                        ) : (
                            <img
                                src={cardPreviewUrl}
                                alt="Business Card"
                                style={{ width: '100%', borderRadius: 10, display: 'block', marginBottom: 12 }}
                            />
                        )}
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                type="button"
                                onClick={handleShareFromOverlay}
                                style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    padding: '11px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                                    background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                                    color: 'white', fontWeight: 700, fontSize: '0.9rem',
                                }}
                            >
                                <FaShare /> {t('share', { defaultValue: 'Share' })}
                            </button>
                            <a
                                href={cardPreviewUrl}
                                download="business-card.png"
                                style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    padding: '11px 0', borderRadius: 10, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(255,255,255,0.05)',
                                    color: 'white', fontWeight: 700, fontSize: '0.9rem',
                                }}
                            >
                                <FaDownload /> {t('download', { defaultValue: 'Download' })}
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* Share button — top right corner */}
            <button
                onClick={handleShare}
                disabled={isSharing}
                title="Share"
                style={{
                    position: 'absolute', top: 10, right: 10, zIndex: 10,
                    width: 36, height: 36, borderRadius: '50%', border: 'none',
                    background: 'rgba(0,0,0,0.45)',
                    backdropFilter: 'blur(6px)',
                    color: 'white', fontSize: '0.95rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: isSharing ? 'wait' : 'pointer',
                    transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { if (!isSharing) e.currentTarget.style.background = brandPrimary ? `${brandPrimary}cc` : 'rgba(249,115,22,0.85)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.45)'; }}
            >
                {isSharing ? '⏳' : <FaShare />}
            </button>

            {/* Image Section */}
            <div style={{
                position: 'relative',
                flex: '1 1 42%',
                minHeight: 0,
                overflow: 'hidden',
                background: 'var(--bg-body)'
            }}>
                <img
                    src={getSafeCoverImage(info.coverImage) || 'https://via.placeholder.com/400x200?text=No+Image'}
                    alt={info.businessName}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'transform 0.5s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                />
            </div>

            {/* Details Section */}
            <div style={{
                padding: '1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                flex: '1 1 58%',
                minHeight: 0,
                gap: '10px',
                overflow: 'hidden'
            }}>
                {/* Title & Type Header */}
                <div style={{ marginBottom: '2px' }}>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/restaurants?category=${encodeURIComponent(info.businessType || 'Venue')}`);
                        }}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '24px',
                            padding: '4px 10px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '6px',
                            color: th(var(--brand-primary), accent || 'var(--primary)'),
                            background: 'rgba(139, 92, 246, 0.08)',
                            border: `1px solid ${th(var(--brand-primary), accent || 'var(--primary)')}44`,
                            borderRadius: '10px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
                            e.currentTarget.style.transform = 'scale(1.02)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.08)';
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        {info.businessType || 'Venue'}
                    </button>
                    <h3 style={{
                        fontSize: '1.3rem',
                        fontWeight: '800',
                        color: 'var(--text-secondary)',
                        margin: 0,
                        lineHeight: 1.2,
                        fontFamily: brandFont || undefined
                    }}>
                        {info.businessName}
                    </h3>
                </div>
                {/* Location */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem'
                }}>
                    <FaMapMarkerAlt style={{ color: brandPrimary || 'var(--primary)', flexShrink: 0 }} />
                    <span style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {info.city || 'Unknown City'}
                        {info.address && `, ${info.address}`}
                    </span>
                </div>

                {/* Rating */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)'
                }}>
                    <FaStar style={{ color: '#fbbf24', flexShrink: 0 }} />
                    <span>{(propRating ?? business?.averageRating ?? 0).toFixed(1)}</span>
                    <span style={{ opacity: 0.9 }}>
                        ({propCount ?? business?.reviewCount ?? 0} {t('reviews', 'reviews')})
                    </span>
                </div>

                {info.services && info.services.length > 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        · {info.services.length} menu items
                    </div>
                )}

                <div style={{ flex: 1 }}></div>

                {/* Action Button: Create Invitation Here */}
                {!isBusinessAccount && (
                    <button
                        onClick={handleCreateInvitation}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: 'var(--brand-primary)' || (accent
                                ? `linear-gradient(135deg, ${accent}, ${brandKit.secondaryColor || accent})`
                                : 'var(--primary)'),
                            border: 'none',
                            borderRadius: brandRadius,
                            color: 'var(--brand-primary)' || 'white',
                            fontWeight: '700',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s',
                            fontFamily: brandFont || undefined,
                            boxShadow: 'var(--brand-primary)' || (accent ? `0 4px 16px ${accent}44` : 'var(--shadow-glow)')
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.02)';
                            e.currentTarget.style.filter = 'brightness(1.15)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.filter = '';
                        }}
                    >
                        <FaCalendarPlus />
                        {t('host_invitation_here')}
                    </button>
                )}
            </div>
        </div>
    );
};

export default BusinessCard;
