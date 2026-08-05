import html2canvas from 'html2canvas';
import {
    buildInitialsAvatarDataUri,
    isUiAvatarsUrl,
    normalizeAvatarDisplayUrl,
} from './avatarUtils';

const BIDI_MARKS_RE = /[\u2066-\u2069\u202A-\u202E\u200E\u200F]/g;

const SHARE_TEXT_SELECTORS = [
    '.social-invitation-card-preview__title',
    '.social-invitation-card-preview__message',
    '.social-invitation-card-preview__host-chip-name',
    '.social-invitation-card-preview__occasion',
    '.social-invitation-card-preview__host-name',
].join(', ');

const CAPTURE_BG_SELECTORS =
    '.social-invitation-card-preview__bg--image, .social-invitation-card-preview__host-chip-avatar';

function resolveAbsoluteUrl(src) {
    if (!src || typeof src !== 'string') return '';
    if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http')) return src;
    if (typeof window === 'undefined') return src;
    try {
        return new URL(src, window.location.href).href;
    } catch {
        return src;
    }
}

function isSameOriginUrl(url) {
    if (!url || typeof window === 'undefined') return true;
    if (url.startsWith('data:') || url.startsWith('blob:')) return true;
    try {
        const abs = resolveAbsoluteUrl(url);
        return new URL(abs).origin === window.location.origin;
    } catch {
        return true;
    }
}

async function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function fetchUrlAsDataUrl(url) {
    const abs = resolveAbsoluteUrl(url);
    if (!abs || abs.startsWith('data:')) return abs;
    const response = await fetch(abs, { mode: 'cors', credentials: 'omit', cache: 'force-cache' });
    if (!response.ok) throw new Error(`Image fetch failed: ${response.status}`);
    return blobToDataUrl(await response.blob());
}

function loadedImageToDataUrl(img, quality = 0.92) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) throw new Error('Image not decoded');
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
}

async function waitForImage(img) {
    if (img.complete && img.naturalWidth > 0) {
        try {
            await img.decode();
        } catch {
            /* ignore */
        }
        return;
    }
    await new Promise((resolve) => {
        const done = () => resolve(undefined);
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
    });
    if (img.naturalWidth > 0) {
        try {
            await img.decode();
        } catch {
            /* ignore */
        }
    }
}

function replaceUiAvatarsImg(img) {
    const rawSrc = img.getAttribute('src') || img.src || '';
    if (!isUiAvatarsUrl(rawSrc)) return false;
    img.removeAttribute('crossorigin');
    img.src = normalizeAvatarDisplayUrl(rawSrc, img.alt || 'U');
    return true;
}

async function inlineImageSrc(img) {
    const src = img.currentSrc || img.getAttribute('src') || '';
    if (!src || src.startsWith('data:')) return;
    if (replaceUiAvatarsImg(img)) return;

    img.removeAttribute('crossorigin');

    await waitForImage(img);

    if (img.naturalWidth > 0) {
        try {
            img.src = loadedImageToDataUrl(img);
            return;
        } catch {
            /* fall through to fetch */
        }
    }

    try {
        if (isSameOriginUrl(src)) {
            const response = await fetch(resolveAbsoluteUrl(src), { credentials: 'same-origin', cache: 'force-cache' });
            if (!response.ok) throw new Error(`Image fetch failed: ${response.status}`);
            img.src = await blobToDataUrl(await response.blob());
            return;
        }
        img.src = await fetchUrlAsDataUrl(src);
    } catch {
        /* keep original src */
    }
}

async function prepareCaptureImages(element) {
    if (!element?.querySelectorAll) return;

    const images = [...element.querySelectorAll(CAPTURE_BG_SELECTORS), ...element.querySelectorAll('img')];
    const seen = new Set();

    await Promise.all(
        images.map(async (img) => {
            const key = img.currentSrc || img.src || img.getAttribute('src');
            if (!key || seen.has(key)) return;
            seen.add(key);

            if (replaceUiAvatarsImg(img)) return;

            await inlineImageSrc(img);
        })
    );
}

function prepareShareCaptureClone(root) {
    if (!root?.querySelectorAll) return;

    root.querySelectorAll('video').forEach((video) => {
        const poster = video.getAttribute('poster') || video.poster;
        const src = poster || video.getAttribute('src');
        if (!src) return;
        const img = root.ownerDocument.createElement('img');
        img.className = video.className.replace('--video', '--image');
        img.src = src;
        img.alt = '';
        img.setAttribute('draggable', 'false');
        img.style.cssText = video.style.cssText;
        video.replaceWith(img);
    });

    root.querySelectorAll('img').forEach((img) => {
        replaceUiAvatarsImg(img);
        img.removeAttribute('crossorigin');
    });

    root.querySelectorAll(SHARE_TEXT_SELECTORS).forEach((el) => {
        el.style.letterSpacing = '0';
        el.style.wordSpacing = 'normal';
        el.style.fontFamily = "'Cairo', sans-serif";
        el.style.fontFeatureSettings = '"liga" 1, "calt" 1';
        el.style.fontVariantLigatures = 'normal';
        el.style.textRendering = 'optimizeLegibility';
        el.style.webkitFontSmoothing = 'antialiased';

        const clean = String(el.textContent || '').replace(BIDI_MARKS_RE, '').trim();
        if (clean && clean !== el.textContent) {
            el.textContent = clean;
        }

        if (el.tagName === 'H3') {
            const div = root.ownerDocument.createElement('div');
            div.className = el.className;
            div.dir = el.getAttribute('dir') || '';
            if (el.getAttribute('lang')) div.setAttribute('lang', el.getAttribute('lang'));
            div.style.cssText = el.style.cssText;
            div.textContent = el.textContent;
            el.replaceWith(div);
        }
    });
}

/**
 * @param {HTMLElement} element
 * @param {{ format?: 'png' | 'jpeg', quality?: number, scale?: number }} [opts]
 */
async function renderElementToCanvas(element, opts = {}) {
    const isShareExport = element.dataset?.shareExport === 'true';
    const format = opts.format || (isShareExport ? 'jpeg' : 'png');
    const quality = opts.quality ?? (format === 'jpeg' ? 0.88 : 1);
    const scale =
        opts.scale ??
        (isShareExport ? 1 : Math.min(3, Math.max(2, typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2)));

    const exportWidth = element.offsetWidth || element.clientWidth;
    const exportHeight = element.offsetHeight || element.clientHeight;

    const baseOptions = {
        scale,
        width: exportWidth > 0 ? exportWidth : undefined,
        height: exportHeight > 0 ? exportHeight : undefined,
        useCORS: true,
        allowTaint: false,
        backgroundColor: isShareExport ? '#0f172a' : null,
        logging: false,
        imageTimeout: 20000,
        onclone: (_doc, clone) => {
            if (isShareExport) prepareShareCaptureClone(clone);
        },
    };

    return html2canvas(element, baseOptions);
}

/**
 * Capture a DOM node as blob (JPEG for share export, PNG otherwise).
 * @param {HTMLElement | null} element
 * @param {{ forShare?: boolean }} [opts]
 * @returns {Promise<Blob | null>}
 */
export async function captureElementAsPngBlob(element, opts = {}) {
    if (!element || typeof element !== 'object') return null;

    const isShareExport = element.dataset?.shareExport === 'true' || opts.forShare;

    if (typeof document !== 'undefined' && document.fonts?.ready) {
        try {
            await document.fonts.ready;
        } catch {
            /* ignore */
        }
    }

    if (!isShareExport) {
        try {
            element.scrollIntoView({ block: 'center', behavior: 'instant' });
        } catch {
            /* ignore */
        }
    }

    if (isShareExport) {
        await prepareCaptureImages(element);
    } else {
        const images = element.querySelectorAll('img');
        await Promise.all([...images].map((img) => waitForImage(img)));
    }

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise((resolve) => setTimeout(resolve, isShareExport ? 180 : 80));

    const format = isShareExport ? 'jpeg' : 'png';
    const canvas = await renderElementToCanvas(element, {
        format,
        quality: isShareExport ? 0.88 : 1,
        scale: isShareExport ? 1 : undefined,
    });

    return await new Promise((resolve) => {
        canvas.toBlob(
            (blob) => resolve(blob),
            format === 'jpeg' ? 'image/jpeg' : 'image/png',
            format === 'jpeg' ? 0.88 : 1
        );
    });
}

/**
 * @param {HTMLElement | null} element
 * @param {string} filename
 * @param {{ forShare?: boolean }} [opts]
 * @returns {Promise<File | null>}
 */
export async function captureElementAsPngFile(element, filename, opts = {}) {
    const isShareExport = element?.dataset?.shareExport === 'true' || opts.forShare;
    const blob = await captureElementAsPngBlob(element, opts);
    if (!blob) return null;

    const defaultName = isShareExport ? 'dinebuddies-invitation.jpg' : 'dinebuddies-invitation.png';
    const resolvedName = filename || defaultName;
    const mime = blob.type || (isShareExport ? 'image/jpeg' : 'image/png');

    return new File([blob], resolvedName, { type: mime, lastModified: Date.now() });
}

export { buildInitialsAvatarDataUri };
