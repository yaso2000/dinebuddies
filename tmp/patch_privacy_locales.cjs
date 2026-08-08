const fs = require('fs');
const enPath = './src/locales/en.json';
const arPath = './src/locales/ar.json';

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

const newKeysEn = {
  "error_update_settings": "Failed to update settings. Please try again.",
  "privacy_settings_desc": "Control who can see your information and interact with you",
  "profile_visibility": "Profile Visibility",
  "public_desc": "Anyone can see your profile",
  "friends_only": "Friends Only",
  "friends_only_desc": "Only your friends can see your profile",
  "private": "Private",
  "private_desc": "Only you can see your profile",
  "privacy_options": "Privacy Options",
  "show_email": "Show Email",
  "show_email_desc": "Display your email on your profile",
  "show_location": "Show Location",
  "show_location_desc": "Display your location on your profile",
  "allow_messages": "Allow Messages",
  "allow_messages_desc": "Let others send you messages",
  "allow_invitations": "Allow Invitations",
  "allow_invitations_desc": "Let others send you invitations",
  "show_activity": "Show Activity",
  "show_activity_desc": "Display your activity status",
  "available_for_dating": "Available for DineBuddy Date",
  "privacy_saved_success": "Privacy settings saved successfully!",
  "save_changes": "Save Changes"
};

const newKeysAr = {
  "error_update_settings": "فشل تحديث الإعدادات. يرجى المحاولة مرة أخرى.",
  "privacy_settings_desc": "تحكم فيمن يمكنه رؤية معلوماتك والتفاعل معك",
  "profile_visibility": "رؤية الملف الشخصي",
  "public_desc": "يمكن لأي شخص رؤية ملفك الشخصي",
  "friends_only": "الأصدقاء فقط",
  "friends_only_desc": "أصدقاؤك فقط يمكنهم رؤية ملفك الشخصي",
  "private": "خاص",
  "private_desc": "أنت فقط من يمكنه رؤية ملفك الشخصي",
  "privacy_options": "خيارات الخصوصية",
  "show_email": "إظهار البريد الإلكتروني",
  "show_email_desc": "عرض بريدك الإلكتروني في ملفك الشخصي",
  "show_location": "إظهار الموقع",
  "show_location_desc": "عرض موقعك في ملفك الشخصي",
  "allow_messages": "السماح بالرسائل",
  "allow_messages_desc": "السماح للآخرين بإرسال رسائل إليك",
  "allow_invitations": "السماح بالدعوات",
  "allow_invitations_desc": "السماح للآخرين بإرسال دعوات إليك",
  "show_activity": "إظهار النشاط",
  "show_activity_desc": "عرض حالة نشاطك",
  "available_for_dating": "متاح لموعد من DineBuddy",
  "privacy_saved_success": "تم حفظ إعدادات الخصوصية بنجاح!",
  "save_changes": "حفظ التغييرات"
};

fs.writeFileSync(enPath, JSON.stringify({ ...en, ...newKeysEn }, null, 2));
fs.writeFileSync(arPath, JSON.stringify({ ...ar, ...newKeysAr }, null, 2));

console.log("Privacy Settings Translation keys merged successfully!");
