import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaEye, FaTimes } from 'react-icons/fa';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useInvitations } from '../context/InvitationContext';
import {
    dismissInviteLandingSession,
    markInviteLandingAttempted,
    usePendingInvitesForMe,
} from '../hooks/usePendingInvitesForMe';
import { markInviteLandingConsumed } from '../utils/inviteLandingSession';
import SocialInvitationCardPreview from '../components/Invitations/socialCard/SocialInvitationCardPreview';
import { DEFAULT_FRAME_COLOR_ID } from '../components/Invitations/socialCard/socialCardFrameColors';
import { DEFAULT_FONT_ID } from '../components/Invitations/socialCard/socialCardFonts';
import {
    DEFAULT_CARD_COPY_OFFSET_Y,
    DEFAULT_CARD_COPY_WIDTH_PCT,
    DEFAULT_CARD_COPY_FONT_SCALE,
} from '../components/Invitations/socialCard/socialCardCopyLayout';
import { getInvitationCardTextBackdropFromInvitation } from '../components/Invitations/socialCard/socialCardTextBackdrop';
import { getPrivateInvitationHeroCoverFromInvitation } from '../components/Invitations/privateCard/privateCardBackgrounds';
import { getSocialInvitationHeroCoverFromInvitation } from '../components/Invitations/socialCard/socialCardBackgrounds';
import { isPrivateHostedInvitation } from '../utils/inviteCategory';
import { getHostedInvitationDetailsPath } from '../utils/hostedInvitationRoutes';
import { getSafeAvatar } from '../utils/avatarUtils';
import '../components/Invitations/InviteLandingGate.css';

/** Full-screen landing page when an invitee opens the app with a pending invitation. */
export default function InviteReceivedPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { respondToPrivateInvitation } = useInvitations() || {};
    const { pending, synced, canLoad, viewerUid } = usePendingInvitesForMe();

    const [index, setIndex] = useState(0);
    const [responding, setResponding] = useState(false);
    const [hostCache, setHostCache] = useState({});

    const current = pending[index] || pending[0] || null;

    useEffect(() => {
        markInviteLandingAttempted();
        if (viewerUid) markInviteLandingConsumed(viewerUid);
    }, [viewerUid]);

    useEffect(() => {
        if (!synced || !canLoad) return;
        if (pending.length > 0) return;

        const timer = window.setTimeout(() => {
            dismissInviteLandingSession();
            navigate('/posts-feed', { replace: true });
        }, 900);

        return () => window.clearTimeout(timer);
    }, [synced, canLoad, pending.length, navigate]);

    useEffect(() => {
        if (index >= pending.length && pending.length > 0) {
            setIndex(0);
        }
    }, [index, pending.length]);

    useEffect(() => {
        if (!current) return;
        const hostId = current.authorId || current.author?.id;
        if (!hostId) return;

        let cancelled = false;
        getDoc(doc(db, 'users', hostId))
            .then((snap) => {
                if (cancelled || !snap.exists()) return;
                setHostCache((prev) =>
                    prev[hostId] ? prev : { ...prev, [hostId]: snap.data() }
                );
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [current?.id, current?.authorId, current?.author?.id]);

    const goFeed = useCallback(() => {
        dismissInviteLandingSession();
        navigate('/posts-feed', { replace: true });
    }, [navigate]);

    const handleLater = useCallback(() => {
        dismissInviteLandingSession();
        goFeed();
    }, [goFeed]);

    const handleView = useCallback(() => {
        if (!current?.id) return;
        dismissInviteLandingSession();
        navigate(getHostedInvitationDetailsPath(current), { replace: true });
    }, [current, navigate]);

    const handleDecline = useCallback(async () => {
        if (!current?.id || typeof respondToPrivateInvitation !== 'function') return;
        setResponding(true);
        try {
            await respondToPrivateInvitation(current.id, 'declined');
            if (pending.length <= 1) {
                goFeed();
            } else {
                setIndex((i) => Math.min(i, pending.length - 2));
            }
        } finally {
            setResponding(false);
        }
    }, [current?.id, respondToPrivateInvitation, pending.length, goFeed]);

    if (!synced || !canLoad || !current) {
        return (
            <div className="invite-landing" aria-busy="true">
                <div className="invite-landing__card-stage" />
            </div>
        );
    }

    const isPrivateInvite = isPrivateHostedInvitation(current);
    const hero = isPrivateInvite
        ? getPrivateInvitationHeroCoverFromInvitation(current)
        : getSocialInvitationHeroCoverFromInvitation(current);
    const backdrop = getInvitationCardTextBackdropFromInvitation(current);
    const hostId = current.authorId || current.author?.id;
    const cached = hostId ? hostCache[hostId] : null;
    const hostName =
        current.author?.name ||
        current.authorName ||
        cached?.display_name ||
        cached?.displayName ||
        '';
    const hostAvatar = getSafeAvatar({
        photoURL:
            current.author?.photo ||
            current.author?.photoURL ||
            cached?.photo_url ||
            cached?.photoURL,
        display_name: hostName,
        gender: current.author?.gender || cached?.gender,
        role: current.author?.role || cached?.role,
    });
    const themeColor = isPrivateInvite
        ? current.privateCardThemeColor || current.datingCardTextColor
        : current.socialCardThemeColor;
    const showHost = isPrivateInvite
        ? current.privateCardShowHostAndMessage !== false
        : current.socialCardShowHostAndMessage !== false;

    return (
        <div className="invite-landing" role="main">
            <div className="invite-landing__top">
                <button
                    type="button"
                    className="invite-landing__close"
                    onClick={handleLater}
                    disabled={responding}
                    aria-label={t('close', 'Close')}
                >
                    <FaTimes />
                </button>
            </div>

            <div className="invite-landing__card-stage">
                <div className="invite-landing__card-wrap">
                    <SocialInvitationCardPreview
                        cardTemplateSet={isPrivateInvite ? 'dating' : 'private'}
                        className="social-invitation-card-preview--showcase social-invitation-card-preview--landing"
                        freezeMotion
                        frameColorId={current.cardFrameColorId ?? DEFAULT_FRAME_COLOR_ID}
                        cardThemeColor={themeColor ?? null}
                        cardFontId={current.cardFontId ?? DEFAULT_FONT_ID}
                        copyOffsetY={current.cardCopyOffsetY ?? DEFAULT_CARD_COPY_OFFSET_Y}
                        copyWidthPct={current.cardCopyWidthPct ?? DEFAULT_CARD_COPY_WIDTH_PCT}
                        copyFontScale={current.cardCopyFontScale ?? DEFAULT_CARD_COPY_FONT_SCALE}
                        occasionType={current.occasionType}
                        cardBackgroundId={current.cardBackgroundId || null}
                        cardGradientId={current.cardGradientId || null}
                        heroCoverSrc={hero?.src ?? null}
                        heroCoverMediaType={hero?.mediaType ?? null}
                        heroCoverPoster={hero?.poster ?? null}
                        title={current.title}
                        description={current.description}
                        date={current.date}
                        time={current.time}
                        location={current.location}
                        inviterName={hostName}
                        inviterAvatarUrl={hostAvatar}
                        showHostAndMessage={showHost}
                        textBackdropTone={backdrop.tone}
                    />
                </div>
            </div>

            <div className="invite-landing__actions">
                <div className="invite-landing__actions-inner">
                    <button
                        type="button"
                        className="invite-landing__btn invite-landing__btn--decline"
                        onClick={handleDecline}
                        disabled={responding}
                    >
                        <FaTimes aria-hidden /> {t('decline', 'Decline')}
                    </button>
                    <button
                        type="button"
                        className="invite-landing__btn invite-landing__btn--later"
                        onClick={handleLater}
                        disabled={responding}
                    >
                        {t('later', 'Later')}
                    </button>
                    <button
                        type="button"
                        className="invite-landing__btn invite-landing__btn--accept"
                        onClick={handleView}
                        disabled={responding}
                    >
                        <FaEye aria-hidden /> {t('invite_notification_view', 'View')}
                    </button>
                </div>
            </div>
        </div>
    );
}
