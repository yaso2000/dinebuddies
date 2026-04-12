/**
 * Typed failure from an image generation backend (OpenAI, future providers, etc.).
 */

class ImageProviderError extends Error {
    /**
     * @param {string} providerId
     * @param {string} message
     */
    constructor(providerId, message) {
        super(message);
        this.name = 'ImageProviderError';
        this.providerId = providerId;
    }
}

module.exports = { ImageProviderError };
