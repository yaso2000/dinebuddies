import {
    DEFAULT_BUSINESS_COVER,
    resolveBusinessCoverImageUrl,
} from './businessCoverImage';
import { isCommunityBannerVideoUrl } from './communityBannerTemplates';
import {
    buildYoutubeBannerBackgroundSrc,
    sanitizeYoutubeVideoId,
} from './videoEmbedUtils';

/**
 * Resolved banner media for display — falls back to business cover when no custom banner_url.
 * @param {{ url?: string; youtubeId?: string } | null | undefined} banner
 * @param {Record<string, unknown> | null | undefined} businessUser
 */
export function resolveCommunityBannerDisplay(banner, businessUser) {
    const youtubeId = sanitizeYoutubeVideoId(banner?.youtubeId);
    if (youtubeId) {
        return {
            url: '',
            youtubeId,
            youtubeShort: Boolean(banner?.youtubeShort),
            usesBusinessCover: false,
            isVideo: false,
            isYoutube: true,
            embedSrc: buildYoutubeBannerBackgroundSrc(youtubeId),
            hasMedia: true,
        };
    }

    const storedUrl = String(banner?.url || '').trim();
    const businessCover =
        resolveBusinessCoverImageUrl(businessUser) || DEFAULT_BUSINESS_COVER;
    const url = storedUrl || businessCover;
    const usesBusinessCover = !storedUrl && Boolean(url);

    return {
        url,
        youtubeId: '',
        youtubeShort: false,
        usesBusinessCover,
        isVideo: isCommunityBannerVideoUrl(url),
        isYoutube: false,
        embedSrc: '',
        hasMedia: Boolean(url),
    };
}
