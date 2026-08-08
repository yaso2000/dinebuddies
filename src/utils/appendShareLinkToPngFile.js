/**
 * Draw the invite URL on a footer band so messaging apps that drop captions still carry the link.
 * @param {File} file
 * @param {string} shareUrl
 * @returns {Promise<File>}
 */
export async function appendShareLinkToPngFile(file, shareUrl) {
    const url = String(shareUrl || '').trim();
    if (!url || typeof document === 'undefined') {
        return file;
    }

    const bitmap = await createImageBitmap(file);
    const bannerH = Math.max(72, Math.round(bitmap.height * 0.08));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height + bannerH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return file;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);

    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, bitmap.height, canvas.width, bannerH);

    const fontSize = Math.max(18, Math.min(32, Math.floor(bitmap.width / 28)));
    ctx.fillStyle = '#111827';
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const maxWidth = canvas.width - 32;
    let displayUrl = url.replace(/^https?:\/\//, '');
    while (ctx.measureText(displayUrl).width > maxWidth && displayUrl.length > 12) {
        displayUrl = `${displayUrl.slice(0, -4)}…`;
    }

    ctx.fillText(displayUrl, canvas.width / 2, bitmap.height + bannerH / 2, maxWidth);

    const blob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png', 1);
    });
    if (!blob) {
        return file;
    }

    return new File([blob], file.name || 'dinebuddies-invitation.png', {
        type: 'image/png',
        lastModified: Date.now(),
    });
}
