import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaEdit, FaCheckCircle, FaExclamationTriangle, FaCalendarAlt, FaClock, FaMapMarkerAlt, FaUsers, FaMoneyBillWave, FaLock, FaGlobe, FaUserFriends } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { doc, getDoc, getDocFromServer, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { formatAgeGroupsSmart } from '../utils/invitationDisplayUtils';
import { FaVenusMars, FaBirthdayCake } from 'react-icons/fa';
import { getTemplateStyle } from '../utils/invitationTemplates';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const InvitationPreview = () => {
    const { t, i18n } = useTranslation();
    const { showToast } = useToast();
    const { isBusiness } = useAuth();
    const isBusinessRef = useRef(isBusiness);
    isBusinessRef.current = isBusiness;
    const navigate = useNavigate();
    const { id: draftId } = useParams(); // Get draft ID from URL

    const fallbackAfterPreviewError = () => (isBusinessRef.current ? '/' : '/create');

    const [invitation, setInvitation] = useState(null);
    const [isPublishing, setIsPublishing] = useState(false);
    const [loading, setLoading] = useState(true);

    const templateStyles = invitation ? getTemplateStyle(
        invitation.templateType || 'classic',
        invitation.colorScheme || 'oceanBlue',
        invitation.inviteMood || invitation.occasionType,
        { cardFontFamily: invitation.cardFontFamily }
    ) : null;
    const previewTextColor = templateStyles?.card?.color || 'var(--text-main)';
    const previewMutedColor = templateStyles?.card?.color ? 'rgba(255,255,255,0.82)' : 'var(--text-secondary)';
    const previewSubtleColor = templateStyles?.card?.color ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)';

    // Fetch draft invitation from Firestore
    useEffect(() => {
        let cancelled = false;

        const fetchDraft = async () => {
            if (!draftId) {
                navigate(fallbackAfterPreviewError(), { replace: true });
                return;
            }

            try {
                const invitationRef = doc(db, 'invitations', draftId);
                // Prefer server read right after create (avoids stale cache); fall back to cache read.
                let invitationDoc;
                try {
                    invitationDoc = await getDocFromServer(invitationRef);
                } catch {
                    invitationDoc = await getDoc(invitationRef);
                }
                if (!invitationDoc.exists()) {
                    invitationDoc = await getDoc(invitationRef);
                }

                if (cancelled) return;

                if (!invitationDoc.exists()) {
                    showToast(t('invitation_not_found') || 'Draft not found', 'error');
                    navigate(fallbackAfterPreviewError(), { replace: true });
                    return;
                }

                const data = invitationDoc.data();

                // Source of truth for "still a draft": status === 'draft'. Published docs clear status (deleteField) and set publishedAt.
                // Do NOT use Boolean(publishedAt) alone — it can mis-classify or fight with other redirects.
                const isStillDraft = data.status === 'draft';
                if (!isStillDraft) {
                    navigate(`/invitation/${draftId}`, { replace: true });
                    return;
                }

                setInvitation({ id: draftId, ...data });
            } catch (error) {
                console.error('Error fetching draft:', error);
                showToast(t('error_loading_draft') || 'Error loading draft', 'error');
                navigate(fallbackAfterPreviewError(), { replace: true });
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchDraft();
        return () => { cancelled = true; };
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
        setIsPublishing(true);

        try {
            const invitationRef = doc(db, 'invitations', draftId);


            // Import deleteField
            const { deleteField } = await import('firebase/firestore');

            // Remove draft status and add published timestamp
            await updateDoc(invitationRef, {
                status: deleteField(), // Remove draft status
                publishedAt: new Date().toISOString()
            });


            // Navigate to published invitation
            navigate(`/invitation/${draftId}`);
        } catch (error) {
            console.error('❌ Error publishing invitation:', error);
            const code = error?.code || '';
            const msg =
                code === 'permission-denied'
                    ? (t('publish_permission_denied') || 'Publishing failed: account does not have permission to update this invitation.')
                    : (t('failed_publish_invitation') || 'Failed to publish invitation');
            showToast(msg, 'error');
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
                    alignItems: templateStyles.layout?.textAlign === 'center' ? 'center' : 'flex-start',
                    color: previewTextColor,
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
                            background: templateStyles.card?.color ? 'rgba(255,255,255,0.1)' : 'var(--bg-input)', padding: '6px 14px',
                            borderRadius: '12px', fontSize: '0.9rem', color: templateStyles.card?.color || 'var(--text-main)',
                            fontWeight: '700', border: templateStyles.card?.color ? '1px solid rgba(255,255,255,0.1)' : '1px solid var(--border-color)'
                        }}>
                            <FaCalendarAlt style={{ color: templateStyles.layout?.accentColor || '#fbbf24' }} />
                            {(() => {
                                if (!invitation.date) return 'TBD';
                                const d = new Date(invitation.date);
                                return d.toLocaleDateString(i18n.language === 'ar' ? 'ar-u-nu-latn' : undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                            })()}
                        </span>
                        <span className="meta-badge" style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: templateStyles.card?.color ? 'rgba(255,255,255,0.1)' : 'var(--bg-input)', padding: '6px 14px',
                            borderRadius: '12px', fontSize: '0.9rem', color: templateStyles.card?.color || 'var(--text-main)',
                            fontWeight: '700', border: templateStyles.card?.color ? '1px solid rgba(255,255,255,0.1)' : '1px solid var(--border-color)'
                        }}>
                            <FaClock style={{ color: templateStyles.layout?.accentColor || '#fbbf24' }} /> {invitation.time}
                        </span>
                    </div>

                    {/* Title */}
                    <h3 style={{
                        fontSize: templateStyles.layout?.titleSize || '1.6rem',
                        fontWeight: '900',
                        color: templateStyles.card?.color || 'var(--text-main)',
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
                            color: previewMutedColor,
                            opacity: 1,
                            margin: '0 0 1.5rem 0',
                            lineHeight: '1.6',
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
                        color: previewTextColor,
                        fontWeight: '700',
                        marginBottom: '1.5rem',
                        padding: '0.5rem 1rem',
                        background: templateStyles.card?.color ? 'rgba(255,255,255,0.12)' : 'var(--bg-input)',
                        borderRadius: '12px',
                        border: templateStyles.card?.color ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border-color)'
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
                        opacity: 0.9,
                        color: previewTextColor
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <FaUsers style={{ color: templateStyles?.badge?.color || 'var(--primary)' }} />
                            <div>
                                <div style={{ fontSize: '0.7rem', color: previewSubtleColor, opacity: 1 }}>{t('guests')}</div>
                                <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{invitation.guestsNeeded}</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <FaMoneyBillWave style={{ color: templateStyles?.badge?.color || 'var(--primary)' }} />
                            <div>
                                <div style={{ fontSize: '0.7rem', color: previewSubtleColor, opacity: 1 }}>{t('payment')}</div>
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
                    type="button"
                    onClick={handleEdit}
                    disabled={isPublishing}
                    className="ui-btn ui-btn--secondary"
                    style={{
                        /* ui-btn ui-btn--secondary provides base; keep preview-specific overrides */
                        padding: '1.25rem',
                        borderRadius: '16px',
                        fontSize: '1rem',
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
                    type="button"
                    onClick={handlePublish}
                    disabled={isPublishing}
                    className="ui-btn ui-btn--primary"
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
