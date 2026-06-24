import manifest from '../data/communityBannerTemplates.manifest.json';

export const COMMUNITY_BANNER_TEMPLATES_BASE = '/community-chat-banner-templates';

/**
 * @typedef {'image' | 'video'} CommunityBannerTemplateKind
 * @typedef {{
 *   id: string;
 *   kind: CommunityBannerTemplateKind;
 *   file: string;
 *   labelKey?: string;
 *   label?: string;
 *   loop?: boolean;
 * }} CommunityBannerTemplate
 */

/** @type {CommunityBannerTemplate[]} */
export const COMMUNITY_BANNER_TEMPLATES = Array.isArray(manifest?.templates)
    ? manifest.templates
    : [];

export function getCommunityBannerTemplatePublicUrl(template) {
    if (!template?.file) return '';
    const folder = template.kind === 'video' ? 'videos' : 'images';
    return `${COMMUNITY_BANNER_TEMPLATES_BASE}/${folder}/${template.file}`;
}

export function isCommunityBannerVideoUrl(url) {
    return /\.(mp4|webm|mov)(\?|$)/i.test(String(url || ''));
}
