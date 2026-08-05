/**
 * Adds t() keys missing from locale JSON files.
 * - Extracts English defaultValue from t('key', '...') and t('key', { defaultValue: '...' })
 * - Merges into en.json (sorted)
 * - Adds Arabic placeholders from ar scan or English fallback
 * - Syncs de/es/fr/it/pt/tr/hi/ur with English for any key still missing
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const localesDir = path.join(root, 'src/locales');

const localeFiles = fs.readdirSync(localesDir).filter((f) => f.endsWith('.json'));
const locales = {};
for (const f of localeFiles) {
  locales[f.replace('.json', '')] = JSON.parse(fs.readFileSync(path.join(localesDir, f), 'utf8'));
}

const srcDir = path.join(root, 'src');
const sourceFiles = [];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.(jsx?|tsx?)$/.test(ent.name)) sourceFiles.push(p);
  }
}
walk(srcDir);

const defaults = new Map();
const keyRe = /\bt\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]\s*\)/g;
const defaultValueRe =
  /\bt\s*\(\s*['"]([^'"]+)['"]\s*,\s*\{[^}]*defaultValue\s*:\s*['"]([^'"]*)['"]/g;

for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = keyRe.exec(text))) {
    if (!defaults.has(m[1]) && m[2]) defaults.set(m[1], m[2]);
  }
  while ((m = defaultValueRe.exec(text))) {
    if (!defaults.has(m[1]) && m[2]) defaults.set(m[1], m[2]);
  }
}

function humanizeKey(key) {
  return key
    .replace(/^admin_/, '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const usedKeys = new Set();
const usedRe = /\bt\s*\(\s*['"]([^'"]+)['"]/g;
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = usedRe.exec(text))) usedKeys.add(m[1]);
}

const manualEn = {
  discovery_icebreaker_label: 'Icebreaker',
  discovery_icebreaker_title_with_name: 'Say hi to {{name}}',
  discovery_icebreaker_title_pick: 'Pick a greeting',
  discovery_icebreaker_menu_aria: 'Icebreaker menu',
  discovery_icebreaker_coffee: 'Coffee?',
  discovery_icebreaker_bubble_tea: 'Bubble tea',
  discovery_icebreaker_cookie: 'Treat',
  discovery_icebreaker_wave: 'Wave',
  invitation_title_fallback: 'Invitation',
  auth_enter_email_reset: 'Please enter your email or mobile number',
  auth_reset_failed: 'Could not process password reset',
  auth_reset_generic_success: 'If an account exists, we sent a reset link.',
  chat_conversation_start_failed: "Couldn't start conversation.",
  chat_voice_stop: 'Stop',
  layout_community_fallback: 'Community',
  posts_delete_confirm_title: 'Delete this post?',
  posts_delete_confirm_body: 'This action is permanent and cannot be undone.',
  logout_failed: 'Failed to log out. Please try again.',
  pwa_install_ios_toast: 'Tap the Share button ↗️ then "Add to Home Screen"',
  pwa_install_android_toast: 'Open this page in Chrome and tap ⋮ then "Add to Home Screen"',
  geolocation_not_supported: 'Geolocation is not supported',
  unknown_user: 'Unknown',
  discovery_back_to_feed_aria: 'Back to feed',
  user_directory_list_view_aria: 'List view',
  business_saved_as_draft: 'Saved as Draft',
  business_service_name_placeholder: 'e.g., Home Delivery, Live DJ…',
  business_info_saved: 'Information saved!',
};

const manualAr = {
  discovery_icebreaker_label: 'كسر الجمود',
  discovery_icebreaker_title_with_name: 'قل مرحباً لـ {{name}}',
  discovery_icebreaker_title_pick: 'اختر تحية',
  discovery_icebreaker_menu_aria: 'قائمة كسر الجمود',
  discovery_icebreaker_coffee: 'قهوة؟',
  discovery_icebreaker_bubble_tea: 'شاي مثلج',
  discovery_icebreaker_cookie: 'حلوى',
  discovery_icebreaker_wave: 'تحية',
  invitation_title_fallback: 'الدعوة',
  auth_enter_email_reset: 'يرجى إدخال البريد أو رقم الجوال',
  auth_reset_failed: 'خطأ في معالجة استعادة الحساب',
  auth_reset_generic_success: 'إذا كان الحساب موجوداً، فقد أرسلنا رابط الاستعادة.',
  chat_conversation_start_failed: 'تعذّر بدء المحادثة.',
  chat_voice_stop: 'إيقاف',
  layout_community_fallback: 'مجتمع',
  posts_delete_confirm_title: 'حذف هذا المنشور؟',
  posts_delete_confirm_body: 'هذا الإجراء نهائي ولا يمكن التراجع عنه.',
  logout_failed: 'تعذّر تسجيل الخروج. حاول مرة أخرى.',
  pwa_install_ios_toast: 'اضغط زر المشاركة ↗️ ثم «Add to Home Screen»',
  pwa_install_android_toast: 'افتح الصفحة في Chrome واضغط ⋮ ثم «Add to Home Screen»',
  geolocation_not_supported: 'تحديد الموقع غير مدعوم',
  unknown_user: 'غير معروف',
  discovery_back_to_feed_aria: 'العودة للخلاصة',
  user_directory_list_view_aria: 'عرض القائمة',
  business_saved_as_draft: 'حُفظ كمسودة',
  business_service_name_placeholder: 'مثال: توصيل منزلي، دي جي مباشر…',
  business_info_saved: 'تم حفظ المعلومات!',
};

let addedEn = 0;
let addedAr = 0;

for (const key of usedKeys) {
  if (!locales.en[key]) {
    const value = manualEn[key] || defaults.get(key) || humanizeKey(key);
    locales.en[key] = value;
    addedEn += 1;
  }
  if (!locales.ar[key]) {
    locales.ar[key] = manualAr[key] || locales.en[key];
    addedAr += 1;
  }
}

for (const key of Object.keys(manualEn)) {
  if (!locales.en[key]) {
    locales.en[key] = manualEn[key];
    addedEn += 1;
  }
  if (!locales.ar[key]) {
    locales.ar[key] = manualAr[key] || manualEn[key];
    addedAr += 1;
  }
}

const sortObj = (obj) =>
  Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));

locales.en = sortObj(locales.en);
locales.ar = sortObj(locales.ar);

fs.writeFileSync(path.join(localesDir, 'en.json'), JSON.stringify(locales.en, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(localesDir, 'ar.json'), JSON.stringify(locales.ar, null, 2) + '\n', 'utf8');

const secondary = ['de', 'es', 'fr', 'it', 'pt', 'tr', 'hi', 'ur'];
let syncedSecondary = 0;
for (const lang of secondary) {
  let changed = false;
  for (const [key, value] of Object.entries(locales.en)) {
    if (!locales[lang][key]) {
      locales[lang][key] = value;
      syncedSecondary += 1;
      changed = true;
    }
  }
  if (changed) {
    locales[lang] = sortObj(locales[lang]);
    fs.writeFileSync(path.join(localesDir, `${lang}.json`), JSON.stringify(locales[lang], null, 2) + '\n', 'utf8');
  }
}

console.log(JSON.stringify({ addedEn, addedAr, syncedSecondary, enKeys: Object.keys(locales.en).length }, null, 2));
