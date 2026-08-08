const fs = require('fs');
const enPath = './src/locales/en.json';
const arPath = './src/locales/ar.json';

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

const newKeysEn = {
  "dating_available": "Available for Dating",
  "dating_unavailable": "Not available for Dating",
  "status_online": "Online",
  "following_disabled": "🔒 Following Disabled",
  "report_user_btn": "Report User"
};

const newKeysAr = {
  "dating_available": "متاح للمواعدة",
  "dating_unavailable": "غير متاح للمواعدة",
  "status_online": "متصل",
  "following_disabled": "🔒 المتابعة معطلة",
  "report_user_btn": "الإبلاغ عن المستخدم"
};

fs.writeFileSync(enPath, JSON.stringify({ ...en, ...newKeysEn }, null, 2));
fs.writeFileSync(arPath, JSON.stringify({ ...ar, ...newKeysAr }, null, 2));

console.log("UserProfile Translation keys merged!");
