const fs = require('fs');
const enPath = './src/locales/en.json';
const arPath = './src/locales/ar.json';

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

const newKeysEn = {
  "business": "Business",
  "my_business_profile": "My Business Profile",
  "view_edit_inline": "View & edit inline",
  "subscription_billing": "Subscription & Billing",
  "current_plan": "Current Plan",
  "elite": "Elite",
  "professional": "Professional",
  "upgrade_available": "Upgrade Available",
  "payment_method": "Payment Method",
  "not_set": "Not set",
  "billing_history": "Billing History",
  "guest_mode": "Guest Mode",
  "guest_mode_desc": "You're browsing as a guest. Sign in to access all settings and personalize your experience!",
  "sign_in_up": "Sign In / Sign Up",
  "continue_browsing": "Continue Browsing",
  "welcome_language": "Language",
  "english": "English",
  "settings_title_page": "Settings",
  "business_account_badge": "Business Account",
  "re_enter_password": "Re-enter password",
  "security_confirm_deletion": "For your security, please enter your password to confirm account deletion.",
  "cancel": "Cancel",
  "deleting": "Deleting...",
  "delete_account_confirm": "Delete Account",
  "incorrect_password": "Incorrect password. Please try again.",
  "failed_delete_account": "Failed to delete account. Please try again.",
  "install_app": "Install App",
  "install_ios_desc": "Tap Share → Add to Home Screen",
  "install_android_desc": "Add to your home screen",
  "tap_again_confirm": "Tap again to confirm",
  "action_cannot_undone": "This action cannot be undone",
  "app_version": "DineBuddies v1.0.0"
};

const newKeysAr = {
  "business": "الأعمال",
  "my_business_profile": "ملف أعمالي",
  "view_edit_inline": "عرض وتعديل",
  "subscription_billing": "الاشتراك والفواتير",
  "current_plan": "الباقة الحالية",
  "elite": "النخبة (Elite)",
  "professional": "المحترفين (Pro)",
  "upgrade_available": "تتوفر ترقية",
  "payment_method": "طريقة الدفع",
  "not_set": "لم يتم التعيين",
  "billing_history": "سجل الفواتير",
  "guest_mode": "وضع الزائر",
  "guest_mode_desc": "أنت تتصفح كزائر. قم بتسجيل الدخول للوصول إلى جميع الإعدادات وتخصيص تجربتك!",
  "sign_in_up": "تسجيل الدخول / إنشاء حساب",
  "continue_browsing": "متابعة التصفح",
  "welcome_language": "اللغة",
  "english": "الإنجليزية",
  "settings_title_page": "الإعدادات",
  "business_account_badge": "حساب أعمال",
  "re_enter_password": "أعد إدخال كلمة المرور",
  "security_confirm_deletion": "لحمايتك، يرجى إدخال كلمة المرور لتأكيد حذف الحساب.",
  "cancel": "إلغاء",
  "deleting": "جاري الحذف...",
  "delete_account_confirm": "حذف الحساب",
  "incorrect_password": "كلمة المرور خاطئة. يرجى المحاولة مرة أخرى.",
  "failed_delete_account": "فشل حذف الحساب. يرجى المحاولة مرة أخرى.",
  "install_app": "تثبيت التطبيق",
  "install_ios_desc": "اضغط مشاركة → إضافة للشاشة الرئيسية",
  "install_android_desc": "أضف إلى شاشتك الرئيسية",
  "tap_again_confirm": "اضغط مرة أخرى للتأكيد",
  "action_cannot_undone": "لا يمكن التراجع عن هذا الإجراء",
  "app_version": "تطبيق DineBuddies الإصدار 1.0.0"
};

fs.writeFileSync(enPath, JSON.stringify({ ...en, ...newKeysEn }, null, 2));
fs.writeFileSync(arPath, JSON.stringify({ ...ar, ...newKeysAr }, null, 2));

console.log("Translation key merged!");
