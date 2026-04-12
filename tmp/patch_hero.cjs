const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/pages/BusinessProfile.jsx');
if (!fs.existsSync(file)) process.exit(1);

let content = fs.readFileSync(file, 'utf8');

const replacements = [
    { search: />\{reviews\.length\}\s*Reviews<\/div>/g, replace: ">{reviews.length} {t('reviews', 'Reviews')}</div>" },
    { search: />Invites<\/div>/g, replace: ">{t('invites', 'Invites')}</div>" },
    { search: />Members<\/div>/g, replace: ">{t('members', 'Members')}</div>" },
    { search: /isMember \? `✓ Community Member \(\$\{memberCount\}\)` : '\+ Join Community'/g, replace: "isMember ? `✓ ${t('community_member', 'Community Member')} (${memberCount})` : `+ ${t('join_community', 'Join Community')}`" },
    { search: /<FaUserPlus[^{>]*\{\{[^}]*\}\}[^>]*\/>\s*Create Invitation/g, replace: "<FaUserPlus style={{ fontSize: '1.2rem' }} /> {t('create_invitation', 'Create Invitation')}" },
    { search: /<span style=\{\{ fontSize: '1\.5rem' \}\}>📄<\/span>\s*About Us/g, replace: "<span style={{ fontSize: '1.5rem' }}>📄</span> {t('about_us', 'About Us')}" },
    { search: />No description available<\/p>/g, replace: ">{t('no_description_available', 'No description available')}</p>" },
    { search: />Click Edit to add one<\/p>/g, replace: ">{t('click_edit_to_add', 'Click Edit to add one')}</p>" },
    { search: /\{businessInfo\.businessType\}\{businessInfo\.cuisineType \? ` • \$\{businessInfo\.cuisineType\}` : ''\}/g, replace: "{businessInfo.businessType ? t(businessInfo.businessType, businessInfo.businessType) : ''}{businessInfo.cuisineType ? ` • ${t(businessInfo.cuisineType, businessInfo.cuisineType)}` : ''}" },
    { search: /coverUploading \? '⏳ Uploading\.\.\.' : '📷 Edit Cover'/g, replace: "coverUploading ? `⏳ ${t('uploading', 'Uploading...')}` : `📷 ${t('edit_cover', 'Edit Cover')}`" },
];

for (let r of replacements) {
    content = content.replace(r.search, r.replace);
}

fs.writeFileSync(file, content);
console.log("Patched BusinessProfile.jsx Hero Section");

// Now update locales
const enJsonPath = path.join(__dirname, '../src/locales/en.json');
const arJsonPath = path.join(__dirname, '../src/locales/ar.json');
let enDict = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));
let arDict = JSON.parse(fs.readFileSync(arJsonPath, 'utf8'));

const newTranslations = {
    "reviews": { en: "Reviews", ar: "مراجعات" },
    "invites": { en: "Invites", ar: "دعوات" },
    "members": { en: "Members", ar: "أعضاء" },
    "community_member": { en: "Community Member", ar: "عضو فالمجتمع" },
    "join_community": { en: "Join Community", ar: "إنضم للمجتمع" },
    "create_invitation": { en: "Create Invitation", ar: "إنشاء دعوة" },
    "about_us": { en: "About Us", ar: "نبذة عنا" },
    "no_description_available": { en: "No description available", ar: "لا يوجد وصف متاح" },
    "click_edit_to_add": { en: "Click Edit to add one", ar: "انقر على تعديل لإضافته" },
    "uploading": { en: "Uploading...", ar: "جاري الرفع..." },
    "edit_cover": { en: "Edit Cover", ar: "تعديل الغلاف" },
    // Common Categories
    "Restaurant": { en: "Restaurant", ar: "مطعـم" },
    "Cafe / Coffee Shop": { en: "Cafe / Coffee Shop", ar: "مقهـى" },
    "Bakery": { en: "Bakery", ar: "مخبـز" },
    "Desserts": { en: "Desserts", ar: "حلويات" },
    "Venue": { en: "Venue", ar: "منشـأة" },
    "Takeaway": { en: "Takeaway", ar: "سفري" },
    "Dine-in": { en: "Dine-in", ar: "محلي" },
    "Fast Food": { en: "Fast Food", ar: "وجبات سريعة" },
    "Fine Dining": { en: "Fine Dining", ar: "مطعم فاخر" },
    "Casual Dining": { en: "Casual Dining", ar: "مطعم غير رسمي" },
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
    console.log("Updated ar.json and en.json with Hero section keys and common categories.");
}
