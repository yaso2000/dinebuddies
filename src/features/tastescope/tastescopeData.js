/**
 * TasteScope — static quiz data (v1). Pure data, no side effects.
 *
 * Entertainment feature (like a horoscope) — never presented as psychology.
 * See docs/tastescope/TASTESCOPE_SPEC.md §2–§5.
 */

export const TASTESCOPE_VERSION = 1;

const img = (n, pole) => `/tastescope/axis${String(n).padStart(2, '0')}-${pole}.webp`;

/**
 * Ten binary axes, ordered. Each axis has two poles; answers are stored as
 * `{ [axisId]: poleId }`. Poles are globally unique (used directly as answer values).
 * @type {{ id: string, poles: [string, string], image: Record<string,string> }[]}
 */
export const AXES = [
  { id: 'adventure',  n: 1,  poles: ['familiar', 'unknown'] },
  { id: 'heat',       n: 2,  poles: ['mild', 'spicy'] },
  { id: 'ritual',     n: 3,  poles: ['casual', 'formal'] },
  { id: 'social',     n: 4,  poles: ['solo', 'group'] },
  { id: 'rhythm',     n: 5,  poles: ['morning', 'night'] },
  { id: 'simplicity', n: 6,  poles: ['simple', 'complex'] },
  { id: 'sweetness',  n: 7,  poles: ['savory', 'sweet'] },
  { id: 'origin',     n: 8,  poles: ['home', 'restaurant'] },
  { id: 'sugar',      n: 9,  poles: ['sugarfree', 'sugar'] },
  { id: 'sharing',    n: 10, poles: ['mine', 'shared'] },
].map((a) => ({
  id: a.id,
  poles: a.poles,
  image: { [a.poles[0]]: img(a.n, a.poles[0]), [a.poles[1]]: img(a.n, a.poles[1]) },
}));

/** Axes that weigh double in tie-breaks (matter most for dating compatibility). */
export const AXIS_WEIGHTS = { adventure: 2, social: 2, sharing: 2 };
export const axisWeight = (axisId) => AXIS_WEIGHTS[axisId] || 1;

/** poleId → axisId (each pole belongs to exactly one axis). */
export const POLE_TO_AXIS = AXES.reduce((map, axis) => {
  map[axis.poles[0]] = axis.id;
  map[axis.poles[1]] = axis.id;
  return map;
}, {});

/** Every valid poleId. */
export const ALL_POLES = AXES.flatMap((a) => a.poles);

/**
 * Ten titles (archetypes), in fixed order — the order is the final deterministic
 * tie-break in computeTitle. `signature` is the set of poles that define the title.
 * Arabic display form is resolved by gender at render time (store titleId only).
 * @type {{ id, signature: string[], en, ar: {m,f}, desc: {ar,en}, emoji, accent }[]}
 */
export const TITLES = [
  {
    id: 'explorer',
    signature: ['unknown', 'spicy', 'restaurant', 'night', 'complex'],
    en: 'The Explorer',
    ar: { m: 'المستكشف', f: 'المستكشفة' },
    desc: {
      ar: 'يأكل ليكتشف، والطبق الذي لا يعرف اسمه هو الذي يطلبه.',
      en: 'Eats to discover — the dish they can’t name is the one they order.',
    },
    emoji: '🧭',
    accent: '#f59e0b',
  },
  {
    id: 'authentic',
    signature: ['familiar', 'home', 'simple', 'savory', 'mild'],
    en: 'The Classic',
    ar: { m: 'الأصيل', f: 'الأصيلة' },
    desc: {
      ar: 'يعرف ما يحب ولا يحتاج أن يبحث عنه، والطبق الذي كبر عليه لا يُنافَس.',
      en: 'Knows what they love — the dish they grew up on has no rival.',
    },
    emoji: '🫒',
    accent: '#10b981',
  },
  {
    id: 'connoisseur',
    signature: ['formal', 'complex', 'restaurant', 'mine', 'unknown'],
    en: 'The Connoisseur',
    ar: { m: 'الذوّاق', f: 'الذوّاقة' },
    desc: {
      ar: 'الأكل عنده فن يُقدَّم بترتيب، والتفاصيل هي المتعة.',
      en: 'Food is an art served in order — the details are the pleasure.',
    },
    emoji: '🍷',
    accent: '#8b5cf6',
  },
  {
    id: 'host',
    signature: ['group', 'shared', 'home', 'familiar', 'casual'],
    en: 'The Host',
    ar: { m: 'المضياف', f: 'المضيافة' },
    desc: {
      ar: 'المائدة عنده تكتمل بالناس لا بالأطباق، والكرم طبع لا قرار.',
      en: 'The table is completed by people, not plates — generosity is a nature, not a choice.',
    },
    emoji: '🍲',
    accent: '#f97316',
  },
  {
    id: 'serene',
    signature: ['solo', 'simple', 'mild', 'morning', 'sugarfree', 'savory'],
    en: 'The Zen',
    ar: { m: 'الصافي', f: 'الصافية' },
    desc: {
      ar: 'يأكل بهدوء ووعي، والقليل الجيد يكفيه.',
      en: 'Eats calmly and mindfully — a little, done well, is enough.',
    },
    emoji: '🍵',
    accent: '#0ea5e9',
  },
  {
    id: 'fiery',
    signature: ['spicy', 'sugar', 'casual', 'night', 'shared'],
    en: 'The Firecracker',
    ar: { m: 'الناري', f: 'النارية' },
    desc: {
      ar: 'يريد من الطعام إحساساً قوياً، ولا شيء عنده "زيادة عن اللزوم".',
      en: 'Wants food to hit hard — nothing is ever "too much".',
    },
    emoji: '🌶️',
    accent: '#ef4444',
  },
  {
    id: 'dreamer',
    signature: ['sweet', 'sugar', 'solo', 'casual', 'complex'],
    en: 'The Sweet Tooth',
    ar: { m: 'الحالم', f: 'الحالمة' },
    desc: {
      ar: 'الطعام عنده مكافأة ولحظة خاصة، والحلو ليس آخر الوجبة بل غايتها.',
      en: 'Food is a reward and a private moment — dessert isn’t the end of the meal, it’s the point.',
    },
    emoji: '🍰',
    accent: '#ec4899',
  },
  {
    id: 'disciplined',
    signature: ['sugarfree', 'savory', 'mine', 'morning', 'formal'],
    en: 'The Disciplined',
    ar: { m: 'المنضبط', f: 'المنضبطة' },
    desc: {
      ar: 'يعرف حدوده ويحترمها، والاستمتاع عنده في التحكم لا في الفوضى.',
      en: 'Knows their limits and respects them — the joy is in control, not chaos.',
    },
    emoji: '🥗',
    accent: '#22c55e',
  },
  {
    id: 'companion',
    signature: ['shared', 'casual', 'group', 'night', 'familiar'],
    en: 'The Companion',
    ar: { m: 'الرفيق', f: 'الرفيقة' },
    desc: {
      ar: 'الأكل عنده حجة للجلسة، ومن يأكل معه أهم مما يأكل.',
      en: 'Eating is an excuse to gather — who they eat with matters more than what.',
    },
    emoji: '🧑‍🤝‍🧑',
    accent: '#14b8a6',
  },
  {
    id: 'warm',
    signature: ['morning', 'home', 'sweet', 'group', 'mild'],
    en: 'The Homebody',
    ar: { m: 'الدافئ', f: 'الدافئة' },
    desc: {
      ar: 'يحب بداية اليوم حول طاولة، والبيت هو مطعمه المفضل.',
      en: 'Loves starting the day around a table — home is their favourite restaurant.',
    },
    emoji: '🌅',
    accent: '#fb923c',
  },
];

export const TITLE_IDS = TITLES.map((t) => t.id);
export const TITLES_BY_ID = TITLES.reduce((m, t) => ((m[t.id] = t), m), {});

/**
 * Complementary title pairs — a small compatibility bonus (v1, editable).
 * Stored as an unordered-pair set keyed by "sorted:join".
 */
export const COMPLEMENTARY_PAIRS = [
  ['host', 'companion'],
  ['explorer', 'connoisseur'],
  ['serene', 'disciplined'],
  ['fiery', 'dreamer'],
  ['authentic', 'warm'],
  ['explorer', 'fiery'],
  ['host', 'warm'],
  ['connoisseur', 'disciplined'],
];

const pairKey = (a, b) => [a, b].sort().join('|');
const COMPLEMENTARY_SET = new Set(COMPLEMENTARY_PAIRS.map(([a, b]) => pairKey(a, b)));

/** True if {a,b} is a complementary pair (order-independent; false if a === b). */
export function areComplementary(a, b) {
  if (!a || !b || a === b) return false;
  return COMPLEMENTARY_SET.has(pairKey(a, b));
}
