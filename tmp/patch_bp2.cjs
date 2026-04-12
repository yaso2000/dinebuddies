const fs = require('fs');
const path = require('path');

const enJsonPath = path.join(__dirname, '../src/locales/en.json');
const arJsonPath = path.join(__dirname, '../src/locales/ar.json');
let enDict = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));
let arDict = JSON.parse(fs.readFileSync(arJsonPath, 'utf8'));

const newTranslations = {
    // MenuShowcase existing keys
    "drag_to_reorder": { en: "Drag to reorder", ar: "اسحب لإعادة الترتيب" },
    "item_name": { en: "Item Name", ar: "اسم الصنف" },
    "price": { en: "Price", ar: "السعر" },
    "description": { en: "Description", ar: "الوصف" },
    "category": { en: "Category", ar: "الفئة" },
    "image": { en: "Image", ar: "صورة" },
    "optional": { en: "Optional", ar: "اختياري" },
    "change_image": { en: "Change Image", ar: "تغيير الصورة" },
    "saving": { en: "Saving...", ar: "جاري الحفظ..." },
    "edit": { en: "Edit", ar: "تعديل" },
    "delete": { en: "Delete", ar: "حذف" },
    "menu": { en: "Menu", ar: "قائمة الطعام" },
    "order_updated": { en: "Order updated", ar: "تم تحديث الترتيب" },
    "update_error": { en: "Update failed", ar: "فشل التحديث" },
    "upload_error": { en: "Failed to upload image", ar: "فشل رفع الصورة" },
    "fill_required_fields": { en: "Please fill in required fields", ar: "يرجى ملء الحقول المطلوبة" },
    "confirm_delete_item": { en: "Delete this menu item?", ar: "حذف هذا الصنف؟" },
    "add_item": { en: "Add Item", ar: "إضافة صنف" },
    "add_menu_item": { en: "Add Menu Item", ar: "إضافة صنف للقائمة" },
    "item_name_placeholder": { en: "e.g., Margherita Pizza", ar: "مثال: بيتزا مارغريتا" },
    "description_placeholder": { en: "Describe this item...", ar: "صف هذا العنصر..." },
    "choose_image": { en: "Choose Image", ar: "اختر صورة" },
    "uploading": { en: "Uploading...", ar: "جاري الرفع..." },
    "add_another": { en: "+ Add", ar: "+ إضافة" },
    "all": { en: "All", ar: "الكل" },
    "add_first_item": { en: "Press + above to add your first menu item", ar: "اضغط على + في الأعلى لإضافة أول صنف" },
    "no_menu_items": { en: "No menu items yet", ar: "لا يوجد أصناف في القائمة بعد" },
    "starters": { en: "Starters", ar: "المقبلات" },
    "mains": { en: "Main Courses", ar: "الأطباق الرئيسية" },
    "desserts": { en: "Desserts", ar: "الحلويات" },
    "drinks": { en: "Drinks", ar: "المشروبات" },

    // EnhancedGallery translations
    "photos": { en: "Photos", ar: "الصور" },
    "upload_photo": { en: "Upload Photo", ar: "رفع صورة" },
    "set_as_cover": { en: "Set as Cover", ar: "تعيين كغلاف" },
    "see_all": { en: "See All", ar: "عرض الكل" },
    "no_photos_yet": { en: "No photos yet", ar: "لا توجد صور بعد" },
    "gallery": { en: "Gallery", ar: "المعرض" },

    // BusinessHours translations
    "monday": { en: "Monday", ar: "الاثنين" },
    "tuesday": { en: "Tuesday", ar: "الثلاثاء" },
    "wednesday": { en: "Wednesday", ar: "الأربعاء" },
    "thursday": { en: "Thursday", ar: "الخميس" },
    "friday": { en: "Friday", ar: "الجمعة" },
    "saturday": { en: "Saturday", ar: "السبت" },
    "sunday": { en: "Sunday", ar: "الأحد" },
    "open": { en: "Open", ar: "مفتوح" },
    "closed": { en: "Closed", ar: "مغلق" },
    "hours_24": { en: "24 Hours", ar: "على مدار الساعة" },
    "edit_hours": { en: "Edit Hours", ar: "تعديل الساعات" },
    "save_hours": { en: "Save Hours", ar: "حفظ الساعات" },
    "add_time_slot": { en: "Add Time Slot", ar: "إضافة فترة زمنية" },

    // DeliveryLinksSection translations
    "order_delivery": { en: "Order Delivery", ar: "اطلب توصيل" },
    "save_links": { en: "Save Links", ar: "حفظ الروابط" }
};

let dictUpdated = false;
for (const [key, trans] of Object.entries(newTranslations)) {
    if (!enDict[key]) {
        enDict[key] = trans.en;
        dictUpdated = true;
    }
    if (!arDict[key]) {
        arDict[key] = trans.ar;
        dictUpdated = true;
    }
}

if (dictUpdated) {
    fs.writeFileSync(enJsonPath, JSON.stringify(enDict, null, 2));
    fs.writeFileSync(arJsonPath, JSON.stringify(arDict, null, 2));
    console.log("Updated ar.json and en.json with Sub-component keys.");
}

function processComponent(relPath, replacements) {
    const fullPath = path.join(__dirname, '..', relPath);
    if (!fs.existsSync(fullPath)) return;
    
    let content = fs.readFileSync(fullPath, 'utf8');

    // Make sure we have useTranslation
    if (!content.includes('useTranslation')) {
        content = content.replace(/import React(.*?);/, 'import React$1;\nimport { useTranslation } from \'react-i18next\';');
    }
    
    // Check if const { t } is extracted. We look for the component definition.
    // Example: const EnhancedGallery = ({...}) => { or export default function BusinessHours({...}) {
    if (!content.includes('const { t } = useTranslation()') && !content.includes('const { t, i18n } = useTranslation()')) {
        // Find standard function declaration or arrow function opening
        content = content.replace(/(const \w+\s*=\s*(async\s*)?\([^)]*\)\s*=>\s*\{|function \w+\([^)]*\)\s*\{)/, "$1\n    const { t } = useTranslation();\n");
    }

    for (let r of replacements) {
        content = content.replace(r.search, r.replace);
    }

    fs.writeFileSync(fullPath, content);
    console.log(`Patched static strings in ${relPath}`);
}


// --- 1. EnhancedGallery ---
processComponent('src/components/EnhancedGallery.jsx', [
    { search: />\s*Photos\s*</g, replace: ">{t('photos', 'Photos')}<" },
    { search: />\s*Upload Photo\s*</g, replace: ">{t('upload_photo', 'Upload Photo')}<" },
    { search: />\s*Set as Cover\s*</g, replace: ">{t('set_as_cover', 'Set as Cover')}<" },
    { search: />\s*See all\s*</g, replace: ">{t('see_all', 'See all')}<" },
    { search: />\s*No photos yet\s*</g, replace: ">{t('no_photos_yet', 'No photos yet')}<" },
    { search: />\s*Gallery\s*</g, replace: ">{t('gallery', 'Gallery')}<" },
    { search: /confirm\('Delete this photo\?'\)/g, replace: "confirm(t('confirm_delete_image', 'Delete this photo?'))" }
]);

// --- 2. DeliveryLinksSection ---
processComponent('src/components/DeliveryLinksSection.jsx', [
    { search: />\s*Order Delivery\s*</g, replace: ">{t('order_delivery', 'Order Delivery')}<" },
    { search: />\s*Save Links\s*</g, replace: ">{t('save_links', 'Save Links')}<" },
    { search: />\s*Cancel\s*</g, replace: ">{t('cancel', 'Cancel')}<" }
]);

// --- 3. BusinessHours ---
processComponent('src/components/BusinessHours.jsx', [
    { search: />\s*Business Hours\s*</g, replace: ">{t('business_hours', 'Business Hours')}<" },
    { search: />\s*Monday\s*</g, replace: ">{t('monday', 'Monday')}<" },
    { search: />\s*Tuesday\s*</g, replace: ">{t('tuesday', 'Tuesday')}<" },
    { search: />\s*Wednesday\s*</g, replace: ">{t('wednesday', 'Wednesday')}<" },
    { search: />\s*Thursday\s*</g, replace: ">{t('thursday', 'Thursday')}<" },
    { search: />\s*Friday\s*</g, replace: ">{t('friday', 'Friday')}<" },
    { search: />\s*Saturday\s*</g, replace: ">{t('saturday', 'Saturday')}<" },
    { search: />\s*Sunday\s*</g, replace: ">{t('sunday', 'Sunday')}<" },
    { search: />\s*Open\s*</g, replace: ">{t('open', 'Open')}<" },
    { search: />\s*Closed\s*</g, replace: ">{t('closed', 'Closed')}<" },
    { search: />\s*24 Hours\s*</g, replace: ">{t('hours_24', '24 Hours')}<" },
    { search: />\s*Edit Hours\s*</g, replace: ">{t('edit_hours', 'Edit Hours')}<" },
    { search: />\s*Save Hours\s*</g, replace: ">{t('save_hours', 'Save Hours')}<" },
    { search: />\s*Saving\.\.\.\s*</g, replace: ">{t('saving', 'Saving...')}<" },
    { search: />\s*\+\s*Add Time Slot\s*</g, replace: ">+ {t('add_time_slot', 'Add Time Slot')}<" },
    { search: />\s*Cancel\s*</g, replace: ">{t('cancel', 'Cancel')}<" }
]);
