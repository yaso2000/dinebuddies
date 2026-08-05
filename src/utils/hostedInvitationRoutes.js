import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { resolveInviteCategory } from './inviteCategory';
import { getInvitationDetailsPath } from './socialInvitationDraft';
import { loadHostedInvitationById } from './staleInvitationNotifications';

/** URL segment for hosted invites: `social` (multi-guest) or `private` (1-on-1 personal). */
export function getHostedInvitationSegment(inv) {
    return resolveInviteCategory(inv) === 'private' ? 'private' : 'social';
}

/** Details or preview path when invitation data is already loaded. */
export function getHostedInvitationDetailsPath(inv) {
    return getInvitationDetailsPath(inv);
}

/** Chat room path for a hosted invitation. */
export function getHostedInvitationChatPath(inv) {
    const id = inv?.id;
    if (!id) return '/invitations';
    const segment = getHostedInvitationSegment(inv);
    return `/invitation/${segment}/${id}/chat`;
}

/** Preview path for a hosted draft. */
export function getHostedInvitationPreviewPath(inv) {
    const id = inv?.id;
    if (!id) return '/create-social';
    const segment = getHostedInvitationSegment(inv);
    return `/invitation/${segment}/preview/${id}`;
}

/**
 * Resolve details path when only the Firestore document id is known (notifications, toasts).
 * Falls back to `/invitations` when the document cannot be loaded.
 */
export async function resolveHostedInvitationDetailsPathById(invitationId) {
    if (!invitationId) return '/invitations';
    try {
        const hosted = await loadHostedInvitationById(invitationId);
        if (hosted) {
            return getInvitationDetailsPath(hosted);
        }
        const publicSnap = await getDoc(doc(db, 'invitations', invitationId));
        if (publicSnap.exists()) {
            return `/invitation/${publicSnap.id}`;
        }
    } catch (err) {
        console.error('resolveHostedInvitationDetailsPathById:', err);
    }
    return '/invitations';
}

/** @param {(path: string) => void} navigate */
export async function navigateToHostedInvitationDetails(invitationId, navigate) {
    const path = await resolveHostedInvitationDetailsPathById(invitationId);
    navigate(path);
}
