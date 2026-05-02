import type { MotionPostPayload } from '../validateMotionPost';
import type { MotionPreviewAspect, MotionPreviewDesign } from '../templates/motionTemplateShared';

/**
 * Representative motion payloads across **special-offer** layout ids and **event_post** layout ids.
 * Categories are **content scenarios** only (not invitation OCCASION_PRESETS).
 */
export type InvitationStyleCategoryId = 'birthday' | 'business' | 'dating' | 'nightlife' | 'family';

export type MotionCategoryFixture = {
    id: InvitationStyleCategoryId;
    label: string;
    /** Expected primary `templateId` for this scenario. */
    primaryTemplate: string;
    post: MotionPostPayload;
    previewDesign?: MotionPreviewDesign | null;
    previewAspects: MotionPreviewAspect[];
    notes: string;
};

const baseStyle = { animation: 'stagger' as const, themeId: 'sunset' as const, durationMs: 700 };

const longBusinessDescription =
    'برامج توصيل للشركات: وجبات متوازنة، فواتير شهرية، وخصم ١٥٪ على الطلبات فوق ٥٠ صندوق أسبوعياً. نخدم المنطقة التجارية والمجمعات المكتبية.';

export const MOTION_CATEGORY_LAYOUT_FIXTURES: MotionCategoryFixture[] = [
    {
        id: 'birthday',
        label: 'Birthday',
        primaryTemplate: 'discount_hero',
        post: {
            type: 'special_offer_post',
            format: 'square',
            templateId: 'discount_hero',
            content: {
                title: 'عيد ميلاد سعيد\nخصم ٢٠٪ على الكعك',
                subtitle: 'احتفل مع الأصدقاء — عرض هذا الأسبوع فقط.',
                description: 'كعك مخصص، شموع مجانية، وتغليف هدايا عند الطلب.',
                cta: 'احجز الكعكة',
                badgeText: 'عيد ميلاد',
            },
            style: { ...baseStyle, themeId: 'rose' },
        },
        previewDesign: {
            textPlacement: 'center',
            overlayStrength: 0.35,
            imageFocus: 'center center',
            styleMood: 'fun',
        },
        previewAspects: ['square', 'vertical', 'landscape'],
        notes: 'Discount hero + multi-line title; energetic mood stresses CTA chrome.',
    },
    {
        id: 'business',
        label: 'Business',
        primaryTemplate: 'premium_offer',
        post: {
            type: 'special_offer_post',
            format: 'square',
            templateId: 'premium_offer',
            content: {
                title: 'حلول التموين للشركات',
                subtitle: 'عقود B2B — فوترة رسمية ودعم حساب مدير.',
                description: longBusinessDescription,
                cta: 'تواصل معنا',
                badgeText: 'للأعمال',
            },
            style: { ...baseStyle, themeId: 'midnight' },
        },
        previewDesign: {
            textPlacement: 'top',
            overlayStrength: 0.22,
            imageFocus: 'center top',
            styleMood: 'elegant',
        },
        previewAspects: ['square', 'landscape'],
        notes: 'Premium inset column + long description.',
    },
    {
        id: 'dating',
        label: 'Dating',
        primaryTemplate: 'romantic_dinner',
        post: {
            type: 'event_post',
            format: 'square',
            templateId: 'romantic_dinner',
            content: {
                title: 'عشاء رومانسي\nلشخصين',
                subtitle: 'طاولة جانبية — إضاءة خافتة ومشروب ترحيبي.',
                description: 'الجمعة والسبت ٧–١١ م. احجز مسبقاً.',
                cta: 'احجز الطاولة',
                dateText: 'الجمعة ٨ مساءً',
                timeText: '٧:٣٠ – ١١ م',
                locationText: 'الطابق الثاني — مطعمنا الرئيسي',
            },
            style: { ...baseStyle, themeId: 'violet' },
        },
        previewDesign: {
            textPlacement: 'bottom',
            overlayStrength: 0.3,
            imageFocus: 'center center',
            styleMood: 'elegant',
        },
        previewAspects: ['square', 'vertical'],
        notes: 'Event template + date chip.',
    },
    {
        id: 'nightlife',
        label: 'Nightlife',
        primaryTemplate: 'party_night',
        post: {
            type: 'event_post',
            format: 'square',
            templateId: 'party_night',
            content: {
                title: 'ليلة الدي جي\nعلى الروف',
                subtitle: 'دخول مجاني قبل ١١ م — كود الدعوة: ROOF',
                description: 'مشروبات مختارة، عرض ضوئي، وأفضل دي جي المدينة.',
                cta: 'احصل على التذكرة',
                dateText: 'السبت ١٠ مساءً',
                timeText: '١٠ مساءً – ٣ صباحاً',
                locationText: 'الروف — برج المدينة',
            },
            style: { ...baseStyle, themeId: 'midnight' },
        },
        previewDesign: {
            textPlacement: 'side',
            overlayStrength: 0.4,
            imageFocus: 'center top',
            styleMood: 'energetic',
        },
        previewAspects: ['square', 'landscape'],
        notes: 'Event + landscape.',
    },
    {
        id: 'family',
        label: 'Family',
        primaryTemplate: 'split_promo',
        post: {
            type: 'special_offer_post',
            format: 'square',
            templateId: 'split_promo',
            content: {
                title: 'أطباق للعائلة\nيوم الأحد',
                subtitle: 'قائمة أطفال + مقاعد عالية مجانية.',
                description: '٤ أطباق رئيسية + سلطة ومشروبات غازية بسعر ثابت للعائلة.',
                cta: 'اطلب العرض',
                badgeText: 'يوم العائلة',
            },
            style: { ...baseStyle, themeId: 'emerald' },
        },
        previewDesign: {
            textPlacement: 'center',
            overlayStrength: 0.28,
            imageFocus: 'center center',
            styleMood: 'fun',
        },
        previewAspects: ['square', 'vertical'],
        notes: 'Split promo slab + vertical stack.',
    },
];
