import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { canViewerOpenHostedInvitation, isPendingInviteForUser, uidStr } from './inviteLanding';

const HOSTED_COLLECTIONS = ['social_invitations', 'private_invitations'];

/** Load hosted invite from either Firestore collection. */
export async function loadHostedInvitationById(invitationId) {
    if (!invitationId || typeof invitationId !== 'string') return null;
    for (const coll of HOSTED_COLLECTIONS) {
        try {
            const snap = await getDoc(doc(db, coll, invitationId));
            if (snap.exists()) {
                return { id: snap.id, ...snap.data(), _collection: coll };
            }
        } catch {
            /* try next */
        }
    }
    return null;
}

/**
 * Whether a `social_invitation` notification still points at a pending invite for this user.
 * (Landing / inbox queue only — not for deleting after RSVP.)
 */
export function isActionableSocialInvitationNotification(inv, viewerUid) {
    if (!inv?.id) return false;
    return isPendingInviteForUser(inv, viewerUid);
}

/** Notification still useful as a link to invitation details. */
export function isOpenableSocialInvitationNotification(inv, viewerUid) {
    return canViewerOpenHostedInvitation(inv, viewerUid);
}

export function getNotificationInvitationId(notif) {
    const direct = notif?.invitationId || notif?.metadata?.invitationId || null;
    if (direct && typeof direct === 'string') return direct;

    // Fallback: parse hosted paths written by Cloud Functions / older clients
    // e.g. /invitation/social/{id}, /invitation/private/{id}/chat
    const url = String(notif?.actionUrl || '');
    const match = url.match(
        /\/invitation\/(?:social|private|dating)(?:\/preview)?\/([^/?#]+)/i
    );
    return match?.[1] || null;
}

export function isSocialInvitationNotificationType(notif) {
    const type = String(notif?.type || '');
    return type === 'social_invitation' || type === 'social_invitation_response';
}

/**
 * Stale = invite missing or viewer has no access.
 * Accepted/declined invites stay so the panel link still opens details.
 * @returns {Promise<boolean>} true if notification should be removed
 */
export async function validateSocialInvitationNotification(notif, viewerUid) {
    if (!isSocialInvitationNotificationType(notif)) return false;
    const invId = getNotificationInvitationId(notif);
    if (!invId) return true;
    const inv = await loadHostedInvitationById(invId);
    if (!inv) return true;
    return !canViewerOpenHostedInvitation(inv, viewerUid);
}

/** Batch-evaluate notifications; returns ids that are stale. */
export async function findStaleSocialInvitationNotificationIds(notifications, viewerUid) {
    const uid = uidStr(viewerUid);
    if (!uid || !Array.isArray(notifications)) return [];

    const inviteNotifs = notifications.filter((n) => isSocialInvitationNotificationType(n));
    const stale = [];

    await Promise.all(
        inviteNotifs.map(async (notif) => {
            const isStale = await validateSocialInvitationNotification(notif, uid);
            if (isStale) stale.push({ id: notif.id, collection: notif._collection || 'notifications' });
        })
    );

    return stale;
}
