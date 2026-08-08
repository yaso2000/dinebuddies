/**
 * Add missing studio editor + AI design studio i18n keys to en.json and ar.json.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const additions = {
    en: {
        ai_deploy_api_hint: 'Make sure you use the deployed domain with /api (redeploy if needed).',
        ai_invalid_server_response: 'Invalid server response ({{hint}}).',
        ai_session_expired: 'Your session expired or the token is invalid. Sign out and sign in again.',
        ai_design_cat_square: 'Square',
        ai_design_cat_story: 'Story / Reel',
        ai_design_cat_landscape: 'Landscape',
        ai_design_cat_profile_picture: 'Profile picture',
        ai_design_cat_profile_cover: 'Profile cover',
        ai_design_cat_business_logo: 'Business logo',
        ai_design_use_profile_avatar: 'Profile picture',
        ai_design_use_profile_cover: 'Profile cover',
        ai_design_use_business_cover: 'Business cover',
        ai_design_use_business_logo: 'Business logo',
        ai_design_use_community_post: 'Feed post',
        ai_design_use_motion_post: 'Motion post',
        ai_design_use_featured_post: 'Featured post',
        ai_design_use_invitation_public: 'Public invitation cover',
        ai_design_use_invitation_private: 'Private invitation cover',
        ai_design_use_invitation_dating: 'Dating invitation cover',
        studio_anim_fade: 'Fade',
        studio_anim_slide: 'Slide',
        studio_anim_pop: 'Pop',
        studio_anim_stagger: 'Stagger',
        studio_anim_zoom: 'Zoom',
        studio_body_placeholder: 'Write message here',
        studio_title_placeholder: 'Write title here',
        studio_main_text_color: 'Title color',
        studio_sub_text_color: 'Text color',
        studio_backdrop_gradient: 'Gradient backdrop',
        studio_promo_offer: 'Offer',
        studio_v_align_top: 'Top',
        studio_v_align_center: 'Center',
        studio_v_align_bottom: 'Bottom',
        studio_quick_neon_white: 'White',
        studio_quick_neon_orange: 'Orange',
        studio_quick_glow_amber: 'Amber',
        studio_quick_electric_cyan: 'Cyan',
        studio_quick_hot_pink: 'Pink',
        studio_quick_lime_pop: 'Lime',
        studio_quick_violet_neon: 'Violet',
        studio_quick_gold_flash: 'Gold',
        studio_quick_coral_burst: 'Coral',
        studio_quick_mint_glow: 'Mint',
        studio_quick_sky_blue: 'Blue',
        studio_quick_magenta: 'Magenta',
        studio_quick_sunset: 'Sunset',
        studio_quick_aqua_white: 'Aqua',
        studio_quick_yellow_pop: 'Yellow',
        studio_quick_neon_mix: 'Neon',
        studio_quick_ruby: 'Ruby',
        studio_quick_contrast: 'Contrast',
        studio_quick_dark_glass: 'Glass',
    },
    ar: {
        ai_deploy_api_hint: 'تأكد أنك تستخدم الدومين المنشور مع /api (أعد النشر إن لزم).',
        ai_invalid_server_response: 'استجابة غير صالحة من السيرفر ({{hint}}).',
        ai_session_expired: 'انتهت جلسة تسجيل الدخول أو التوكن غير صالح. سجّل الخروج ثم الدخول مرة أخرى.',
        ai_design_cat_square: 'مربع',
        ai_design_cat_story: 'قصة / 9:16',
        ai_design_cat_landscape: '16:9 أفقي',
        ai_design_cat_profile_picture: 'صورة بروفايل',
        ai_design_cat_profile_cover: 'غلاف البروفايل',
        ai_design_cat_business_logo: 'لوغو البزنس',
        ai_design_use_profile_avatar: 'صورة البروفايل',
        ai_design_use_profile_cover: 'غلاف البروفايل',
        ai_design_use_business_cover: 'غلاف البزنس',
        ai_design_use_business_logo: 'لوغو البزنس',
        ai_design_use_community_post: 'بوست الفيد',
        ai_design_use_motion_post: 'بوست حركي',
        ai_design_use_featured_post: 'بوست مميز',
        ai_design_use_invitation_public: 'غلاف دعوة عامة',
        ai_design_use_invitation_private: 'غلاف دعوة خاصة',
        ai_design_use_invitation_dating: 'غلاف دعوة موعد',
        studio_anim_fade: 'ظهور',
        studio_anim_slide: 'انزلاق',
        studio_anim_pop: 'قفزة',
        studio_anim_stagger: 'متتابع',
        studio_anim_zoom: 'تكبير',
        studio_body_placeholder: 'اكتب الرسالة هنا',
        studio_title_placeholder: 'اكتب العنوان هنا',
        studio_main_text_color: 'لون العنوان',
        studio_sub_text_color: 'لون النص',
        studio_backdrop_gradient: 'خلفية متدرجة',
        studio_promo_offer: 'عرض',
        studio_v_align_top: 'أعلى',
        studio_v_align_center: 'وسط',
        studio_v_align_bottom: 'أسفل',
        studio_quick_neon_white: 'أبيض',
        studio_quick_neon_orange: 'برتقالي',
        studio_quick_glow_amber: 'عنبر',
        studio_quick_electric_cyan: 'سماوي',
        studio_quick_hot_pink: 'وردي',
        studio_quick_lime_pop: 'ليموني',
        studio_quick_violet_neon: 'بنفسجي',
        studio_quick_gold_flash: 'ذهبي',
        studio_quick_coral_burst: 'مرجاني',
        studio_quick_mint_glow: 'نعناع',
        studio_quick_sky_blue: 'أزرق',
        studio_quick_magenta: 'أرجواني',
        studio_quick_sunset: 'غروب',
        studio_quick_aqua_white: 'مائي',
        studio_quick_yellow_pop: 'أصفر',
        studio_quick_neon_mix: 'نيون',
        studio_quick_ruby: 'ياقوت',
        studio_quick_contrast: 'تباين',
        studio_quick_dark_glass: 'زجاجي',
    },
};

for (const [code, keys] of Object.entries(additions)) {
    const filePath = path.join(root, 'src/locales', `${code}.json`);
    const locale = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let added = 0;
    for (const [k, v] of Object.entries(keys)) {
        if (locale[k] === undefined) {
            locale[k] = v;
            added += 1;
        }
    }
    const sorted = Object.fromEntries(Object.keys(locale).sort().map((k) => [k, locale[k]]));
    fs.writeFileSync(filePath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
    console.log(`${code}: added ${added} keys`);
}
