import type { MotionPostPayload } from '../validateMotionPost';
import type { MotionPreviewDesign } from '../templates/motionTemplateShared';
import type { SpecialOfferTemplateId } from '../templates/registry';

/** Dev-only: stress Arabic + long lines + average-quality remote image for offer template QA. */
const QA_IMAGE = 'https://picsum.photos/seed/motionofferqa/480/480';

const longArSubtitle =
    'عرض محدود على أطباق المشاوي والمقبلات الباردة مع مشروبات ريفية مختارة. صالح على الطلبات عبر التطبيق أو من الفرع الرئيسي حتى نهاية الأسبوع فقط دون استثناء.';

const longArDescription =
    'يشمل العرض قائمة العشاء للشخصين مع سلطة موسمية وحلى يومي. لا يجمع مع عروض أخرى. قد تختلف الأصناف حسب التوفر. مخصص للجلوس في المطعم والطلبات الخارجية مع رسوم توصيل عادية.';

const baseStyle = { animation: 'stagger' as const, themeId: 'midnight' as const, durationMs: 700 };

const qaPreviewDesign: MotionPreviewDesign = {
    textPlacement: 'bottom',
    overlayStrength: 0.32,
    imageFocus: 'center center',
    styleMood: 'default',
};

function offerPayload(templateId: SpecialOfferTemplateId): MotionPostPayload {
    return {
        type: 'special_offer_post',
        format: 'square',
        templateId,
        content: {
            title: '٤٠٪ خصم\nعلى قائمة العشاء',
            subtitle: longArSubtitle,
            description: longArDescription,
            cta: 'اطلب العرض الآن',
            badgeText: 'عرض خاص',
            imageUrl: QA_IMAGE,
        },
        style: { ...baseStyle },
    };
}

/** Rows for `/dev/motion-category-qa` — all five offer layouts with identical copy for comparison. */
export const MOTION_SPECIAL_OFFER_VISUAL_QA_FIXTURES: Array<{
    id: string;
    label: string;
    post: MotionPostPayload;
    previewDesign: MotionPreviewDesign | null;
}> = [
    { id: 'qa_discount_hero', label: 'QA: discount_hero', post: offerPayload('discount_hero'), previewDesign: qaPreviewDesign },
    { id: 'qa_premium_offer', label: 'QA: premium_offer', post: offerPayload('premium_offer'), previewDesign: qaPreviewDesign },
    { id: 'qa_split_promo', label: 'QA: split_promo', post: offerPayload('split_promo'), previewDesign: qaPreviewDesign },
    { id: 'qa_coupon_style', label: 'QA: coupon_style', post: offerPayload('coupon_style'), previewDesign: qaPreviewDesign },
    { id: 'qa_flash_sale', label: 'QA: flash_sale', post: offerPayload('flash_sale'), previewDesign: qaPreviewDesign },
];
