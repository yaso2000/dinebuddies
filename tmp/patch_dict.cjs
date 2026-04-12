const fs = require('fs');
const path = require('path');

const enJsonPath = path.join(__dirname, '../src/locales/en.json');
const arJsonPath = path.join(__dirname, '../src/locales/ar.json');
let enDict = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));
let arDict = JSON.parse(fs.readFileSync(arJsonPath, 'utf8'));

const updates = {
    // Overwrite community member typo
    "community_member": { en: "Community Member", ar: "عضو في المجتمع" },
    
    // Add missing feedback section keys
    "feedback_box": { en: "Feedback & Complaints", ar: "الشكاوي والاقتراحات" },
    "feedback_desc": { en: "Have a complaint or suggestion? Contact the management directly and privately.", ar: "هل لديك شكوى أو اقتراح؟ تواصل مع الإدارة مباشرة وبسرية تامة." },
    "send_feedback_btn": { en: "Send Feedback", ar: "إرسال رسالة" },
    
    // Add missing highlights keys
    "offers": { en: "Offers", ar: "العروض" },
    "featured_posts": { en: "Featured Posts", ar: "منشورات مميزة" },
};

let dictUpdated = false;
for (const [key, trans] of Object.entries(updates)) {
    // Overwrite in case the key exists
    if (enDict[key] !== trans.en) {
        enDict[key] = trans.en;
        dictUpdated = true;
    }
    if (arDict[key] !== trans.ar) {
        arDict[key] = trans.ar;
        dictUpdated = true;
    }
}

if (dictUpdated) {
    fs.writeFileSync(enJsonPath, JSON.stringify(enDict, null, 2));
    fs.writeFileSync(arJsonPath, JSON.stringify(arDict, null, 2));
    console.log("Updated ar.json and en.json with latest keys!");
} else {
    console.log("No new keys to patch.");
}
