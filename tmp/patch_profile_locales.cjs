const fs = require('fs');
const enPath = './src/locales/en.json';
const arPath = './src/locales/ar.json';

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

const newKeysEn = {
  "dating_available_disable": "Available for Dating — click to disable",
  "dating_unavailable_enable": "Not available for Dating — click to enable",
  "add_story": "Add Story",
  "subscription_plan_label": "Subscription Plan",
  "private_invites_left": "Private Invites Left",
  "resets_on": "Resets on: ",
  "extra_credits": "Extra Credits",
  "gift_badge": "GIFT 🎁",
  "top_up_btn": "+ Top Up",
  "trial_ends_label": "✨ Trial Pro Plan Active - Ends:",
  "upgrade_plan_btn": "Upgrade Plan"
};

const newKeysAr = {
  "dating_available_disable": "متاح للمواعدة — انقر للإلغاء",
  "dating_unavailable_enable": "غير متاح للمواعدة — انقر للتفعيل",
  "add_story": "إضافة قصة",
  "subscription_plan_label": "خطة الاشتراك",
  "private_invites_left": "الدعوات الخاصة المتبقية",
  "resets_on": "يُجدد في: ",
  "extra_credits": "رصيد إضافي",
  "gift_badge": "هدية 🎁",
  "top_up_btn": "+ شحن رصيد",
  "trial_ends_label": "✨ الخطة التجريبية Pro نشطة - تنتهي في:",
  "upgrade_plan_btn": "ترقية الخطة"
};

fs.writeFileSync(enPath, JSON.stringify({ ...en, ...newKeysEn }, null, 2));
fs.writeFileSync(arPath, JSON.stringify({ ...ar, ...newKeysAr }, null, 2));

console.log("Profile Translation keys merged!");
