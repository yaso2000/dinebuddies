import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaEdit, FaCheckCircle, FaExclamationTriangle, FaLock, FaArrowLeft } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getTemplateStyle } from '../utils/invitationTemplates';
import PrivateInvitationInfoGrid from '../components/Invitation/PrivateInvitationInfoGrid';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import './PrivateInvitation.css';

import Lottie from 'lottie-react';
import { OCCASION_PRESETS } from '../utils/invitationTemplates';
import { pickSafeDisplayImageUrl, getSafeAvatar } from '../utils/avatarUtils';
import PrivateInvitationCardPreview from '../components/Invitations/privateCard/PrivateInvitationCardPreview';
import { DEFAULT_FRAME_COLOR_ID } from '../components/Invitations/privateCard/privateCardFrameColors';
import { DEFAULT_FONT_ID } from '../components/Invitations/privateCard/privateCardFonts';

const PrivateInvitationPreview = () => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const { id: draftId } = useParams();
    const { publishPrivateInvitationDraft } = useInvitations();

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
                const invitationRef = doc(db, 'private_invitations', draftId);
                const invitationDoc = await getDoc(invitationRef);

                if (!invitationDoc.exists()) {
                    showToast(t('invitation_not_found') || 'Draft not found', 'error');
                    navigate('/create-private');
                    return;
                }

                const data = invitationDoc.data();
                if (data.status !== 'draft' || data.publishedAt) {
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

    // Optional background animation (skip failed / blocked CDN responses — avoids 403 console noise)
    useEffect(() => {
        const lottieUrl = invitation ? OCCASION_PRESETS[(invitation.occasionType || '').charAt(0).toUpperCase() + (invitation.occasionType || '').slice(1).toLowerCase()]?.lottieUrl : null;
        if (!lottieUrl) return;
        let cancelled = false;
        fetch(lottieUrl, { mode: 'cors' })
            .then((res) => {
                if (!res.ok) return null;
                const ct = res.headers.get('content-type') || '';
                if (!ct.includes('json')) return null;
                return res.json();
            })
            .then((data) => {
                if (!cancelled && data) setAnimationData(data);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [invitation]);

    const handlePublish = async () => {
        setIsPublishing(true);
        try {
            const publishResult = await publishPrivateInvitationDraft(draftId);
            if (!publishResult?.success) return;
            // Invite notifications are created server-side in publishPrivateInvitationDraft (Admin SDK).

            navigate(`/invitation/private/${draftId}`);
        } catch (error) {
            console.error('Error publishing private invitation:', error);
            showToast(t('failed_publish_invitation'), 'error');
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

    const privateHeroImageSrc = pickSafeDisplayImageUrl(
        invitation.customImage,
        invitation.restaurantImage,
        invitation.image
    );

    return (
        <div className={`private-preview-container page-container theme-${(invitation.occasionType || 'social').toLowerCase()}`} style={{ paddingBottom: '40px', position: 'relative' }}>
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

            <div style={{ padding: '0 15px 20px', display: 'flex', justifyContent: 'center' }}>
                <PrivateInvitationCardPreview
                    className="private-invitation-card-preview--showcase"
                    frameColorId={invitation.cardFrameColorId ?? DEFAULT_FRAME_COLOR_ID}
                    cardFontId={invitation.cardFontId ?? DEFAULT_FONT_ID}
                    occasionType={invitation.occasionType}
                    cardBackgroundId={invitation.cardBackgroundId || null}
                    title={invitation.title}
                    description={invitation.description}
                    date={invitation.date}
                    time={invitation.time}
                    location={invitation.location}
                    inviterName={invitation.author?.name || ''}
                    inviterAvatarUrl={getSafeAvatar(invitation.author || {})}
                />
            </div>

            {/* Mirror of PrivateInvitationDetails Structure */}
            <div className="private-mock-details" style={{ padding: '0 15px' }}>
                <div className="private-hero-section" style={{ position: 'relative', width: '100%', height: '240px', overflow: 'hidden', borderRadius: '30px', marginBottom: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
                    {privateHeroImageSrc ? (
                        <img src={privateHeroImageSrc} alt="" className="private-hero-img-animated" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(45deg, #1e1b4b, #312e81)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FaLock size={40} color="rgba(255,255,255,0.2)" />
                        </div>
                    )}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, #0a0a0f 100%)' }} />
                </div>

                <div className="reveal-text private-title-heavy reveal-delay-1" style={{ textAlign: 'center' }}>
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

                <div className="reveal-text reveal-delay-2">
                    <PrivateInvitationInfoGrid invitation={invitation} t={t} />
                </div>

                {invitation.description && (
                    <div className="reveal-text premium-glass-card reveal-delay-3" style={{ marginBottom: '2rem', padding: '1.5rem', borderRadius: '24px' }}>
                        <p style={{ color: 'rgba(255,255,255,0.95)', fontSize: '1.05rem', lineHeight: '1.6' }}>{invitation.description}</p>
                    </div>
                )}
            </div>

            {/* Bottom Controls */}
            <div className="preview-action-bar premium-glass-card" style={{ margin: '30px 15px 20px', maxWidth: '640px', marginInline: 'auto', padding: '20px', display: 'flex', gap: '12px', borderRadius: '24px' }}>
                <button
                    type="button"
                    className="vip-btn ui-btn ui-btn--secondary"
                    onClick={() => navigate(`/create-private`, { state: { editInvitation: invitation } })}
                    style={{ flex: 1, height: '50px', borderRadius: 15 }}
                    disabled={isPublishing}
                >
                    <FaEdit /> {t('edit')}
                </button>
                <button
                    type="button"
                    className="vip-btn vip-btn-primary ui-btn ui-btn--primary"
                    onClick={handlePublish}
                    style={{ flex: 2, height: '50px', borderRadius: 15 }}
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
