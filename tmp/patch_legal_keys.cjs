const fs = require('fs');
const enPath = './src/locales/en.json';
const arPath = './src/locales/ar.json';

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

const newKeysEn = {
  "account_deletion_intro": "You can request permanent deletion of your DineBuddies account at any time. This page explains what is removed and how to proceed.",
  "what_happens": "What happens when you delete",
  "account_deletion_irreversible": "Account deletion is permanent and cannot be undone.",
  "we_will_remove": "We will remove:",
  "deletion_profile": "Your profile and account data",
  "deletion_invitations": "Your dining invitations and related content",
  "deletion_messages": "Your messages and chat history",
  "deletion_preferences": "Your preferences and settings",
  "deletion_backups": "Deleted accounts may remain in backups for a limited period in accordance with our Privacy Policy.",
  "how_to_delete": "How to delete your account",
  "delete_from_settings": "You are signed in. To permanently delete your account, go to Settings and use the \"Delete Account\" option. You will be asked to confirm before the deletion is processed.",
  "go_to_settings": "Go to Settings",
  "delete_need_login": "You need to be signed in to delete your account. Sign in, then go to Settings and use \"Delete Account\".",
  "log_in": "Log in",
  "contact_support": "Contact support",
  "deletion_contact_intro": "If you cannot access your account or need help with deletion, contact us and we will process your request in line with our policies.",
  "email": "Email",
  "website": "Website",
  "last_updated": "Last Updated",
  "privacy_policy": "Privacy Policy",
  "terms_of_service": "Terms of Service",
  "community_guidelines": "Community Guidelines"
};

const newKeysAr = {
  "account_deletion_intro": "يمكنك طلب حذف حساب DineBuddies الخاص بك بشكل دائم في أي وقت. توضح هذه الصفحة ما سيتم إزالته وكيفية المتابعة.",
  "what_happens": "ماذا يحدث عند الحذف",
  "account_deletion_irreversible": "حذف الحساب نهائي ولا يمكن التراجع عنه.",
  "we_will_remove": "سنقوم بإزالة:",
  "deletion_profile": "ملفك الشخصي وبيانات حسابك",
  "deletion_invitations": "دعوات تناول الطعام والمحتوى ذي الصلة",
  "deletion_messages": "رسائلك وسجل الدردشة",
  "deletion_preferences": "تفضيلاتك وإعداداتك",
  "deletion_backups": "قد تبقى الحسابات المحذوفة في النسخ الاحتياطية لفترة محدودة وفقًا لسياسة الخصوصية الخاصة بنا.",
  "how_to_delete": "كيفية حذف حسابك",
  "delete_from_settings": "أنت مسجل الدخول. لحذف حسابك نهائيًا، انتقل إلى الإعدادات واستخدم خيار \"حذف الحساب\". سيتم طلب التأكيد قبل معالجة الحذف.",
  "go_to_settings": "الذهاب إلى الإعدادات",
  "delete_need_login": "يجب تسجيل الدخول لحذف حسابك. قم بتسجيل الدخول، ثم انتقل إلى الإعدادات واستخدم \"حذف الحساب\".",
  "log_in": "تسجيل الدخول",
  "contact_support": "تواصل مع الدعم",
  "deletion_contact_intro": "إذا لم تتمكن من الوصول إلى حسابك أو كنت بحاجة إلى مساعدة في الحذف، فاتصل بنا وسنقوم بمعالجة طلبك وفقًا لسياساتنا.",
  "email": "البريد الإلكتروني",
  "website": "الموقع الإلكتروني",
  "last_updated": "آخر تحديث",
  "privacy_policy": "سياسة الخصوصية",
  "terms_of_service": "شروط الخدمة",
  "community_guidelines": "إرشادات المجتمع"
};

fs.writeFileSync(enPath, JSON.stringify({ ...en, ...newKeysEn }, null, 2));
fs.writeFileSync(arPath, JSON.stringify({ ...ar, ...newKeysAr }, null, 2));

console.log("Account Deletion & Legal Translation keys merged successfully!");
