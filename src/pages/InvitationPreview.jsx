import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaEdit, FaCheckCircle, FaExclamationTriangle, FaCalendarAlt, FaClock, FaMapMarkerAlt, FaUsers, FaMoneyBillWave, FaLock, FaGlobe, FaUserFriends } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const InvitationPreview = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id: draftId } = useParams(); // Get draft ID from URL

    const [invitation, setInvitation] = useState(null);
    const [isPublishing, setIsPublishing] = useState(false);
    const [loading, setLoading] = useState(true);

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
            case 'private': return <FaLock />;
            default: return <FaGlobe />;
        }
    };

    const getPrivacyLabel = () => {
        switch (invitation.privacy) {
            case 'public': return t('public') || 'Public';
            case 'followers': return t('followers_only') || 'Followers Only';
            case 'private': return t('private') || 'Private';
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
                background: 'var(--card-bg)',
                borderRadius: '20px',
                border: '2px solid var(--border-color)',
                overflow: 'hidden',
                marginBottom: '2rem',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
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
                <div style={{ padding: '2rem' }}>
                    {/* Title */}
                    <h3 style={{
                        fontSize: '1.5rem',
                        fontWeight: '900',
                        marginBottom: '1.5rem',
                        color: 'white'
                    }}>
                        {invitation.title}
                    </h3>

                    {/* Details Grid */}
                    <div style={{
                        display: 'grid',
                        gap: '1rem',
                        marginBottom: '1.5rem'
                    }}>
                        {/* Date & Time */}
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <FaCalendarAlt style={{ color: 'var(--primary)', fontSize: '1.2rem' }} />
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {t('date')}
                                    </div>
                                    <div style={{ fontWeight: '700' }}>
                                        {new Date(invitation.date).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <FaClock style={{ color: 'var(--primary)', fontSize: '1.2rem' }} />
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {t('time')}
                                    </div>
                                    <div style={{ fontWeight: '700' }}>
                                        {invitation.time}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Location */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <FaMapMarkerAlt style={{ color: 'var(--primary)', fontSize: '1.2rem' }} />
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {t('location')}
                                </div>
                                <div style={{ fontWeight: '700' }}>
                                    {invitation.location}
                                </div>
                            </div>
                        </div>

                        {/* Guests & Payment */}
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <FaUsers style={{ color: 'var(--primary)', fontSize: '1.2rem' }} />
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {t('guests_needed')}
                                    </div>
                                    <div style={{ fontWeight: '700' }}>
                                        {invitation.guestsNeeded} {t('guests')}
                                    </div>
                                </div>
                            </div>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <FaMoneyBillWave style={{ color: 'var(--primary)', fontSize: '1.2rem' }} />
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {t('payment')}
                                    </div>
                                    <div style={{ fontWeight: '700' }}>
                                        {invitation.paymentType}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    {invitation.description && (
                        <div style={{
                            background: 'rgba(255,255,255,0.03)',
                            padding: '1rem',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)'
                        }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                {t('description')}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                {invitation.description}
                            </div>
                        </div>
                    )}
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
                        borderRadius: '12px',
                        border: '2px solid var(--border-color)',
                        background: 'var(--card-bg)',
                        color: 'white',
                        fontSize: '1rem',
                        fontWeight: '700',
                        cursor: isPublishing ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem',
                        transition: 'all 0.2s',
                        opacity: isPublishing ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => {
                        if (!isPublishing) {
                            e.currentTarget.style.borderColor = 'var(--primary)';
                            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.background = 'var(--card-bg)';
                    }}
                >
                    <FaEdit />
                    {t('edit_details') || 'Edit Details'}
                </button>

                {/* Publish Button */}
                <button
                    onClick={handlePublish}
                    disabled={isPublishing}
                    style={{
                        padding: '1.25rem',
                        borderRadius: '12px',
                        border: 'none',
                        background: isPublishing
                            ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.5), rgba(244, 63, 94, 0.5))'
                            : 'linear-gradient(135deg, #8b5cf6, #f43f5e)',
                        color: 'white',
                        fontSize: '1.1rem',
                        fontWeight: '800',
                        cursor: isPublishing ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem',
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                        if (!isPublishing) {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 6px 20px rgba(139, 92, 246, 0.4)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
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
