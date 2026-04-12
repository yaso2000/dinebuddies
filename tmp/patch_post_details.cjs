const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/pages/PostDetails.jsx');
if (!fs.existsSync(file)) process.exit(1);

let content = fs.readFileSync(file, 'utf8');

// Add translation hook
if (!content.includes('useTranslation')) {
    content = content.replace("import { useParams", "import { useTranslation } from 'react-i18next';\nimport { useParams");
}

if (!content.includes('const { t, i18n } = useTranslation();')) {
    content = content.replace("const navigate = useNavigate();", "const navigate = useNavigate();\n    const { t, i18n } = useTranslation();");
}

// Replace strings
content = content.replace(/>Post not found<\/h2>/g, ">{t('post_not_found', 'Post not found')}</h2>");
content = content.replace(/>This post may have been deleted\.\<\/p>/g, ">{t('post_deleted', 'This post may have been deleted.')}</p>");
content = content.replace(/>Go Back<\/button>/g, ">{t('btn_go_back', 'Go Back')}</button>");

// Replace Header text
content = content.replace(/Post[\r\n\s]*<\/h2>/, "{t('post_title', 'Post')}</h2>");

// Fix Back Arrow
content = content.replace(/<FaChevronLeft size=\{18\} \/>/, "<FaChevronLeft size={18} style={{ transform: i18n.dir() === 'rtl' ? 'rotate(180deg)' : 'none' }} />");

// Replace Featured Post text
content = content.replace(/>Featured Post ✨<\/div>/g, ">{t('featured_post', 'Featured Post')} ✨</div>");

fs.writeFileSync(file, content);
console.log("Patched PostDetails.jsx successfully.");

// Update Locales
const enJsonPath = path.join(__dirname, '../src/locales/en.json');
const arJsonPath = path.join(__dirname, '../src/locales/ar.json');
let enDict = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));
let arDict = JSON.parse(fs.readFileSync(arJsonPath, 'utf8'));

const updates = {
    "post_title": { en: "Post", ar: "منشور" },
    "post_not_found": { en: "Post not found", ar: "المنشور غير موجود" },
    "post_deleted": { en: "This post may have been deleted.", ar: "ربما تم حذف هذا المنشور." },
    "btn_go_back": { en: "Go Back", ar: "العودة" },
    "featured_post": { en: "Featured Post", ar: "منشور مميز" }
};

let dictUpdated = false;
for (const [key, trans] of Object.entries(updates)) {
    if (enDict[key] !== trans.en) { enDict[key] = trans.en; dictUpdated = true; }
    if (arDict[key] !== trans.ar) { arDict[key] = trans.ar; dictUpdated = true; }
}

if (dictUpdated) {
    fs.writeFileSync(enJsonPath, JSON.stringify(enDict, null, 2));
    fs.writeFileSync(arJsonPath, JSON.stringify(arDict, null, 2));
    console.log("Updated ar.json and en.json with PostDetails keys.");
}
