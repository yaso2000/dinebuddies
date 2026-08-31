/**
 * Where an image is uploaded — every zone runs Vision Safe Search moderation.
 */
export const ImageUploadZone = {
    /** 1:1 private conversation — moderated (same pipeline as public chat) */
    PRIVATE_DM: 'social_dm',
    /** Community chat, invitation group chat, any public chat room */
    PUBLIC_CHAT: 'chat_public',
    INVITATION: 'invitation',
    THUMBNAIL: 'thumbnail',
    POST: 'post',
    STORY: 'story',
    AVATAR: 'avatar',
    /** Dating-space profile photo — moderated + must contain a human face */
    DATING_PHOTO: 'dating_photo',
    COVER: 'cover',
    LOGO: 'logo',
    GALLERY: 'gallery',
    MENU: 'menu',
    OFFER: 'offer',
    PREMIUM_OFFER: 'premium_offer',
    BUSINESS: 'business',
    PLACE: 'place',
    FEATURED: 'featured',
    /** "Real or AI?" game camera photo — moderated (NSFW), faces allowed */
    REAL_OR_AI_PHOTO: 'realornai_photo',
    /** Reusable AI image-edit input — moderated (NSFW), faces allowed */
    AI_EDIT_INPUT: 'ai_edit_input',
};

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
