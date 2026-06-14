import html2canvas from 'html2canvas';

/**
 * Capture a DOM node (invitation card preview) as PNG for sharing.
 * @param {HTMLElement | null} element
 * @returns {Promise<Blob | null>}
 */
export async function captureElementAsPngBlob(element) {
    if (!element || typeof element !== 'object') return null;

    if (typeof document !== 'undefined' && document.fonts?.ready) {
        try {
            await document.fonts.ready;
        } catch {
            /* ignore */
        }
    }

    try {
        element.scrollIntoView({ block: 'center', behavior: 'instant' });
    } catch {
        /* ignore */
    }

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise((resolve) => setTimeout(resolve, 80));

    const scale = Math.min(3, Math.max(2, typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2));

    const canvas = await html2canvas(element, {
        scale,
        useCORS: true,
        allowTaint: false,
        backgroundColor: null,
        logging: false,
        imageTimeout: 15000,
    });

    return await new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png', 1);
    });
}

/**
 * @param {HTMLElement | null} element
 * @param {string} filename
 * @returns {Promise<File | null>}
 */
export async function captureElementAsPngFile(element, filename = 'dinebuddies-invitation.png') {
    const blob = await captureElementAsPngBlob(element);
    if (!blob) return null;
    return new File([blob], filename, { type: 'image/png', lastModified: Date.now() });
}
