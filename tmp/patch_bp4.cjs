const fs = require('fs');
const path = require('path');

const enJsonPath = path.join(__dirname, '../src/locales/en.json');
const arJsonPath = path.join(__dirname, '../src/locales/ar.json');
let enDict = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));
let arDict = JSON.parse(fs.readFileSync(arJsonPath, 'utf8'));

const newTranslations = {
    // PostCard & PremiumOfferCard translations
    "edit": { en: "Edit", ar: "تعديل" },
    "hide": { en: "Hide", ar: "إخفاء" },
    "delete": { en: "Delete", ar: "حذف" },
    "report_post": { en: "Report Post", ar: "الإبلاغ عن المنشور" },
    "upcoming_event": { en: "UPCOMING EVENT", ar: "حدث قادم" },
    "view_event_details": { en: "View Event Details", ar: "عرض تفاصيل الحدث" },
    "comments": { en: "Comments", ar: "تعليقات" },
    "freeze": { en: "Freeze", ar: "تجميد" },
    "republish": { en: "Re-Publish", ar: "إعادة النشر" },
    "frozen": { en: "FROZEN", ar: "مجمد" }
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
    console.log("Updated ar.json and en.json with PremiumOffer and PostCard keys.");
}

function processComponent(relPath, replacements, needsInjection = false, componentNamePattern = null) {
    const fullPath = path.join(__dirname, '..', relPath);
    if (!fs.existsSync(fullPath)) return;
    
    let content = fs.readFileSync(fullPath, 'utf8');

    if (needsInjection) {
        if (!content.includes('useTranslation')) {
            content = content.replace(/import React(.*?);/, 'import React$1;\nimport { useTranslation } from \'react-i18next\';');
        }
        if (!content.includes('const { t } = useTranslation()') && !content.includes('const { t, i18n } = useTranslation()') && componentNamePattern) {
            content = content.replace(componentNamePattern, "$1\n    const { t } = useTranslation();\n");
        }
    }

    for (let r of replacements) {
        content = content.replace(r.search, r.replace);
    }

    fs.writeFileSync(fullPath, content);
    console.log(`Patched static strings in ${relPath}`);
}

// --- 1. PostCard.jsx ---
// PostCard already imports useTranslation and has const { t } = useTranslation();
processComponent('src/components/PostCard.jsx', [
    { search: />\s*Edit\s*</g, replace: "> {t('edit', 'Edit')}<" },
    { search: />\s*Hide\s*</g, replace: "> {t('hide', 'Hide')}<" },
    { search: />\s*Delete\s*</g, replace: "> {t('delete', 'Delete')}<" },
    { search: />\s*Report Post\s*</g, replace: ">{t('report_post', 'Report Post')}<" },
    { search: /🎟️ UPCOMING EVENT/g, replace: "🎟️ {t('upcoming_event', 'UPCOMING EVENT')}" },
    { search: />\s*View Event Details\s*</g, replace: ">{t('view_event_details', 'View Event Details')}<" },
    { search: />\s*Cancel\s*</g, replace: ">{t('cancel', 'Cancel')}<" },
    { search: /\{savingEdit \? 'Saving\.\.\.' : 'Save'\}/g, replace: "{savingEdit ? t('saving', 'Saving...') : t('save', 'Save')}" },
    { search: /\{post\.comments\.length\} Comments<span/g, replace: "{post.comments.length} {t('comments', 'Comments')}<span" }, // in case it wraps
    { search: />\{post\.comments\.length\} Comments</g, replace: ">{post.comments.length} {t('comments', 'Comments')}<" },
    { search: />\s*Comments\s*</g, replace: ">{t('comments', 'Comments')}<" }
], false);


// --- 2. PremiumOfferCard.jsx ---
processComponent('src/components/PremiumOfferCard.jsx', [
    { search: />\s*Edit\s*</g, replace: "> {t('edit', 'Edit')}<" },
    { search: />\s*Freeze\s*</g, replace: "> {t('freeze', 'Freeze')}<" },
    { search: />\s*Re-Publish\s*</g, replace: "> {t('republish', 'Re-Publish')}<" },
    { search: />\s*FROZEN\s*</g, replace: ">{t('frozen', 'FROZEN')}<" }
], true, /(const PremiumOfferCard = \(\{\s*.*?\s*\}\) =>\s*\{)/s);

// NOTE for Regex: The regex /s flag allows .*? to match newlines inside the component arguments block.
