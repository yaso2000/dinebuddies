import imageCompression from 'browser-image-compression';

/**
 * Resize/compress a user-picked image for Gemini multimodal reference (Magic cover).
 * @param {File} file
 * @returns {Promise<{ mimeType: string, dataBase64: string, blob: Blob }>}
 */
export async function prepareMagicCoverReferenceImage(file) {
    if (!file?.type?.startsWith('image/')) {
        const e = new Error('INVALID_IMAGE');
        e.code = 'INVALID_IMAGE';
        throw e;
    }
    const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const compressed = await imageCompression(file, {
        maxSizeMB: 1.25,
        maxWidthOrHeight: 1536,
        useWebWorker: true,
        fileType: outType,
    });
    const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(compressed);
    });
    const m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
    if (!m) {
        const e = new Error('READ_FAILED');
        e.code = 'READ_FAILED';
        throw e;
    }
    const mimeType = m[1];
    const dataBase64 = m[2];
    if (dataBase64.length > 5_500_000) {
        const e = new Error('IMAGE_TOO_LARGE');
        e.code = 'IMAGE_TOO_LARGE';
        throw e;
    }
    return { mimeType, dataBase64, blob: compressed };
}
