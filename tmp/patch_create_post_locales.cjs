const fs = require('fs');
const enPath = './src/locales/en.json';
const arPath = './src/locales/ar.json';

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

const newKeysEn = {
  "video_too_long": "Video too long. Max 30s.",
  "failed_to_post": "Failed to post. Try again.",
  "posting": "Posting...",
  "post_button": "Post",
  "whats_happening": "What's happening?",
  "caption_placeholder": "Caption...",
  "stroke": "Stroke",
  "emoji": "Emoji",
  "quick_emojis": "Quick Emojis",
  "done": "Done",
  "photo": "Photo",
  "video": "Video",
  "record": "Record",
  "size": "Size",
  "text_color": "Text Color",
  "auto_color": "Auto",
  "background_color": "Background Color"
};

const newKeysAr = {
  "video_too_long": "الفيديو طويل جداً. الحد الأقصى 30 ثانية.",
  "failed_to_post": "فشل النشر. حاول مرة أخرى.",
  "posting": "جارِ النشر...",
  "post_button": "نشر",
  "whats_happening": "ماذا يحدث؟",
  "caption_placeholder": "اكتب تعليقاً...",
  "stroke": "إطار صلب",
  "emoji": "ملصقات",
  "quick_emojis": "ملصقات سريعة",
  "done": "تم",
  "photo": "صورة",
  "video": "فيديو",
  "record": "تسجيل",
  "size": "الحجم",
  "text_color": "لون النص",
  "auto_color": "تلقائي",
  "background_color": "لون الخلفية"
};

fs.writeFileSync(enPath, JSON.stringify({ ...en, ...newKeysEn }, null, 2));
fs.writeFileSync(arPath, JSON.stringify({ ...ar, ...newKeysAr }, null, 2));

console.log("Create Post Translation keys merged successfully!");
