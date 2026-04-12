/**
 * Provider-agnostic gateway: delegates image creation to a plugged-in provider, then Storage + Firebase download URL (token).
 */

const crypto = require('crypto');
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { createImageProvider } = require('./providers/createImageProvider');

/**
 * Firebase client-style download URL (metadata token). Avoids GCS V4 signing / iam.serviceAccounts.signBlob on the runtime SA.
 */
function firebaseStorageDownloadUrl(bucketName, objectPath, downloadToken) {
    const encoded = encodeURIComponent(objectPath);
    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media&token=${downloadToken}`;
}

class CardVisualGeneratorGateway {
    /**
     * @param {{ generateImage: function }} [imageProvider] — must return { imageBuffer, mimeType? }
     */
    constructor(imageProvider) {
        this.imageProvider = imageProvider || createImageProvider();
    }

    async generateAndStore({ visualPrompt, userId, draftGroupId, cardId }) {
        const promptLen = String(visualPrompt || '').length;
        functions.logger.info('[invitationCards] CardVisualGeneratorGateway.generateAndStore start', {
            userId,
            draftGroupId,
            cardId,
            visualPromptLength: promptLen
        });

        let imageBuffer;
        let mimeType;
        try {
            const out = await this.imageProvider.generateImage({
                prompt: String(visualPrompt || '')
            });
            imageBuffer = out.imageBuffer;
            mimeType = out.mimeType;
        } catch (e) {
            const name = e && e.name;
            const providerId = e && e.providerId;
            functions.logger.error('[invitationCards] CardVisualGeneratorGateway provider.generateImage failed', {
                error: e && e.message ? e.message : String(e),
                name,
                providerId
            });
            throw e;
        }

        functions.logger.info('[invitationCards] CardVisualGeneratorGateway image from provider', {
            imageBufferBytes: imageBuffer ? imageBuffer.length : 0,
            mimeType: mimeType || 'default'
        });

        const contentType = mimeType || 'image/png';
        const bucket = admin.storage().bucket();
        const path = `invitation_cards/${userId}/${draftGroupId}/${cardId}.png`;
        const file = bucket.file(path);
        const downloadToken = crypto.randomUUID();

        functions.logger.info('[invitationCards] CardVisualGeneratorGateway storage upload', {
            storagePath: path,
            bucketName: bucket.name,
            contentType
        });

        try {
            await file.save(imageBuffer, {
                metadata: {
                    contentType,
                    cacheControl: 'public, max-age=31536000',
                    metadata: {
                        firebaseStorageDownloadTokens: downloadToken
                    }
                }
            });
            functions.logger.info('[invitationCards] CardVisualGeneratorGateway storage upload ok', { storagePath: path });
        } catch (e) {
            const detail = e && e.message ? e.message : String(e);
            const code = e && e.code;
            functions.logger.error('[invitationCards] CardVisualGeneratorGateway storage upload failed', {
                storagePath: path,
                code,
                error: detail,
                stack: e && e.stack
            });
            throw new Error(`CardVisualGeneratorGateway: storage upload failed: ${detail}`);
        }

        const imageUrl = firebaseStorageDownloadUrl(bucket.name, path, downloadToken);
        functions.logger.info('[invitationCards] CardVisualGeneratorGateway download URL built', {
            storagePath: path,
            downloadUrlLength: imageUrl ? imageUrl.length : 0
        });

        return { imageUrl, storagePath: path };
    }
}

module.exports = CardVisualGeneratorGateway;
