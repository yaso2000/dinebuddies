import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaShareAlt, FaEdit, FaSpinner } from 'react-icons/fa';
import { getTemplateStyle, COLOR_SCHEMES } from '../../utils/invitationTemplates';
import { getSafeAvatar, pickSafeDisplayImageUrl } from '../../utils/avatarUtils';

const INVITATION_IMAGE_FALLBACK = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800';

const InvitationHeader = ({ invitation, isHost, onImageUpdate, onEdit, onDelete, onShare, sharingCard }) => {
    const { t, i18n } = useTranslation();

    const templateStyles = getTemplateStyle(
        invitation.templateType || 'classic',
        invitation.colorScheme || 'oceanBlue',
        invitation.inviteMood || invitation.occasionType,
        { cardFontFamily: invitation.cardFontFamily }
    );

    const themeColors = COLOR_SCHEMES[invitation.colorScheme || 'oceanBlue'] || COLOR_SCHEMES.oceanBlue;
    const isRTL = i18n.language === 'ar' || i18n.language?.startsWith('ar');

    // Skip Google Maps PhotoService URLs — they 403 as direct img src (API key / referrer rules)
    const displayImage =
        pickSafeDisplayImageUrl(invitation.customImage, invitation.restaurantImage, invitation.image) ||
        INVITATION_IMAGE_FALLBACK;

    return (
        <div className="invitation-hero" style={{ position: 'relative', height: '350px' }}>
            <img
                src={displayImage}
                alt={invitation.title}
                className="invitation-image"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.src = INVITATION_IMAGE_FALLBACK; }}
            />
            <div
                className="overlay"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background:
                        `linear-gradient(180deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.6) 85%, ${themeColors.primary}A0 100%)`,
                    borderStyle: 'solid',
                    borderWidth: '1px',
                    borderColor: 'rgba(0, 0, 0, 1)',
                }}
            ></div>

            {/* Action Buttons (Top Right corner normally, flips to Top Left in RTL) */}
            <div style={{ position: 'absolute', top: '20px', ...(isRTL ? { left: '20px' } : { right: '20px' }), zIndex: 10, display: 'flex', gap: '10px' }}>
                <button
                    onClick={onShare}
                    disabled={sharingCard}
                    style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: sharingCard ? 'wait' : 'pointer', opacity: sharingCard ? 0.6 : 1 }}
                >
                    {sharingCard
                        ? <FaSpinner style={{ animation: 'spin 1s linear infinite' }} />
                        : <FaShareAlt />}
                </button>
                {isHost && (
                    <>
                        <button
                            onClick={onEdit}
                            style={{
                                background: 'var(--luxury-gold)',
                                border: 'none',
                                borderRadius: '30px',
                                padding: '8px 24px',
                                minWidth: '110px',
                                height: '44px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                color: 'black',
                                cursor: 'pointer',
                                fontWeight: '900',
                                boxShadow: 'var(--shadow-premium)',
                                transform: 'scale(1.05)',
                                transition: 'all 0.3s ease'
                            }}
                            aria-label="Edit Invitation"
                        >
                            <FaEdit style={{ fontSize: '1.2rem', color: 'black' }} />
                            <span style={{ fontSize: '0.95rem' }}>{t('edit', { defaultValue: 'Edit' })}</span>
                        </button>

                        {/* Delete button removed as per user request */}
                    </>
                )}
            </div>

            {/* Title & Type */}
            <div style={{ position: 'absolute', bottom: '40px', left: '20px', right: '20px', zIndex: 5 }}>
                <div style={{
                    display: 'inline-block',
                    background: templateStyles?.badge?.background || 'var(--luxury-gold)',
                    color: templateStyles?.badge?.color || 'black',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    marginBottom: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    border: templateStyles?.badge?.border || 'none',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                }}>
                    {t(invitation.type)}
                </div>
                <h1 style={{
                    fontSize: 'clamp(1.4rem, 5vw, 1.8rem)',
                    fontWeight: '900',
                    color: '#ffffff',
                    lineHeight: '1.2',
                    textShadow: '0 2px 10px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.5)',
                    fontFamily: templateStyles.layout?.fontFamily || 'inherit',
                    marginBottom: '8px'
                }}>
                    {invitation.title}
                </h1>
                {invitation.description && (
                    <p style={{
                        color: 'rgba(255,255,255,0.95)',
                        marginTop: '8px',
                        fontSize: '0.95rem',
                        maxWidth: '600px',
                        lineHeight: '1.5',
                        textShadow: '0 1px 6px rgba(0,0,0,0.8)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        ...templateStyles.layout?.messageStyle
                    }}>
                        {invitation.description}
                    </p>
                )}
            </div>

        </div>
    );
};

export default InvitationHeader;
