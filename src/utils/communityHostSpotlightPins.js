import { extractQuotedFromMessage } from './communityChatReply';
import { sanitizeBannerAxis } from './communityChatBanner';

export const HOST_SPOTLIGHT_DEFAULT_SLOTS = [
    { x: 50, y: 66 },
];

export const HOST_SPOTLIGHT_DEFAULT_SLOTS_NO_TITLE = [
    { x: 50, y: 54 },
];

function messageTimeMs(message) {
    const ts = message?.createdAt;
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.seconds === 'number') return ts.seconds * 1000;
    return 0;
}

function hostMessagesOf(messages, partnerId) {
    return (messages || []).filter((m) => m?.senderId === partnerId);
}

/**
 * Pinned announcement strip (between banner and chat) — `pinned` only.
 */
export function selectPinnedBarMessage(messages, partnerId) {
    const hostMessages = hostMessagesOf(messages, partnerId);
    return hostMessages.find((m) => m.pinned === true) ?? null;
}

/**
 * Banner bubble in the media panel — separate from pin.
 * - Explicit `bannerSpotlight` on a message, or
 * - Latest host message when auto-spotlight is on and not dismissed.
 */
export function selectBannerSpotlightMessage(
    messages,
    partnerId,
    { spotlightDismissed = false, spotlightAuto = false } = {}
) {
    const hostMessages = hostMessagesOf(messages, partnerId);
    if (!hostMessages.length) return null;

    const explicit = hostMessages.find((m) => m.bannerSpotlight === true);
    if (explicit) return explicit;

    if (!spotlightAuto || spotlightDismissed) return null;

    const sorted = [...hostMessages].sort((a, b) => messageTimeMs(a) - messageTimeMs(b));
    return sorted[sorted.length - 1] ?? null;
}

/** @deprecated Use selectPinnedBarMessage or selectBannerSpotlightMessage */
export function selectHostBarMessage(messages, partnerId, options = {}) {
    const pinned = selectPinnedBarMessage(messages, partnerId);
    if (pinned) return { message: pinned, isExplicitPin: true };
    const spotlight = selectBannerSpotlightMessage(messages, partnerId, options);
    if (!spotlight) return null;
    return { message: spotlight, isExplicitPin: spotlight.bannerSpotlight === true };
}

/** @deprecated Use selectBannerSpotlightMessage */
export function selectPinnedHostMessage(messages, partnerId, options = {}) {
    return selectBannerSpotlightMessage(messages, partnerId, options);
}

/** @deprecated */
export function selectHostSpotlightMessages(messages, partnerId, options = {}) {
    const live = selectBannerSpotlightMessage(messages, partnerId, options);
    return {
        live,
        bannerMessages: live ? [live] : [],
    };
}

export function resolveNewHostSpotlightPosition({ hasTitle = false } = {}) {
    const slots = hasTitle ? HOST_SPOTLIGHT_DEFAULT_SLOTS : HOST_SPOTLIGHT_DEFAULT_SLOTS_NO_TITLE;
    const slot = slots[0];
    return {
        x: sanitizeBannerAxis(slot.x),
        y: sanitizeBannerAxis(slot.y),
    };
}

/**
 * @param {Array} messages
 * @param {string} partnerId
 * @param {{ pendingReplyTo?: object | null, isHost?: boolean, spotlightDismissed?: boolean, spotlightAuto?: boolean }} options
 */
export function buildBannerSpotlightViews(messages, partnerId, options = {}) {
    const {
        pendingReplyTo = null,
        isHost = false,
        spotlightDismissed = false,
        spotlightAuto = false,
    } = options;
    const live = selectBannerSpotlightMessage(messages, partnerId, { spotlightDismissed, spotlightAuto });

    const views = live
        ? [
              {
                  message: live,
                  quotedMessage: extractQuotedFromMessage(live),
                  pendingQuoted: null,
                  key: live.id,
              },
          ]
        : [];

    if (isHost && pendingReplyTo && !live) {
        views.push({
            message: null,
            quotedMessage: null,
            pendingQuoted: pendingReplyTo,
            key: `pending-${pendingReplyTo.id}`,
        });
    }

    return views;
}
