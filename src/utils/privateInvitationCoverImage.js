import { resolveOccasionCategoryId } from '../components/Invitations/socialCard/socialCardOccasionMap';
import { resolveCardBackgroundUrl } from '../components/Invitations/socialCard/socialCardBackgrounds';
import { getFirstPrivateBackgroundFileUrl } from '../components/Invitations/privateCard/privateCardBackgrounds';

const DEFAULT_ARCHIVE_FALLBACK =
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400';

/**
 * Best HTTPS image for private invitation notifications / hero fallbacks.
 * Prefers still image (custom cover or video thumbnail) over raw video URL.
 */
export function pickPrivateInvitationCoverImageUrl(invitation) {
    if (!invitation || typeof invitation !== 'object') return null;
    const candidates = [
        invitation.cardImageUrl,
        invitation.customImage,
        invitation.videoThumbnail,
        invitation.restaurantImage,
        invitation.image
    ];
    for (const raw of candidates) {
        if (typeof raw !== 'string') continue;
        const url = raw.trim();
        if (/^https:\/\//i.test(url)) return url;
    }
    return null;
}

/** Still image for profile archive / list thumbnails (cover, template, or card export). */
export function pickPrivateInvitationArchiveThumbUrl(invitation) {
    const direct = pickPrivateInvitationCoverImageUrl(invitation);
    if (direct) return direct;
    if (!invitation || typeof invitation !== 'object') return null;

    if (invitation.type === 'Private' && invitation.cardBackgroundId) {
        const datingTpl = getFirstPrivateBackgroundFileUrl(
            invitation.cardBackgroundId,
            invitation.personalInviteCategory || 'dating'
        );
        if (datingTpl) return datingTpl;
    }

    const categoryId = resolveOccasionCategoryId(invitation.occasionType || 'social');
    if (invitation.cardBackgroundId && categoryId) {
        const tpl = resolveCardBackgroundUrl(categoryId, invitation.cardBackgroundId);
        if (tpl && typeof tpl === 'string' && !tpl.startsWith('data:')) return tpl;
    }

    return null;
}

/** @param {object} inv */
export function isPrivateCollectionInvitation(inv) {
    return (
        inv?.privacy === 'private' ||
        inv?.type === 'Social' ||
        inv?.type === 'Private'
    );
}

/** Profile / archive list thumbnail — card cover when available. */
export function getInvitationListThumbSrc(inv, fallback = DEFAULT_ARCHIVE_FALLBACK) {
    if (inv?.isArchived && inv.thumbnailUrl) return inv.thumbnailUrl;
    if (inv?.thumbnailUrl) return inv.thumbnailUrl;
    if (isPrivateCollectionInvitation(inv)) {
        return pickPrivateInvitationArchiveThumbUrl(inv) || fallback;
    }
    return (
        inv?.listThumbnailUrl ||
        inv?.customImage ||
        inv?.restaurantImage ||
        inv?.videoThumbnail ||
        inv?.image ||
        fallback
    );
}
