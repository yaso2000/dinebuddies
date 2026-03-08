/**
 * exportCanvas.js
 * Standalone export utility — used only by social-creator feature.
 * Delete the entire social-creator folder to remove this.
 */

/**
 * Exports an HTML element as a PNG download.
 * @param {HTMLElement} element - The DOM element to capture
 * @param {string} filename - Download filename (without extension)
 * @param {object} options - html2canvas options
 */
export async function exportAsPNG(element, filename = 'social-post', options = {}) {
    try {
        // Dynamic import — only loaded when user clicks export
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(element, {
            backgroundColor: null,
            scale: 2,            // 2× for high-DPI / print quality
            useCORS: true,
            allowTaint: true,
            logging: false,
            ...options,
        });
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
        return true;
    } catch (err) {
        console.error('[SocialCreator] Export failed:', err);
        return false;
    }
}

/**
 * Exports multiple slides as separate PNG files downloaded sequentially.
 */
export async function exportSlidesAsPNGs(elements, baseName = 'slide') {
    for (let i = 0; i < elements.length; i++) {
        await exportAsPNG(elements[i], `${baseName}-${i + 1}`);
        await new Promise(r => setTimeout(r, 200)); // small delay between downloads
    }
}
