/**
 * OpenAI Images API — first plugged-in image provider.
 */

const functions = require('firebase-functions');
const { ImageProviderError } = require('./ImageProviderError');

const OPENAI_GENERATIONS_URL = 'https://api.openai.com/v1/images/generations';

class OpenAIImageProvider {
    constructor() {
        this.providerId = 'openai';
    }

    /**
     * @param {{ prompt: string }} req
     * @returns {Promise<{ imageBuffer: Buffer, mimeType: string }>}
     */
    async generateImage(req) {
        const apiKey = process.env.OPENAI_API_KEY;
        const model = process.env.OPENAI_IMAGE_MODEL || 'dall-e-3';
        functions.logger.info('[invitationCards] OpenAIImageProvider.generateImage start', {
            OPENAI_API_KEY_set: Boolean(apiKey && String(apiKey).trim()),
            OPENAI_IMAGE_MODEL: model,
            promptLength: String(req.prompt || '').length
        });

        if (!apiKey) {
            functions.logger.error('[invitationCards] OpenAIImageProvider missing OPENAI_API_KEY');
            throw new ImageProviderError(this.providerId, 'OPENAI_API_KEY is not configured.');
        }

        const prompt = String(req.prompt || '').slice(0, 4000);
        const body = JSON.stringify({
            model,
            prompt,
            n: 1,
            size: '1024x1024',
            response_format: 'b64_json'
        });

        functions.logger.info('[invitationCards] OpenAIImageProvider calling OpenAI images/generations', {
            url: OPENAI_GENERATIONS_URL,
            model
        });

        let res;
        try {
            res = await fetch(OPENAI_GENERATIONS_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`
                },
                body
            });
        } catch (e) {
            const errMsg = e && e.message ? e.message : String(e);
            functions.logger.error('[invitationCards] OpenAIImageProvider fetch failed', {
                error: errMsg,
                name: e && e.name
            });
            throw new ImageProviderError(this.providerId, `Network error: ${errMsg}`);
        }

        const text = await res.text();
        functions.logger.info('[invitationCards] OpenAIImageProvider OpenAI HTTP response', {
            status: res.status,
            ok: res.ok,
            bodyLength: text.length
        });

        if (!res.ok) {
            let detail = text;
            try {
                detail = JSON.parse(text)?.error?.message || text;
            } catch {
                /* ignore */
            }
            const snippet = text.length > 800 ? `${text.slice(0, 800)}…` : text;
            functions.logger.error('[invitationCards] OpenAIImageProvider OpenAI error response', {
                status: res.status,
                detail,
                bodySnippet: snippet
            });
            throw new ImageProviderError(this.providerId, `${res.status} ${detail}`);
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch (parseErr) {
            functions.logger.error('[invitationCards] OpenAIImageProvider JSON parse failed', {
                parseError: parseErr && parseErr.message,
                bodySnippet: text.length > 500 ? `${text.slice(0, 500)}…` : text
            });
            throw new ImageProviderError(this.providerId, 'Invalid JSON from OpenAI images API.');
        }

        const b64 = data?.data?.[0]?.b64_json;
        if (!b64) {
            functions.logger.error('[invitationCards] OpenAIImageProvider no b64_json in response', {
                hasDataArray: Array.isArray(data?.data),
                dataLength: data?.data?.length,
                keys: data ? Object.keys(data) : []
            });
            throw new ImageProviderError(this.providerId, 'No image in OpenAI response.');
        }

        const imageBuffer = Buffer.from(b64, 'base64');
        functions.logger.info('[invitationCards] OpenAIImageProvider success', {
            imageBufferBytes: imageBuffer.length
        });

        return {
            imageBuffer,
            mimeType: 'image/png'
        };
    }
}

module.exports = OpenAIImageProvider;
