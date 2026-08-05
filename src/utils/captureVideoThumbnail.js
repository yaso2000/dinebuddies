/**
 * Extract a JPEG thumbnail (object URL) from a short video blob URL.
 */
export function captureVideoThumbnailFromUrl(objectUrl) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.crossOrigin = 'anonymous';
        video.src = objectUrl;

        const cleanup = () => {
            try {
                video.removeAttribute('src');
                video.load();
            } catch {
                /* ignore */
            }
        };

        const fail = (e) => {
            cleanup();
            reject(e);
        };

        video.onerror = () => fail(new Error('video load error'));

        video.onloadeddata = () => {
            try {
                const dur = video.duration;
                const t = Number.isFinite(dur) && dur > 0 ? Math.min(0.2, dur * 0.05) : 0.1;
                video.currentTime = t;
            } catch (e) {
                fail(e);
            }
        };

        video.onseeked = () => {
            try {
                const w = video.videoWidth;
                const h = video.videoHeight;
                if (!w || !h) {
                    fail(new Error('no dimensions'));
                    return;
                }
                const canvas = document.createElement('canvas');
                const tw = 320;
                const th = Math.max(1, Math.round((h / w) * tw));
                canvas.width = tw;
                canvas.height = th;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    fail(new Error('no canvas context'));
                    return;
                }
                ctx.drawImage(video, 0, 0, tw, th);
                canvas.toBlob(
                    (blob) => {
                        cleanup();
                        if (blob) resolve(URL.createObjectURL(blob));
                        else reject(new Error('no blob'));
                    },
                    'image/jpeg',
                    0.82
                );
            } catch (e) {
                fail(e);
            }
        };
    });
}
