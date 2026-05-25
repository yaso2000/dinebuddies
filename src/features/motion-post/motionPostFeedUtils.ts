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

export type StudioEditorSnapshot = {
    layoutModel: 'square' | 'story' | 'header_card';
    style: Record<string, unknown>;
    promoStickers?: { id: string; stickerId: string; slot?: string }[];
    textAnimation?: string;
};

/** Read Smart Post Studio editor state from a motion doc or community mirror snapshot. */
export function studioEditorFromDoc(doc: Record<string, unknown>): StudioEditorSnapshot | null {
    const direct = doc?.studioEditor;
    if (direct && typeof direct === 'object' && direct !== null) {
        const se = direct as Record<string, unknown>;
        const layout = se.layoutModel;
        if (layout === 'square' || layout === 'story' || layout === 'header_card') {
            return {
                layoutModel: layout,
                style: (se.style && typeof se.style === 'object' ? se.style : {}) as Record<string, unknown>,
                promoStickers: Array.isArray(se.promoStickers) ? (se.promoStickers as StudioEditorSnapshot['promoStickers']) : [],
                textAnimation: typeof se.textAnimation === 'string' ? se.textAnimation : undefined,
            };
        }
    }
    const snap = doc?.motionPostSnapshot;
    if (snap && typeof snap === 'object' && snap !== null) {
        return studioEditorFromDoc(snap as Record<string, unknown>);
    }
    return null;
}

/** True when a community feed item should render as a studio motion canvas (not plain text + image). */
export function isCommunityMotionPost(post: Record<string, unknown>): boolean {
    if (post.type === 'motion_post') return true;
    if (post.motionPostId) return true;
    if (post.motionPostSnapshot && typeof post.motionPostSnapshot === 'object') return true;
    if (post._isMotionPost) return true;
    if (post.source === 'smart_post_studio' && post.mediaUrl) return true;
    return false;
}

/** Build a motion doc for MotionPostBody from community or motion collection data. */
export function motionDocFromPost(post: Record<string, unknown>): Record<string, unknown> | null {
    if (!isCommunityMotionPost(post)) return null;

    const snap = post.motionPostSnapshot;
    if (snap && typeof snap === 'object' && snap !== null) {
        const s = snap as Record<string, unknown>;
        return {
            ...s,
            id: post.motionPostId || post.id,
            businessId: post.businessId || s.businessId,
            ownerId: post.authorId || s.ownerId,
        };
    }

    const contentStr = String(post.content || '').trim();
    const chunks = contentStr.split(/\n\n+/).filter(Boolean);
    const title = chunks[0] || contentStr;
    const description = chunks.length > 1 ? chunks.slice(1).join('\n\n') : chunks[0] ? '' : contentStr;

    return {
        id: post.motionPostId || post.id,
        type: 'normal_post',
        templateId: 'normal_post_stub_v1',
        content: {
            title,
            description,
            subtitle: '',
        },
        media: {
            imageUrl: String(post.mediaUrl || ''),
        },
        style: (post.style && typeof post.style === 'object' ? post.style : { animation: 'slide', themeId: 'midnight', durationMs: 700 }) as Record<
            string,
            unknown
        >,
        ui: (post.ui && typeof post.ui === 'object' ? post.ui : { postSize: 'square', aspectRatio: '1:1' }) as Record<string, unknown>,
        studioEditor: post.studioEditor ?? null,
        businessId: post.businessId,
        ownerId: post.authorId,
    };
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
    const animation = (['fade', 'slide', 'pop', 'stagger', 'zoom'].includes(String(styleRaw.animation))
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
