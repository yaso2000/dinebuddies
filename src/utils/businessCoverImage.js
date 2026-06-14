import { pickSafeDisplayImageUrl } from './avatarUtils';
import { resolveApiUrl } from './resolveApiUrl';

/** Neutral restaurant cover when no persisted image exists. */
export const DEFAULT_BUSINESS_COVER =
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80';

/**
 * Stable server proxy for Google-imported business covers (reads Firebase Storage by placeId).
 * @param {string} placeId
 */
export function businessCoverProxyUrl(placeId) {
    const id = String(placeId || '').trim();
    if (!id) return null;
    return resolveApiUrl(`/api/business/cover-image?placeId=${encodeURIComponent(id)}`);
}

/**
 * Resolve cover URL for business cards and profile hero.
 * Returns direct persisted URLs only — falls back to placeholder on img error.
 * @param {Record<string, unknown> | null | undefined} business
 * @param {{ preferProxy?: boolean }} [opts]
 */
export function resolveBusinessCoverImageUrl(business, opts = {}) {
    if (!business || typeof business !== 'object') return null;

    const bi =
        business.businessInfo && typeof business.businessInfo === 'object'
            ? business.businessInfo
            : {};

    const placeId = String(
        business.uid || business.id || business._profileDocId || business.googlePlaceId || '',
    ).trim();

    const direct = pickSafeDisplayImageUrl(
        bi.coverImage,
        business.coverImage,
        business.photo_url,
        business.avatarUrl,
        business.avatar,
        business.image,
        bi.photo_url,
    );

    if (direct) return direct;

    if (opts.preferProxy && placeId) {
        const hasStoragePath = Boolean(
            String(business.coverImageStoragePath || bi.coverImageStoragePath || '').trim(),
        );
        const isImported =
            business.isVirtual === true ||
            business._sourceCollection === 'restaurants' ||
            business.sourceCollection === 'restaurants' ||
            business.createdBy === 'admin';

        if (hasStoragePath || isImported) {
            return businessCoverProxyUrl(placeId);
        }
    }

    return null;
}

/**
 * img onError chain for business covers: direct URL → API proxy → neutral placeholder.
 * @param {React.SyntheticEvent<HTMLImageElement>} e
 * @param {Record<string, unknown>} businessOrOpts — full business row or `{ coverImage, docId, placeId }`
 * @param {{ onExhausted?: () => void }} [handlers]
 */
export function handleBusinessCoverImageError(e, businessOrOpts, handlers = {}) {
    const img = e?.currentTarget;
    if (!img) return;

    const row = businessOrOpts && typeof businessOrOpts === 'object' ? businessOrOpts : {};
    const isInlineOpts =
        'coverImage' in row || 'docId' in row || 'placeId' in row;

    let direct = '';

    if (isInlineOpts) {
        direct = String(row.coverImage || '').trim();
    } else {
        direct = resolveBusinessCoverImageUrl(row) || '';
    }

    if (direct && img.src !== direct && img.dataset.coverTriedDirect !== '1') {
        img.dataset.coverTriedDirect = '1';
        img.src = direct;
        return;
    }
    if (img.src !== DEFAULT_BUSINESS_COVER) {
        img.src = DEFAULT_BUSINESS_COVER;
    }
    handlers.onExhausted?.();
}

/**
 * Merge owner drafts without wiping cover with empty strings.
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>} drafts
 */
export function mergeBusinessInfoDrafts(base, drafts) {
    if (!drafts || typeof drafts !== 'object') return base || {};
    const merged = { ...(base || {}), ...drafts };
    if (!String(drafts.coverImage || '').trim() && String(base?.coverImage || '').trim()) {
        merged.coverImage = base.coverImage;
    }
    return merged;
}
