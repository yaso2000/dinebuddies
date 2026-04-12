const fs = require('fs');
const enPath = './src/locales/en.json';
const arPath = './src/locales/ar.json';

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

const newKeysEn = {
    "dating_available_desc": "Allow others to send you a DineBuddy Date invitation. When off, date invitations will be declined automatically.",
    "following_disabled_desc": "Let other users follow your profile. When off, no one can follow you (existing followers are unaffected)."
};

const newKeysAr = {
    "dating_available_desc": "السماح للآخرين بإرسال دعوة لموعد غرامي من DineBuddy. عند التبديل للإيقاف، سيتم رفض دعوات المواعيد تلقائياً.",
    "following_disabled_desc": "السماح للمستخدمين الآخرين بمتابعة ملفك الشخصي. عند التشغيل كإيقاف، لا يمكن لأحد متابعتك (لا يتم التأثير على المتابعين الحاليين)."
};

fs.writeFileSync(enPath, JSON.stringify({ ...en, ...newKeysEn }, null, 2));
fs.writeFileSync(arPath, JSON.stringify({ ...ar, ...newKeysAr }, null, 2));

console.log("Missing descriptive translation keys merged successfully!");
