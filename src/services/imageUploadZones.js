/**
 * Where an image is uploaded — drives moderation (Vision) vs direct private DM upload.
 */
export const ImageUploadZone = {
    /** 1:1 private conversation only — no Vision moderation */
    PRIVATE_DM: 'social_dm',
    /** Community chat, invitation group chat, any public chat room */
    PUBLIC_CHAT: 'chat_public',
    INVITATION: 'invitation',
    THUMBNAIL: 'thumbnail',
    POST: 'post',
    STORY: 'story',
    AVATAR: 'avatar',
    COVER: 'cover',
    LOGO: 'logo',
    GALLERY: 'gallery',
    MENU: 'menu',
    OFFER: 'offer',
    PREMIUM_OFFER: 'premium_offer',
    BUSINESS: 'business',
    PLACE: 'place',
    FEATURED: 'featured',
};

/** @param {string} zone */
export function isPrivateDmZone(zone) {
    return zone === ImageUploadZone.PRIVATE_DM;
}

/** @param {string} folder */
export function folderToImageZone(folder, type) {
    if (type === 'thumbnail') return ImageUploadZone.THUMBNAIL;
    switch (folder) {
        case 'invitations':
            return ImageUploadZone.INVITATION;
        case 'businesses':
        case 'business_photos':
            return ImageUploadZone.BUSINESS;
        case 'stories':
            return ImageUploadZone.STORY;
        case 'community-posts':
            return ImageUploadZone.POST;
        default:
            return ImageUploadZone.INVITATION;
    }
}
