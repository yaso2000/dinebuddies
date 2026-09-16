/**
 * Pick One — lists and entries. Names are data (proper nouns), not i18n keys.
 * Adding a list = adding one object here + a folder of images under
 * /public/pickone/<category>/. See docs/games/PICKONE_SPEC.md §2.
 *
 * v1 test category: FOOD (no likeness/publicity issues — safe to publish). Each
 * list is a self-contained play-through of 20 items of ONE food type; items are
 * never mixed across lists.
 */

const IMG = (category, id) => `/pickone/${category}/${id}.webp`;

// Per-entry accent colors used by the no-image fallback and the story-card rim.
const PALETTE = [
  '#7c3aed', '#db2777', '#ea580c', '#0891b2', '#16a34a', '#ca8a04', '#dc2626', '#2563eb',
  '#9333ea', '#0d9488', '#e11d48', '#4f46e5', '#d97706', '#059669', '#be185d', '#1d4ed8',
  '#c026d3', '#b45309', '#0e7490', '#65a30d',
];

/** Build an entry list from compact tuples: [id, en, ar, tier]. */
const build = (category, rows) =>
  rows.map(([id, en, ar, tier], i) => ({
    id,
    name: { en, ar },
    tier: tier === 1 ? 1 : 2,
    image: IMG(category, id),
    color: PALETTE[i % PALETTE.length],
  }));

const FOODS = 'foods';

export const LISTS = [
  {
    id: 'foods-arab',
    category: FOODS,
    title: { en: 'Arab & Middle-Eastern Dishes', ar: 'أطباق عربية وشرقية' },
    sub: { en: 'Which one wins your table?', ar: 'أيّها يفوز على مائدتك؟' },
    entries: build(FOODS, [
      ['kabsa', 'Kabsa', 'كبسة', 1],
      ['mansaf', 'Mansaf', 'منسف', 1],
      ['mandi', 'Mandi', 'مندي', 1],
      ['shawarma', 'Shawarma', 'شاورما', 1],
      ['maqluba', 'Maqluba', 'مقلوبة', 1],
      ['koshari', 'Koshari', 'كشري', 1],
      ['shakshuka', 'Shakshuka', 'شكشوكة', 1],
      ['kibbeh', 'Kibbeh', 'كبة', 1],
      ['falafel', 'Falafel', 'فلافل', 2],
      ['hummus', 'Hummus', 'حمّص', 2],
      ['ful', 'Ful Medames', 'فول', 2],
      ['musakhan', 'Musakhan', 'مسخّن', 2],
      ['molokhia', 'Molokhia', 'ملوخية', 2],
      ['warak-enab', 'Warak Enab', 'ورق عنب', 2],
      ['ouzi', 'Ouzi', 'أوزي', 2],
      ['machboos', 'Machboos', 'مجبوس', 2],
      ['fattah', 'Fattah', 'فتّة', 2],
      ['harees', 'Harees', 'هريس', 2],
      ['tabbouleh', 'Tabbouleh', 'تبولة', 2],
      ['manakish', 'Manakish', 'مناقيش', 2],
    ]),
  },
  {
    id: 'foods-world',
    category: FOODS,
    title: { en: 'Global Favorites', ar: 'أطباق عالمية' },
    sub: { en: 'The world on one plate — pick one.', ar: 'العالم في طبق — اختر واحدًا.' },
    entries: build(FOODS, [
      ['pizza', 'Pizza', 'بيتزا', 1],
      ['burger', 'Burger', 'برجر', 1],
      ['sushi', 'Sushi', 'سوشي', 1],
      ['pasta', 'Pasta', 'باستا', 1],
      ['steak', 'Steak', 'ستيك', 1],
      ['biryani', 'Biryani', 'برياني', 1],
      ['fried-chicken', 'Fried Chicken', 'دجاج مقلي', 1],
      ['tacos', 'Tacos', 'تاكو', 2],
      ['ramen', 'Ramen', 'رامن', 2],
      ['lasagna', 'Lasagna', 'لازانيا', 2],
      ['paella', 'Paella', 'باييا', 2],
      ['dumplings', 'Dumplings', 'دامبلينغ', 2],
      ['pad-thai', 'Pad Thai', 'باد تاي', 2],
      ['fish-and-chips', 'Fish & Chips', 'فيش آند تشيبس', 2],
      ['curry', 'Curry', 'كاري', 2],
      ['bbq-ribs', 'BBQ Ribs', 'أضلاع باربكيو', 2],
      ['gnocchi', 'Gnocchi', 'نيوكي', 2],
      ['pho', 'Pho', 'فو', 2],
      ['risotto', 'Risotto', 'ريزوتو', 2],
      ['shrimp-tempura', 'Shrimp Tempura', 'تمبورا الروبيان', 2],
    ]),
  },
  {
    id: 'foods-desserts',
    category: FOODS,
    title: { en: 'Desserts & Sweets', ar: 'حلويات' },
    sub: { en: 'Save room — which one wins?', ar: 'اترك مكانًا — أيّها يفوز؟' },
    entries: build(FOODS, [
      ['kunafa', 'Kunafa', 'كنافة', 1],
      ['baklava', 'Baklava', 'بقلاوة', 1],
      ['umm-ali', 'Umm Ali', 'أم علي', 1],
      ['cheesecake', 'Cheesecake', 'تشيز كيك', 1],
      ['tiramisu', 'Tiramisu', 'تيراميسو', 1],
      ['chocolate-cake', 'Chocolate Cake', 'كيك الشوكولاتة', 1],
      ['ice-cream', 'Ice Cream', 'آيس كريم', 1],
      ['basbousa', 'Basbousa', 'بسبوسة', 2],
      ['luqaimat', 'Luqaimat', 'لقيمات', 2],
      ['qatayef', 'Qatayef', 'قطايف', 2],
      ['donut', 'Donut', 'دونات', 2],
      ['waffle', 'Waffle', 'وافل', 2],
      ['creme-brulee', 'Crème Brûlée', 'كريم بروليه', 2],
      ['macarons', 'Macarons', 'ماكرون', 2],
      ['brownie', 'Brownie', 'براوني', 2],
      ['churros', 'Churros', 'تشوروز', 2],
      ['cupcake', 'Cupcake', 'كب كيك', 2],
      ['gelato', 'Gelato', 'جيلاتو', 2],
      ['muhalabia', 'Muhalabia', 'مهلبية', 2],
      ['pancakes', 'Pancakes', 'بان كيك', 2],
    ]),
  },
  {
    id: 'foods-street',
    category: FOODS,
    title: { en: 'Street & Fast Food', ar: 'وجبات سريعة وشارع' },
    sub: { en: 'The craving showdown.', ar: 'مواجهة الشهيّة.' },
    entries: build(FOODS, [
      ['hot-dog', 'Hot Dog', 'هوت دوغ', 1],
      ['fries', 'Fries', 'بطاطس مقلية', 1],
      ['nachos', 'Nachos', 'ناتشوز', 1],
      ['samosa', 'Samosa', 'سمبوسة', 1],
      ['kebab', 'Kebab', 'كباب', 1],
      ['club-sandwich', 'Club Sandwich', 'كلوب ساندويتش', 1],
      ['nuggets', 'Nuggets', 'ناجتس', 2],
      ['onion-rings', 'Onion Rings', 'حلقات البصل', 2],
      ['corn-dog', 'Corn Dog', 'كورن دوغ', 2],
      ['spring-rolls', 'Spring Rolls', 'سبرينغ رول', 2],
      ['wrap', 'Wrap', 'راب', 2],
      ['quesadilla', 'Quesadilla', 'كاساديا', 2],
      ['mozzarella-sticks', 'Mozzarella Sticks', 'أصابع الموزاريلا', 2],
      ['sliders', 'Sliders', 'سلايدرز', 2],
      ['poutine', 'Poutine', 'بوتين', 2],
      ['pretzel', 'Pretzel', 'بريتزل', 2],
      ['taquito', 'Taquito', 'تاكيتو', 2],
      ['loaded-fries', 'Loaded Fries', 'بطاطس محمّلة', 2],
      ['popcorn-chicken', 'Popcorn Chicken', 'دجاج بوب كورن', 2],
      ['chili-dog', 'Chili Dog', 'تشيلي دوغ', 2],
    ]),
  },
];

export const LISTS_BY_ID = Object.fromEntries(LISTS.map((l) => [l.id, l]));

// Kept for back-compat with usePickOne / renderStoryCard imports.
export const REGIONS = ['global', 'arab'];
export const STORY_BG = {
  global: '/pickone/story-bg-global.webp',
  arab: '/pickone/story-bg-arab.webp',
};

export function getList(listId) {
  return LISTS_BY_ID[listId] || null;
}

export function getEntry(listId, entryId) {
  const list = getList(listId);
  return list ? list.entries.find((e) => e.id === entryId) || null : null;
}

/** Display name in the UI language: Arabic locale → name.ar, otherwise name.en. */
export function entryName(entry, language) {
  if (!entry) return '';
  const ar = String(language || '').toLowerCase().startsWith('ar');
  return (ar ? entry.name.ar : entry.name.en) || entry.name.en || entry.id;
}

/** Localized list title / subtitle. */
export function listTitle(list, language) {
  const ar = String(language || '').toLowerCase().startsWith('ar');
  return (ar ? list?.title?.ar : list?.title?.en) || list?.title?.en || list?.id || '';
}
export function listSub(list, language) {
  const ar = String(language || '').toLowerCase().startsWith('ar');
  return (ar ? list?.sub?.ar : list?.sub?.en) || list?.sub?.en || '';
}

/** The next list to offer as "try another" — cycles through LISTS. */
export function siblingList(listId) {
  const i = LISTS.findIndex((l) => l.id === listId);
  if (i < 0 || LISTS.length < 2) return null;
  return LISTS[(i + 1) % LISTS.length];
}

/** All playable lists (the picker shows every one). */
export function allLists() {
  return LISTS;
}
