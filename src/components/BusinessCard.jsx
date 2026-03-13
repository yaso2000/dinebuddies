import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaMapMarkerAlt, FaStar, FaCalendarPlus, FaShare, FaDownload, FaTimes } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { generateShareCardBlob } from '../utils/shareCardCanvas';
import { getSafeAvatar } from '../utils/avatarUtils';
import { getContrastText } from '../utils/colorUtils';
import { getTheme } from '../utils/businessThemes';

const BusinessCard = ({ business }) => {
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const { t } = useTranslation();
    const info = business.businessInfo || {};
    const brandKit = info.brandKit || {};
    const brandFont = 'system-ui, sans-serif';

    // ── Theme colors (free for all businesses) ──────────────────────────────────
    const theme = getTheme(info.theme || 'default');
    const tc = theme?.colors || null; // null = default styling
    const th = (themed, fallback) => (tc && themed !== undefined) ? themed : fallback;

    // Accent color: theme accent → brandKit primaryColor → CSS var
    const accent = tc?.accent || brandKit.primaryColor || null;
    const brandRadius = brandKit.buttonStyle || tc?.btnBorderRadius || '16px';
    const [isSharing, setIsSharing] = useState(false);
    const [cardPreviewUrl, setCardPreviewUrl] = useState(null);
    const [cardFile, setCardFile] = useState(null);

    // Canonical: only role. Partner = role === 'business'.
    const isBusinessAccount = userProfile?.role === 'business';

    const handleCreateInvitation = (e) => {
        e.stopPropagation();
        navigate('/create', {
            state: {
                restaurantData: {
                    id: business.uid,
                    name: info.businessName,
                    type: info.businessType,
                    location: `${info.address || ''} ${info.city || ''}`.trim(),
                    image: info.coverImage,
                    lat: info.coordinates?.lat,
                    lng: info.coordinates?.lng
                }
            }
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
        };

        try {
            setIsSharing(true);
            const blob = await generateShareCardBlob(storyData, 'business');
            if (!blob) throw new Error('No blob');
            const file = new File([blob], 'business-card.png', { type: 'image/png' });

            // Try native share with image file → opens OS picker
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({ files: [file], title: shareTitle, text: shareText, url: shareUrl });
                    return;
                } catch (err) {
                    if (err.name === 'AbortError') return;
                    // File sharing not supported (e.g. HTTP/localhost) → show preview overlay
                }
            }
            // Fallback: show card preview so user can download & share manually
            setCardFile(file);
            setCardPreviewUrl(URL.createObjectURL(blob));
        } catch (err) {
            console.error('Share error:', err);
        } finally {
            setIsSharing(false);
        }
    };

    const closePreview = (e) => {
        e?.stopPropagation();
        if (cardPreviewUrl) URL.revokeObjectURL(cardPreviewUrl);
        setCardPreviewUrl(null);
        setCardFile(null);
    };


    return (
        <div
            onClick={handleCardClick}
            style={{
                background: th(tc?.cardBg, 'var(--bg-card)'),
                border: accent ? `1px solid ${accent}44` : '1px solid var(--border-color)',
                borderRadius: '24px',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                boxShadow: tc?.cardShadow || (accent ? `0 4px 20px ${accent}22` : '0 4px 20px rgba(0,0,0,0.05)')
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.boxShadow = tc?.cardShadow || (accent ? `0 15px 30px ${accent}44` : '0 15px 30px rgba(0,0,0,0.1)');
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = tc?.cardShadow || '0 4px 20px rgba(0,0,0,0.05)';
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
                        <img
                            src={cardPreviewUrl}
                            alt="Business Card"
                            style={{ width: '100%', borderRadius: 10, display: 'block', marginBottom: 12 }}
                        />
                        <a
                            href={cardPreviewUrl}
                            download="business-card.png"
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                padding: '11px 0', borderRadius: 10, textDecoration: 'none',
                                background: 'linear-gradient(135deg, #f97316, #eab308)',
                                color: 'white', fontWeight: 700, fontSize: '0.9rem',
                            }}
                        >
                            <FaDownload /> Download Card
                        </a>
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
                height: '200px',
                overflow: 'hidden',
                background: 'var(--bg-body)'
            }}>
                <img
                    src={info.coverImage || 'https://via.placeholder.com/400x200?text=No+Image'}
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
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                gap: '12px'
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
                            color: th(tc?.accent, accent || 'var(--primary)'),
                            background: 'rgba(139, 92, 246, 0.08)',
                            border: `1px solid ${th(tc?.accent, accent || 'var(--primary)')}44`,
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
                        color: th(tc?.badgeText, 'var(--text-main)'),
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

                {/* Rating/Services Info */}
                {info.services && info.services.length > 0 && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)'
                    }}>
                        <FaStar style={{ color: brandPrimary || 'var(--luxury-gold)', fontSize: '0.9rem' }} />
                        <span>{info.services.length} Menu Items Available</span>
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
                            background: tc?.footerBg || (accent
                                ? `linear-gradient(135deg, ${accent}, ${brandKit.secondaryColor || accent})`
                                : 'var(--primary)'),
                            border: 'none',
                            borderRadius: brandRadius,
                            color: tc?.accentText || 'white',
                            fontWeight: '700',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s',
                            fontFamily: brandFont || undefined,
                            boxShadow: tc?.btnShadow || (accent ? `0 4px 16px ${accent}44` : 'var(--shadow-glow)')
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
