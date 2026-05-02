import {
    ALLOWED_MOTION_ANIMATIONS,
    ALLOWED_MOTION_THEMES,
    ALLOWED_MOTION_TYPES,
    MOTION_TEMPLATE_REGISTRY,
    type MotionAnimation,
    type MotionPostType,
    type MotionTemplateId,
} from './templates/registry';
import { DEFAULT_MOTION_THEME_ID, type MotionThemeId } from './theme/themeTokens';

export type MotionPostPayload = {
    type: MotionPostType;
    format: 'square';
    templateId: MotionTemplateId;
    content: {
        title: string;
        subtitle?: string;
        description?: string;
        cta?: string;
        badgeText?: string;
        dateText?: string;
        /** event_post — optional lines for layout */
        timeText?: string;
        locationText?: string;
        imageUrl?: string;
    };
    style?: {
        animation?: MotionAnimation;
        themeId?: MotionThemeId;
        durationMs?: number;
    };
};

export type MotionValidationResult = {
    valid: boolean;
    errors: string[];
    safePost: MotionPostPayload | null;
};

const trimTo = (value: unknown, max: number): string => String(value || '').trim().slice(0, max);
const lenOf = (value: unknown): number => String(value || '').trim().length;

export function validateMotionPost(input: unknown): MotionValidationResult {
    const errors: string[] = [];
    const raw = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {};

    const type = String(raw.type || '') as MotionPostType;
    const format = String(raw.format || '') as 'square';
    const templateIdRaw = String(raw.templateId || '').trim();
    /** Legacy template ids → current defaults. */
    let templateId = templateIdRaw as MotionTemplateId;
    if (templateIdRaw === 'sq_offer_v1') templateId = 'discount_hero';
    if (templateIdRaw === 'sq_event_v1') templateId = 'elegant_invitation';
    const def = MOTION_TEMPLATE_REGISTRY[templateId];

    if (!ALLOWED_MOTION_TYPES.includes(type)) errors.push('Invalid post type');
    if (format !== 'square') errors.push('Only square format is allowed');
    if (!def) errors.push('Unknown templateId');

    const contentRaw = (raw.content && typeof raw.content === 'object') ? (raw.content as Record<string, unknown>) : {};
    const styleRaw = (raw.style && typeof raw.style === 'object') ? (raw.style as Record<string, unknown>) : {};

    const max = def?.maxLengths || {
        title: 60, subtitle: 100, description: 180, cta: 24, badgeText: 28, dateText: 32,
    };
    const timeMax = max.timeText ?? 44;
    const locMax = max.locationText ?? 96;
    const safeContent = {
        title: trimTo(contentRaw.title, max.title),
        subtitle: trimTo(contentRaw.subtitle, max.subtitle),
        description: trimTo(contentRaw.description, max.description),
        cta: trimTo(contentRaw.cta, max.cta),
        badgeText: trimTo(contentRaw.badgeText, max.badgeText),
        dateText: trimTo(contentRaw.dateText, max.dateText),
        timeText: type === 'event_post' ? trimTo(contentRaw.timeText, timeMax) : '',
        locationText: type === 'event_post' ? trimTo(contentRaw.locationText, locMax) : '',
        imageUrl: trimTo(contentRaw.imageUrl, 2000),
    };

    if (!safeContent.title) errors.push('Title is required');
    if (lenOf(contentRaw.title) > max.title) errors.push('Title exceeds max length');
    if (lenOf(contentRaw.subtitle) > max.subtitle) errors.push('Subtitle exceeds max length');
    if (lenOf(contentRaw.description) > max.description) errors.push('Description exceeds max length');
    if (lenOf(contentRaw.cta) > max.cta) errors.push('CTA exceeds max length');
    if (lenOf(contentRaw.badgeText) > max.badgeText) errors.push('Badge text exceeds max length');
    if (lenOf(contentRaw.dateText) > max.dateText) errors.push('Date text exceeds max length');
    if (type === 'event_post') {
        if (lenOf(contentRaw.timeText) > timeMax) errors.push('Time text exceeds max length');
        if (lenOf(contentRaw.locationText) > locMax) errors.push('Location text exceeds max length');
    }

    const animation = String(styleRaw.animation || def?.defaults.animation || 'stagger') as MotionAnimation;
    const themeId = String(styleRaw.themeId || def?.defaults.themeId || DEFAULT_MOTION_THEME_ID) as MotionThemeId;
    const durationMsRaw = Number(styleRaw.durationMs ?? 700);
    const durationMs = Number.isFinite(durationMsRaw) ? Math.min(1600, Math.max(300, durationMsRaw)) : 700;

    if (!ALLOWED_MOTION_ANIMATIONS.includes(animation)) errors.push('Invalid animation name');
    if (!ALLOWED_MOTION_THEMES.includes(themeId)) errors.push('Invalid theme id');

    if (def) {
        if (!def.allowedAnimations.includes(animation)) errors.push('Animation not allowed for selected template');
        if (!def.allowedThemes.includes(themeId)) errors.push('Theme not allowed for selected template');
        if (def.postType !== type) errors.push('post type does not match template');
    }

    if (errors.length > 0) {
        return { valid: false, errors, safePost: null };
    }

    return {
        valid: true,
        errors: [],
        safePost: {
            type,
            format: 'square',
            templateId,
            content: safeContent,
            style: { animation, themeId, durationMs },
        },
    };
}

