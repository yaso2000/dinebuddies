import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaEye, FaTimes } from 'react-icons/fa';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import SocialInvitationCardPreview from './socialCard/SocialInvitationCardPreview';
import { buildSocialInvitationCardPreviewProps } from './socialCard/buildSocialInvitationCardPreviewProps';
import { getInvitationCardTextBackdropFromInvitation } from './socialCard/socialCardTextBackdrop';
import { getPrivateInvitationHeroCoverFromInvitation } from './privateCard/privateCardBackgrounds';
import { getSocialInvitationHeroCoverFromInvitation } from './socialCard/socialCardBackgrounds';
import { getSafeAvatar } from '../../utils/avatarUtils';
import { getHostedInvitationDetailsPath } from '../../utils/hostedInvitationRoutes';
import {
  buildPendingInvitationInboxQueue,
  normInvitationUid,
  shouldSuppressInvitationInbox } from
'../../utils/invitationInboxQueue';
import { markInviteInboxDismissed } from '../../utils/inviteInboxDismissals';
import './InvitationInboxOverlay.css';
import { AppText } from "../base";

const SWIPE_THRESHOLD_PX = 52;

class InboxCardPreviewBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err) {
    console.error('Invitation inbox card preview:', err);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

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
 * Full-screen pending private/social invite receiver (swipe queue, view / decline / later).
 */
export default function InvitationInboxOverlay({
  invitations = [],
  viewerUid,
  pathname = '',
  onRespond,
  enabled = true,
  extraSuppressed = false
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [closedIds, setClosedIds] = useState(() => new Set());
  const [index, setIndex] = useState(0);
  const [responding, setResponding] = useState(false);
  const [slideAnim, setSlideAnim] = useState(null);
  const [hostCache, setHostCache] = useState({});
  const [sessionUid, setSessionUid] = useState(() =>
  normInvitationUid(auth.currentUser?.uid || viewerUid)
  );
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  useEffect(() => {
    const sync = () =>
    setSessionUid(normInvitationUid(auth.currentUser?.uid || viewerUid));
    sync();
    return auth.onAuthStateChanged(sync);
  }, [viewerUid]);

  useEffect(() => {
    clearInboxClosedInvitationIds(sessionUid);
    setClosedIds(new Set());
    setIndex(0);
  }, [sessionUid]);

  const queue = useMemo(
    () => buildPendingInvitationInboxQueue(invitations, sessionUid, closedIds),
    [invitations, sessionUid, closedIds]
  );

  const suppressed = !enabled || extraSuppressed || shouldSuppressInvitationInbox(pathname);
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
    getDoc(doc(db, 'users', hostId)).
    then((snap) => {
      if (cancelled || !snap.exists()) return;
      setHostCache((prev) =>
      prev[hostId] ? prev : { ...prev, [hostId]: snap.data() }
      );
    }).
    catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [current?.id, current?.authorId, current?.author?.id]);

  const goTo = useCallback(
    (nextIndex, anim) => {
      if (queue.length <= 1) return;
      const wrapped =
      (nextIndex % queue.length + queue.length) % queue.length;
      setSlideAnim(anim);
      setIndex(wrapped);
      window.setTimeout(() => setSlideAnim(null), 320);
    },
    [queue.length]
  );

  const goNext = useCallback(() => goTo(safeIndex + 1, 'next'), [goTo, safeIndex]);
  const goPrev = useCallback(() => goTo(safeIndex - 1, 'prev'), [goTo, safeIndex]);

  useEffect(() => {
    if (!visible) return undefined;
    const onKey = (e) => {
      if (responding) return;
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, responding, goNext, goPrev]);

  const handleClose = useCallback(() => {
    if (!current?.id) return;
    setClosedIds((prev) => {
      const next = new Set(prev);
      next.add(current.id);
      return next;
    });
    if (safeIndex >= queue.length - 1 && safeIndex > 0) {
      setIndex(Math.max(0, safeIndex - 1));
    }
  }, [current?.id, safeIndex, queue.length]);

  const removeFromQueue = useCallback((invitationId) => {
    if (!invitationId) return;
    setClosedIds((prev) => {
      const next = new Set(prev);
      next.add(invitationId);
      return next;
    });
  }, []);

  const restoreToQueue = useCallback((invitationId) => {
    if (!invitationId) return;
    setClosedIds((prev) => {
      if (!prev.has(invitationId)) return prev;
      const next = new Set(prev);
      next.delete(invitationId);
      return next;
    });
  }, []);

  const handleView = useCallback(async () => {
    if (!current?.id) return;
    const id = current.id;
    removeFromQueue(id);
    try {
      if (sessionUid) {
        await markInviteInboxDismissed(sessionUid, id, 'viewed');
      }
    } catch (err) {
      console.error('[InvitationInboxOverlay] dismiss viewed failed', err);
    }
    navigate(getHostedInvitationDetailsPath(current), { replace: true });
  }, [current, navigate, removeFromQueue, sessionUid]);

  const handleDecline = useCallback(async () => {
    if (!current?.id || !onRespond) return;
    const id = current.id;
    removeFromQueue(id);
    setResponding(true);
    try {
      const ok = await onRespond(id, 'declined');
      if (ok) {
        if (sessionUid) {
          await markInviteInboxDismissed(sessionUid, id, 'declined');
        }
      } else {
        restoreToQueue(id);
      }
    } catch (err) {
      console.error('[InvitationInboxOverlay] decline failed', err);
      restoreToQueue(id);
    } finally {
      setResponding(false);
    }
  }, [current?.id, onRespond, removeFromQueue, restoreToQueue, sessionUid]);

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
    if (swipeNext) goNext();else
    goPrev();
  };

  const cardPreviewProps = useMemo(() => {
    if (!current) return null;
    const isDatingCard = current.type === 'Private';
    const hero = isDatingCard ?
    getPrivateInvitationHeroCoverFromInvitation(current) :
    getSocialInvitationHeroCoverFromInvitation(current);
    const backdrop = getInvitationCardTextBackdropFromInvitation(current);
    const host = resolveHostProfile(current, hostCache);
    return buildSocialInvitationCardPreviewProps(current, {
      heroCover: hero,
      inviterName: host.name,
      inviterAvatarUrl: host.avatarUrl,
      textBackdrop: backdrop,
      className: 'social-invitation-card-preview--showcase'
    });
  }, [current, hostCache]);

  if (!visible || !current) return null;

  const isDating = current.type === 'Private';

  const animClass =
  slideAnim === 'next' ?
  ' invitation-inbox-overlay__card-wrap--anim-next' :
  slideAnim === 'prev' ?
  ' invitation-inbox-overlay__card-wrap--anim-prev' :
  '';

  return createPortal(
    <div
      className={`invitation-inbox-overlay${isDating ? ' invitation-inbox-overlay__dating' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('invitation_inbox_aria', { defaultValue: 'Invitation' })}>
      
            <div className="invitation-inbox-overlay__shell">
            <div className="invitation-inbox-overlay__top">
                <AppText as="span" className="invitation-inbox-overlay__progress">
                    {t('invitation_inbox_counter', {
              defaultValue: '{{current}} / {{total}}',
              current: safeIndex + 1,
              total: queue.length
            })}
                </AppText>
                {queue.length > 1 &&
          <div className="invitation-inbox-overlay__dots" aria-hidden>
                        {queue.map((item, i) =>
            <AppText as="span"
            key={item.id}
            className={`invitation-inbox-overlay__dot${
            i === safeIndex ? ' invitation-inbox-overlay__dot--active' : ''}`
            } />

            )}
                    </div>
          }
                <button
            type="button"
            className="invitation-inbox-overlay__close"
            onClick={handleClose}
            disabled={responding}
            aria-label={t('close', 'Close')}>
            
                    <FaTimes />
                </button>
            </div>

            <div
          className="invitation-inbox-overlay__card-stage"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}>
          
                <div className={`invitation-inbox-overlay__card-wrap${animClass}`}>
                    <InboxCardPreviewBoundary
              resetKey={current.id}
              fallback={
              <div className="invitation-inbox-overlay__card-fallback">
                                <AppText as="h2">{current.title || t('invitation', 'Invitation')}</AppText>
                                {current.description ?
                <AppText as="p">{current.description}</AppText> :
                null}
                            </div>
              }>
              
                        {cardPreviewProps ?
              <SocialInvitationCardPreview {...cardPreviewProps} /> :
              null}
                    </InboxCardPreviewBoundary>
                </div>
            </div>

            {queue.length > 1 &&
        <AppText as="p" className="invitation-inbox-overlay__hint">
                    {t('invitation_inbox_swipe_hint', { defaultValue: 'Swipe to see other invitations' })}
                </AppText>
        }

            <div className="invitation-inbox-overlay__actions">
                <button
            type="button"
            className="invitation-inbox-overlay__btn invitation-inbox-overlay__btn--decline"
            onClick={handleDecline}
            disabled={responding}>
            
                    <AppText as="span" className="invitation-inbox-overlay__btn-icon" aria-hidden>
                        <FaTimes />
                    </AppText>
                    <AppText as="span" className="invitation-inbox-overlay__btn-label">
                        {t('decline', 'Decline')}
                    </AppText>
                </button>
                <button
            type="button"
            className="invitation-inbox-overlay__btn invitation-inbox-overlay__btn--later"
            onClick={handleClose}
            disabled={responding}>
            
                    <AppText as="span" className="invitation-inbox-overlay__btn-icon" aria-hidden>
                        ???
                    </AppText>
                    <AppText as="span" className="invitation-inbox-overlay__btn-label">
                        {t('later', 'Later')}
                    </AppText>
                </button>
                <button
            type="button"
            className="invitation-inbox-overlay__btn invitation-inbox-overlay__btn--accept"
            onClick={handleView}
            disabled={responding}>
            
                    <AppText as="span" className="invitation-inbox-overlay__btn-icon" aria-hidden>
                        <FaEye />
                    </AppText>
                    <AppText as="span" className="invitation-inbox-overlay__btn-label">
                        {t('invite_notification_view', 'View')}
                    </AppText>
                </button>
            </div>
            </div>
        </div>,
    document.body
  );
}