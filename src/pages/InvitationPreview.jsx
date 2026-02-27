import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaEdit, FaCheckCircle, FaExclamationTriangle, FaCalendarAlt, FaClock, FaMapMarkerAlt, FaUsers, FaMoneyBillWave, FaLock, FaGlobe, FaUserFriends } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { formatAgeGroupsSmart } from '../utils/invitationDisplayUtils';
import { FaVenusMars, FaBirthdayCake } from 'react-icons/fa';
import { getTemplateStyle } from '../utils/invitationTemplates';

const InvitationPreview = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id: draftId } = useParams(); // Get draft ID from URL

    const [invitation, setInvitation] = useState(null);
    const [isPublishing, setIsPublishing] = useState(false);
    const [loading, setLoading] = useState(true);

    const templateStyles = invitation ? getTemplateStyle(
        invitation.templateType || 'classic',
        invitation.colorScheme || 'oceanBlue',
        invitation.occasionType
    ) : null;

    // Fetch draft invitation from Firestore
    useEffect(() => {
        const fetchDraft = async () => {
            if (!draftId) {
                navigate('/create');
                return;
            }

            try {
                const invitationRef = doc(db, 'invitations', draftId);
                const invitationDoc = await getDoc(invitationRef);

                if (!invitationDoc.exists()) {
                    alert(t('invitation_not_found') || 'Draft not found');
                    navigate('/create');
                    return;
                }

                const data = invitationDoc.data();

                // Verify it's a draft
                if (data.status !== 'draft') {
                    // Already published, redirect to invitation page
                    navigate(`/invitation/${draftId}`);
                    return;
                }

                setInvitation({ id: draftId, ...data });
            } catch (error) {
                console.error('Error fetching draft:', error);
                alert(t('error_loading_draft') || 'Error loading draft');
                navigate('/create');
            } finally {
                setLoading(false);
            }
        };

        fetchDraft();
    }, [draftId, navigate, t]);

    const handleEdit = () => {
        // Go back to create page with draft ID to edit
        navigate('/create', {
            state: {
                draftId,
                editingDraft: true
            }
        });
    };

    const handlePublish = async () => {
        console.log('🚀 Publishing invitation...');
        setIsPublishing(true);

        try {
            const invitationRef = doc(db, 'invitations', draftId);

            console.log('📝 Removing draft status and marking as published...');

            // Import deleteField
            const { deleteField } = await import('firebase/firestore');

            // Remove draft status and add published timestamp
            await updateDoc(invitationRef, {
                status: deleteField(), // Remove draft status
                publishedAt: new Date().toISOString()
            });

            console.log('✅ Invitation published successfully!');
            console.log('🔄 Navigating to invitation page...');

            // Navigate to published invitation
            navigate(`/invitation/${draftId}`);
        } catch (error) {
            console.error('❌ Error publishing invitation:', error);
            alert(t('failed_publish_invitation') || 'Failed to publish invitation');
        } finally {
            setIsPublishing(false);
        }
    };

    if (loading) {
        return (
            <div className="page-container" style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', padding: '4rem 0' }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
                <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>
                    {t('loading') || 'Loading draft...'}
                </div>
            </div>
        );
    }

    if (!invitation) {
        return null;
    }

    const getPrivacyIcon = () => {
        switch (invitation.privacy) {
            case 'public': return <FaGlobe />;
            case 'followers': return <FaUserFriends />;
            default: return <FaGlobe />;
        }
    };

    const getPrivacyLabel = () => {
        switch (invitation.privacy) {
            case 'public': return t('public') || 'Public';
            case 'followers': return t('followers_only') || 'Followers Only';
            default: return 'Public';
        }
    };

    return (
        <div className="page-container" style={{
            maxWidth: '800px',
            margin: '0 auto',
            padding: '2rem 1.5rem'
        }}>
            {/* DRAFT WARNING BANNER */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.2))',
                border: '2px solid #f59e0b',
                borderRadius: '16px',
                padding: '1.5rem',
                marginBottom: '2rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '1rem',
                animation: 'pulse 2s infinite'
            }}>
                <FaExclamationTriangle style={{ fontSize: '2rem', color: '#f59e0b', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f59e0b', marginBottom: '0.5rem' }}>
                        📋 {t('preview_mode') || 'PREVIEW MODE - NOT PUBLISHED YET'}
                    </div>
                    <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                        {t('preview_warning') || 'This is a preview of your invitation. It has NOT been published yet and is NOT visible to other users. Click "Publish Invitation" below to make it available to guests.'}
                    </div>
                </div>
            </div>

            {/* PREVIEW HEADER */}
            <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '0.5rem' }}>
                    {t('preview_your_invitation') || 'Preview Your Invitation'}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                    {t('review_before_publishing') || 'Review all details before publishing'}
                </p>
            </div>

            {/* PREVIEW CARD */}
            <div style={{
                ...(templateStyles?.card || {}),
                overflow: 'hidden',
                marginBottom: '2rem',
                minHeight: 'auto' // Override minHeight for preview
            }}>
                {/* Media (Image or Video) */}
                {(() => {
                    // Determine media to display
                    let mediaUrl = null;
                    let isVideo = false;

                    if (invitation.mediaType === 'video' && invitation.customVideo) {
                        mediaUrl = invitation.customVideo;
                        isVideo = true;
                    } else if (invitation.customImage) {
                        mediaUrl = invitation.customImage;
                    } else if (invitation.restaurantImage) {
                        mediaUrl = invitation.restaurantImage;
                    } else if (invitation.image) {
                        // Fallback to old field
                        mediaUrl = invitation.image;
                    }

                    if (!mediaUrl) return null;

                    return (
                        <div style={{
                            width: '100%',
                            height: '300px',
                            overflow: 'hidden',
                            position: 'relative',
                            background: '#000'
                        }}>
                            {isVideo ? (
                                <video
                                    src={mediaUrl}
                                    controls
                                    playsInline
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'contain'
                                    }}
                                />
                            ) : (
                                <img
                                    src={mediaUrl}
                                    alt={invitation.title}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                    }}
                                />
                            )}
                            <div style={{
                                position: 'absolute',
                                top: '1rem',
                                right: '1rem',
                                background: 'rgba(0,0,0,0.7)',
                                backdropFilter: 'blur(10px)',
                                padding: '0.5rem 1rem',
                                borderRadius: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: '0.85rem',
                                fontWeight: '700'
                            }}>
                                {getPrivacyIcon()}
                                {getPrivacyLabel()}
                            </div>
                        </div>
                    );
                })()}

                {/* Content */}
                <div style={{
                    padding: '2rem',
                    textAlign: templateStyles.layout?.textAlign || 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: templateStyles.layout?.textAlign === 'center' ? 'center' : 'flex-start'
                }}>
                    {/* Decorative Header (Optional) */}
                    {templateStyles.layout?.decorativeElement && (
                        <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>
                            {templateStyles.layout.decorativeElement}
                        </div>
                    )}

                    {/* Date & Time Row - More prominent */}
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: templateStyles.layout?.textAlign === 'center' ? 'center' : 'flex-start',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '1rem'
                    }}>
                        <span className="meta-badge" style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'rgba(255,255,255,0.1)', padding: '6px 14px',
                            borderRadius: '12px', fontSize: '0.9rem', color: 'white',
                            fontWeight: '700', border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <FaCalendarAlt style={{ color: templateStyles.layout?.accentColor || '#fbbf24' }} />
                            {(() => {
                                if (!invitation.date) return 'TBD';
                                const d = new Date(invitation.date);
                                return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                            })()}
                        </span>
                        <span className="meta-badge" style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'rgba(255,255,255,0.1)', padding: '6px 14px',
                            borderRadius: '12px', fontSize: '0.9rem', color: 'white',
                            fontWeight: '700', border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <FaClock style={{ color: templateStyles.layout?.accentColor || '#fbbf24' }} /> {invitation.time}
                        </span>
                    </div>

                    {/* Title */}
                    <h3 style={{
                        fontSize: templateStyles.layout?.titleSize || '1.6rem',
                        fontWeight: '900',
                        color: 'white',
                        margin: '0 0 1rem 0',
                        lineHeight: 1.2,
                        fontFamily: templateStyles.layout?.fontFamily || 'inherit'
                    }}>
                        {invitation.title}
                    </h3>

                    {/* Message / Description */}
                    {templateStyles.layout?.displayDescription && invitation.description && (
                        <p style={{
                            fontSize: '1rem',
                            color: 'rgba(255,255,255,0.9)',
                            margin: '0 0 1.5rem 0',
                            lineHeight: '1.6',
                            ...templateStyles.layout.messageStyle
                        }}>
                            {invitation.description}
                        </p>
                    )}

                    {/* Location / Restaurant Name */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: templateStyles.layout?.textAlign === 'center' ? 'center' : 'flex-start',
                        gap: '8px',
                        fontSize: '1.1rem',
                        color: 'white',
                        fontWeight: '700',
                        marginBottom: '1.5rem',
                        padding: '0.5rem 1rem',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <FaMapMarkerAlt style={{ color: '#f87171' }} />
                        <span>
                            {invitation.location || t('venue_selected')}
                        </span>
                    </div>

                    {/* Grid of Other Info */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: '1rem',
                        width: '100%',
                        marginBottom: '1.5rem',
                        opacity: 0.9
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <FaUsers style={{ color: templateStyles?.badge?.color || 'var(--primary)' }} />
                            <div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('guests')}</div>
                                <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{invitation.guestsNeeded}</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <FaMoneyBillWave style={{ color: templateStyles?.badge?.color || 'var(--primary)' }} />
                            <div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('payment')}</div>
                                <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{invitation.paymentType}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ACTION BUTTONS */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 2fr',
                gap: '1rem',
                marginBottom: '2rem'
            }}>
                {/* Edit Button */}
                <button
                    onClick={handleEdit}
                    disabled={isPublishing}
                    style={{
                        padding: '1.25rem',
                        borderRadius: '16px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        fontSize: '1rem',
                        fontWeight: '700',
                        cursor: isPublishing ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem',
                        transition: 'all 0.2s',
                        opacity: isPublishing ? 0.5 : 1,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                    }}
                    onMouseEnter={(e) => {
                        if (!isPublishing) {
                            e.currentTarget.style.borderColor = templateStyles?.badge?.color || 'var(--primary)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 6px 15px rgba(0,0,0,0.1)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                    }}
                >
                    <FaEdit style={{ color: templateStyles?.badge?.color || 'var(--primary)' }} />
                    {t('edit_details') || 'Edit Details'}
                </button>

                {/* Publish Button */}
                <button
                    onClick={handlePublish}
                    disabled={isPublishing}
                    style={{
                        ...(templateStyles?.button || {}),
                        padding: '1.25rem',
                        fontSize: '1.1rem',
                        fontWeight: '800',
                        cursor: isPublishing ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        width: '100%',
                        border: templateStyles?.button?.border || 'none'
                    }}
                    onMouseEnter={(e) => {
                        if (!isPublishing) {
                            e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
                            e.currentTarget.style.boxShadow = templateStyles?.button?.boxShadow || '0 12px 25px rgba(0,0,0,0.3)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.boxShadow = templateStyles?.button?.boxShadow || 'none';
                    }}
                >
                    <FaCheckCircle />
                    {isPublishing
                        ? t('publishing') || 'Publishing...'
                        : t('publish_invitation') || 'Publish Invitation'}
                </button>
            </div>

            {/* Bottom Warning */}
            <div style={{
                textAlign: 'center',
                padding: '1rem',
                background: 'rgba(251, 191, 36, 0.1)',
                borderRadius: '12px',
                border: '1px solid rgba(251, 191, 36, 0.3)'
            }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    💡 {t('preview_reminder') || 'Remember: Your invitation will only be visible to guests after you click "Publish Invitation"'}
                </div>
            </div>

            {/* CSS Animation */}
            <style>{`
                @keyframes pulse {
                    0%, 100% {
                        opacity: 1;
                    }
                    50% {
                        opacity: 0.8;
                    }
                }
            `}</style>
        </div>
    );
};

export default InvitationPreview;
