/**
 * TasteScope generated reading + cover — pure prompt assembly and validation.
 * No side effects, no model calls; unit-testable. See TASTESCOPE_SPEC Appendix A.
 * CommonJS (functions/ runtime).
 */

const TITLE_IDS = [
  'explorer', 'authentic', 'connoisseur', 'host', 'serene',
  'fiery', 'dreamer', 'disciplined', 'companion', 'warm',
];

/** Display names (gendered Arabic + English), mirrored from tastescopeData.js. */
const TITLES_DISPLAY = {
  explorer: { en: 'The Explorer', ar: { m: 'المستكشف', f: 'المستكشفة' } },
  authentic: { en: 'The Classic', ar: { m: 'الأصيل', f: 'الأصيلة' } },
  connoisseur: { en: 'The Connoisseur', ar: { m: 'الذوّاق', f: 'الذوّاقة' } },
  host: { en: 'The Host', ar: { m: 'المضياف', f: 'المضيافة' } },
  serene: { en: 'The Zen', ar: { m: 'الصافي', f: 'الصافية' } },
  fiery: { en: 'The Firecracker', ar: { m: 'الناري', f: 'النارية' } },
  dreamer: { en: 'The Sweet Tooth', ar: { m: 'الحالم', f: 'الحالمة' } },
  disciplined: { en: 'The Disciplined', ar: { m: 'المنضبط', f: 'المنضبطة' } },
  companion: { en: 'The Companion', ar: { m: 'الرفيق', f: 'الرفيقة' } },
  warm: { en: 'The Homebody', ar: { m: 'الدافئ', f: 'الدافئة' } },
};

/** 'feminine' | 'masculine' from a stored user gender value. */
function genderWord(rawGender) {
  return String(rawGender || '').trim().toLowerCase().startsWith('f') ? 'feminine' : 'masculine';
}

/** Gendered/localized display name for a title. locale 'ar' | 'en'. */
function titleDisplayName(titleId, gender, locale) {
  const t = TITLES_DISPLAY[titleId];
  if (!t) return '';
  if (locale === 'ar') return gender === 'feminine' ? t.ar.f : t.ar.m;
  return t.en;
}

const AXES = {
  adventure: ['familiar', 'unknown'],
  heat: ['mild', 'spicy'],
  ritual: ['casual', 'formal'],
  social: ['solo', 'group'],
  rhythm: ['morning', 'night'],
  simplicity: ['simple', 'complex'],
  sweetness: ['savory', 'sweet'],
  origin: ['home', 'restaurant'],
  sugar: ['sugarfree', 'sugar'],
  sharing: ['mine', 'shared'],
};

/** True iff answers cover exactly the ten axes with a valid pole each. */
function isValidAnswers(answers) {
  if (!answers || typeof answers !== 'object') return false;
  const keys = Object.keys(AXES);
  if (Object.keys(answers).length !== keys.length) return false;
  return keys.every((k) => AXES[k].includes(answers[k]));
}

// ── Reading (A2) ─────────────────────────────────────────────────────────────

const READING_SYSTEM = `You write short, warm, playful "taste readings" for a social dining app. A reading describes how a person eats and what that playfully suggests about how they enjoy life and company. It is entertainment, like a horoscope — never psychology, never diagnosis.

Hard rules:
- Speak directly to the person in the second person, in the requested language and grammatical gender.
- 120–170 words, exactly three short paragraphs, no title, no lists, no emojis, no markdown.
- Base the text on the ten answers provided. Mention at least four of them in a natural way (e.g., "you reach for the spicy bowl", "breakfast is your hour"). Two readings with the same title but different answers must feel different.
- Use the person's country only for one or two dish examples from that cuisine; do not name the country itself.
- Never mention or hint at age, weight, body, health, diet, calories, money, religion, or relationships status.
- Never use clinical or judgmental words (anxious, disorder, addicted, lazy, greedy, unhealthy, should, must).
- Soften every claim: "it seems", "you probably", "chances are". Nothing absolute.
- Tone: affectionate, slightly witty, generous. End the third paragraph with one sentence about the kind of dinner invitation that would suit this person.
- Do not mention that this is generated, do not mention the quiz, do not add disclaimers.`;

/**
 * @param {{ locale:'ar'|'en', gender:'feminine'|'masculine', titleName:string,
 *   titleEn:string, runnerUpName:string, country:string, answers:Record<string,string> }} ctx
 */
function buildReadingUserMessage(ctx) {
  const localeName = ctx.locale === 'ar' ? 'Arabic' : 'English';
  const a = ctx.answers || {};
  const line = (axis) => `- ${axis}: ${a[axis] || ''}`;
  return [
    `Language: ${localeName}`,
    `Grammatical gender: ${ctx.gender}`,
    `Title: ${ctx.titleName} (${ctx.titleEn})`,
    `Secondary title: ${ctx.runnerUpName}`,
    `Country (for dish examples only): ${ctx.country || ''}`,
    'Answers:',
    line('adventure'), line('heat'), line('ritual'), line('social'), line('rhythm'),
    line('simplicity'), line('sweetness'), line('origin'), line('sugar'), line('sharing'),
    'Write the reading now.',
  ].join('\n');
}

// Banned words (both languages) — reject + retry if any appear.
const BANNED_WORDS = [
  // English
  'anxious', 'disorder', 'addicted', 'addiction', 'lazy', 'greedy', 'unhealthy',
  'calorie', 'calories', 'diet', 'weight', 'religion', 'religious',
  // Arabic
  'قلق', 'اضطراب', 'إدمان', 'مدمن', 'كسول', 'جشع', 'صحي', 'غير صحي', 'سعرات',
  'رجيم', 'حمية', 'وزن', 'دين', 'ديني', 'مرض',
];

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

// Whole-word matchers. A naive substring check false-rejects innocent words
// (دين ⊂ المدينة، صحي ⊂ صحيح، مرض ⊂ تمرض). Require a non-letter boundary on
// each side, allowing only the attached Arabic clitic prefixes (ال، و، ب، ل…).
const AR_PREFIXES = '(?:وال|فال|بال|كال|لل|ال|و|ف|ب|ك|ل)?';
// Attached pronoun / plural / feminine suffixes (ك، كم، ه، ها، نا، ية، ات، ة)
// and an optional English plural -s. Left boundary still blocks mid-word hits.
const SUFFIXES = '(?:كم|كن|هم|هن|نا|ها|ية|ات|ك|ه|ي|ة|s)?';
const BANNED_MATCHERS = BANNED_WORDS.map((w) => {
  const esc = w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}])${AR_PREFIXES}${esc}${SUFFIXES}(?![\\p{L}])`, 'u');
});

/** Validate a reading. @returns {{ ok:boolean, reason?:string }} */
function validateReading(text) {
  const clean = String(text || '').trim();
  const words = countWords(clean);
  if (words < 90 || words > 220) return { ok: false, reason: 'length' };
  const lower = clean.toLowerCase();
  if (BANNED_MATCHERS.some((re) => re.test(lower))) return { ok: false, reason: 'banned_word' };
  return { ok: true };
}

/** Trim + collapse runs of >2 newlines to exactly 2. */
function postProcessReading(text) {
  return String(text || '').trim().replace(/\n{3,}/g, '\n\n');
}

// ── Cover (A3) ───────────────────────────────────────────────────────────────

// Shared base (composition + people policy + palette). The chosen art style is
// prepended; the text/negatives are appended by buildCoverPrompt.
const STYLE_BLOCK = `Cinematic wide 16:9 composition, human and inviting. The food and the table stay the heart of the scene. People are welcome and their faces may show — stylized and non-identifiable, never a real, identifiable, or famous person. Keep the lower third calmer and slightly darker so a caption can sit there. Limited palette dominated by the accent color given, with a consistent series look.`;

// Selectable art directions. `calm` is the quiet default; the rest add energy.
const COVER_STYLES = {
  calm: 'Warm painterly editorial illustration with soft grain — quiet, elegant, understated.',
  cinematic: 'Dramatic cinematic film still — moody volumetric lighting, shallow depth of field, rich filmic contrast, atmospheric and full of action.',
  cartoon: 'Bold flat 2D cartoon — thick clean outlines, bright saturated flat colors, playful exaggerated shapes, lively sitcom energy.',
  anime: 'Modern anime illustration — expressive characters, cel shading, clean dynamic linework, vivid colors.',
  pixar: 'Polished stylized 3D animated-film look — soft global illumination, rounded appealing characters, warm and cheerful.',
  watercolor: 'Delicate watercolor illustration — soft washes, bleeding pigments, gentle paper texture, airy and light.',
  popart: 'Retro pop-art comic — halftone dots, bold ink outlines, punchy primary colors, vintage poster energy.',
};
const COVER_STYLE_IDS = Object.keys(COVER_STYLES);
const DEFAULT_COVER_STYLE = 'calm';
function isValidCoverStyle(s) { return COVER_STYLE_IDS.includes(s); }

/** Human age phrase from the profile's ageCategory (or numeric age fallback). */
function ageDescriptor(ageCategory, age) {
  const cat = String(ageCategory || '').trim();
  const byCat = {
    '18-24': 'in their early twenties',
    '25-34': 'in their late twenties to early thirties',
    '35-44': 'around their late thirties to early forties',
    '45-54': 'in their late forties to early fifties',
    '55+': 'mature, in their late fifties or older',
  };
  if (byCat[cat]) return byCat[cat];
  const n = Number(age);
  if (Number.isFinite(n) && n > 0) {
    if (n < 25) return 'in their early twenties';
    if (n < 35) return 'in their late twenties to early thirties';
    if (n < 45) return 'around their late thirties to early forties';
    if (n < 55) return 'in their late forties to early fifties';
    return 'mature, in their late fifties or older';
  }
  return '';
}

const genderNoun = (gender) => (gender === 'female' ? 'woman' : gender === 'male' ? 'man' : 'person');

/** "a young woman in their twenties" style descriptor, or '' if nothing known. */
function personDescriptor(gender, ageCategory, age) {
  const g = String(gender || '').toLowerCase();
  const noun = genderNoun(g === 'f' || g === 'female' ? 'female' : g === 'm' || g === 'male' ? 'male' : '');
  const ageDesc = ageDescriptor(ageCategory, age);
  if (noun === 'person' && !ageDesc) return '';
  return [ageDesc ? `a ${noun} ${ageDesc}` : `a ${noun}`].join('');
}

/** Strip a display name to a safe, single-line snippet for in-art lettering. */
function sanitizeName(name) {
  return String(name || '').replace(/[\r\n"]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
}

const SCENE = {
  explorer: "a wooden table at the edge of a night market seen from above, one unfamiliar steaming dish in the center, blurred paper lanterns in the distance, a folded map at the table's edge",
  authentic: 'a sunlit kitchen table with one beloved home dish in a well-used ceramic bowl, a cloth napkin, bread torn by hand, a window with soft daylight',
  connoisseur: 'a quiet fine-dining table, one precisely plated dish under a soft spotlight, polished cutlery aligned, a single stemmed water glass, deep background bokeh',
  host: 'a long table crowded with shared platters, dips, bread baskets and many small plates, generous and abundant, warm evening light, hands reaching in from the frame edges',
  serene: 'a small table by a window at dawn, one simple bowl and a cup of tea, a plant, lots of calm negative space, pale light',
  fiery: 'a dark table with a glowing red chili dish at its center, steam rising, scattered chilies and spices, dramatic warm rim light',
  dreamer: 'a cozy corner table with a beautiful dessert and a dreamy soft-focus background, pastel light, a spoon resting, a hint of fairy lights',
  disciplined: 'a clean minimalist table with a neatly portioned plate, a glass of water with lemon, a folded napkin, morning light, everything aligned',
  companion: 'a small round café table for two, one shared plate in the middle with two forks, two cups, warm night-time street lights blurred behind',
  warm: 'a family breakfast table in soft morning light, eggs, bread, honey, tea, a pot on the stove in the background, homely and welcoming',
};

const ACCENT = {
  explorer: 'deep teal with amber highlights',
  authentic: 'burnt orange with cream',
  connoisseur: 'charcoal with gold',
  host: 'terracotta with olive',
  serene: 'sage green with soft cream',
  fiery: 'deep red with ember orange',
  dreamer: 'dusty rose with lavender',
  disciplined: 'slate blue with white',
  companion: 'warm mustard with navy',
  warm: 'honey gold with brick red',
};

const MOOD = {
  explorer: 'curiosity', authentic: 'comfort', connoisseur: 'refinement', host: 'generosity',
  serene: 'calm', fiery: 'intensity', dreamer: 'sweetness', disciplined: 'clarity',
  companion: 'togetherness', warm: 'warmth',
};

const CUISINE = {
  SA: 'Gulf cuisine: rice and roasted meat, dates, cardamom coffee',
  EG: 'Egyptian cuisine: koshari, ful, baladi bread',
  MA: 'Moroccan cuisine: tagine, mint tea',
  TR: 'Turkish cuisine: mezze, çay',
  AE: 'Gulf cuisine: rice and roasted meat, dates, cardamom coffee',
  KW: 'Gulf cuisine: rice and roasted meat, dates, cardamom coffee',
  QA: 'Gulf cuisine: rice and roasted meat, dates, cardamom coffee',
};

/** Answer-driven detail modifiers, appended in the fixed spec order. */
function coverModifiers(answers = {}) {
  const mods = [];
  if (answers.rhythm === 'morning') mods.push('morning light through a window');
  else if (answers.rhythm === 'night') mods.push('evening lamp light, dark surroundings');
  if (answers.heat === 'spicy') mods.push('visible chilies and rising steam');
  else if (answers.heat === 'mild') mods.push('creamy, gentle dishes');
  if (answers.sweetness === 'sweet') mods.push('a dessert or pastry present on the table');
  if (answers.simplicity === 'simple') mods.push('very few objects, generous empty space');
  else if (answers.simplicity === 'complex') mods.push('layered, richly garnished dishes');
  if (answers.origin === 'home') mods.push('homely kitchen setting');
  else if (answers.origin === 'restaurant') mods.push('restaurant setting');
  if (answers.sharing === 'shared') mods.push('one central shared platter everyone reaches for');
  return mods;
}

/**
 * The social character of the scene — the whole point of the quiz is how social
 * someone is, so the cover reflects it: a lively gathering for the outgoing, a
 * calm solo table for the private. Driven by the title first, then by the
 * social/sharing answers. @returns {string}
 */
function peopleClause(answers = {}, titleId) {
  if (titleId === 'host') return 'a warm, lively gathering of several happy friends around the table, sharing food and laughter';
  if (titleId === 'companion') return 'two close friends sharing the meal, relaxed and smiling at each other';
  if (titleId === 'warm') return 'a cozy family together at the table, warm and welcoming';
  const shared = answers.sharing === 'shared';
  if (answers.social === 'group') {
    return shared
      ? 'a cheerful group of friends sharing the dishes together, engaged and smiling'
      : 'a small group of people enjoying the meal side by side at the table';
  }
  // solo
  return shared
    ? 'one person sharing the meal with a single companion, calm and content'
    : 'a single person savoring the meal on their own, serene and content';
}

/**
 * Assemble the cover image prompt. Pure: same inputs → same string.
 * @param {{ titleId:string, answers:Record<string,string>, countryCode?:string }} ctx
 */
function buildCoverPrompt(ctx) {
  const titleId = TITLE_IDS.includes(ctx.titleId) ? ctx.titleId : 'authentic';
  const cc = String(ctx.countryCode || '').trim().toUpperCase();
  const cuisine = CUISINE[cc] || '';
  const mods = coverModifiers(ctx.answers).join(', ');
  const style = isValidCoverStyle(ctx.style) ? ctx.style : DEFAULT_COVER_STYLE;
  const person = personDescriptor(ctx.gender, ctx.ageCategory, ctx.age);
  const name = sanitizeName(ctx.name);
  const withText = Boolean(ctx.withText) && Boolean(name);

  const lines = [
    `Art style: ${COVER_STYLES[style]}`,
    STYLE_BLOCK,
    `Accent color: ${ACCENT[titleId]}.`,
    `Scene: ${SCENE[titleId]}, ${mods}.${cuisine ? ` ${cuisine}` : ''}`,
    `People: ${peopleClause(ctx.answers, titleId)}${person ? `; the central figure is ${person}` : ''}.`,
    `Mood: ${MOOD[titleId]}.`,
  ];
  if (withText) {
    lines.push(`Hand-letter the name "${name}" into the artwork as bold, correctly spelled decorative typography that matches the art style and sits in the upper third; keep it clearly legible. Apart from that name, no other text.`);
  } else {
    lines.push('No text, no letters, no numbers.');
  }
  lines.push('No logos, no watermark, no brand names, no real or identifiable people, no alcohol, no wine glasses.');
  return lines.join('\n');
}

module.exports = {
  TITLE_IDS,
  TITLES_DISPLAY,
  titleDisplayName,
  genderWord,
  AXES,
  isValidAnswers,
  READING_SYSTEM,
  buildReadingUserMessage,
  BANNED_WORDS,
  validateReading,
  postProcessReading,
  buildCoverPrompt,
  coverModifiers,
  peopleClause,
  personDescriptor,
  ageDescriptor,
  sanitizeName,
  SCENE,
  ACCENT,
  MOOD,
  CUISINE,
  STYLE_BLOCK,
  COVER_STYLES,
  COVER_STYLE_IDS,
  DEFAULT_COVER_STYLE,
  isValidCoverStyle,
};
