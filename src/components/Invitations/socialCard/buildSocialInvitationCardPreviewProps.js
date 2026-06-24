import { DEFAULT_FRAME_COLOR_ID } from './socialCardFrameColors';
import { DEFAULT_FONT_ID } from './socialCardFonts';
import {
    DEFAULT_CARD_COPY_OFFSET_Y,
    DEFAULT_CARD_COPY_WIDTH_PCT,
    DEFAULT_CARD_COPY_FONT_SCALE,
} from './socialCardCopyLayout';

/**
 * Shared props for SocialInvitationCardPreview (visible UI + off-screen share capture).
 * @param {object} invitation
 * @param {{
 *   heroCover?: { src?: string | null; mediaType?: string | null; poster?: string | null } | null;
 *   inviterName?: string;
 *   inviterAvatarUrl?: string;
 *   textBackdrop?: { tone?: string } | null;
 *   className?: string;
 * }} [options]
 */
export function buildSocialInvitationCardPreviewProps(invitation, options = {}) {
    const {
        heroCover = null,
        inviterName = '',
        inviterAvatarUrl = '',
        textBackdrop = null,
        className = 'social-invitation-card-preview--showcase',
    } = options;

    const cardTemplateSet = invitation?.type === 'Private' ? 'dating' : 'private';

    return {
        className,
        freezeMotion: true,
        cardTemplateSet,
        frameColorId: invitation?.cardFrameColorId ?? DEFAULT_FRAME_COLOR_ID,
        cardThemeColor:
            invitation?.type === 'Social'
                ? invitation?.socialCardThemeColor ?? null
                : invitation?.privateCardThemeColor ?? invitation?.datingCardTextColor ?? null,
        cardFontId: invitation?.cardFontId ?? DEFAULT_FONT_ID,
        copyOffsetY: invitation?.cardCopyOffsetY ?? DEFAULT_CARD_COPY_OFFSET_Y,
        copyWidthPct: invitation?.cardCopyWidthPct ?? DEFAULT_CARD_COPY_WIDTH_PCT,
        copyFontScale: invitation?.cardCopyFontScale ?? DEFAULT_CARD_COPY_FONT_SCALE,
        occasionType: invitation?.occasionType,
        cardBackgroundId: invitation?.cardBackgroundId || null,
        cardGradientId: invitation?.cardGradientId || null,
        heroCoverSrc: heroCover?.src ?? null,
        heroCoverMediaType: heroCover?.mediaType ?? null,
        heroCoverPoster: heroCover?.poster ?? null,
        title: invitation?.title,
        description: invitation?.description,
        date: invitation?.date,
        time: invitation?.time,
        location: invitation?.location,
        inviterName,
        inviterAvatarUrl,
        showHostAndMessage:
            invitation?.type === 'Private'
                ? invitation?.privateCardShowHostAndMessage !== false
                : invitation?.type === 'Social'
                  ? invitation?.socialCardShowHostAndMessage !== false
                  : true,
        textBackdropTone:
            invitation?.type === 'Social' || invitation?.type === 'Private'
                ? textBackdrop?.tone
                : undefined,
    };
}
