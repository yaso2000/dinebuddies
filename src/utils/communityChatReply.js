/** Build Firestore reply metadata from a source chat message. */
export function buildReplyFields(replyTo) {
    if (!replyTo) return {};

    const messageId = replyTo.messageId || replyTo.id;
    if (!messageId) return {};

    return {
        replyToMessageId: messageId,
        replyToText: String(replyTo.text || ''),
        replyToType: replyTo.type || 'text',
        replyToSenderName: String(replyTo.senderName || '').trim(),
        replyToSenderAvatar: String(replyTo.senderAvatar || '').trim(),
        replyToSenderId: String(replyTo.senderId || '').trim(),
    };
}

/** Restore quoted guest message from a host reply document. */
export function extractQuotedFromMessage(message) {
    if (!message?.replyToMessageId) return null;

    return {
        id: message.replyToMessageId,
        text: message.replyToText,
        type: message.replyToType || 'text',
        senderName: message.replyToSenderName,
        senderAvatar: message.replyToSenderAvatar,
        senderId: message.replyToSenderId,
    };
}
