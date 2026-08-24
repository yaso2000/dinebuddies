const functions = require('firebase-functions');

/**
 * RETIRED. The business→member personal-chat broadcast has been removed:
 * business↔user communication now happens solely through the Business Inbox
 * (support / offers / announcements) and Stage rooms, keeping personal chat
 * user↔user only.
 *
 * This inert stub replaces the old implementation so the still-deployed
 * `broadcastCommunityMemberMessage` endpoint can no longer write personal-chat
 * DMs. It can be pruned entirely in a future full `firebase deploy --only
 * functions --force`.
 */
function registerCommunityMemberBroadcast(exports) {
    exports.broadcastCommunityMemberMessage = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
        }
        throw new functions.https.HttpsError(
            'failed-precondition',
            'This feature has been retired. Use the Business inbox to send offers and announcements.'
        );
    });
}

module.exports = { registerCommunityMemberBroadcast };
