/** iPhone / iPad / iOS Safari (including iPadOS desktop UA). */
export function isIosLikeDevice() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/i.test(ua)) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

export const YOUTUBE_EMBED_ALLOW =
    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';

const YOUTUBE_ID_RE = '[a-zA-Z0-9_-]{11}';

/**
 * @param {string} input
 * @returns {{ id: string; isShort: boolean } | null}
 */
export function parseYoutubeLink(input) {
    const text = String(input || '').trim();
    if (!text) return null;

    const shortsMatch = text.match(
        new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?youtube\\.com\\/shorts\\/(${YOUTUBE_ID_RE})`, 'i')
    );
    if (shortsMatch?.[1]) {
        return { id: shortsMatch[1], isShort: true };
    }

    const generalMatch = text.match(
        new RegExp(
            `(?:https?:\\/\\/)?(?:www\\.)?(?:youtube\\.com\\/(?:[^\\/\\n\\s]+\\/\\S+\\/|(?:v|e(?:mbed)?)\\/|.*[?&]v=)|youtu\\.be\\/)(${YOUTUBE_ID_RE})`,
            'i'
        )
    );
    if (generalMatch?.[1]) {
        return { id: generalMatch[1], isShort: /youtube\.com\/shorts\//i.test(text) };
    }

    return null;
}

/** @param {{ mediaType?: string; youtubeShort?: boolean; mediaAspect?: string; content?: string; caption?: string } | null | undefined} post */
export function isYoutubeShortPost(post) {
    if (!post || post.mediaType !== 'youtube') return false;
    if (post.youtubeShort === true || post.mediaAspect === '9:16') return true;
    const blob = `${post.content || ''} ${post.caption || ''}`;
    return /youtube\.com\/shorts\/[a-zA-Z0-9_-]{11}/i.test(blob);
}

/** Vertical thumbnail for YouTube Shorts when available. */
export function getYoutubeThumbnailUrl(videoId, { isShort = false } = {}) {
    const id = String(videoId || '').trim();
    if (!id) return '';
    if (isShort) {
        return `https://i.ytimg.com/vi/${id}/oardefault.jpg`;
    }
    return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** Ordered fallbacks when a YouTube thumbnail URL 404s or is blocked. */
export function getYoutubeThumbnailCandidates(videoId, { isShort = false } = {}) {
    const id = String(videoId || '').trim();
    if (!id) return [];
    if (isShort) {
        return [
            `https://i.ytimg.com/vi/${id}/oardefault.jpg`,
            `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        ];
    }
    return [
        `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
        `https://i.ytimg.com/vi/${id}/sddefault.jpg`,
        `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
        `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    ];
}

/**
 * YouTube iframe src tuned for mobile Safari (playsinline required on iOS).
 * @param {string} videoId
 * @param {{ autoplay?: boolean; mute?: boolean }} [opts]
 */
export function buildYoutubeEmbedSrc(videoId, { autoplay = false, mute = false } = {}) {
    const params = new URLSearchParams({
        autoplay: autoplay ? '1' : '0',
        playsinline: '1',
        rel: '0',
        modestbranding: '1',
        controls: '1',
    });
    if (mute) params.set('mute', '1');
    if (typeof window !== 'undefined' && window.location?.origin) {
        params.set('origin', window.location.origin);
    }
    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

/** @param {unknown} ts Firestore Timestamp or ms number */
export function firestoreTimestampToMs(ts) {
    if (ts == null) return 0;
    if (typeof ts === 'number' && Number.isFinite(ts)) return ts;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.seconds === 'number') return ts.seconds * 1000;
    return 0;
}

/** Elapsed seconds since host sync anchor (for member embed `start`). */
export function computeYoutubeMemberStartSec(syncAtMs) {
    const anchor = Number(syncAtMs) || 0;
    if (!anchor) return 0;
    return Math.max(0, Math.floor((Date.now() - anchor) / 1000));
}

const YOUTUBE_MESSAGE_ORIGINS = new Set([
    'https://www.youtube.com',
    'https://www.youtube-nocookie.com',
]);

/** @param {MessageEvent} event */
export function parseYoutubeEmbedMessage(event) {
    if (!YOUTUBE_MESSAGE_ORIGINS.has(event.origin)) return null;
    let data = event.data;
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch {
            return null;
        }
    }
    if (!data || typeof data !== 'object') return null;

    if (data.event === 'onError') {
        return { type: 'error', code: data.info };
    }
    if (data.event === 'onStateChange') {
        return { type: 'state', state: data.info };
    }
    if (data.event === 'infoDelivery' && data.info && typeof data.info === 'object') {
        return { type: 'state', state: data.info.playerState };
    }
    return null;
}

export const YOUTUBE_PLAYER_STATE = {
    UNSTARTED: -1,
    ENDED: 0,
    PLAYING: 1,
    PAUSED: 2,
    BUFFERING: 3,
    CUED: 5,
};

/** Send a command to a YouTube embed iframe (requires `enablejsapi=1`). */
export function postYoutubeEmbedCommand(iframe, func, args = []) {
    const win = iframe?.contentWindow;
    if (!win) return;
    const payload = JSON.stringify({ event: 'command', func, args });
    for (const origin of YOUTUBE_MESSAGE_ORIGINS) {
        try {
            win.postMessage(payload, origin);
        } catch {
            /* ignore cross-origin postMessage failures */
        }
    }
}

/** @param {HTMLIFrameElement | null | undefined} iframe */
export function setYoutubeEmbedMuted(iframe, muted) {
    postYoutubeEmbedCommand(iframe, muted ? 'mute' : 'unMute');
    if (!muted) {
        postYoutubeEmbedCommand(iframe, 'setVolume', [100]);
    }
}

/** Seek and resume — best-effort sync when a member enables sound. */
export function syncYoutubeEmbedPlayback(iframe, startSec = 0) {
    const sec = Math.max(0, Math.floor(Number(startSec) || 0));
    if (sec > 0) {
        postYoutubeEmbedCommand(iframe, 'seekTo', [sec, true]);
    }
    postYoutubeEmbedCommand(iframe, 'playVideo');
}

/** Send listening handshake so postMessage commands reach the embed. */
export function postYoutubeEmbedListening(iframe) {
    const win = iframe?.contentWindow;
    if (!win) return;
    const id = iframe.id || '';
    const payload = JSON.stringify({ event: 'listening', id, channel: 'widget' });
    for (const origin of [...YOUTUBE_MESSAGE_ORIGINS, '*']) {
        try {
            win.postMessage(payload, origin);
        } catch {
            /* ignore */
        }
    }
}

/** Seek member embed to the host sync anchor (recomputed on every call). */
export function syncMemberYoutubeToHost(iframe, syncAtMs) {
    if (!iframe) return;
    const startSec = computeYoutubeMemberStartSec(syncAtMs);
    postYoutubeEmbedListening(iframe);
    postYoutubeEmbedCommand(iframe, 'seekTo', [startSec, true]);
    postYoutubeEmbedCommand(iframe, 'playVideo');
}

/** Reload embed src for member sound toggle (must run inside a user gesture). */
export function applyMemberYoutubeSound(iframe, videoId, syncAtMs, soundOn) {
    if (!iframe || !videoId) return;
    const startSec = computeYoutubeMemberStartSec(syncAtMs);

    if (isIosLikeDevice()) {
        if (!soundOn) {
            iframe.src = buildYoutubeBannerBackgroundSrc(videoId, {
                muted: true,
                controls: false,
                loop: false,
                startSec,
            });
            postYoutubeEmbedListening(iframe);
            return;
        }
        iframe.src = buildYoutubeBannerBackgroundSrc(videoId, {
            muted: false,
            controls: false,
            loop: false,
            startSec,
        });
        postYoutubeEmbedListening(iframe);
        return;
    }

    iframe.src = buildYoutubeBannerBackgroundSrc(videoId, {
        muted: !soundOn,
        controls: false,
        loop: false,
        startSec,
    });
    postYoutubeEmbedListening(iframe);
}

/** Best-effort unmute + sync retries after iframe reload / iOS gesture. */
export function reinforceMemberYoutubeSound(iframe, syncAtMs) {
    if (!iframe) return;

    const run = () => {
        const startSec = computeYoutubeMemberStartSec(syncAtMs);
        postYoutubeEmbedListening(iframe);
        syncYoutubeEmbedPlayback(iframe, startSec);
        setYoutubeEmbedMuted(iframe, false);
    };

    run();

    if (isIosLikeDevice()) {
        requestAnimationFrame(run);
        [150, 400, 900].forEach((ms) => {
            window.setTimeout(run, ms);
        });
        return;
    }

    window.setTimeout(run, 120);
}

/**
 * Background banner embed — autoplay loop for members; host gets controls.
 * @param {string} videoId
 * @param {{ muted?: boolean; controls?: boolean; loop?: boolean; startSec?: number }} [opts]
 */
export function buildYoutubeBannerBackgroundSrc(
    videoId,
    { muted = true, controls = false, loop = true, startSec = 0 } = {}
) {
    const id = String(videoId || '').trim();
    const params = new URLSearchParams({
        autoplay: '1',
        mute: muted ? '1' : '0',
        playsinline: '1',
        controls: controls ? '1' : '0',
        disablekb: controls ? '0' : '1',
        fs: controls ? '1' : '0',
        rel: '0',
        modestbranding: '1',
        iv_load_policy: '3',
        cc_load_policy: '0',
        enablejsapi: '1',
    });
    if (loop) {
        params.set('loop', '1');
        params.set('playlist', id);
    }
    const start = Math.max(0, Math.floor(Number(startSec) || 0));
    if (start > 0) {
        params.set('start', String(start));
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
        params.set('origin', window.location.origin);
    }
    return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

/** @param {string} value */
export function sanitizeYoutubeVideoId(value) {
    const id = String(value || '').trim();
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : '';
}

/** iOS blocks unmuted iframe autoplay unless the user tapped. */
export function shouldMuteEmbedAutoplay() {
    return isIosLikeDevice();
}
