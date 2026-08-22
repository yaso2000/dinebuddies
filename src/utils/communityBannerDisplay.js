import { resolveBusinessCoverImageUrl } from './businessCoverImage';
import { isCommunityBannerVideoUrl } from './communityBannerTemplates';
import {
    buildYoutubeBannerBackgroundSrc,
    hasYoutubeBannerMedia,
    sanitizeYoutubePlaylistId,
    sanitizeYoutubeVideoId,
} from './videoEmbedUtils';

/**
 * Resolved banner media for display — falls back to business cover when no custom banner_url.
 * @param {Record<string, unknown> | null | undefined} banner
 * @param {Record<string, unknown> | null | undefined} businessUser
 */
export function resolveCommunityBannerDisplay(banner, businessUser) {
    const youtubeId = sanitizeYoutubeVideoId(banner?.youtubeId);
    const youtubePlaylistId = sanitizeYoutubePlaylistId(banner?.youtubePlaylistId);
    if (hasYoutubeBannerMedia({ youtubeId, youtubePlaylistId })) {
        const isLive = Boolean(banner?.youtubeLive);
        const isMusic = Boolean(banner?.youtubeMusic);
        return {
            url: '',
            youtubeId,
            youtubePlaylistId,
            youtubeShort: Boolean(banner?.youtubeShort),
            youtubeLive: isLive,
            youtubeMusic: isMusic,
            usesBusinessCover: false,
            isVideo: false,
            isYoutube: true,
            embedSrc: buildYoutubeBannerBackgroundSrc(youtubeId, {
                playlistId: youtubePlaylistId,
                isLive,
                loop: false,
            }),
            hasMedia: true,
        };
    }

    const storedUrl = String(banner?.url || '').trim();
    const businessCover = businessUser
        ? resolveBusinessCoverImageUrl(businessUser, { preferProxy: true })
        : null;
    const url = storedUrl || businessCover || '';
    const usesBusinessCover = !storedUrl && Boolean(businessCover);

    return {
        url,
        youtubeId: '',
        youtubePlaylistId: '',
        youtubeShort: false,
        youtubeLive: false,
        youtubeMusic: false,
        usesBusinessCover,
        isVideo: isCommunityBannerVideoUrl(url),
        isYoutube: false,
        embedSrc: '',
        hasMedia: Boolean(url),
    };
}
