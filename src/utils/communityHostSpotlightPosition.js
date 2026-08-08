import { sanitizeBannerAxis, BANNER_TITLE_ZONE_PERCENT } from './communityChatBanner';

export const DEFAULT_HOST_SPOTLIGHT_POS = { x: 50, y: 54 };
export const DEFAULT_HOST_SPOTLIGHT_POS_WITH_TITLE = { x: 50, y: 66 };

/** Safe inset from banner edges (rem). */
export const HOST_SPOTLIGHT_SAFE = {
    top: 0.7,
    bottom: 0.7,
    inline: 0.8,
    inlineEnd: 0.8,
    inlineEndEditable: 3.9,
    titleGap: 0.4,
};

function remPx(valueRem) {
    if (typeof document === 'undefined') return valueRem * 16;
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return valueRem * root;
}

export function resolveHostSpotlightPosition(message, hasTitle = false) {
    const fallback = hasTitle ? DEFAULT_HOST_SPOTLIGHT_POS_WITH_TITLE : DEFAULT_HOST_SPOTLIGHT_POS;
    return {
        x: sanitizeBannerAxis(message?.spotlightX, fallback.x),
        y: hasTitle
            ? sanitizeBannerAxis(
                  message?.spotlightY,
                  fallback.y,
                  BANNER_TITLE_ZONE_PERCENT + 6,
                  94
              )
            : sanitizeBannerAxis(message?.spotlightY, fallback.y),
    };
}

/**
 * Pixel bounds for spotlight center point (client coordinates).
 * @param {{
 *   bannerRect: DOMRect;
 *   bubbleRect: DOMRect;
 *   titleRect?: DOMRect | null;
 *   editable?: boolean;
 * }} params
 */
export function measureHostSpotlightCenterBounds({
    bannerRect,
    bubbleRect,
    titleRect = null,
    editable = false,
    hasTitleZone = false,
}) {
    const safe = HOST_SPOTLIGHT_SAFE;
    const halfW = bubbleRect.width / 2;
    const halfH = bubbleRect.height / 2;

    let minTop = bannerRect.top + remPx(safe.top);
    if (hasTitleZone) {
        minTop = Math.max(
            minTop,
            bannerRect.top + bannerRect.height * (BANNER_TITLE_ZONE_PERCENT / 100) + remPx(safe.titleGap)
        );
    } else if (titleRect && titleRect.height > 0) {
        minTop = Math.max(minTop, titleRect.bottom + remPx(safe.titleGap));
    }

    const maxBottom = bannerRect.bottom - remPx(safe.bottom);
    const inlineEnd = editable ? safe.inlineEndEditable : safe.inlineEnd;
    const minLeft = bannerRect.left + remPx(safe.inline);
    const maxRight = bannerRect.right - remPx(inlineEnd);

    const minCenterX = minLeft + halfW;
    const maxCenterX = maxRight - halfW;
    const minCenterY = minTop + halfH;
    const maxCenterY = maxBottom - halfH;

    return {
        minCenterX: Math.min(minCenterX, maxCenterX),
        maxCenterX: Math.max(minCenterX, maxCenterX),
        minCenterY: Math.min(minCenterY, maxCenterY),
        maxCenterY: Math.max(minCenterY, maxCenterY),
    };
}

export function clientPointToBannerPercent(clientX, clientY, bannerRect) {
    if (!bannerRect?.width || !bannerRect?.height) {
        return { x: 50, y: 50 };
    }
    return {
        x: ((clientX - bannerRect.left) / bannerRect.width) * 100,
        y: ((clientY - bannerRect.top) / bannerRect.height) * 100,
    };
}

export function bannerPercentToClientPoint(x, y, bannerRect) {
    return {
        x: bannerRect.left + (x / 100) * bannerRect.width,
        y: bannerRect.top + (y / 100) * bannerRect.height,
    };
}

export function clampHostSpotlightPercent(
    x,
    y,
    bannerRect,
    bubbleRect,
    titleRect,
    editable,
    hasTitleZone = false
) {
    const point = bannerPercentToClientPoint(x, y, bannerRect);
    const bounds = measureHostSpotlightCenterBounds({
        bannerRect,
        bubbleRect,
        titleRect,
        editable,
        hasTitleZone,
    });

    const clampedX = Math.max(bounds.minCenterX, Math.min(bounds.maxCenterX, point.x));
    const clampedY = Math.max(bounds.minCenterY, Math.min(bounds.maxCenterY, point.y));

    return clientPointToBannerPercent(clampedX, clampedY, bannerRect);
}
