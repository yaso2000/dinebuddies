const fs = require('fs');
const enPath = './src/locales/en.json';
const arPath = './src/locales/ar.json';

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

const newKeysEn = {
  "settings_account": "Account",
  "password": "Password",
  "settings_preferences": "Preferences",
  "language": "Language",
  "appearance": "Appearance",
  "light_mode": "Light Mode",
  "dark_mode": "Dark Mode",
  "settings_privacy": "Privacy & Security",
  "settings_about": "About & Legal",
  "help_and_support": "Help & Support",
  "privacy_policy": "Privacy Policy",
  "terms_of_service": "Terms of Service",
  "community_guidelines": "Community Guidelines",
  "account_deletion_request": "Account Deletion Request",
  "danger_zone": "Danger Zone",
  "install_app": "Install App",
  "install_ios_desc": "Tap Share → Add to Home Screen",
  "install_android_desc": "Add to your home screen",
  "business": "Business",
  "subscription_billing": "Subscription & Billing",
  "current_plan": "Current Plan",
  "payment_method": "Payment Method",
  "billing_history": "Billing History"
};

const newKeysAr = {
  "settings_account": "الحساب",
  "password": "كلمة المرور",
  "settings_preferences": "التفضيلات",
  "language": "اللغة",
  "appearance": "المظهر",
  "light_mode": "الوضع الفاتح",
  "dark_mode": "الوضع الداكن",
  "settings_privacy": "الخصوصية والأمان",
  "settings_about": "حول التطبيق والشروط",
  "help_and_support": "المساعدة والدعم",
  "privacy_policy": "سياسة الخصوصية",
  "terms_of_service": "شروط الخدمة",
  "community_guidelines": "إرشادات المجتمع",
  "account_deletion_request": "طلب حذف الحساب",
  "danger_zone": "منطقة الخطر",
  "install_app": "تثبيت التطبيق",
  "install_ios_desc": "اضغط على مشاركة ثم أضف للشاشة الرئيسية",
  "install_android_desc": "أضف إلى شاشتك الرئيسية",
  "business": "الأعمال",
  "subscription_billing": "الاشتراك والفواتير",
  "current_plan": "الخطة الحالية",
  "payment_method": "طريقة الدفع",
  "billing_history": "سجل الفواتير"
};

fs.writeFileSync(enPath, JSON.stringify({ ...en, ...newKeysEn }, null, 2));
fs.writeFileSync(arPath, JSON.stringify({ ...ar, ...newKeysAr }, null, 2));

console.log("Settings Translation keys merged successfully!");
