import { DEFAULT_MOTION_THEME_ID, type MotionThemeId } from '../theme/themeTokens';

export type MotionPostType = 'special_offer_post' | 'event_post' | 'normal_post';

/** Visual layouts for special-offer posts (each maps to its own component tree). */
export const SPECIAL_OFFER_TEMPLATE_IDS = [
    'discount_hero',
    'premium_offer',
    'split_promo',
    'coupon_style',
    'flash_sale',
] as const;
export type SpecialOfferTemplateId = (typeof SPECIAL_OFFER_TEMPLATE_IDS)[number];

export const EVENT_TEMPLATE_IDS = [
    'elegant_invitation',
    'party_night',
    'birthday_celebration',
    'business_event',
    'romantic_dinner',
] as const;
export type EventTemplateId = (typeof EVENT_TEMPLATE_IDS)[number];

export type MotionTemplateId = SpecialOfferTemplateId | EventTemplateId | 'normal_post_stub_v1';

export type MotionAnimation = 'fade' | 'slide' | 'pop' | 'stagger';

export type MotionTemplateMaxLengths = {
    title: number;
    subtitle: number;
    description: number;
    cta: number;
    badgeText: number;
    dateText: number;
    /** event_post layouts only */
    timeText?: number;
    locationText?: number;
};

export type MotionTemplateDefinition = {
    id: MotionTemplateId;
    name: string;
    postType: MotionPostType;
    format: 'square';
    version: 1;
    maxLengths: MotionTemplateMaxLengths;
    allowedAnimations: MotionAnimation[];
    allowedThemes: MotionThemeId[];
    defaults: {
        animation: MotionAnimation;
        themeId: MotionThemeId;
    };
};

const SHARED_MAX_LENGTHS: MotionTemplateMaxLengths = {
    title: 60,
    subtitle: 100,
    description: 180,
    cta: 24,
    badgeText: 28,
    dateText: 32,
};

const EVENT_MAX_LENGTHS: MotionTemplateMaxLengths = {
    ...SHARED_MAX_LENGTHS,
    timeText: 44,
    locationText: 96,
};

const SHARED_ANIMATIONS: MotionAnimation[] = ['fade', 'slide', 'pop', 'stagger'];
const SHARED_THEMES: MotionThemeId[] = ['midnight', 'sunset', 'emerald', 'violet', 'mono', 'rose', 'noir'];

const OFFER_DEFAULTS = {
    animation: 'stagger' as const,
    themeId: DEFAULT_MOTION_THEME_ID,
};

const EVENT_DEFAULTS = {
    animation: 'stagger' as const,
    themeId: DEFAULT_MOTION_THEME_ID,
};

export const MOTION_TEMPLATE_REGISTRY: Record<MotionTemplateId, MotionTemplateDefinition> = {
    discount_hero: {
        id: 'discount_hero',
        name: 'Discount Hero',
        postType: 'special_offer_post',
        format: 'square',
        version: 1,
        maxLengths: SHARED_MAX_LENGTHS,
        allowedAnimations: SHARED_ANIMATIONS,
        allowedThemes: SHARED_THEMES,
        defaults: OFFER_DEFAULTS,
    },
    premium_offer: {
        id: 'premium_offer',
        name: 'Premium Offer',
        postType: 'special_offer_post',
        format: 'square',
        version: 1,
        maxLengths: SHARED_MAX_LENGTHS,
        allowedAnimations: SHARED_ANIMATIONS,
        allowedThemes: SHARED_THEMES,
        defaults: OFFER_DEFAULTS,
    },
    split_promo: {
        id: 'split_promo',
        name: 'Split Promo',
        postType: 'special_offer_post',
        format: 'square',
        version: 1,
        maxLengths: SHARED_MAX_LENGTHS,
        allowedAnimations: SHARED_ANIMATIONS,
        allowedThemes: SHARED_THEMES,
        defaults: OFFER_DEFAULTS,
    },
    coupon_style: {
        id: 'coupon_style',
        name: 'Coupon Style',
        postType: 'special_offer_post',
        format: 'square',
        version: 1,
        maxLengths: SHARED_MAX_LENGTHS,
        allowedAnimations: SHARED_ANIMATIONS,
        allowedThemes: SHARED_THEMES,
        defaults: OFFER_DEFAULTS,
    },
    flash_sale: {
        id: 'flash_sale',
        name: 'Flash Sale',
        postType: 'special_offer_post',
        format: 'square',
        version: 1,
        maxLengths: SHARED_MAX_LENGTHS,
        allowedAnimations: SHARED_ANIMATIONS,
        allowedThemes: SHARED_THEMES,
        defaults: OFFER_DEFAULTS,
    },
    elegant_invitation: {
        id: 'elegant_invitation',
        name: 'Elegant Invitation',
        postType: 'event_post',
        format: 'square',
        version: 1,
        maxLengths: EVENT_MAX_LENGTHS,
        allowedAnimations: SHARED_ANIMATIONS,
        allowedThemes: SHARED_THEMES,
        defaults: EVENT_DEFAULTS,
    },
    party_night: {
        id: 'party_night',
        name: 'Party Night',
        postType: 'event_post',
        format: 'square',
        version: 1,
        maxLengths: EVENT_MAX_LENGTHS,
        allowedAnimations: SHARED_ANIMATIONS,
        allowedThemes: SHARED_THEMES,
        defaults: EVENT_DEFAULTS,
    },
    birthday_celebration: {
        id: 'birthday_celebration',
        name: 'Birthday Celebration',
        postType: 'event_post',
        format: 'square',
        version: 1,
        maxLengths: EVENT_MAX_LENGTHS,
        allowedAnimations: SHARED_ANIMATIONS,
        allowedThemes: SHARED_THEMES,
        defaults: EVENT_DEFAULTS,
    },
    business_event: {
        id: 'business_event',
        name: 'Business Event',
        postType: 'event_post',
        format: 'square',
        version: 1,
        maxLengths: EVENT_MAX_LENGTHS,
        allowedAnimations: SHARED_ANIMATIONS,
        allowedThemes: SHARED_THEMES,
        defaults: EVENT_DEFAULTS,
    },
    romantic_dinner: {
        id: 'romantic_dinner',
        name: 'Romantic Dinner',
        postType: 'event_post',
        format: 'square',
        version: 1,
        maxLengths: EVENT_MAX_LENGTHS,
        allowedAnimations: SHARED_ANIMATIONS,
        allowedThemes: SHARED_THEMES,
        defaults: EVENT_DEFAULTS,
    },
    normal_post_stub_v1: {
        id: 'normal_post_stub_v1',
        name: 'Normal Post (stub preview)',
        postType: 'normal_post',
        format: 'square',
        version: 1,
        maxLengths: SHARED_MAX_LENGTHS,
        allowedAnimations: SHARED_ANIMATIONS,
        allowedThemes: SHARED_THEMES,
        defaults: {
            animation: 'stagger',
            themeId: DEFAULT_MOTION_THEME_ID,
        },
    },
};

export const ALLOWED_MOTION_TYPES: MotionPostType[] = ['special_offer_post', 'event_post', 'normal_post'];
export const ALLOWED_MOTION_ANIMATIONS: MotionAnimation[] = SHARED_ANIMATIONS;
export const ALLOWED_MOTION_THEMES: MotionThemeId[] = SHARED_THEMES;

export function isSpecialOfferTemplateId(id: string): id is SpecialOfferTemplateId {
    return (SPECIAL_OFFER_TEMPLATE_IDS as readonly string[]).includes(id);
}

export function isEventTemplateId(id: string): id is EventTemplateId {
    return (EVENT_TEMPLATE_IDS as readonly string[]).includes(id);
}
