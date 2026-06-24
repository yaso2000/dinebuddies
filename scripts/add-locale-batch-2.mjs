import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const additions = {
    en: {
        ai_context_business_name: 'Business name: {{value}}',
        ai_context_payment: 'Payment: {{value}}',
        ai_context_seats: 'Seats needed: {{value}}',
        ai_prompt_animated_post_default: 'Promotional animated community post',
        ai_prompt_featured_post_default: 'Featured post for {{name}}',
        ai_prompt_public_invitation_default:
            'Write an invitation title and welcoming message suited to the context above',
        card_overlay_desc_placeholder:
            'Write a thoughtful message to appear here, aligned within the safe zones…',
        card_overlay_title_placeholder: 'Your invitation headline',
        featured_editor_desc_placeholder: 'Enter description here (optional)',
        featured_editor_title_placeholder: 'Enter title here',
        offline_no_connection: 'No internet connection. Please check your network.',
        studio_tool_align: 'Alignment',
        studio_tool_colors: 'Colors',
        studio_tool_effects: 'Effects',
        studio_tool_font: 'Font',
        studio_tool_promo: 'Offers',
        studio_tool_size: 'Size',
        studio_tool_transparency: 'Transparency',
    },
    ar: {
        ai_context_business_name: 'اسم المنشأة: {{value}}',
        ai_context_payment: 'الدفع: {{value}}',
        ai_context_seats: 'عدد المقاعد: {{value}}',
        ai_prompt_animated_post_default: 'منشور متحرك ترويجي للمجتمع',
        ai_prompt_featured_post_default: 'منشور مميز لـ {{name}}',
        ai_prompt_public_invitation_default:
            'اكتب عنوان دعوة ورسالة ترحيبية مناسبة للسياق أعلاه',
        card_overlay_desc_placeholder:
            'اكتب رسالة رقيقة لتظهر هنا متناسقة داخل مساحات الأمان تلقائياً وبأبهى حُلّة بصرية...',
        card_overlay_title_placeholder: 'عنوان الدعوة الساحرة',
        featured_editor_desc_placeholder: 'اكتب الوصف هنا (اختياري)',
        featured_editor_title_placeholder: 'اكتب العنوان هنا',
        offline_no_connection: 'لا يوجد اتصال بالإنترنت. يرجى التحقق من الشبكة.',
        studio_tool_align: 'المحاذاة',
        studio_tool_colors: 'الألوان',
        studio_tool_effects: 'التأثيرات',
        studio_tool_font: 'الخط',
        studio_tool_promo: 'عروض',
        studio_tool_size: 'الحجم',
        studio_tool_transparency: 'الشفافية',
    },
};

for (const file of ['en.json', 'ar.json']) {
    const lang = file.startsWith('en') ? 'en' : 'ar';
    const p = path.join(root, 'src/locales', file);
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    Object.assign(data, additions[lang]);
    const sorted = Object.fromEntries(Object.keys(data).sort().map((k) => [k, data[k]]));
    fs.writeFileSync(p, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
}

console.log('Added batch 2 keys');
