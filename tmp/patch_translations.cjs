const fs = require('fs');
const path = require('path');

const arPath = path.join(__dirname, '../src/locales/ar.json');
const enPath = path.join(__dirname, '../src/locales/en.json');

const arData = JSON.parse(fs.readFileSync(arPath, 'utf8'));
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

// Add Arabic Keys
arData["business_visible_page"] = "نشاطك التجاري مرئي في صفحة الشركاء.";
arData["business_not_visible_title"] = "نشاطك التجاري غير مرئي في صفحة الشركاء";
arData["business_not_visible_desc"] = "قم بنشر ملفك الشخصي ليظهر في الدليل ويمكن للمستخدمين اكتشافه.";
arData["publish_profile"] = "نشر الملف";
arData["unpublish_profile"] = "إخفاء من صفحة الشركاء (مثلاً مغلق مؤقتاً)";
arData["publishing"] = "جاري النشر...";
arData["feedback_box_title"] = "صندوق الملاحظات والشكاوى 📥";
arData["feedback_box"] = "الملاحظات والشكاوى";
arData["restaurant"] = "مطعم";
arData["select_all_broadcast"] = "تحديد الكل (رسالة جماعية)";
arData["message_selected"] = "إرسال للمحددين";
arData["select_all_message"] = "تحديد الكل (رسالة جماعية)";

// Add English Keys
enData["business_visible_page"] = "Your business is visible on the Businesses page.";
enData["business_not_visible_title"] = "Your business is not visible on the Partners page";
enData["business_not_visible_desc"] = "Publish your profile to appear in the directory and be discoverable by users.";
enData["publish_profile"] = "Publish Profile";
enData["unpublish_profile"] = "Hide from Partners (e.g. temporarily closed)";
enData["publishing"] = "Publishing...";
enData["feedback_box_title"] = "Feedback & Complaints Inbox 📥";
enData["feedback_box"] = "Feedback & Complaints";
enData["restaurant"] = "Restaurant";
enData["select_all_broadcast"] = "Select All (Group Message)";
enData["message_selected"] = "Message Selected";
enData["select_all_message"] = "Select All (Group Message)";

fs.writeFileSync(arPath, JSON.stringify(arData, null, 4));
fs.writeFileSync(enPath, JSON.stringify(enData, null, 4));

console.log('Translations patched successfully!');
