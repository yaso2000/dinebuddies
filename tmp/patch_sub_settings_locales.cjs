const fs = require('fs');
const enPath = './src/locales/en.json';
const arPath = './src/locales/ar.json';

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

const newKeysEn = {
  "error_same_email": "Please enter a different email address",
  "error_reauth_email": "Please log out and log back in before changing your email",
  "error_email_in_use": "This email is already in use",
  "error_update_email": "Failed to update email. Please try again.",
  "email_settings_title": "Email Settings",
  "update_email_address": "Update Email Address",
  "your_current_email": "Your current email:",
  "verified": "Verified",
  "email_not_verified": "Email not verified",
  "new_email_address": "New Email Address",
  "enter_new_email": "Enter new email",
  "email_updated_success": "Email updated successfully! Verification email sent.",
  "updating": "Updating...",
  "update_email_btn": "Update Email",
  "note": "Note:",
  "email_verification_note": "You will receive a verification email at your new address. Please verify it to complete the change.",
  "error_passwords_match": "New passwords do not match",
  "error_password_length": "Password must be at least 6 characters",
  "error_current_password": "Current password is incorrect",
  "error_weak_password": "Password is too weak",
  "error_update_password": "Failed to update password. Please try again.",
  "password_settings_title": "Password Settings",
  "change_password": "Change Password",
  "change_password_desc": "Update your password to keep your account secure",
  "current_password": "Current Password",
  "enter_current_password": "Enter current password",
  "new_password": "New Password",
  "enter_new_password": "Enter new password",
  "confirm_new_password": "Confirm New Password",
  "confirm_new_password_placeholder": "Confirm new password",
  "password_updated_success": "Password updated successfully!",
  "update_password_btn": "Update Password",
  "password_requirements": "Password Requirements:",
  "req_min_length": "At least 6 characters long",
  "req_mix_chars": "Mix of letters and numbers recommended",
  "req_avoid_common": "Avoid common passwords",
  "push_diagnostics": "⚙️ Push Diagnostics",
  "push_diagnostics_desc": "If you aren't receiving notifications, use this tool to debug your device's connection.",
  "run_device_diagnostics": "Run Device Diagnostics"
};

const newKeysAr = {
  "error_same_email": "يرجى كتابة عنوان بريد إلكتروني مختلف",
  "error_reauth_email": "يرجى تسجيل الخروج وتسجيل الدخول مرة أخرى قبل تغيير البريد الإلكتروني",
  "error_email_in_use": "هذا البريد الإلكتروني مستخدم بالفعل",
  "error_update_email": "فشل تحديث البريد الإلكتروني. يرجى المحاولة مرة أخرى.",
  "email_settings_title": "إعدادات البريد الإلكتروني",
  "update_email_address": "تحديث عنوان البريد الإلكتروني",
  "your_current_email": "بريدك الإلكتروني الحالي:",
  "verified": "تم التحقق",
  "email_not_verified": "البريد الإلكتروني غير متحقق منه",
  "new_email_address": "البريد الإلكتروني الجديد",
  "enter_new_email": "أدخل البريد الإلكتروني الجديد",
  "email_updated_success": "تم تحديث البريد الإلكتروني بنجاح! تم إرسال رسالة تحقق.",
  "updating": "جاري التحديث...",
  "update_email_btn": "تحديث البريد الإلكتروني",
  "note": "ملاحظة:",
  "email_verification_note": "ستتلقى رسالة تحقق على بريدك الجديد. يرجى التحقق منه لإكمال التغيير.",
  "error_passwords_match": "كلمات المرور الجديدة غير متطابقة",
  "error_password_length": "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل",
  "error_current_password": "كلمة المرور الحالية غير صحيحة",
  "error_weak_password": "كلمة المرور ضعيفة جداً",
  "error_update_password": "فشل تحديث كلمة المرور. يرجى المحاولة مرة أخرى.",
  "password_settings_title": "إعدادات كلمة المرور",
  "change_password": "تغيير كلمة المرور",
  "change_password_desc": "قم بتحديث كلمة المرور للحفاظ على أمان حسابك",
  "current_password": "كلمة المرور الحالية",
  "enter_current_password": "أدخل كلمة المرور الحالية",
  "new_password": "كلمة المرور الجديدة",
  "enter_new_password": "أدخل كلمة المرور الجديدة",
  "confirm_new_password": "تأكيد كلمة المرور الجديدة",
  "confirm_new_password_placeholder": "أدخل كلمة المرور الجديدة للتأكيد",
  "password_updated_success": "تم تحديث كلمة المرور بنجاح!",
  "update_password_btn": "تحديث كلمة المرور",
  "password_requirements": "متطلبات كلمة المرور:",
  "req_min_length": "6 أحرف على الأقل",
  "req_mix_chars": "يفضل دمج الأحرف والأرقام",
  "req_avoid_common": "تجنب كلمات المرور الشائعة",
  "push_diagnostics": "⚙️ فحص الإشعارات",
  "push_diagnostics_desc": "إذا كنت لا تتلقى الإشعارات، استخدم هذه الأداة لفحص اتصال جهازك.",
  "run_device_diagnostics": "تشغيل فحص الجهاز"
};

fs.writeFileSync(enPath, JSON.stringify({ ...en, ...newKeysEn }, null, 2));
fs.writeFileSync(arPath, JSON.stringify({ ...ar, ...newKeysAr }, null, 2));

console.log("Settings subpages Translation keys merged successfully!");
