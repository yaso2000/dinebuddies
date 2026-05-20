import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaCheck, FaTimes } from 'react-icons/fa';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import PrivateInvitationCardPreview from './privateCard/PrivateInvitationCardPreview';
import { DEFAULT_FRAME_COLOR_ID } from './privateCard/privateCardFrameColors';
import { DEFAULT_FONT_ID } from './privateCard/privateCardFonts';
import { DEFAULT_MOTION_ID } from './privateCard/privateCardMotions';
import { getInvitationCardTextBackdropFromInvitation } from './privateCard/privateCardTextBackdrop';
import {
    getDatingInvitationHeroCoverFromInvitation,
    getPrivateInvitationHeroCoverFromInvitation
} from './datingCard/datingCardBackgrounds';
import { getSafeAvatar } from '../../utils/avatarUtils';
import {
    addInboxClosedInvitationId,
    readInboxClosedInvitationIds
} from '../../utils/invitationInboxSession';
import {
    buildPendingInvitationInboxQueue,
    shouldSuppressInvitationInbox
} from '../../utils/invitationInboxQueue';
import './InvitationInboxOverlay.css';

const SWIPE_THRESHOLD_PX = 52;

/** @param {object} inv @param {Record<string, object>} cache */
function resolveHostProfile(inv, cache) {
    const hostId = inv.authorId || inv.author?.id;
    const cached = hostId ? cache[hostId] : null;
    return {
        name:
            inv.author?.name ||
            inv.authorName ||
            inv.hostName ||
            cached?.display_name ||
            cached?.displayName ||
            cached?.name ||
            '',
        avatarUrl: getSafeAvatar({
            photoURL:
                inv.author?.photo ||
                inv.author?.photoURL ||
                inv.authorAvatarUrl ||
                cached?.photo_url ||
                cached?.photoURL ||
                cached?.avatar,
            display_name: inv.author?.name || cached?.display_name,
            gender: inv.author?.gender || cached?.gender,
            role: inv.author?.role || cached?.role
        })
    };
}

/**
 * Full-screen pending private/dating invitation receiver (swipe queue, accept / decline / later).
 */
export default function InvitationInboxOverlay({
    invitations = [],
    viewerUid,
    pathname = '',
    onRespond,
    enabled = true
}) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [closedIds, setClosedIds] = useState(() => readInboxClosedInvitationIds(viewerUid));
    const [index, setIndex] = useState(0);
    const [responding, setResponding] = useState(false);
    const [slideAnim, setSlideAnim] = useState(null);
    const [hostCache, setHostCache] = useState({});
    const touchStartX = useRef(null);
    const touchStartY = useRef(null);

    useEffect(() => {
        setClosedIds(readInboxClosedInvitationIds(viewerUid));
        setIndex(0);
    }, [viewerUid]);

    const queue = useMemo(
        () => buildPendingInvitationInboxQueue(invitations, viewerUid, closedIds),
        [invitations, viewerUid, closedIds]
    );

    const suppressed = !enabled || shouldSuppressInvitationInbox(pathname);
    const visible = !suppressed && queue.length > 0;

    const safeIndex = Math.min(index, Math.max(0, queue.length - 1));
    const current = queue[safeIndex] || null;

    useEffect(() => {
        if (safeIndex !== index) setIndex(safeIndex);
    }, [safeIndex, index, queue.length]);

    useEffect(() => {
        if (!visible) return undefined;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.body.classList.add('invitation-inbox-open');
        return () => {
            document.body.style.overflow = prevOverflow;
            document.body.classList.remove('invitation-inbox-open');
        };
    }, [visible]);

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

    const goTo = useCallback(
        (nextIndex, anim) => {
            if (queue.length <= 1) return;
            const wrapped =
                ((nextIndex % queue.length) + queue.length) % queue.length;
            setSlideAnim(anim);
            setIndex(wrapped);
            window.setTimeout(() => setSlideAnim(null), 320);
        },
        [queue.length]
    );

    const goNext = useCallback(() => goTo(safeIndex + 1, 'next'), [goTo, safeIndex]);
    const goPrev = useCallback(() => goTo(safeIndex - 1, 'prev'), [goTo, safeIndex]);

    const handleClose = useCallback(() => {
        if (!current?.id) return;
        const next = addInboxClosedInvitationId(viewerUid, current.id, closedIds);
        setClosedIds(next);
        if (safeIndex >= queue.length - 1 && safeIndex > 0) {
            setIndex(Math.max(0, safeIndex - 1));
        }
    }, [current?.id, viewerUid, closedIds, safeIndex, queue.length]);

    const handleAccept = useCallback(async () => {
        if (!current?.id || !onRespond) return;
        setResponding(true);
        try {
            const ok = await onRespond(current.id, 'accepted');
            if (ok) {
                navigate(`/invitation/private/${current.id}`, { replace: true });
            }
        } finally {
            setResponding(false);
        }
    }, [current?.id, onRespond, navigate]);

    const handleDecline = useCallback(async () => {
        if (!current?.id || !onRespond) return;
        setResponding(true);
        try {
            await onRespond(current.id, 'declined');
        } finally {
            setResponding(false);
        }
    }, [current?.id, onRespond]);

    const onTouchStart = (e) => {
        const t = e.touches[0];
        touchStartX.current = t.clientX;
        touchStartY.current = t.clientY;
    };

    const onTouchEnd = (e) => {
        if (touchStartX.current == null || touchStartY.current == null) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStartX.current;
        const dy = t.clientY - touchStartY.current;
        touchStartX.current = null;
        touchStartY.current = null;
        if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return;
        const rtl = i18n.dir() === 'rtl';
        const swipeNext = rtl ? dx > 0 : dx < 0;
        if (swipeNext) goNext();
        else goPrev();
    };

    if (!visible || !current) return null;

    const isDating = current.type === 'Dating';
    const hero =
        isDating
            ? getDatingInvitationHeroCoverFromInvitation(current)
            : getPrivateInvitationHeroCoverFromInvitation(current);
    const backdrop = getInvitationCardTextBackdropFromInvitation(current);
    const host = resolveHostProfile(current, hostCache);
    const themeColor =
        isDating
            ? current.datingCardThemeColor || current.datingCardTextColor
            : current.privateCardThemeColor;
    const showHost =
        isDating
            ? current.datingCardShowHostAndMessage !== false
            : current.privateCardShowHostAndMessage !== false;

    const animClass =
        slideAnim === 'next'
            ? ' invitation-inbox-overlay__card-wrap--anim-next'
            : slideAnim === 'prev'
              ? ' invitation-inbox-overlay__card-wrap--anim-prev'
              : '';

    return createPortal(
        <div
            className={`invitation-inbox-overlay${isDating ? ' invitation-inbox-overlay__dating' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={t('invitation_inbox_aria', { defaultValue: 'Invitation' })}
        >
            <div className="invitation-inbox-overlay__top">
                <span className="invitation-inbox-overlay__progress">
                    {t('invitation_inbox_counter', {
                        defaultValue: '{{current}} / {{total}}',
                        current: safeIndex + 1,
                        total: queue.length
                    })}
                </span>
                {queue.length > 1 && (
                    <div className="invitation-inbox-overlay__dots" aria-hidden>
                        {queue.map((item, i) => (
                            <span
                                key={item.id}
                                className={`invitation-inbox-overlay__dot${
                                    i === safeIndex ? ' invitation-inbox-overlay__dot--active' : ''
                                }`}
                            />
                        ))}
                    </div>
                )}
                <button
                    type="button"
                    className="invitation-inbox-overlay__close"
                    onClick={handleClose}
                    disabled={responding}
                    aria-label={t('close', 'Close')}
                >
                    <FaTimes />
                </button>
            </div>

            <div
                className="invitation-inbox-overlay__card-stage"
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
            >
                <div className={`invitation-inbox-overlay__card-wrap${animClass}`}>
                    <PrivateInvitationCardPreview
                        cardTemplateSet={isDating ? 'dating' : 'private'}
                        className="private-invitation-card-preview--showcase private-invitation-card-preview--inbox"
                        freezeMotion
                        frameColorId={current.cardFrameColorId ?? DEFAULT_FRAME_COLOR_ID}
                        cardThemeColor={themeColor ?? null}
                        cardFontId={current.cardFontId ?? DEFAULT_FONT_ID}
                        cardMotionId={current.cardMotionId ?? DEFAULT_MOTION_ID}
                        occasionType={current.occasionType}
                        cardBackgroundId={current.cardBackgroundId || null}
                        heroCoverSrc={hero?.src ?? null}
                        heroCoverMediaType={hero?.mediaType ?? null}
                        heroCoverPoster={hero?.poster ?? null}
                        title={current.title}
                        description={current.description}
                        date={current.date}
                        time={current.time}
                        location={current.location}
                        inviterName={host.name}
                        inviterAvatarUrl={host.avatarUrl}
                        showHostAndMessage={showHost}
                        textBackdropTone={backdrop.tone}
                    />
                </div>
            </div>

            {queue.length > 1 && (
                <p className="invitation-inbox-overlay__hint">
                    {t('invitation_inbox_swipe_hint', { defaultValue: 'Swipe to see other invitations' })}
                </p>
            )}

            <div className="invitation-inbox-overlay__actions">
                <button
                    type="button"
                    className="invitation-inbox-overlay__btn invitation-inbox-overlay__btn--decline"
                    onClick={handleDecline}
                    disabled={responding}
                >
                    <FaTimes aria-hidden /> {t('decline', 'Decline')}
                </button>
                <button
                    type="button"
                    className="invitation-inbox-overlay__btn invitation-inbox-overlay__btn--later"
                    onClick={handleClose}
                    disabled={responding}
                >
                    {t('later', 'Later')}
                </button>
                <button
                    type="button"
                    className="invitation-inbox-overlay__btn invitation-inbox-overlay__btn--accept"
                    onClick={handleAccept}
                    disabled={responding}
                >
                    <FaCheck aria-hidden /> {t('accept', 'Accept')}
                </button>
            </div>
        </div>,
        document.body
    );
}
