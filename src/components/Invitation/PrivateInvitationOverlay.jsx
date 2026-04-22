import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { FaChevronLeft, FaChevronRight, FaTimes } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useInvitations } from '../../context/InvitationContext';
import { getSafeAvatar } from '../../utils/avatarUtils';
import PrivateInvitationCardPreview from '../Invitations/privateCard/PrivateInvitationCardPreview';
import { DEFAULT_FRAME_COLOR_ID } from '../Invitations/privateCard/privateCardFrameColors';
import { DEFAULT_FONT_ID } from '../Invitations/privateCard/privateCardFonts';

function toMillis(value) {
    if (!value) return 0;
    if (value instanceof Date) return value.getTime();
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    return 0;
}

function getMyRsvp(invitation, uid) {
    if (!uid) return null;
    const rsvp = invitation?.rsvps?.[uid];
    return typeof rsvp === 'string' ? rsvp.toLowerCase() : null;
}

const PrivateInvitationOverlay = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser, isGuest } = useAuth();
    const { respondToPrivateInvitation } = useInvitations();

    const uid = currentUser?.uid || currentUser?.id;
    const [pendingInvitations, setPendingInvitations] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [sessionHiddenIds, setSessionHiddenIds] = useState([]);
    const [touchStartX, setTouchStartX] = useState(null);
    const [touchEndX, setTouchEndX] = useState(null);
    const [isRejecting, setIsRejecting] = useState(false);

    const storageKey = uid ? `private_invites_hidden_session_${uid}` : null;
    const minSwipeDistance = 60;

    useEffect(() => {
        if (!storageKey) {
            setSessionHiddenIds([]);
            return;
        }
        try {
            const raw = sessionStorage.getItem(storageKey);
            const parsed = raw ? JSON.parse(raw) : [];
            setSessionHiddenIds(Array.isArray(parsed) ? parsed : []);
        } catch {
            setSessionHiddenIds([]);
        }
    }, [storageKey]);

    const persistHiddenIds = (next) => {
        setSessionHiddenIds(next);
        if (!storageKey) return;
        try {
            sessionStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
            // ignore session storage failures
        }
    };

    useEffect(() => {
        if (!uid || isGuest) {
            setPendingInvitations([]);
            return;
        }
        const q = query(
            collection(db, 'private_invitations'),
            where('invitedFriends', 'array-contains', uid)
        );
        const unsub = onSnapshot(q, (snapshot) => {
            const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            const pending = rows
                .filter((inv) => inv.status !== 'draft')
                .filter((inv) => !!inv.publishedAt)
                .filter((inv) => {
                    const me = getMyRsvp(inv, uid);
                    return !me || me === 'pending';
                })
                .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
            setPendingInvitations(pending);
        }, (error) => {
            console.error('Private invitation overlay query failed:', error);
            setPendingInvitations([]);
        });
        return () => unsub();
    }, [uid, isGuest]);

    const visibleInvitations = useMemo(
        () => pendingInvitations.filter((inv) => !sessionHiddenIds.includes(inv.id)),
        [pendingInvitations, sessionHiddenIds]
    );

    useEffect(() => {
        if (visibleInvitations.length === 0) {
            setCurrentIndex(0);
            return;
        }
        if (currentIndex >= visibleInvitations.length) {
            setCurrentIndex(visibleInvitations.length - 1);
        }
    }, [visibleInvitations, currentIndex]);

    const shouldHideOverlay =
        !uid ||
        isGuest ||
        location.pathname.startsWith('/login') ||
        location.pathname.startsWith('/auth') ||
        location.pathname.startsWith('/business/login') ||
        location.pathname.startsWith('/business/signup') ||
        location.pathname.startsWith('/invitation/private/');

    if (shouldHideOverlay || visibleInvitations.length === 0) return null;

    const invitation = visibleInvitations[currentIndex];
    if (!invitation) return null;

    const closeForSession = () => {
        const next = Array.from(new Set([...sessionHiddenIds, invitation.id]));
        persistHiddenIds(next);
    };

    const handleReject = async () => {
        if (isRejecting) return;
        setIsRejecting(true);
        try {
            await respondToPrivateInvitation(invitation.id, 'declined');
            closeForSession();
        } finally {
            setIsRejecting(false);
        }
    };

    const handleView = () => {
        closeForSession();
        navigate(`/invitation/private/${invitation.id}`);
    };

    const goPrev = () => {
        setCurrentIndex((prev) => Math.max(0, prev - 1));
    };
    const goNext = () => {
        setCurrentIndex((prev) => Math.min(visibleInvitations.length - 1, prev + 1));
    };

    const onTouchStart = (e) => {
        setTouchEndX(null);
        setTouchStartX(e.targetTouches[0].clientX);
    };
    const onTouchMove = (e) => {
        setTouchEndX(e.targetTouches[0].clientX);
    };
    const onTouchEnd = () => {
        if (touchStartX == null || touchEndX == null) return;
        const delta = touchStartX - touchEndX;
        if (delta > minSwipeDistance) goNext();
        if (delta < -minSwipeDistance) goPrev();
        setTouchStartX(null);
        setTouchEndX(null);
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            style={{
                position: 'fixed',
                inset: 0,
                /* Must exceed .bottom-nav { z-index: 99999 !important } in index.css */
                zIndex: 150000,
                width: '100%',
                minHeight: '100dvh',
                background: 'rgba(8, 8, 14, 0.94)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'stretch',
                justifyContent: 'center'
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            <div
                style={{
                    width: 'min(720px, 100%)',
                    boxSizing: 'border-box',
                    padding: '16px 14px max(20px, env(safe-area-inset-bottom, 0px))',
                    paddingTop: 'max(16px, env(safe-area-inset-top, 0px))',
                    display: 'grid',
                    gridTemplateRows: 'auto minmax(0, 1fr) auto',
                    gap: 14,
                    minHeight: 0
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                        type="button"
                        onClick={closeForSession}
                        aria-label={t('close', 'Close')}
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            border: '1px solid rgba(255,255,255,0.18)',
                            background: 'rgba(255,255,255,0.08)',
                            color: '#fff'
                        }}
                    >
                        <FaTimes />
                    </button>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>
                        {visibleInvitations.length > 1
                            ? `${currentIndex + 1}/${visibleInvitations.length}`
                            : t('private_invitation', 'Private invitation')}
                    </div>
                    <div style={{ width: 40 }} />
                </div>

                <div style={{ display: 'grid', placeItems: 'center', position: 'relative' }}>
                    {visibleInvitations.length > 1 && (
                        <>
                            <button
                                type="button"
                                onClick={goPrev}
                                disabled={currentIndex === 0}
                                style={{
                                    position: 'absolute',
                                    left: 0,
                                    zIndex: 2,
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    border: '1px solid rgba(255,255,255,0.18)',
                                    background: 'rgba(255,255,255,0.08)',
                                    color: '#fff',
                                    opacity: currentIndex === 0 ? 0.45 : 1
                                }}
                            >
                                <FaChevronLeft />
                            </button>
                            <button
                                type="button"
                                onClick={goNext}
                                disabled={currentIndex === visibleInvitations.length - 1}
                                style={{
                                    position: 'absolute',
                                    right: 0,
                                    zIndex: 2,
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    border: '1px solid rgba(255,255,255,0.18)',
                                    background: 'rgba(255,255,255,0.08)',
                                    color: '#fff',
                                    opacity: currentIndex === visibleInvitations.length - 1 ? 0.45 : 1
                                }}
                            >
                                <FaChevronRight />
                            </button>
                        </>
                    )}

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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button
                        type="button"
                        onClick={handleReject}
                        disabled={isRejecting}
                        style={{
                            height: 48,
                            borderRadius: 14,
                            border: '1px solid rgba(255,255,255,0.22)',
                            background: 'rgba(255,255,255,0.08)',
                            color: '#fff',
                            fontWeight: 700
                        }}
                    >
                        {isRejecting ? t('processing', 'Processing') : t('reject_invitation', 'Reject Invitation')}
                    </button>
                    <button
                        type="button"
                        onClick={handleView}
                        style={{
                            height: 48,
                            borderRadius: 14,
                            border: 'none',
                            background: 'var(--primary, #8b5cf6)',
                            color: '#fff',
                            fontWeight: 800
                        }}
                    >
                        {t('view_invitation', 'View Invitation')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PrivateInvitationOverlay;
