import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
dotenv.config();

initializeApp({
  credential: cert({
    projectId: 'dinebuddies',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore();

// Level themes: 1 light · 2 lifestyle · 3 values · 4 emotional · 5 deep/future.
// Two-option "this or that" choice questions — clean matching for compatibility.
const DECK = [
  // Level 1 — light / icebreaker
  [1, 'قهوة أم شاي؟', 'Coffee or tea?', ['قهوة', 'شاي'], ['Coffee', 'Tea']],
  [1, 'شخص صباحي أم ليلي؟', 'Morning person or night owl?', ['صباحي', 'ليلي'], ['Morning', 'Night']],
  [1, 'بحر أم جبل؟', 'Beach or mountain?', ['بحر', 'جبل'], ['Beach', 'Mountain']],
  [1, 'حلو أم مالح؟', 'Sweet or savory?', ['حلو', 'مالح'], ['Sweet', 'Savory']],
  [1, 'سهرة في البيت أم خروج؟', 'Night in or night out?', ['في البيت', 'خروج'], ['Night in', 'Night out']],
  // Level 2 — lifestyle
  [2, 'مخطِّط أم عفوي؟', 'Planner or spontaneous?', ['مخطِّط', 'عفوي'], ['Planner', 'Spontaneous']],
  [2, 'اجتماعي أم تحب الهدوء؟', 'Social or homebody?', ['اجتماعي', 'هادئ'], ['Social', 'Homebody']],
  [2, 'ادّخار أم إنفاق؟', 'Saver or spender?', ['ادّخار', 'إنفاق'], ['Saver', 'Spender']],
  [2, 'مدينة أم طبيعة؟', 'City or nature?', ['مدينة', 'طبيعة'], ['City', 'Nature']],
  [2, 'روتين ثابت أم تغيير دائم؟', 'Steady routine or constant change?', ['روتين', 'تغيير'], ['Routine', 'Change']],
  // Level 3 — values
  [3, 'مغامرة أم استقرار؟', 'Adventure or stability?', ['مغامرة', 'استقرار'], ['Adventure', 'Stability']],
  [3, 'العائلة أولًا أم العمل أولًا؟', 'Family first or career first?', ['العائلة', 'العمل'], ['Family', 'Career']],
  [3, 'صراحة مباشرة أم لطف يتجنّب الجرح؟', 'Blunt honesty or gentle tact?', ['صراحة', 'لطف'], ['Honesty', 'Tact']],
  [3, 'تقاليد أم تجديد؟', 'Tradition or trying new?', ['تقاليد', 'تجديد'], ['Tradition', 'New']],
  [3, 'قيادة أم مشاركة القرار؟', 'Lead or share decisions?', ['قيادة', 'مشاركة'], ['Lead', 'Share']],
  // Level 4 — emotional
  [4, 'تعبّر بالكلمات أم بالأفعال؟', 'Express with words or actions?', ['كلمات', 'أفعال'], ['Words', 'Actions']],
  [4, 'تحتاج مساحة أم قربًا دائمًا؟', 'Need space or constant closeness?', ['مساحة', 'قرب'], ['Space', 'Closeness']],
  [4, 'تسامح بسرعة أم ببطء؟', 'Forgive quickly or slowly?', ['بسرعة', 'ببطء'], ['Quickly', 'Slowly']],
  [4, 'رومانسي أم عملي؟', 'Romantic or practical?', ['رومانسي', 'عملي'], ['Romantic', 'Practical']],
  [4, 'تحب المفاجآت أم اللفتات المخطّطة؟', 'Love surprises or planned gestures?', ['مفاجآت', 'مخطّطة'], ['Surprises', 'Planned']],
  // Level 5 — deep / future
  [5, 'الاستقرار في مكان أم التنقّل والسفر؟', 'Settle in one place or keep moving?', ['استقرار', 'تنقّل'], ['Settle', 'Move']],
  [5, 'طموح دائم أم قناعة وراحة؟', 'Ambition or contentment?', ['طموح', 'قناعة'], ['Ambition', 'Contentment']],
  [5, 'تعيش اللحظة أم تخطّط للمستقبل؟', 'Live for now or plan ahead?', ['اللحظة', 'المستقبل'], ['Now', 'Future']],
  [5, 'الروحانية محورية أم شخصية؟', 'Faith/spirituality: central or personal?', ['محورية', 'شخصية'], ['Central', 'Personal']],
  [5, 'حياة هادئة أم مليئة بالإثارة؟', 'Calm life or full of excitement?', ['هادئة', 'مثيرة'], ['Calm', 'Exciting']],
];

async function run() {
  let n = 0;
  const perLevelOrder = {};
  for (const [level, ar, en, optsAr, optsEn] of DECK) {
    perLevelOrder[level] = (perLevelOrder[level] || 0) + 1;
    const order = perLevelOrder[level];
    const id = `l${level}_q${order}`;
    await db.collection('compat_questions').doc(id).set({
      level,
      order,
      type: 'choice',
      text: { ar, en },
      options: { ar: optsAr, en: optsEn },
      weight: 1,
      active: true,
    });
    n += 1;
  }
  console.log(`seeded ${n} compat questions across 5 levels`);
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
