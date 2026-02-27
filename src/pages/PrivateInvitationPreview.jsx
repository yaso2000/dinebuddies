import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaEdit, FaCheckCircle, FaExclamationTriangle, FaLock, FaArrowLeft } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { doc, getDoc, updateDoc, deleteField, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getTemplateStyle } from '../utils/invitationTemplates';
import PrivateInvitationInfoGrid from '../components/Invitation/PrivateInvitationInfoGrid';
import { getSafeAvatar } from '../utils/avatarUtils';
import './PrivateInvitation.css';

import Lottie from 'lottie-react';
import { OCCASION_PRESETS } from '../utils/invitationTemplates';

const PrivateInvitationPreview = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id: draftId } = useParams();

    const [invitation, setInvitation] = useState(null);
    const [isPublishing, setIsPublishing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [animationData, setAnimationData] = useState(null);

    useEffect(() => {
        const fetchDraft = async () => {
            if (!draftId) {
                navigate('/create-private');
                return;
            }

            try {
                const invitationRef = doc(db, 'invitations', draftId);
                const invitationDoc = await getDoc(invitationRef);

                if (!invitationDoc.exists()) {
                    alert(t('invitation_not_found') || 'Draft not found');
                    navigate('/create-private');
                    return;
                }

                const data = invitationDoc.data();
                if (data.status !== 'draft') {
                    navigate(`/invitation/private/${draftId}`);
                    return;
                }

                setInvitation({ id: draftId, ...data });
            } catch (error) {
                console.error('Error fetching private draft:', error);
                navigate('/create-private');
            } finally {
                setLoading(false);
            }
        };

        fetchDraft();
    }, [draftId, navigate, t]);

    // Fetch Lottie data
    useEffect(() => {
        const lottieUrl = invitation ? OCCASION_PRESETS[(invitation.occasionType || '').charAt(0).toUpperCase() + (invitation.occasionType || '').slice(1).toLowerCase()]?.lottieUrl : null;
        if (lottieUrl) {
            fetch(lottieUrl)
                .then(res => res.json())
                .then(data => setAnimationData(data))
                .catch(err => console.error('Error loading Lottie animation in preview:', err));
        }
    }, [invitation]);

    const handlePublish = async () => {
        setIsPublishing(true);
        try {
            const invitationRef = doc(db, 'invitations', draftId);
            await updateDoc(invitationRef, {
                status: deleteField(),
                publishedAt: serverTimestamp()
            });

            // Send notifications to invited guests
            if (invitation.invitedFriends?.length > 0) {
                const notificationsBatch = invitation.invitedFriends.map(friendId => {
                    return addDoc(collection(db, 'notifications'), {
                        userId: friendId,
                        type: 'private_invitation',
                        title: t('notification_private_invitation_title'),
                        message: t('notification_private_invitation_message', {
                            name: invitation.author?.name || 'Host',
                            title: invitation.title
                        }),
                        invitationId: draftId,
                        actionUrl: `/invitation/private/${draftId}`, // ENFORCE PRIVATE ROUTE
                        createdAt: serverTimestamp(),
                        read: false,
                        fromUserId: invitation.author?.id,
                        fromUserName: invitation.author?.name,
                        fromUserAvatar: getSafeAvatar(invitation.author)
                    });
                });
                await Promise.all(notificationsBatch);
            }

            navigate(`/invitation/private/${draftId}`);
        } catch (error) {
            console.error('Error publishing private invitation:', error);
            alert(t('failed_publish_invitation'));
        } finally {
            setIsPublishing(false);
        }
    };

    if (loading) return <div className="loading-container">{t('loading')}</div>;
    if (!invitation) return null;

    const templateStyles = getTemplateStyle(
        invitation.templateType || 'classic',
        invitation.colorScheme || 'oceanBlue',
        invitation.occasionType
    );

    return (
        <div className={`private-preview-container page-container theme-${(invitation.occasionType || 'social').toLowerCase()}`} style={{ paddingBottom: '120px', position: 'relative' }}>
            {/* Lottie Background Animation */}
            {animationData && (
                <div className="lottie-bg-container" style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: -1,
                    opacity: 0.2, // Slightly more subtle for preview
                    pointerEvents: 'none'
                }}>
                    <Lottie
                        animationData={animationData}
                        loop={true}
                        autoPlay={true}
                        style={{ width: '100%', height: '100%' }}
                        rendererSettings={{ preserveAspectRatio: 'xMidYMid slice' }}
                    />
                </div>
            )}

            {/* Header Control Panel */}
            <div className="preview-sticky-header" style={{ position: 'sticky', top: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(15px)', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderRadius: '0 0 20px 20px' }}>
                <button onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '8px 15px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                    <FaArrowLeft /> {t('back')}
                </button>
                <div style={{ color: 'var(--luxury-gold)', fontWeight: '900', fontSize: '1rem', textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
                    ✨ {t('preview_mode')}
                </div>
            </div>

            <div className="premium-banner-warning" style={{ margin: '15px', padding: '15px', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.3)', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem', backdropFilter: 'blur(5px)' }}>
                <FaExclamationTriangle color="var(--luxury-gold)" size={20} />
                <span style={{ color: 'rgba(255,255,255,0.95)', fontWeight: '600' }}>{t('preview_warning_private')}</span>
            </div>

            {/* Mirror of PrivateInvitationDetails Structure */}
            <div className="private-mock-details" style={{ padding: '0 15px' }}>
                <div className="private-hero-section" style={{ position: 'relative', width: '100%', height: '240px', overflow: 'hidden', borderRadius: '30px', marginBottom: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
                    {(invitation.customImage || invitation.restaurantImage || invitation.image) ? (
                        <img src={invitation.customImage || invitation.restaurantImage || invitation.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(45deg, #1e1b4b, #312e81)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FaLock size={40} color="rgba(255,255,255,0.2)" />
                        </div>
                    )}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, #0a0a0f 100%)' }} />
                </div>

                <div className="reveal-text" style={{ transitionDelay: '0.2s', textAlign: 'center' }}>
                    <h1 style={{
                        fontFamily: templateStyles?.layout?.fontFamily || 'inherit',
                        fontSize: '2rem',
                        fontWeight: '900',
                        color: 'white',
                        marginBottom: '10px',
                        lineHeight: '1.2'
                    }}>
                        {invitation.title}
                    </h1>

                    {invitation.venueName && (
                        <div style={{
                            color: templateStyles?.layout?.accentColor || 'var(--luxury-gold)',
                            fontSize: '1.2rem',
                            fontWeight: '700',
                            marginBottom: '20px',
                            background: 'rgba(255,255,255,0.05)',
                            display: 'inline-block',
                            padding: '5px 15px',
                            borderRadius: '12px'
                        }}>
                            @ {invitation.venueName}
                        </div>
                    )}
                </div>

                <div className="reveal-text" style={{ transitionDelay: '0.4s' }}>
                    <PrivateInvitationInfoGrid invitation={invitation} t={t} />
                </div>

                {invitation.description && (
                    <div className="reveal-text" style={{ transitionDelay: '0.5s', marginBottom: '2rem', background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                        <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.05rem', lineHeight: '1.6' }}>{invitation.description}</p>
                    </div>
                )}
            </div>

            {/* Bottom Controls */}
            <div className="preview-action-bar" style={{ position: 'fixed', bottom: '90px', left: '20px', right: '20px', background: 'rgba(10, 10, 15, 0.95)', padding: '20px', display: 'flex', gap: '12px', borderRadius: '24px', border: '1px solid var(--border-color)', zIndex: 1000, backdropFilter: 'blur(10px)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                <button
                    onClick={() => navigate(`/create-private`, { state: { editInvitation: invitation } })}
                    className="action-btn-outline"
                    style={{ flex: 1, height: '50px', borderRadius: '15px', border: '1px solid var(--border-color)', background: 'transparent', color: 'white', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    disabled={isPublishing}
                >
                    <FaEdit /> {t('edit')}
                </button>
                <button
                    onClick={handlePublish}
                    className="action-btn-primary"
                    style={{ flex: 2, height: '50px', borderRadius: '15px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 8px 16px rgba(139, 92, 246, 0.3)' }}
                    disabled={isPublishing}
                >
                    {isPublishing ? t('publishing') : (
                        <>
                            <FaCheckCircle /> {t('send_invitations')}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default PrivateInvitationPreview;
