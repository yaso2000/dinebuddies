/**
 * Selects the image generation backend via INVITATION_CARD_IMAGE_PROVIDER (default: openai).
 */

const functions = require('firebase-functions');
const OpenAIImageProvider = require('./OpenAIImageProvider');

function createImageProvider() {
    const id = (process.env.INVITATION_CARD_IMAGE_PROVIDER || 'openai').toLowerCase().trim();
    functions.logger.info('[invitationCards] createImageProvider', {
        INVITATION_CARD_IMAGE_PROVIDER: id
    });
    if (id === 'openai') {
        return new OpenAIImageProvider();
    }
    functions.logger.error('[invitationCards] createImageProvider unsupported provider', {
        INVITATION_CARD_IMAGE_PROVIDER: id
    });
    throw new Error(`INVITATION_CARD_IMAGE_PROVIDER not supported: ${id}`);
}

module.exports = { createImageProvider };
