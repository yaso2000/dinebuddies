const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, '../src/locales/en.json');
const arPath = path.join(__dirname, '../src/locales/ar.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

// Keys map
const newKeys = {
    // VenueLocationPicker
    search_dineBuddies_venue: { en: "Search registered venues on DineBuddies...", ar: "ابحث عن الأماكن المسجلة في داين باديز..." },
    google_places: { en: "Google Places", ar: "أماكن جوجل" },
    dinbuddies_venues: { en: "DineBuddies Venues", ar: "منشآت داين باديز" },
    try_google_places_hint: { en: "Try Google Places for unregistered venues", ar: "جرب أماكن جوجل للمنشآت غير المسجلة" },
    switch_to_google: { en: "Search on Google Places instead", ar: "ابحث في أماكن جوجل بدلاً من ذلك" },
    
    // MediaSelector
    upload_media_tab: { en: "Upload", ar: "رفع ملف" },
    video_media_tab: { en: "Video", ar: "فيديو" },
    take_photo: { en: "Take Photo", ar: "التقاط صورة" },
    record_video: { en: "Record", ar: "تسجيل" },
    choose_how_to_add_photo: { en: "Choose how to add your photo:", ar: "اختر طريقة إضافة الصورة:" },
    choose_how_to_add_video: { en: "Choose how to add your video:", ar: "اختر طريقة إضافة الفيديو:" },
    remove_preview: { en: "Remove", ar: "إزالة" },
    change_selection: { en: "Change Selection", ar: "تغيير الاختيار" },
    venue_photos_tab: { en: "Venue Photos", ar: "صور المنشأة" },
    google_photos_tab: { en: "Google Photos", ar: "صور جوجل" },
    will_be_saved_permanently: { en: "Will be saved permanently", ar: "سيتم الحفظ بشكل دائم" },

    // CreateInvitation (Validation & Options)
    multi_select: { en: "(SELECT MULTIPLE)", ar: "(تحديد متعدد)" },
    non_binary: { en: "Non-Binary", ar: "غير محدد" },
    please_select_gender_group: { en: "Please select at least one gender group", ar: "الرجاء تحديد فئة جنس واحدة على الأقل" },
    please_select_age_group: { en: "Please select at least one age group", ar: "الرجاء تحديد فئة عمرية واحدة على الأقل" },
    select_at_least_one_gender: { en: "Please select at least one option", ar: "الرجاء تحديد خيار واحد على الأقل" },
    select_at_least_one_age: { en: "Please select at least one age group", ar: "الرجاء تحديد فئة عمرية واحدة على الأقل" },
    choose_color_theme: { en: "CHOOSE COLOR THEME", ar: "اختر لون السمة المعروضة" }
};

for (const [key, value] of Object.entries(newKeys)) {
    en[key] = value.en;
    ar[key] = value.ar;
}

fs.writeFileSync(enPath, JSON.stringify(en, null, 2));
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2));

console.log('Successfully patched all Form UI translations!');
