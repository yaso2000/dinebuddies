/**
 * Final i18n pass: Arabic translations for keys still identical to English,
 * plus new EN/AR keys for hardcoded UI strings.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '..', 'src/locales');

const arPatch = JSON.parse(fs.readFileSync(path.join(__dirname, '_ar-same-as-en.json'), 'utf8'));

const arTranslations = {
  admin_businesses_name: 'اسم النشاط التجاري',
  admin_deleting: 'جاري الحذف…',
  admin_demo_user_age_required: 'الفئة العمرية مطلوبة.',
  admin_demo_user_cover: 'صورة الغلاف',
  admin_demo_user_create_confirm: 'تأكيد إنشاء مستخدم تجريبي',
  admin_demo_user_create_section: 'إنشاء مستخدم تجريبي',
  admin_demo_user_created: 'تم إنشاء المستخدم التجريبي',
  admin_demo_user_creating: 'جاري النشر…',
  admin_demo_user_delete_confirm: 'تأكيد حذف المستخدم التجريبي',
  admin_demo_user_deleted: 'تم حذف المستخدم التجريبي',
  admin_demo_user_gallery_photo: 'صورة من المعرض',
  admin_demo_user_gender_required: 'الجنس مطلوب.',
  admin_demo_user_image_uploaded: 'تم رفع الصورة.',
  admin_demo_user_lat: 'خط العرض',
  admin_demo_user_lng: 'خط الطول',
  admin_demo_user_location_section: 'الموقع',
  admin_demo_user_name_required: 'اسم العرض مطلوب.',
  admin_demo_user_no_image: 'لا توجد صورة',
  admin_demo_user_photo: 'صورة الملف الشخصي',
  admin_demo_user_private_invite_hint: 'عند الإيقاف، يقبل هذا المستخدم الدعوات العامة/الاجتماعية فقط.',
  admin_demo_user_profile_section: 'تفاصيل الملف الشخصي',
  admin_demo_user_publish_btn: 'نشر المستخدم التجريبي',
  admin_demo_user_replace_image: 'استبدال الصورة',
  admin_demo_user_required_section: 'الحقول الإلزامية',
  admin_demo_user_sign_in_upload: 'سجّل دخولك كمسؤول لرفع الصور.',
  admin_demo_user_suggest_btn: 'اقتراح نص بالذكاء الاصطناعي',
  admin_demo_user_suggest_empty: 'لم يُرجع الذكاء الاصطناعي ملفاً شخصياً.',
  admin_demo_user_suggested: 'تم اقتراح نص الملف — راجعه وعدّله قبل النشر.',
  admin_demo_user_suggesting: 'جاري الاقتراح…',
  admin_demo_user_upload_hint: 'JPG أو PNG أو WebP — بحد أقصى 8MB. اتركه فارغاً لاستخدام مجموعة الوسائط حسب الجنس عند النشر.',
  admin_demo_user_upload_image: 'رفع من الجهاز',
  admin_demo_user_uploading: 'جاري الرفع…',
  admin_demo_users_lead_single: 'أنشئ ملف مستهلك تجريبي واحداً في كل مرة مع حقول كاملة وموقع مدينة دقيق. لا يُنشأ حساب Auth.',
  admin_loading: 'جاري التحميل…',
  admin_plans_to_production: '→ الإنتاج',
  admin_plans_to_sandbox: '→ بيئة الاختبار',
  age_group: 'الفئة العمرية',
  age_groups: 'الفئات العمرية',
  available_for_private_invite: 'متاح للدعوات الخاصة',
  bio: 'نبذة',
  biz_plan_map_view_only: 'معاينة الخريطة فقط',
  business_email_verified_sign_in: 'تم التحقق من البريد. سجّل دخول كلمة مرور نشاطك التجاري للمتابعة.',
  camera_flip: 'قلب الكاميرا',
  color_scheme: 'نظام الألوان',
  community_banner_add_media: 'إضافة صورة للبانر من الكاميرا أو المعرض',
  community_banner_body_bold: 'عريض',
  community_banner_body_color: 'لون النص',
  community_banner_body_cycle_hint: 'اضغط أيقونة النص مرة أخرى لتعديل الكتلة التالية.',
  community_banner_body_italic: 'مائل',
  community_banner_body_slot: 'كتلة نص البانر',
  community_banner_body_slot_next: 'الكتلة النصية التالية',
  community_banner_body_slots: 'كتل النص',
  community_banner_body_style: 'النمط',
  community_banner_body_width: 'العرض',
  community_banner_delete_image: 'إزالة صورة البانر',
  community_banner_delete_youtube: 'إزالة الفيديو',
  community_banner_image_alt: 'بانر المجتمع',
  community_banner_media_tools: 'وسائط البانر',
  community_banner_panel: 'وسائط المجتمع',
  community_banner_placeholder: 'بانر الوسائط',
  community_banner_publish_youtube: 'تطبيق الفيديو',
  community_banner_text_tools: 'نص البانر والنمط',
  community_banner_title_color: 'لون العنوان',
  community_banner_title_stroke_color: 'لون الحد',
  community_banner_title_stroke_width: 'سمك الحد',
  community_banner_title_style_toolbar: 'نمط العنوان',
  community_banner_uploading: 'جاري رفع البانر…',
  community_banner_youtube_embed_hint: 'يجب أن يسمح الفيديو بالتضمين. إن فشل التشغيل، تُعرض صورة غلاف بدلاً منه.',
  community_banner_youtube_host_controls: 'تحكم الفيديو',
  community_banner_youtube_host_hint: 'أنت تتحكم بالفيديو عبر أزرار YouTube. الأعضاء يرونه صامتاً بلا أزرار.',
  community_banner_youtube_mute: 'كتم صوت الفيديو',
  community_banner_youtube_pause: 'إيقاف الفيديو',
  community_banner_youtube_play: 'تشغيل الفيديو',
  community_banner_youtube_resync: 'مزامنة الضيوف مع هذه اللحظة',
  community_banner_youtube_tool: 'خلفية YouTube',
  community_banner_youtube_unmute: 'تشغيل صوت الفيديو',
  community_banner_youtube_url_label: 'رابط YouTube',
  community_banner_youtube_url_placeholder: 'https://youtube.com/watch?v=… أو youtu.be/…',
  community_host_messages: 'رسالة من المضيف',
  community_participants_empty: 'لا أعضاء بعد.',
  community_participants_title: 'المشاركون المتصلون',
  community_pinned_host_bar: 'إعلان المضيف',
  continue_with_google_chrome: 'المتابعة مع Google (افتح Chrome)',
  cover_photo_save_profile_hint: 'تم رفع الغلاف — اضغط حفظ لإبقائه في ملفك.',
  failed_save: 'تعذّر الحفظ. حاول مرة أخرى.',
  failed_save_invitees: 'تعذّر حفظ قائمة المدعوين. حاول مرة أخرى.',
  gender_groups: 'مجموعات الجنس',
  invite_mood: 'مزاج الدعوة',
  liked: 'أُعجب',
  local_dev_embedded_preview_blocked: 'تسجيل الدخول لا يعمل داخل معاينة Cursor / VS Code.',
  local_dev_embedded_preview_hint: 'افتح Chrome أو Edge على http://localhost:5176/login?tab=business',
  local_dev_oauth_firebase_domains: 'Firebase → Auth → Authorized domains: أضف localhost و127.0.0.1 إن لزم.',
  local_dev_oauth_google_step1: '1) Firebase → Authentication → Google → Enabled. انسخ Web client ID:',
  local_dev_oauth_google_step2: '2) Google Cloud → Credentials → أضف كل origin أدناه:',
  local_dev_oauth_open_firebase: 'فتح إعدادات Google في Firebase',
  local_dev_oauth_open_gcloud: 'فتح Credentials في Google Cloud',
  local_dev_oauth_preview_body: 'استخدم الزر أدناه لفتح تسجيل الدخول في Chrome.',
  local_dev_oauth_preview_title: 'معاينة Cursor لا تكمل تسجيل Google.',
  more_options: 'المزيد من الخيارات',
  private_profile_custom_tag_mobile_placeholder: 'أضف إيموجي + نص من لوحة المفاتيح…',
  profile_gallery_view_photo: 'عرض الصورة',
  social_preview_open_retry: 'تعذّر فتح المعاينة. حاول بعد لحظات.',
  template: 'قالب',
  user_directory_greeting: 'لوّح',
  user_directory_list_view: 'عرض البطاقات',
  venue_search_section_dinebuddies: 'DineBuddies',
  venue_search_section_google: 'Google Places',
  venue_type: 'نوع المكان',
};

const newKeys = {
  en: {
    post_hidden_success: 'Post hidden from feed.',
    post_hide_failed: 'Failed to hide post.',
    post_updated_success: 'Post updated.',
    post_update_failed: 'Failed to update post.',
    reported_success: 'Reported.',
    image_upload_type_error: 'Only JPG, PNG, and WebP images are allowed',
    image_upload_size_error: 'Image size must be less than 5MB',
    review_login_required: 'Please sign in to leave a review',
    review_own_business: 'You cannot review your own business',
    review_reply_failed: 'Failed to post reply',
    recording_start_failed: 'Failed to start recording.',
    profile_links_save_failed: 'Failed to save links',
    business_services_draft_body: 'Your services were saved, but they will not appear on your public profile until you upgrade your plan.',
    business_no_services_listed: 'No services listed yet.',
    business_select_cuisine_type: 'Select cuisine type…',
    business_basic_info_section: 'Basic info',
    business_info_saved_title: 'Information saved!',
    business_pro_fields_notice: 'The following fields require a Pro plan to be visible to visitors:',
    business_pro_fields_saved_hint: 'Your data is saved and will become visible once you upgrade.',
    business_upgrade_to_pro: 'Upgrade to Pro',
    invitation_welcome_new_member: 'Welcome, new member!',
    home_explore_now: 'Explore now',
    auth_set_new_password_title: 'Set a new password',
    restaurant_todays_hours: "Today's hours",
    payment_manage_description: 'Manage your payment methods for subscription billing',
    payment_add_stripe_soon: 'Add payment method will be integrated with Stripe',
    payment_remove_confirm: 'Are you sure you want to remove this payment method?',
    payment_secure_stripe_note: 'Secure payment: All payment information is securely processed by Stripe.',
    billing_need_help: 'Need help?',
    billing_support_contact: 'If you have any questions about your billing, please contact our support team at support@dinebuddies.com',
    image_upload_label: 'Upload image',
    payment_no_methods: 'No payment methods',
    payment_add_method_hint: 'Add a payment method to manage your subscription',
    payment_add_method: 'Add Payment Method',
    payment_default_badge: 'DEFAULT',
    payment_expires: 'Expires {{month}}/{{year}}',
    payment_set_default: 'Set as Default',
    admin_access_denied_body: 'This account does not have admin panel access. You were not sent to the home feed automatically to avoid redirect loops.',
    go_to_app_feed: 'Go to app feed',
    invitation_selected_venue: 'Selected Venue',
    unavailable: 'Unavailable',
    home_hot_deal: 'HOT DEAL',
  },
  ar: {
    post_hidden_success: 'تم إخفاء المنشور من الخلاصة.',
    post_hide_failed: 'تعذّر إخفاء المنشور.',
    post_updated_success: 'تم تحديث المنشور.',
    post_update_failed: 'تعذّر تحديث المنشور.',
    reported_success: 'تم الإبلاغ.',
    image_upload_type_error: 'يُسمح فقط بصور JPG وPNG وWebP',
    image_upload_size_error: 'يجب أن يكون حجم الصورة أقل من 5MB',
    review_login_required: 'يرجى تسجيل الدخول لترك تقييم',
    review_own_business: 'لا يمكنك تقييم نشاطك التجاري',
    review_reply_failed: 'تعذّر نشر الرد',
    recording_start_failed: 'تعذّر بدء التسجيل.',
    profile_links_save_failed: 'تعذّر حفظ الروابط',
    business_services_draft_body: 'تم حفظ خدماتك، لكنها لن تظهر في ملفك العام حتى ترقّي خطتك.',
    business_no_services_listed: 'لا توجد خدمات مدرجة بعد.',
    business_select_cuisine_type: 'اختر نوع المطبخ…',
    business_basic_info_section: 'معلومات أساسية',
    business_info_saved_title: 'تم حفظ المعلومات!',
    business_pro_fields_notice: 'الحقول التالية تتطلب خطة Pro لتظهر للزوار:',
    business_pro_fields_saved_hint: 'بياناتك محفوظة وستظهر بعد الترقية.',
    business_upgrade_to_pro: 'الترقية إلى Pro',
    invitation_welcome_new_member: 'مرحباً، عضو جديد!',
    home_explore_now: 'استكشف الآن',
    auth_set_new_password_title: 'تعيين كلمة مرور جديدة',
    restaurant_todays_hours: 'ساعات اليوم',
    payment_manage_description: 'إدارة طرق الدفع لفوترة الاشتراك',
    payment_add_stripe_soon: 'ستُدمَج إضافة طريقة الدفع مع Stripe',
    payment_remove_confirm: 'هل أنت متأكد من إزالة طريقة الدفع هذه؟',
    payment_secure_stripe_note: 'دفع آمن: تُعالَج جميع معلومات الدفع بأمان عبر Stripe.',
    billing_need_help: 'تحتاج مساعدة؟',
    billing_support_contact: 'لأي أسئلة عن الفوترة، تواصل معنا على support@dinebuddies.com',
    image_upload_label: 'رفع صورة',
    payment_no_methods: 'لا توجد طرق دفع',
    payment_add_method_hint: 'أضف طريقة دفع لإدارة اشتراكك',
    payment_add_method: 'إضافة طريقة دفع',
    payment_default_badge: 'افتراضي',
    payment_expires: 'ينتهي {{month}}/{{year}}',
    payment_set_default: 'تعيين كافتراضي',
    admin_access_denied_body: 'هذا الحساب لا يملك صلاحية لوحة الإدارة. لم تُوجّه تلقائياً إلى الصفحة الرئيسية لتجنّب حلقات إعادة التوجيه.',
    go_to_app_feed: 'الذهاب إلى خلاصة التطبيق',
    invitation_selected_venue: 'المكان المختار',
    unavailable: 'غير متاح',
    home_hot_deal: 'عرض ساخن',
  },
};

function sortObj(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}

const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
const ar = JSON.parse(fs.readFileSync(path.join(localesDir, 'ar.json'), 'utf8'));

let arFixed = 0;
for (const [key, value] of Object.entries(arTranslations)) {
  if (ar[key] === en[key] || ar[key] === arPatch[key]) {
    ar[key] = value;
    arFixed += 1;
  }
}

let enAdded = 0;
let arAdded = 0;
for (const [key, value] of Object.entries(newKeys.en)) {
  if (!en[key]) {
    en[key] = value;
    enAdded += 1;
  }
  if (!ar[key]) {
    ar[key] = newKeys.ar[key] || value;
    arAdded += 1;
  } else if (newKeys.ar[key] && ar[key] === en[key]) {
    ar[key] = newKeys.ar[key];
    arAdded += 1;
  }
}

fs.writeFileSync(path.join(localesDir, 'en.json'), JSON.stringify(sortObj(en), null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(localesDir, 'ar.json'), JSON.stringify(sortObj(ar), null, 2) + '\n', 'utf8');

const secondary = ['de', 'es', 'fr', 'it', 'pt', 'tr', 'hi', 'ur'];
let synced = 0;
for (const lang of secondary) {
  const file = path.join(localesDir, `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let changed = false;
  for (const [key, value] of Object.entries(en)) {
    if (!data[key]) {
      data[key] = value;
      synced += 1;
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(file, JSON.stringify(sortObj(data), null, 2) + '\n', 'utf8');
  }
}

const remaining = Object.keys(en).filter(
  (k) => ar[k] === en[k] && !k.startsWith('language_native') && k !== 'app_name' && !k.includes('paypal') && !k.includes('stripe') && k !== 'studio_layout_square' && k !== 'studio_layout_story' && k !== 'social_color_hex_label' && k !== 'feedback_phone_ph' && k !== 'delivery_link_url_placeholder' && k !== 'per_duration' && k !== 'gift_shield' && !k.startsWith('admin_plans_env')
);

console.log(JSON.stringify({ arFixed, enAdded, arAdded, synced, remainingSameAsEn: remaining.length, remainingSample: remaining.slice(0, 15) }, null, 2));
