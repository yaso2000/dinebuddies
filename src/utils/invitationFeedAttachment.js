/**
 * Serialize a public invitation for attachment on a communityPosts feed item.
 */
export function buildInvitationFeedAttachment(invitation) {
    if (!invitation?.id) return null;
    return {
        id: invitation.id,
        title: invitation.title,
        date: invitation.date,
        time: invitation.time,
        location: invitation.location,
        lat: invitation.lat ?? invitation.coordinates?.lat ?? null,
        lng: invitation.lng ?? invitation.coordinates?.lng ?? null,
        image:
            invitation.videoThumbnail ||
            invitation.image ||
            invitation.restaurantImage ||
            invitation.customImage ||
            null,
        author: invitation.author
            ? {
                  id: invitation.author.id,
                  name: invitation.author.name || invitation.author.display_name,
                  avatar: invitation.author.avatar || invitation.author.photoURL,
              }
            : null,
    };
}
