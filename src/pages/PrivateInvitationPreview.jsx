import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaEdit, FaCheckCircle, FaExclamationTriangle, FaLock, FaArrowLeft } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import {
    isPrivateInvitationDraft,
    isPrivateInvitationPublished,
    getPrivateInvitationCreatePath,
    getPrivateDraftRecoveryCreatePath,
    rememberPrivateDraftCreateKind,
} from '../utils/privateInvitationDraft';
import { getTemplateStyle } from '../utils/invitationTemplates';
import PrivateInvitationInfoGrid from '../components/Invitation/PrivateInvitationInfoGrid';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import './PrivateInvitation.css';

import Lottie from 'lottie-react';
import { OCCASION_PRESETS } from '../utils/invitationTemplates';
import { getSafeAvatar } from '../utils/avatarUtils';
import PrivateInvitationCardPreview from '../components/Invitations/privateCard/PrivateInvitationCardPreview';
import { DEFAULT_FRAME_COLOR_ID } from '../components/Invitations/privateCard/privateCardFrameColors';
import { DEFAULT_FONT_ID } from '../components/Invitations/privateCard/privateCardFonts';
import { DEFAULT_MOTION_ID } from '../components/Invitations/privateCard/privateCardMotions';
import {
    getDatingInvitationHeroCoverFromInvitation,
    getPrivateInvitationHeroCoverFromInvitation
} from '../components/Invitations/datingCard/datingCardBackgrounds';
import { getInvitationCardTextBackdropFromInvitation } from '../components/Invitations/privateCard/privateCardTextBackdrop';
import { pickPrivateInvitationCoverImageUrl } from '../utils/privateInvitationCoverImage';

const PrivateInvitationPreview = () => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const { id: draftId } = useParams();
    const { publishPrivateInvitationDraft } = useInvitations();

    const [invitation, setInvitation] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [isPublishing, setIsPublishing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [animationData, setAnimationData] = useState(null);

    useEffect(() => {
        let cancelled = false;

        const fetchDraft = async () => {
            if (!draftId) {
                navigate(getPrivateDraftRecoveryCreatePath(), { replace: true });
                return;
            }

            setLoadError(null);
            setLoading(true);

            try {
                await auth.authStateReady();
                if (cancelled) return;

                const invitationRef = doc(db, 'private_invitations', draftId);
                let invitationDoc = await getDoc(invitationRef);
                if (!invitationDoc.exists()) {
                    await new Promise((r) => setTimeout(r, 400));
                    if (cancelled) return;
                    invitationDoc = await getDoc(invitationRef);
                }

                if (!invitationDoc.exists()) {
                    setLoadError('not_found');
                    showToast(t('invitation_not_found') || 'Draft not found', 'error');
                    return;
                }

                const data = invitationDoc.data();
                if (isPrivateInvitationPublished(data)) {
                    navigate(`/invitation/private/${draftId}`, { replace: true });
                    return;
                }
                if (!isPrivateInvitationDraft(data)) {
                    setLoadError('invalid_status');
                    showToast(
                        t('error_loading_draft') || 'Could not open this invitation draft.',
                        'error'
                    );
                    return;
                }

                setInvitation({ id: draftId, ...data });
                rememberPrivateDraftCreateKind(data);
            } catch (error) {
                console.error('Error fetching private draft:', error);
                const code = error?.code || '';
                setLoadError(code === 'permission-denied' ? 'permission' : 'unknown');
                showToast(
                    code === 'permission-denied'
                        ? t('private_draft_permission_denied', {
                              defaultValue: 'Could not open the draft. Sign in again and retry.'
                          })
                        : t('error_loading_draft') || 'Error loading draft',
                    'error'
                );
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchDraft();
        return () => {
            cancelled = true;
        };
    }, [draftId, navigate, showToast, t]);

    useEffect(() => {
        const lottieUrl = invitation
            ? OCCASION_PRESETS[
                  (invitation.occasionType || '').charAt(0).toUpperCase() +
                      (invitation.occasionType || '').slice(1).toLowerCase()
              ]?.lottieUrl
            : null;
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

    const cardHeroCover = useMemo(() => {
        if (!invitation) return null;
        if (invitation.type === 'Dating') return getDatingInvitationHeroCoverFromInvitation(invitation);
        return getPrivateInvitationHeroCoverFromInvitation(invitation);
    }, [invitation]);

    const textBackdrop = useMemo(
        () => (invitation ? getInvitationCardTextBackdropFromInvitation(invitation) : null),
        [invitation]
    );

    const templateStyles = useMemo(() => {
        if (!invitation) return null;
        return getTemplateStyle(
            invitation.templateType || 'classic',
            invitation.colorScheme || 'oceanBlue',
            invitation.occasionType,
            { cardFontFamily: invitation.cardFontFamily }
        );
    }, [invitation]);

    const privateHeroImageSrc = useMemo(
        () => (invitation ? pickPrivateInvitationCoverImageUrl(invitation) : null),
        [invitation]
    );

    const handlePublish = async () => {
        setIsPublishing(true);
        try {
            const publishResult = await publishPrivateInvitationDraft(draftId);
            if (!publishResult?.success) return;
            navigate(`/invitation/private/${draftId}`, { replace: true });
        } catch (error) {
            console.error('Error publishing private invitation:', error);
            showToast(t('failed_publish_invitation'), 'error');
        } finally {
            setIsPublishing(false);
        }
    };

    if (loading) {
        return <div className="loading-container">{t('loading')}</div>;
    }

    if (!invitation) {
        return (
            <div className="page-container" style={{ padding: 24, textAlign: 'center' }}>
                <p style={{ marginBottom: 16, color: 'var(--text-muted)' }}>
                    {loadError === 'permission'
                        ? t('private_draft_permission_denied', {
                              defaultValue: 'Could not open the draft. Sign in again and retry.'
                          })
                        : t('error_loading_draft', { defaultValue: 'Could not load the invitation draft.' })}
                </p>
                <button
                    type="button"
                    className="vip-btn vip-btn-primary"
                    onClick={() => navigate(getPrivateDraftRecoveryCreatePath(), { replace: true })}
                >
                    {t('back_to_create', { defaultValue: 'Back to create invitation' })}
                </button>
            </div>
        );
    }

    return (
        <div
            className={`private-preview-container page-container theme-${(invitation.occasionType || 'social').toLowerCase()}`}
            style={{ paddingBottom: '40px', position: 'relative' }}
        >
            {animationData && (
                <div
                    className="lottie-bg-container"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: -1,
                        opacity: 0.2,
                        pointerEvents: 'none'
                    }}
                >
                    <Lottie
                        animationData={animationData}
                        loop
                        autoPlay
                        style={{ width: '100%', height: '100%' }}
                        rendererSettings={{ preserveAspectRatio: 'xMidYMid slice' }}
                    />
                </div>
            )}

            <div className="preview-sticky-header invitation-preview-chrome__header">
                <button
                    type="button"
                    className="invitation-preview-chrome__back-btn"
                    onClick={() => navigate(-1)}
                >
                    <FaArrowLeft /> {t('back')}
                </button>
                <div className="invitation-preview-chrome__mode-label">
                    ✨ {t('preview_mode')}
                </div>
            </div>

            <div className="premium-banner-warning invitation-preview-chrome__warning">
                <FaExclamationTriangle color="var(--luxury-gold)" size={20} aria-hidden />
                <span className="invitation-preview-chrome__warning-text">
                    {t('preview_warning_private')}
                </span>
            </div>

            <div style={{ padding: '0 15px 20px', display: 'flex', justifyContent: 'center' }}>
                <PrivateInvitationCardPreview
                    className="private-invitation-card-preview--showcase"
                    freezeMotion
                    cardTemplateSet={invitation.type === 'Dating' ? 'dating' : 'private'}
                    frameColorId={invitation.cardFrameColorId ?? DEFAULT_FRAME_COLOR_ID}
                    cardThemeColor={
                        invitation.type === 'Private'
                            ? invitation.privateCardThemeColor ?? null
                            : invitation.datingCardThemeColor ?? invitation.datingCardTextColor ?? null
                    }
                    cardFontId={invitation.cardFontId ?? DEFAULT_FONT_ID}
                    cardMotionId={invitation.cardMotionId ?? DEFAULT_MOTION_ID}
                    occasionType={invitation.occasionType}
                    cardBackgroundId={invitation.cardBackgroundId || null}
                    heroCoverSrc={cardHeroCover?.src ?? null}
                    heroCoverMediaType={cardHeroCover?.mediaType ?? null}
                    heroCoverPoster={cardHeroCover?.poster ?? null}
                    title={invitation.title}
                    description={invitation.description}
                    date={invitation.date}
                    time={invitation.time}
                    location={invitation.location}
                    inviterName={invitation.author?.name || ''}
                    inviterAvatarUrl={getSafeAvatar(invitation.author || {})}
                    showHostAndMessage={
                        invitation.type === 'Dating'
                            ? invitation.datingCardShowHostAndMessage !== false
                            : invitation.type === 'Private'
                              ? invitation.privateCardShowHostAndMessage !== false
                              : true
                    }
                    textBackdropTone={
                        invitation.type === 'Private' || invitation.type === 'Dating'
                            ? textBackdrop?.tone
                            : undefined
                    }
                />
            </div>

            <div className="private-mock-details" style={{ padding: '0 15px' }}>
                <div
                    className="private-hero-section"
                    style={{
                        position: 'relative',
                        width: '100%',
                        height: '240px',
                        overflow: 'hidden',
                        borderRadius: '30px',
                        marginBottom: '25px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
                    }}
                >
                    {privateHeroImageSrc ? (
                        <img
                            src={privateHeroImageSrc}
                            alt=""
                            className="private-hero-img-animated"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : (
                        <div
                            style={{
                                width: '100%',
                                height: '100%',
                                background: 'linear-gradient(45deg, #1e1b4b, #312e81)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <FaLock size={40} className="invitation-preview-chrome__hero-placeholder-icon" aria-hidden />
                        </div>
                    )}
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'linear-gradient(to bottom, transparent 40%, #0a0a0f 100%)'
                        }}
                    />
                </div>

                <div className="reveal-text private-title-heavy reveal-delay-1 invitation-preview-chrome__title-block">
                    <h1
                        className="invitation-preview-chrome__title"
                        style={{
                            fontFamily: templateStyles?.layout?.fontFamily || 'inherit'
                        }}
                    >
                        {invitation.title}
                    </h1>

                    {invitation.venueName && (
                        <div
                            className="invitation-preview-chrome__venue-chip"
                            style={{
                                color: templateStyles?.layout?.accentColor || 'var(--luxury-gold)'
                            }}
                        >
                            @ {invitation.venueName}
                        </div>
                    )}
                </div>

                <div className="reveal-text reveal-delay-2">
                    <PrivateInvitationInfoGrid invitation={invitation} t={t} />
                </div>

                {invitation.description && (
                    <div
                        className="reveal-text premium-glass-card reveal-delay-3"
                        style={{ marginBottom: '2rem', padding: '1.5rem', borderRadius: '24px' }}
                    >
                        <p className="invitation-preview-chrome__description">
                            {invitation.description}
                        </p>
                    </div>
                )}
            </div>

            <div
                className="preview-action-bar premium-glass-card"
                style={{
                    margin: '30px 15px 20px',
                    maxWidth: '640px',
                    marginInline: 'auto',
                    padding: '20px',
                    display: 'flex',
                    gap: '12px',
                    borderRadius: '24px'
                }}
            >
                <button
                    type="button"
                    className="vip-btn ui-btn ui-btn--secondary"
                    onClick={() =>
                        navigate(getPrivateInvitationCreatePath(invitation), {
                            state: { editInvitation: invitation },
                        })
                    }
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
                    {isPublishing ? (
                        t('publishing')
                    ) : (
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
