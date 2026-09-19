# TasteScope — Appendix A: Generated Reading + Generated Cover (v1.1)

> Extends `TASTESCOPE_SPEC.md`. After the quiz, the user may generate (a) a personal reading — a medium-length Arabic/English text about their taste personality — and (b) a personal 16:9 cover image. Both use the Gemini integration already in the project (text + image generation). First generation of each is free; regenerating costs **10 credits (text)** and **25 credits (cover)** from the existing credits ledger.
>
> Everything below is server-side (Cloud Function). The client never sees the prompts, never sends free text to the model, and never calls Gemini directly.

---

## A1. Callable: `tastescopeGenerate`

Input: `{ kind: 'reading' | 'cover', locale: 'ar' | 'en' }` (uid from auth).

Server steps, in order:
1. Load `users/{uid}`: `tasteScope` (titleId, runnerUpId, answers, version), `gender`, `country`/`city`, `ageGroup` (or derive a coarse band from birth date), display name.
2. Reject if no `tasteScope.titleId` or `answers` invalid.
3. Pricing: read `tasteScope.generated.{kind}.count` (default 0). If 0 → free. Else price = 10 (reading) / 25 (cover). Check balance ≥ price; if not, return `{ ok:false, reason:'insufficient_credits', price }` without calling the model.
4. Build the prompt (A2 / A3). Call Gemini. For cover: run the project's existing image moderation on the result; if it fails, retry once with the same prompt; if it fails again, return `{ ok:false, reason:'generation_failed' }`.
5. **Only after success**: debit credits (if not free) through the same ledger path used elsewhere (one transaction: debit + write), upload the cover to Storage at `tastescope/covers/{uid}/{timestamp}.webp` (1920×1080, WebP q80), and write:
   ```js
   tasteScope.generated.reading = { text, locale, createdAt, count: n+1 }
   tasteScope.generated.cover   = { url, createdAt, count: n+1 }
   tasteScope.coverUrl          = url          // also mirror to public_profiles.tasteScope.coverUrl
   ```
6. Return `{ ok:true, text | url, charged: price }`.

Rate limit: max 5 successful generations per kind per user per day (abuse guard even when paying). Never charge on failure. Log model latency + failures.

Client (result screen + own profile): two buttons — "أنشئ قراءتي" / "أنشئ غلافي". Label shows "مجاناً" when count = 0, else "10 كريدت" / "25 كريدت" plus current balance. While generating, show a skeleton in place; never block the rest of the screen. Existing reading/cover stay visible until the new one replaces them.

Reading is shown as: first line on the profile card, full text in a sheet on tap. Cover is used as the TasteScope card background on the profile and as the share image.

---

## A2. Reading prompt (Gemini text)

Model: the text model already configured in `aiClaude.js` / Gemini wrapper. Temperature 0.9, max ~350 output tokens. Output must be plain text, no markdown, no emojis, no headings.

**System instruction (verbatim):**

```
You write short, warm, playful "taste readings" for a social dining app. A reading describes how a person eats and what that playfully suggests about how they enjoy life and company. It is entertainment, like a horoscope — never psychology, never diagnosis.

Hard rules:
- Speak directly to the person in the second person, in the requested language and grammatical gender.
- 120–170 words, exactly three short paragraphs, no title, no lists, no emojis, no markdown.
- Base the text on the ten answers provided. Mention at least four of them in a natural way (e.g., "you reach for the spicy bowl", "breakfast is your hour"). Two readings with the same title but different answers must feel different.
- Use the person's country only for one or two dish examples from that cuisine; do not name the country itself.
- Never mention or hint at age, weight, body, health, diet, calories, money, religion, or relationships status.
- Never use clinical or judgmental words (anxious, disorder, addicted, lazy, greedy, unhealthy, should, must).
- Soften every claim: "it seems", "you probably", "chances are". Nothing absolute.
- Tone: affectionate, slightly witty, generous. End the third paragraph with one sentence about the kind of dinner invitation that would suit this person.
- Do not mention that this is generated, do not mention the quiz, do not add disclaimers.
```

**User message template:**

```
Language: {{locale_name}}            # "Arabic" | "English"
Grammatical gender: {{gender}}       # "feminine" | "masculine"
Title: {{title_name}} ({{title_en}})
Secondary title: {{runner_up_name}}
Country (for dish examples only): {{country}}
Answers:
- adventure: {{familiar|unknown}}
- heat: {{mild|spicy}}
- ritual: {{casual|formal}}
- social: {{solo|group}}
- rhythm: {{morning|night}}
- simplicity: {{simple|complex}}
- sweetness: {{savory|sweet}}
- origin: {{home|restaurant}}
- sugar: {{sugarfree|sugar}}
- sharing: {{mine|shared}}
Write the reading now.
```

Post-processing: trim, collapse >2 newlines, reject and retry once if word count < 90 or > 220, or if the text contains any of the banned words (keep a small list in code for both languages).

---

## A3. Cover prompt (Gemini image)

Model: the image model already wired in the project. Aspect 16:9, 1920×1080 (or the model's closest, then resize). No text of any kind in the image — the app overlays name/title later.

The prompt is **assembled from a fixed template + lookup tables**. The user contributes nothing free-form.

**Fixed style block (verbatim, always first):**

```
Editorial illustration, painterly with soft grain, cinematic wide 16:9 composition, warm and inviting. No text, no letters, no numbers, no logos, no watermark, no faces, no people (hands only if explicitly listed). Main subject in the middle third; the lower third is calm, uncluttered and slightly darker so white text can be overlaid later. Limited palette dominated by the accent color given. Consistent series look: same illustration style, same lighting mood, same level of detail.
```

**Scene by title (`SCENE[titleId]`):**

| titleId | scene |
|---|---|
| explorer | a wooden table at the edge of a night market seen from above, one unfamiliar steaming dish in the center, blurred paper lanterns in the distance, a folded map at the table's edge |
| authentic | a sunlit kitchen table with one beloved home dish in a well-used ceramic bowl, a cloth napkin, bread torn by hand, a window with soft daylight |
| connoisseur | a quiet fine-dining table, one precisely plated dish under a soft spotlight, polished cutlery aligned, a single stemmed water glass, deep background bokeh |
| host | a long table crowded with shared platters, dips, bread baskets and many small plates, generous and abundant, warm evening light, hands reaching in from the frame edges |
| serene | a small table by a window at dawn, one simple bowl and a cup of tea, a plant, lots of calm negative space, pale light |
| fiery | a dark table with a glowing red chili dish at its center, steam rising, scattered chilies and spices, dramatic warm rim light |
| dreamer | a cozy corner table with a beautiful dessert and a dreamy soft-focus background, pastel light, a spoon resting, a hint of fairy lights |
| disciplined | a clean minimalist table with a neatly portioned plate, a glass of water with lemon, a folded napkin, morning light, everything aligned |
| companion | a small round café table for two, one shared plate in the middle with two forks, two cups, warm night-time street lights blurred behind |
| warm | a family breakfast table in soft morning light, eggs, bread, honey, tea, a pot on the stove in the background, homely and welcoming |

**Accent palette by title (`ACCENT[titleId]`)** — reuse the `accent` hex from `tastescopeData.js` and describe it in words: e.g. explorer "deep teal with amber highlights", fiery "deep red with ember orange", serene "sage green with soft cream", dreamer "dusty rose with lavender", disciplined "slate blue with white", host "terracotta with olive", companion "warm mustard with navy", warm "honey gold with brick red", authentic "burnt orange with cream", connoisseur "charcoal with gold".

**Detail modifiers from answers** (append the ones that apply, in this order):
- `rhythm=morning` → "morning light through a window" ; `night` → "evening lamp light, dark surroundings"
- `heat=spicy` → "visible chilies and rising steam" ; `mild` → "creamy, gentle dishes"
- `sweetness=sweet` → "a dessert or pastry present on the table"
- `simplicity=simple` → "very few objects, generous empty space" ; `complex` → "layered, richly garnished dishes"
- `origin=home` → "homely kitchen setting" ; `restaurant` → "restaurant setting"
- `social=group` → "several plates, hands at the frame edges" ; `solo` → "a single place setting"
- `sharing=shared` → "one central shared platter"

**Cuisine cue from country** (`CUISINE[countryCode]`, optional, one short phrase): e.g. SA → "Gulf cuisine: rice and roasted meat, dates, cardamom coffee"; EG → "Egyptian cuisine: koshari, ful, baladi bread"; MA → "Moroccan cuisine: tagine, mint tea"; TR → "Turkish cuisine: mezze, çay"; default → omit.

**Assembly:**
```
{STYLE_BLOCK}
Accent color: {ACCENT[titleId]}.
Scene: {SCENE[titleId]}, {modifiers joined by ", "}. {CUISINE[country]}
Mood: {one word per title: curiosity | comfort | refinement | generosity | calm | intensity | sweetness | clarity | togetherness | warmth}.
```

Negative/constraints (repeat at the end, some models weigh the tail): `No text, no faces, no logos, no brand names, no alcohol, no wine glasses.`

Post-processing (server): resize/crop to 1920×1080, encode WebP q80, run moderation, upload. Also produce a 960×540 thumbnail for lists.

---

## A4. Fallbacks

- Reading generation fails → keep showing the static title description; show a toast "تعذّر إنشاء القراءة، لم يُخصم شيء".
- Cover generation fails → show the title's accent-color gradient card with the title emoji; same toast.
- If Gemini is disabled by feature flag (`TASTESCOPE_GEN_ENABLED=false`), hide both buttons entirely.

## A5. i18n additions

```
tastescope.gen.reading.cta        "أنشئ قراءتي"
tastescope.gen.cover.cta          "أنشئ غلافي"
tastescope.gen.free               "مجاناً"
tastescope.gen.price              "{{n}} كريدت"
tastescope.gen.balance            "رصيدك: {{n}}"
tastescope.gen.generating         "جارٍ الإنشاء…"
tastescope.gen.failed             "تعذّر الإنشاء، لم يُخصم شيء"
tastescope.gen.insufficient       "رصيدك لا يكفي"
tastescope.gen.readMore           "اقرأ القراءة كاملة"
tastescope.gen.regenerate         "أنشئ من جديد"
```

## A6. Implementation order

1. Callable skeleton + pricing/ledger path + rate limit (no model calls yet; return stub text/url) — unit-test the free/paid/insufficient/failure paths.
2. Reading prompt + post-processing + banned-word check.
3. Cover prompt assembly (pure function, unit-tested: same inputs → same prompt) + image call + moderation + upload.
4. Client buttons, skeletons, sheet, profile card background, share image.
5. i18n + feature flag + deploy function.
