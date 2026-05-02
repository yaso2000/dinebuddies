import type { MotionPostPayload } from './validateMotionPost';
import {
    EVENT_TEMPLATE_IDS,
    SPECIAL_OFFER_TEMPLATE_IDS,
    type MotionAnimation,
    type MotionPostType,
    type MotionTemplateId,
} from './templates/registry';
import type { MotionThemeId } from './theme/themeTokens';
import type { MotionPreviewAspect } from './templates/motionTemplateShared';

type FirestoreTimestamp = { toDate?: () => Date };

function normalizeUiPostSize(raw: unknown): MotionPreviewAspect | null {
    const s = String(raw || '')
        .trim()
        .toLowerCase();
    if (s === 'landscape' || s === '16:9' || s.includes('16 / 9') || s.includes('wide') || s.includes('horizontal')) {
        return 'landscape';
    }
    if (s === 'vertical' || s === '9:16' || s.includes('9 / 16') || s.includes('mobile') || s.includes('portrait')) {
        return 'vertical';
    }
    if (s === 'square' || s === '1:1' || s.includes('1 / 1')) return 'square';
    return null;
}

/** Feed/display layer aspect: use stored ui metadata, fallback to square for legacy docs. */
export function motionPostPreviewAspectFromDoc(doc: Record<string, unknown>): MotionPreviewAspect {
    const ui = (doc?.ui && typeof doc.ui === 'object' ? doc.ui : {}) as Record<string, unknown>;
    return normalizeUiPostSize(ui.postSize) || normalizeUiPostSize(ui.aspectRatio) || 'square';
}

/** Sort key: publishedAt first, else updatedAt (matches product requirement). */
export function motionPostFeedSortMs(data: {
    publishedAt?: FirestoreTimestamp | null;
    updatedAt?: FirestoreTimestamp | null;
}): number {
    const primary = data?.publishedAt;
    const fallback = data?.updatedAt;
    const ts = primary?.toDate ? primary : fallback?.toDate ? fallback : null;
    if (!ts || typeof ts.toDate !== 'function') return 0;
    return ts.toDate().getTime();
}

/** Map Firestore `business_motion_posts` doc fields into `renderMotionPost` input. */
export function motionFirestoreDocToPreviewPayload(doc: Record<string, unknown>): MotionPostPayload {
    const contentRaw = (doc?.content && typeof doc.content === 'object' ? doc.content : {}) as Record<string, unknown>;
    const styleRaw = (doc?.style && typeof doc.style === 'object' ? doc.style : {}) as Record<string, unknown>;
    const media = (doc?.media && typeof doc.media === 'object' ? doc.media : {}) as Record<string, unknown>;
    const rawType = String(doc?.type || '');
    const type: MotionPostType =
        rawType === 'event_post'
            ? 'event_post'
            : rawType === 'normal_post'
              ? 'normal_post'
              : 'special_offer_post';
    const tidRaw = String(doc?.templateId || '').trim();
    const tid =
        tidRaw === 'sq_offer_v1' ? 'discount_hero' : tidRaw === 'sq_event_v1' ? 'elegant_invitation' : tidRaw;
    const templateId: MotionTemplateId =
        tid === 'normal_post_stub_v1'
            ? 'normal_post_stub_v1'
            : type === 'event_post'
              ? (EVENT_TEMPLATE_IDS as readonly string[]).includes(tid)
                  ? (tid as MotionTemplateId)
                  : 'elegant_invitation'
              : (SPECIAL_OFFER_TEMPLATE_IDS as readonly string[]).includes(tid)
                ? (tid as MotionTemplateId)
                : 'discount_hero';
    const animation = (['fade', 'slide', 'pop', 'stagger'].includes(String(styleRaw.animation))
        ? styleRaw.animation
        : 'stagger') as MotionAnimation;
    const themeId = (['midnight', 'sunset', 'emerald', 'violet', 'mono', 'rose', 'noir'].includes(String(styleRaw.themeId))
        ? styleRaw.themeId
        : 'midnight') as MotionThemeId;
    const durationMs = Number(styleRaw.durationMs ?? 700);
    return {
        type,
        // Persisted payload still validates as square; visual aspect is provided separately via previewAspect.
        format: 'square',
        templateId,
        content: {
            title: String(contentRaw.title || ''),
            subtitle: String(contentRaw.subtitle || ''),
            description: String(contentRaw.description || ''),
            cta: String(contentRaw.cta || ''),
            badgeText: String(contentRaw.badgeText || ''),
            dateText: String(contentRaw.dateText || ''),
            timeText: String(contentRaw.timeText || ''),
            locationText: String(contentRaw.locationText || ''),
            imageUrl: String(media.imageUrl || contentRaw.imageUrl || ''),
        },
        style: {
            animation,
            themeId,
            durationMs: Number.isFinite(durationMs) ? Math.min(1600, Math.max(300, durationMs)) : 700,
        },
    };
}
