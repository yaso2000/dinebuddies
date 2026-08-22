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

/** @param {string} value */
export function sanitizeYoutubeVideoId(value) {
    const id = String(value || '').trim();
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : '';
}

/**
 * Playlist / mix IDs (PL…, RD…, UU…, OL…, etc.).
 * @param {string} value
 */
export function sanitizeYoutubePlaylistId(value) {
    const id = String(value || '').trim();
    if (!/^[a-zA-Z0-9_-]{10,64}$/.test(id)) return '';
    // Exact 11-char tokens are usually video IDs — allow only known playlist prefixes.
    if (id.length === 11 && !/^(PL|UU|RD|OL|LL|FL|WL)/i.test(id)) return '';
    return id;
}

/**
 * @typedef {{
 *   id: string,
 *   playlistId: string,
 *   isShort: boolean,
 *   isLive: boolean,
 *   isMusic: boolean,
 *   kind: 'video' | 'live' | 'playlist' | 'music',
 * }} ParsedYoutubeLink
 */

/**
 * @param {string} input
 * @returns {ParsedYoutubeLink | null}
 */
export function parseYoutubeLink(input) {
    const text = String(input || '').trim();
    if (!text) return null;

    const isMusicHost = /(?:^|\.)music\.youtube\.com/i.test(text);
    let playlistId = '';
    try {
        const href = /^https?:\/\//i.test(text) ? text : `https://${text}`;
        const url = new URL(href);
        playlistId = sanitizeYoutubePlaylistId(url.searchParams.get('list'));
    } catch {
        const listMatch = text.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
        playlistId = sanitizeYoutubePlaylistId(listMatch?.[1]);
    }

    const liveMatch = text.match(
        new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?youtube\\.com\\/live\\/(${YOUTUBE_ID_RE})`, 'i')
    );
    if (liveMatch?.[1]) {
        return {
            id: liveMatch[1],
            playlistId,
            isShort: false,
            isLive: true,
            isMusic: false,
            kind: 'live',
        };
    }

    const shortsMatch = text.match(
        new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?youtube\\.com\\/shorts\\/(${YOUTUBE_ID_RE})`, 'i')
    );
    if (shortsMatch?.[1]) {
        return {
            id: shortsMatch[1],
            playlistId,
            isShort: true,
            isLive: false,
            isMusic: false,
            kind: 'video',
        };
    }

    const musicWatch = text.match(
        new RegExp(
            `(?:https?:\\/\\/)?(?:music\\.youtube\\.com)\\/(?:watch\\?(?:[^\\s#]*&)?v=|embed\\/)(${YOUTUBE_ID_RE})`,
            'i'
        )
    );
    if (musicWatch?.[1]) {
        return {
            id: musicWatch[1],
            playlistId,
            isShort: false,
            isLive: false,
            isMusic: true,
            kind: playlistId ? 'playlist' : 'music',
        };
    }

    const generalMatch = text.match(
        new RegExp(
            `(?:https?:\\/\\/)?(?:www\\.)?(?:youtube\\.com\\/(?:[^\\/\\n\\s]+\\/\\S+\\/|(?:v|e(?:mbed)?)\\/|.*[?&]v=)|youtu\\.be\\/)(${YOUTUBE_ID_RE})`,
            'i'
        )
    );
    if (generalMatch?.[1]) {
        const id = generalMatch[1];
        const isShort = /youtube\.com\/shorts\//i.test(text);
        const isLive = /[?&]live=1\b/i.test(text) || /\/live\b/i.test(text);
        return {
            id,
            playlistId,
            isShort,
            isLive,
            isMusic: isMusicHost,
            kind: isLive ? 'live' : isMusicHost || playlistId ? (playlistId ? 'playlist' : 'music') : 'video',
        };
    }

    if (playlistId) {
        return {
            id: '',
            playlistId,
            isShort: false,
            isLive: false,
            isMusic: isMusicHost,
            kind: 'playlist',
        };
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

/** Soft drift correction while playing — not a pause/restart. */
export const YOUTUBE_DRIFT_RESYNC_MS = 8000;
/** Only seek when member is off by more than this (seconds). */
export const YOUTUBE_DRIFT_TOLERANCE_SEC = 1.25;
/** Prefer host client wall-clock if within this of server timestamp. */
export const YOUTUBE_SYNC_CLIENT_SKEW_MS = 45_000;

/**
 * Normalize a playback position to whole seconds (Firestore + seekTo).
 * @param {unknown} value
 */
export function normalizeYoutubePositionSec(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
}

/**
 * Resolve sync anchor: prefer host client ms (no serverTimestamp lag), else server.
 * @param {number} serverSyncAtMs
 * @param {number} [clientSyncAtMs]
 */
export function resolveYoutubeSyncAtMs(serverSyncAtMs, clientSyncAtMs = 0) {
    const server = Number(serverSyncAtMs) || 0;
    const client = Number(clientSyncAtMs) || 0;
    if (!client) return server;
    if (!server) return client;
    if (Math.abs(client - server) <= YOUTUBE_SYNC_CLIENT_SKEW_MS) return client;
    return server;
}

/**
 * Member / join-midstream start second.
 * @param {number} syncAtMs
 * @param {{ positionSec?: number; paused?: boolean; isLive?: boolean; nowMs?: number }} [opts]
 */
export function computeYoutubeMemberStartSec(
    syncAtMs,
    { positionSec = 0, paused = false, isLive = false, nowMs } = {}
) {
    if (isLive) return 0;
    const base = normalizeYoutubePositionSec(positionSec);
    if (paused) return base;
    const anchor = Number(syncAtMs) || 0;
    if (!anchor) return base;
    const now = Number.isFinite(nowMs) ? Number(nowMs) : Date.now();
    const elapsed = Math.max(0, Math.floor((now - anchor) / 1000));
    return base + elapsed;
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
        const info = data.info;
        const currentTime =
            typeof info.currentTime === 'number' && Number.isFinite(info.currentTime)
                ? info.currentTime
                : null;
        if (typeof info.playerState === 'number') {
            return { type: 'state', state: info.playerState, currentTime };
        }
        if (currentTime != null) {
            return { type: 'time', currentTime };
        }
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
export function syncYoutubeEmbedPlayback(iframe, startSec = 0, { paused = false } = {}) {
    const sec = normalizeYoutubePositionSec(startSec);
    // Always seek — including 0 — so hard-stop really restarts from the beginning.
    postYoutubeEmbedCommand(iframe, 'seekTo', [sec, true]);
    if (paused) {
        postYoutubeEmbedCommand(iframe, 'pauseVideo');
        return;
    }
    postYoutubeEmbedCommand(iframe, 'playVideo');
}

/**
 * Correct drift without pause/play churn (playing members only).
 * @param {HTMLIFrameElement | null | undefined} iframe
 * @param {number} startSec
 */
export function softSeekYoutubeEmbed(iframe, startSec = 0) {
    const sec = normalizeYoutubePositionSec(startSec);
    postYoutubeEmbedCommand(iframe, 'seekTo', [sec, true]);
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

/**
 * Ask the embed for its real playhead (more accurate than wall-clock on pause).
 * @param {HTMLIFrameElement | null | undefined} iframe
 * @param {number} [timeoutMs]
 * @returns {Promise<number | null>}
 */
export function requestYoutubeEmbedCurrentTime(iframe, timeoutMs = 450) {
    return new Promise((resolve) => {
        if (!iframe?.contentWindow || typeof window === 'undefined') {
            resolve(null);
            return;
        }

        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            window.removeEventListener('message', onMessage);
            resolve(value);
        };

        const onMessage = (event) => {
            const parsed = parseYoutubeEmbedMessage(event);
            if (!parsed) return;
            // Ignore bare 0 from stale infoDelivery — embeds often emit currentTime:0 on buffer.
            if (parsed.type === 'time' && parsed.currentTime != null && parsed.currentTime > 0.25) {
                finish(Math.max(0, parsed.currentTime));
                return;
            }
            if (
                parsed.type === 'state' &&
                parsed.currentTime != null &&
                parsed.currentTime > 0.25
            ) {
                finish(Math.max(0, parsed.currentTime));
            }
        };

        const timer = window.setTimeout(() => finish(null), timeoutMs);
        window.addEventListener('message', onMessage);
        postYoutubeEmbedListening(iframe);
        // Some embeds only answer after a listening + getCurrentTime pair.
        postYoutubeEmbedCommand(iframe, 'getCurrentTime');
        window.setTimeout(() => {
            if (!settled) postYoutubeEmbedCommand(iframe, 'getCurrentTime');
        }, 80);
    });
}

/**
 * Choose a pause freeze second. Prefer wall-clock when the player reports ~0 / nonsense.
 * @param {number} wallSec
 * @param {number | null | undefined} playerSec
 */
export function pickTrustedYoutubePauseSec(wallSec, playerSec) {
    const wall = normalizeYoutubePositionSec(wallSec);
    if (playerSec == null || !Number.isFinite(Number(playerSec))) return wall;
    const player = normalizeYoutubePositionSec(playerSec);
    // Player at ~0 while wall says we are deep into the video → trust wall.
    if (player <= 1 && wall >= 3) return wall;
    // Wild mismatch (player jumped far ahead/behind) → trust wall.
    if (wall >= 2 && Math.abs(player - wall) > 12) return wall;
    return player;
}

/**
 * @param {HTMLIFrameElement | null | undefined} iframe
 * @param {number} syncAtMs
 * @param {{ positionSec?: number; paused?: boolean; isLive?: boolean }} [media]
 */
export function syncMemberYoutubeToHost(iframe, syncAtMs, media = {}) {
    if (!iframe) return;
    const startSec = computeYoutubeMemberStartSec(syncAtMs, media);
    postYoutubeEmbedListening(iframe);
    syncYoutubeEmbedPlayback(iframe, startSec, { paused: Boolean(media.paused) && !media.isLive });
}

/**
 * Toggle member sound. On iOS, prefer JS API (no src reload — remounts stall Safari).
 * @param {HTMLIFrameElement | null | undefined} iframe
 * @param {string} videoId
 * @param {number} syncAtMs
 * @param {boolean} soundOn
 * @param {{ playlistId?: string; isLive?: boolean; paused?: boolean; positionSec?: number }} [media]
 */
export function applyMemberYoutubeSound(iframe, videoId, syncAtMs, soundOn, media = {}) {
    if (!iframe) return;

    // iOS: never rewrite iframe.src for mute toggles — that remounts and often dies.
    if (isIosLikeDevice()) {
        postYoutubeEmbedListening(iframe);
        setYoutubeEmbedMuted(iframe, !soundOn);
        if (soundOn && !(media.paused && !media.isLive)) {
            postYoutubeEmbedCommand(iframe, 'playVideo');
        } else if (!soundOn) {
            /* stay muted; keep playing video */
        } else if (media.paused && !media.isLive) {
            postYoutubeEmbedCommand(iframe, 'pauseVideo');
        }
        return;
    }

    const startSec = computeYoutubeMemberStartSec(syncAtMs, {
        positionSec: media.positionSec,
        paused: media.paused,
        isLive: media.isLive,
    });
    const common = {
        controls: false,
        loop: false,
        startSec,
        playlistId: media.playlistId,
        isLive: media.isLive,
    };

    iframe.src = buildYoutubeBannerBackgroundSrc(videoId, {
        ...common,
        muted: !soundOn,
    });
    postYoutubeEmbedListening(iframe);
    if (media.paused && !media.isLive) {
        window.setTimeout(() => {
            syncYoutubeEmbedPlayback(iframe, startSec, { paused: true });
        }, 200);
    }
}

/**
 * Best-effort unmute after a user gesture.
 * iOS: unmute + play only (no seek storms — they stutter/cut playback).
 * @param {HTMLIFrameElement | null | undefined} iframe
 * @param {number} syncAtMs
 * @param {{ positionSec?: number; paused?: boolean; isLive?: boolean }} [media]
 */
export function reinforceMemberYoutubeSound(iframe, syncAtMs, media = {}) {
    if (!iframe) return;

    if (isIosLikeDevice()) {
        const bump = () => {
            postYoutubeEmbedListening(iframe);
            setYoutubeEmbedMuted(iframe, false);
            if (!(media.paused && !media.isLive)) {
                postYoutubeEmbedCommand(iframe, 'playVideo');
            }
        };
        bump();
        window.setTimeout(bump, 180);
        return;
    }

    const run = () => {
        const startSec = computeYoutubeMemberStartSec(syncAtMs, media);
        postYoutubeEmbedListening(iframe);
        syncYoutubeEmbedPlayback(iframe, startSec, {
            paused: Boolean(media.paused) && !media.isLive,
        });
        if (!(media.paused && !media.isLive)) {
            setYoutubeEmbedMuted(iframe, false);
        }
    };

    run();
    window.setTimeout(run, 120);
}

/**
 * Background banner embed — autoplay for members; host gets controls.
 * Supports single video, live, playlist (+ music.youtube links via same video id).
 * @param {string} videoId
 * @param {{
 *   muted?: boolean;
 *   controls?: boolean;
 *   loop?: boolean;
 *   startSec?: number;
 *   playlistId?: string;
 *   isLive?: boolean;
 * }} [opts]
 */
export function buildYoutubeBannerBackgroundSrc(
    videoId,
    {
        muted = true,
        controls = false,
        loop = true,
        startSec = 0,
        playlistId = '',
        isLive = false,
    } = {}
) {
    const id = sanitizeYoutubeVideoId(videoId);
    const listId = sanitizeYoutubePlaylistId(playlistId);
    const pathId = id || (listId ? 'videoseries' : '');
    if (!pathId) return '';

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

    if (listId) {
        params.set('list', listId);
    }

    // Single-video loop hack — do not override a real playlist `list=`.
    if (loop && id && !listId && !isLive) {
        params.set('loop', '1');
        params.set('playlist', id);
    }

    if (!isLive) {
        const start = Math.max(0, Math.floor(Number(startSec) || 0));
        if (start > 0 && id) {
            params.set('start', String(start));
        }
    }

    if (typeof window !== 'undefined' && window.location?.origin) {
        params.set('origin', window.location.origin);
    }
    return `https://www.youtube.com/embed/${pathId}?${params.toString()}`;
}

/** Whether banner has any YouTube media (video and/or playlist). */
export function hasYoutubeBannerMedia(banner) {
    if (!banner) return false;
    return Boolean(
        sanitizeYoutubeVideoId(banner.youtubeId) ||
            sanitizeYoutubePlaylistId(banner.youtubePlaylistId)
    );
}

/** iOS blocks unmuted iframe autoplay unless the user tapped. */
export function shouldMuteEmbedAutoplay() {
    return isIosLikeDevice();
}
