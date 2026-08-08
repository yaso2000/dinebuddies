const fs = require('fs');
const path = require('path');

const enJsonPath = path.join(__dirname, '../src/locales/en.json');
const arJsonPath = path.join(__dirname, '../src/locales/ar.json');
let enDict = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));
let arDict = JSON.parse(fs.readFileSync(arJsonPath, 'utf8'));

// The dictionary entries we want to ensure exist
const newTranslations = {
    "tab_about": { en: "About", ar: "حول" },
    "tab_menu": { en: "Menu", ar: "المنيو" },
    "tab_services": { en: "Services", ar: "الخدمات" },
    "tab_updates": { en: "Updates", ar: "التحديثات" },
    "tab_reviews": { en: "Reviews", ar: "التقييمات" },
    "tab_photos": { en: "Photos", ar: "الصور" },
    "join_community": { en: "Join Community", ar: "انضمام للمجتمع" },
    "joined_community": { en: "Joined", ar: "منضم" },
    "leave_community": { en: "Leave", ar: "مغادرة" },
    "btn_follow": { en: "Follow", ar: "متابعة" },
    "btn_following": { en: "Following", ar: "يتابع" },
    "btn_directions": { en: "Directions", ar: "الاتجاهات" },
    "btn_website": { en: "Website", ar: "الموقع" },
    "btn_share": { en: "Share", ar: "مشاركة" },
    "btn_edit_profile": { en: "Edit Profile", ar: "تعديل الملف" },
    "no_contact_info": { en: "No contact info available", ar: "لا تتوفر معلومات اتصال" },
    "write_review": { en: "Write a Review", ar: "اكتب تقييماً" },
    "claim_business": { en: "Claim This Business", ar: "طالب بإدارة هذا النشاط" },
    "business_hours": { en: "Business Hours", ar: "ساعات العمل" },
    "see_all_photos": { en: "See All Photos", ar: "عرض كل الصور" },
    "save": { en: "Save", ar: "حفظ" },
    "cancel": { en: "Cancel", ar: "إلغاء" },
    "add_photo": { en: "Add Photo", ar: "إضافة صورة" }
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
    console.log("Updated ar.json and en.json with BusinessProfile keys.");
}

const filePaths = [
    'src/pages/BusinessProfile.jsx'
];

filePaths.forEach((relPath) => {
    const fullPath = path.join(__dirname, '..', relPath);
    if (!fs.existsSync(fullPath)) return;
    
    let content = fs.readFileSync(fullPath, 'utf8');

    // Make sure we have useTranslation
    if (!content.includes('const { t } = useTranslation()') && !content.includes('const { t, i18n } = useTranslation()')) {
        // If it's missing entirely (but we saw it was there, just in case)
        content = content.replace(/const navigate = useNavigate\(\);/, 'const navigate = useNavigate();\n    const { t, i18n } = useTranslation();');
    }

    // Tabs array replacement (often defined as an array of objects)
    content = content.replace(/label:\s*['"]About['"]/g, "label: t('tab_about', 'About')");
    content = content.replace(/label:\s*['"]Menu['"]/g, "label: t('tab_menu', 'Menu')");
    content = content.replace(/label:\s*['"]Services['"]/g, "label: t('tab_services', 'Services')");
    content = content.replace(/label:\s*['"]Updates['"]/g, "label: t('tab_updates', 'Updates')");
    content = content.replace(/label:\s*['"]Reviews['"]/g, "label: t('tab_reviews', 'Reviews')");
    content = content.replace(/label:\s*['"]Photos['"]/g, "label: t('tab_photos', 'Photos')");

    // Button texts
    content = content.replace(/>\s*Join Community\s*</g, ">{t('join_community', 'Join Community')}<");
    content = content.replace(/>\s*Joined\s*</g, ">{t('joined_community', 'Joined')}<");
    content = content.replace(/>\s*Follow\s*</g, ">{t('btn_follow', 'Follow')}<");
    content = content.replace(/>\s*Following\s*</g, ">{t('btn_following', 'Following')}<");
    content = content.replace(/>\s*Directions\s*</g, ">{t('btn_directions', 'Directions')}<");
    content = content.replace(/>\s*Website\s*</g, ">{t('btn_website', 'Website')}<");
    content = content.replace(/>\s*Share\s*</g, ">{t('btn_share', 'Share')}<");
    content = content.replace(/>\s*Edit Profile\s*</g, ">{t('btn_edit_profile', 'Edit Profile')}<");
    content = content.replace(/>\s*Claim This Business\s*</g, ">{t('claim_business', 'Claim This Business')}<");

    // Other UI labels
    content = content.replace(/>\s*Business Hours\s*</g, ">{t('business_hours', 'Business Hours')}<");
    content = content.replace(/>\s*See All Photos\s*</g, ">{t('see_all_photos', 'See All Photos')}<");
    content = content.replace(/>\s*Write a Review\s*</g, ">{t('write_review', 'Write a Review')}<");
    content = content.replace(/>\s*Save\s*</g, ">{t('save', 'Save')}<");
    content = content.replace(/>\s*Cancel\s*</g, ">{t('cancel', 'Cancel')}<");
    content = content.replace(/>\s*Add Photo\s*</g, ">{t('add_photo', 'Add Photo')}<");

    // Action strings
    content = content.replace(/'No contact info available'/g, "t('no_contact_info', 'No contact info available')");

    fs.writeFileSync(fullPath, content);
    console.log(`Patched static strings in ${relPath}`);
});
