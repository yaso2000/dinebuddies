const fs = require('fs');
const enPath = './src/locales/en.json';
const arPath = './src/locales/ar.json';

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

const newKeysEn = {
  "edit_profile": "Edit Profile",
  "create_invitation": "Create Invitation",
  "guest_welcome_title": "Join DineBuddies",
  "guest_profile_desc": "Create an account to customize your profile and join events.",
  "login_signup": "Login / Sign Up",
  "my_plan": "My Plan",
  "manage_subscription": "Manage Subscription",
  "my_private_posts": "My Private Posts",
  "confirm_delete_all_private": "Are you sure you want to delete all your private invitations?",
  "clear_all": "Clear All",
  "received_invitations": "Received Invitations",
  "business_account_badge": "Business Account"
};

const newKeysAr = {
  "edit_profile": "تعديل الملف الشخصي",
  "create_invitation": "إنشاء دعوة",
  "guest_welcome_title": "انضم إلى DineBuddies",
  "guest_profile_desc": "أنشئ حساباً لتخصيص ملفك الشخصي والانضمام إلى الفعاليات.",
  "login_signup": "تسجيل الدخول / إنشاء حساب",
  "my_plan": "خطتي",
  "manage_subscription": "إدارة الاشتراك",
  "my_private_posts": "منشوراتي الخاصة",
  "confirm_delete_all_private": "هل أنت متأكد أنك تريد حذف جميع دعواتك الخاصة؟",
  "clear_all": "مسح الكل",
  "received_invitations": "الدعوات المستلمة",
  "business_account_badge": "حساب أعمال"
};

fs.writeFileSync(enPath, JSON.stringify({ ...en, ...newKeysEn }, null, 2));
fs.writeFileSync(arPath, JSON.stringify({ ...ar, ...newKeysAr }, null, 2));

console.log("Missing Profile Translation keys merged!");
