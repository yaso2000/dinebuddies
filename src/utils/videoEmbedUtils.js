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
    return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
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

/** iOS blocks unmuted iframe autoplay unless the user tapped. */
export function shouldMuteEmbedAutoplay() {
    return isIosLikeDevice();
}
