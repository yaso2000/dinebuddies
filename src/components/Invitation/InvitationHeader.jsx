import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaShareAlt, FaEdit, FaSpinner } from 'react-icons/fa';
import { getTemplateStyle } from '../../utils/invitationTemplates';
import { getSafeAvatar } from '../../utils/avatarUtils';

const InvitationHeader = ({ invitation, isHost, onImageUpdate, onEdit, onDelete, onShare, sharingCard }) => {
    const { t } = useTranslation();

    const templateStyles = getTemplateStyle(
        invitation.templateType || 'classic',
        invitation.colorScheme || 'oceanBlue',
        invitation.occasionType
    );

    // Determine the best image source, matching logic in InvitationCard
    const displayImage = invitation.customImage || invitation.restaurantImage || invitation.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800';

    return (
        <div className="invitation-hero" style={{ position: 'relative', height: '350px' }}>
            <img
                src={displayImage}
                alt={invitation.title}
                className="invitation-image"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800'; }}
            />
            <div className="overlay" style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.6) 60%, var(--bg-body) 100%)'
            }}></div>

            {/* Action Buttons (Top Right) */}
            <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10, display: 'flex', gap: '10px' }}>
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
                    fontSize: '2.2rem',
                    fontWeight: '900',
                    color: '#ffffff',
                    lineHeight: '1.2',
                    textShadow: '0 2px 15px rgba(0,0,0,0.8), 0 0 5px rgba(0,0,0,0.5)',
                    fontFamily: templateStyles.layout?.fontFamily || 'inherit',
                    marginBottom: '10px'
                }}>
                    {invitation.title}
                </h1>
                {invitation.description && (
                    <p style={{
                        color: 'rgba(255,255,255,0.95)',
                        marginTop: '10px',
                        fontSize: '1rem',
                        maxWidth: '600px',
                        lineHeight: '1.6',
                        textShadow: '0 1px 8px rgba(0,0,0,0.8)',
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
