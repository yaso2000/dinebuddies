import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaUserPlus } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import PrivateInvitationCardPreview from '../components/Invitations/privateCard/PrivateInvitationCardPreview';
import { DEFAULT_FRAME_COLOR_ID } from '../components/Invitations/privateCard/privateCardFrameColors';
import { DEFAULT_FONT_ID } from '../components/Invitations/privateCard/privateCardFonts';
import {
    DEFAULT_CARD_COPY_OFFSET_Y,
    DEFAULT_CARD_COPY_WIDTH_PCT,
    DEFAULT_CARD_COPY_FONT_SCALE,
} from '../components/Invitations/privateCard/privateCardCopyLayout';
import { getPrivateHeroCoverFromMediaData } from '../components/Invitations/datingCard/datingCardBackgrounds';
import {
    buildLoginUrlWithNext,
    buildPrivateInvitationSharePath,
    stashPendingPrivateInviteToken,
} from '../utils/privateInvitationShare';
import '../components/Invitations/privateCard/PrivateInvitationExternalShare.css';
import './PrivateInvitation.css';

function normUid(v) {
    if (v == null || v === '') return '';
    return typeof v === 'string' ? v : String(v);
}

export default function PublicPrivateInvitationJoin() {
    const { token } = useParams();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { currentUser, loading: authLoading } = useAuth();
    const { getPrivateInvitationSharePreview, claimPrivateInvitationShare } = useInvitations();
    const getPreviewRef = useRef(getPrivateInvitationSharePreview);
    const claimRef = useRef(claimPrivateInvitationShare);
    getPreviewRef.current = getPrivateInvitationSharePreview;
    claimRef.current = claimPrivateInvitationShare;

    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState(false);
    const [error, setError] = useState(null);

    const previewFetchKeyRef = useRef(null);
    const claimAttemptedRef = useRef(false);
    const sessionUid = normUid(currentUser?.uid || currentUser?.id);

    const invitePath = useMemo(() => buildPrivateInvitationSharePath(token), [token]);
    const loginHref = useMemo(() => buildLoginUrlWithNext(invitePath), [invitePath]);

    useEffect(() => {
        if (!token) {
            setError('invalid');
            setLoading(false);
            return undefined;
        }

        const fetchKey = String(token);
        if (previewFetchKeyRef.current === fetchKey) return undefined;
        previewFetchKeyRef.current = fetchKey;

        let cancelled = false;
        setLoading(true);
        setError(null);

        getPreviewRef.current(token)
            .then((data) => {
                if (cancelled) return;
                if (!data?.preview) {
                    setError('not_found');
                    return;
                }
                setPreview(data.preview);
            })
            .catch(() => {
                if (!cancelled) setError('not_found');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [token]);

    useEffect(() => {
        if (!token || authLoading || !preview || claimAttemptedRef.current) return undefined;
        if (!sessionUid || sessionUid === 'guest') return undefined;

        claimAttemptedRef.current = true;
        let cancelled = false;
        setClaiming(true);

        claimRef.current(token)
            .then((invitationId) => {
                if (cancelled || !invitationId) return;
                navigate(`/invitation/private/${invitationId}`, { replace: true });
            })
            .catch((err) => {
                if (cancelled) return;
                claimAttemptedRef.current = false;
                console.error('[PublicPrivateInvitationJoin] claim', err);
                showToast(
                    t('private_invite_claim_failed', 'Could not open this invitation. Try again.'),
                    'error'
                );
            })
            .finally(() => {
                if (!cancelled) setClaiming(false);
            });

        return () => {
            cancelled = true;
        };
    }, [token, authLoading, sessionUid, preview, navigate, showToast, t]);

    const heroCover = useMemo(() => {
        if (!preview) return null;
        return getPrivateHeroCoverFromMediaData({
            type: preview.mediaType === 'video' ? 'video' : 'image',
            preview: preview.customImage || preview.videoThumbnail,
            url: preview.customImage,
            publishedUrl: preview.customImage,
            videoThumbnail: preview.videoThumbnail,
        });
    }, [preview]);

    const handleSignUp = () => {
        if (token) stashPendingPrivateInviteToken(token);
        navigate(loginHref);
    };

    if (loading || claiming) {
        return (
            <div className="loading-container public-private-invite-join">
                {claiming
                    ? t('private_invite_opening', 'Opening your invitation…')
                    : t('loading')}
            </div>
        );
    }

    if (error || !preview) {
        return (
            <div className="page-container public-private-invite-join" style={{ textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
                    {t('private_invite_link_invalid', 'This invitation link is invalid or has expired.')}
                </p>
                <button type="button" className="vip-btn vip-btn-primary" onClick={() => navigate('/')}>
                    {t('back_home', 'Back home')}
                </button>
            </div>
        );
    }

    return (
        <div className="public-private-invite-join page-container">
            <div className="public-private-invite-join__card-wrap">
                <PrivateInvitationCardPreview
                    className="private-invitation-card-preview--showcase"
                    cardTemplateSet={preview.type === 'Dating' ? 'dating' : 'private'}
                    frameColorId={preview.cardFrameColorId ?? DEFAULT_FRAME_COLOR_ID}
                    cardThemeColor={preview.privateCardThemeColor ?? null}
                    cardFontId={preview.cardFontId ?? DEFAULT_FONT_ID}
                    copyOffsetY={preview.cardCopyOffsetY ?? DEFAULT_CARD_COPY_OFFSET_Y}
                    copyWidthPct={preview.cardCopyWidthPct ?? DEFAULT_CARD_COPY_WIDTH_PCT}
                    copyFontScale={preview.cardCopyFontScale ?? DEFAULT_CARD_COPY_FONT_SCALE}
                    freezeMotion
                    occasionType={preview.occasionType}
                    cardBackgroundId={preview.cardBackgroundId || null}
                    cardGradientId={preview.cardGradientId || null}
                    heroCoverSrc={heroCover?.src ?? null}
                    heroCoverMediaType={heroCover?.mediaType ?? null}
                    heroCoverPoster={heroCover?.poster ?? null}
                    title={preview.title}
                    description={preview.description}
                    date={preview.date}
                    time={preview.time}
                    location={preview.location}
                    inviterName={preview.inviterName}
                    showHostAndMessage={preview.privateCardShowHostAndMessage !== false}
                    textBackdropTone={preview.privateCardTextBackdropTone || undefined}
                />
            </div>

            <div className="public-private-invite-join__cta">
                <h2>{t('private_invite_guest_title', 'You are invited!')}</h2>
                <p>
                    {preview.inviterName
                        ? t('private_invite_guest_body_named', {
                              defaultValue:
                                  '{{host}} sent you a private invitation. Create a free account to accept or decline.',
                              host: preview.inviterName,
                          })
                        : t('private_invite_guest_body', {
                              defaultValue:
                                  'Create a free DineBuddies account to accept or decline this invitation.',
                          })}
                </p>
                <button
                    type="button"
                    className="vip-btn vip-btn-primary ui-btn ui-btn--primary"
                    style={{ width: '100%', height: 52, borderRadius: 14, fontWeight: 800 }}
                    onClick={handleSignUp}
                >
                    <FaUserPlus style={{ marginRight: 8 }} aria-hidden />
                    {t('private_invite_sign_up_cta', 'Sign up to respond')}
                </button>
                <button
                    type="button"
                    className="vip-btn ui-btn ui-btn--secondary"
                    style={{
                        width: '100%',
                        height: 46,
                        marginTop: 10,
                        borderRadius: 14,
                        fontWeight: 700,
                    }}
                    onClick={handleSignUp}
                >
                    {t('sign_in', 'Sign in')}
                </button>
            </div>
        </div>
    );
}
