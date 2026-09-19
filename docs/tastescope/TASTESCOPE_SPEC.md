# TasteScope — Feature Specification (v1)

> Purpose: a 10-tap food-personality quiz inside DineBuddies. The user picks one of two food photos ten times, receives one of ten named "taste titles" (لقب), the title is shown on their profile, and any two users can see their taste compatibility. Entertainment-style (like a horoscope), **not** a clinical or scientific assessment — never present it as psychology.
>
> Stack assumptions (verify against the repo before coding): React + Vite (JSX), Firebase Auth/Firestore/Functions, i18next with `src/locales/*.json`, feature folders under `src/features/`, Capacitor for iOS/Android, Vercel for web. Follow existing conventions (bidi lint rules, `t()` keys with defaults, existing profile document shape).

---

## 0. Definition of done (v1)

1. `/tastescope` route: intro → 10 image-pair rounds → result screen.
2. Result persisted to the user document; title badge visible on own profile and on other users' profile cards.
3. Compatibility line ("Taste match") visible when viewing another user who has a title.
4. Retake allowed once every 90 days; result screen shareable as an image/card (reuse the existing invitation-card/share tooling if present).
5. All strings in `ar.json` and `en.json` (other locales can fall back to English initially).
6. Unit tests for `computeTitle()` and `computeCompatibility()`.

---

## 1. Assets (already in repo)

Folder: `public/tastescope/` — 20 files, 1024×1024 WebP, ~100 KB each.

```
axis01-familiar.webp   axis01-unknown.webp
axis02-mild.webp       axis02-spicy.webp
axis03-casual.webp     axis03-formal.webp
axis04-solo.webp       axis04-group.webp
axis05-morning.webp    axis05-night.webp
axis06-simple.webp     axis06-complex.webp
axis07-savory.webp     axis07-sweet.webp
axis08-home.webp       axis08-restaurant.webp
axis09-sugarfree.webp  axis09-sugar.webp
axis10-mine.webp       axis10-shared.webp
```

Rules: reference by `/tastescope/<file>.webp` (lowercase folder — Vercel/Linux are case-sensitive). Preload all 20 on the intro screen so rounds feel instant. The original `.jpeg` files in that folder should be moved out of `public/` (they must not ship).

---

## 2. Axes and poles (the quiz data)

Ten binary axes. Each round shows the two poles of one axis side by side (randomize left/right per round, and randomize round order per session, so position bias averages out). No text under the images except a tiny neutral caption is allowed; the photo is the question.

| # | axisId      | pole A (value `a`) | pole B (value `b`) | Arabic axis name |
|---|-------------|--------------------|--------------------|------------------|
| 1 | `adventure` | `familiar`         | `unknown`          | المغامرة |
| 2 | `heat`      | `mild`             | `spicy`            | الحدّة |
| 3 | `ritual`    | `casual`           | `formal`           | الطقس |
| 4 | `social`    | `solo`             | `group`            | الاجتماعية |
| 5 | `rhythm`    | `morning`          | `night`            | الإيقاع |
| 6 | `simplicity`| `simple`           | `complex`          | البساطة |
| 7 | `sweetness` | `savory`           | `sweet`            | الحلاوة |
| 8 | `origin`    | `home`             | `restaurant`       | الأصل |
| 9 | `sugar`     | `sugarfree`        | `sugar`            | السكر |
| 10| `sharing`   | `mine`             | `shared`           | المشاركة |

Store answers as a map `{ axisId: poleId }` (poleId strings above), not as left/right indices.

Suggested constants file: `src/features/tastescope/tastescopeData.js` exporting `AXES` (ordered array of `{ id, poles: [poleA, poleB], image: { poleA: url, poleB: url } }`) and `TITLES` (below).

---

## 3. Titles (archetypes)

Ten titles. Each has a `signature`: the set of poles that define it. Arabic has masculine/feminine forms — pick by the user's profile gender field; if unknown, use masculine.

| titleId      | ar (m / f)                 | en           | signature poles |
|--------------|----------------------------|--------------|-----------------|
| `explorer`   | المستكشف / المستكشفة       | The Explorer | unknown, spicy, restaurant, night, complex |
| `authentic`  | الأصيل / الأصيلة           | The Authentic| familiar, home, simple, savory, mild |
| `connoisseur`| الذوّاق / الذوّاقة         | The Connoisseur | formal, complex, restaurant, mine, unknown |
| `host`       | المضياف / المضيافة         | The Host     | group, shared, home, familiar, casual |
| `serene`     | الصافي / الصافية           | The Serene   | solo, simple, mild, morning, sugarfree, savory |
| `fiery`      | الناري / النارية           | The Fiery    | spicy, sugar, casual, night, shared |
| `dreamer`    | الحالم / الحالمة           | The Dreamer  | sweet, sugar, solo, casual, complex |
| `disciplined`| المنضبط / المنضبطة         | The Disciplined | sugarfree, savory, mine, morning, formal |
| `companion`  | الرفيق / الرفيقة           | The Companion| shared, casual, group, night, familiar |
| `warm`       | الدافئ / الدافئة           | The Warm     | morning, home, sweet, group, mild |

One-line descriptions (Arabic, shown on result + profile tooltip). English versions to be written alongside.

- explorer: يأكل ليكتشف، والطبق الذي لا يعرف اسمه هو الذي يطلبه.
- authentic: يعرف ما يحب ولا يحتاج أن يبحث عنه، والطبق الذي كبر عليه لا يُنافَس.
- connoisseur: الأكل عنده فن يُقدَّم بترتيب، والتفاصيل هي المتعة.
- host: المائدة عنده تكتمل بالناس لا بالأطباق، والكرم طبع لا قرار.
- serene: يأكل بهدوء ووعي، والقليل الجيد يكفيه.
- fiery: يريد من الطعام إحساساً قوياً، ولا شيء عنده "زيادة عن اللزوم".
- dreamer: الطعام عنده مكافأة ولحظة خاصة، والحلو ليس آخر الوجبة بل غايتها.
- disciplined: يعرف حدوده ويحترمها، والاستمتاع عنده في التحكم لا في الفوضى.
- companion: الأكل عنده حجة للجلسة، ومن يأكل معه أهم مما يأكل.
- warm: يحب بداية اليوم حول طاولة، والبيت هو مطعمه المفضل.

Each title also needs: an emoji/icon placeholder (v1: emoji; v2: custom SVG in `public/tastescope/titles/`), and an accent color token from the existing theme.

---

## 4. Scoring — `computeTitle(answers)`

```
score(title) = number of poles in title.signature that appear in answers (values)
winner = title with max score
```

Tie-break, in order:
1. Higher weighted score, where weights are `adventure: 2, social: 2, sharing: 2`, all others `1` (these three matter most for dating compatibility).
2. Fewer signature poles (a tighter archetype wins over a broader one).
3. Fixed order of the TITLES array (deterministic).

Pure function, no side effects, fully unit-tested with: (a) each title's exact signature → that title; (b) an all-`a` answer set and an all-`b` answer set (must not throw, must return a deterministic title); (c) a known tie case resolved by weights.

Also return `runnerUp` (second-best title) for the result screen ("with a touch of …").

---

## 5. Compatibility — `computeCompatibility(answersA, answersB, titleA, titleB)`

v1 formula (simple, explainable):

```
axisMatches = count of axes where answersA[axis] === answersB[axis]   // 0..10
base = axisMatches / 10                                                // 0..1
bonus = +0.10 if titleA === titleB
        +0.05 if COMPLEMENTARY pairs contain {titleA, titleB}
percent = clamp(round((base + bonus) * 100), 35, 98)
```

Never show below 35% or above 98% (a horoscope never says "0% match"). `COMPLEMENTARY` pairs (v1 list, editable): host+companion, explorer+connoisseur, serene+disciplined, fiery+dreamer, authentic+warm, explorer+fiery, host+warm, connoisseur+disciplined.

Output also includes a `suggestedInvite` string key chosen from the pair's shared poles: both `morning` → "breakfast", both `night` → "late dinner", both `group` → "group table", both `formal` → "fine dining", both `casual` → "café", else "dinner for two". Map these to the app's existing invitation types where they exist.

Compatibility is computed client-side from both users' stored answers (answers are small: 10 short strings). If answers are not readable for the other user under current Firestore rules, expose a lightweight callable function `tastescopeCompatibility(otherUid)` instead — decide after checking `firestore.rules`.

---

## 6. Data model

On the user document (`users/{uid}`), add one field:

```js
tasteScope: {
  version: 1,                 // schema/quiz version — bump if axes/titles change
  titleId: 'explorer',
  runnerUpId: 'fiery',
  answers: { adventure: 'unknown', heat: 'spicy', ... },   // 10 keys
  takenAt: <Timestamp>,
  retakeAvailableAt: <Timestamp>,   // takenAt + 90 days
  history: [ { titleId, takenAt } ] // keep last 5, for "your title changed" moments
}
```

Firestore rules: the owner writes `tasteScope` (validate: exactly 10 known axis keys, each value one of the two poles, `titleId` in the allowed list, `version === 1`). Read: same as the rest of the public profile fields. Add `tasteScope.titleId` to whatever lightweight "user card" projection the lists use, so badges render without extra reads.

Do **not** store gender-specific title text; store `titleId` only and resolve the display form at render time.

---

## 7. UI / UX

**Entry points**
- Profile page: a card "اكتشف لقبك الغذائي / Discover your taste title" if not taken; otherwise the badge with "retake in N days".
- Optional one-time prompt after onboarding completes (behind a feature flag `VITE_TASTESCOPE_ONBOARDING_PROMPT`).

**Intro screen** (`/tastescope`)
- Title, one line ("عشر صور. اضغط ما تشتهيه. لا توجد إجابة خاطئة."), start button, small disclaimer "للمتعة فقط" (for fun only). Preload images here.

**Round screen** (×10)
- Two images stacked vertically on phones (full width, 1:1, small gap), side by side on wide screens. Tap = answer; no confirm step. Progress dots 1–10. Back button allowed (changes previous answer). No text on images; optional 2-word caption under each is allowed but keep it neutral (e.g. "مألوف" / "جديد").
- Animate transitions ≤150 ms; the whole quiz should take under 40 seconds.

**Result screen**
- Big title (gendered Arabic form), icon, one-line description, "with a touch of {runnerUp}".
- Two buttons: "Add to my profile" (default already on; this just confirms) and "Share".
- Small "How you answered" strip: 10 chips showing the chosen pole per axis (this is what makes people screenshot it).

**Profile badge**
- Own profile and others' profiles: icon + title next to name, tap → small sheet with description.
- User lists / cards: icon only (tiny), title in tooltip/sheet.

**Compatibility**
- On another user's profile, when both have a title: "توافقكما الغذائي: 82% — أفضل دعوة بينكما: فطور". Tap → sheet showing which axes match. Link/CTA to the app's invite flow with the suggested type preselected.

**Retake**
- Locked for 90 days after taking; show remaining days. When retaken and the title changes, show "لقبك تغيّر من X إلى Y" and append to `history`.

**Accessibility / RTL**
- Fully RTL-aware (existing bidi rules). Images get `alt` from the pole name. Tap targets ≥ 44 px.

---

## 8. i18n keys (namespace `tastescope.*`)

```
tastescope.name                       "TasteScope"
tastescope.intro.title / .subtitle / .start / .disclaimer
tastescope.round.progress             "{{n}} / 10"
tastescope.axis.<axisId>              axis names
tastescope.pole.<poleId>              short pole captions (20 keys)
tastescope.title.<titleId>.m / .f / .desc
tastescope.result.touchOf             "with a touch of {{title}}"
tastescope.result.addToProfile / .share / .howYouAnswered
tastescope.profile.cta / .retakeIn    "Retake in {{days}} days"
tastescope.compat.line                "Taste match: {{percent}}% — best invite: {{invite}}"
tastescope.compat.invite.<key>        breakfast / lateDinner / groupTable / fineDining / cafe / dinnerForTwo
tastescope.changed                    "Your title changed from {{from}} to {{to}}"
```

Arabic values for titles/descriptions are in §3; write English equivalents in the same PR. Run the repo's `locale:*` scripts as the project normally does.

---

## 9. File layout (suggested)

```
src/features/tastescope/
  tastescopeData.js        // AXES, TITLES, COMPLEMENTARY, image urls
  computeTitle.js          // pure
  computeCompatibility.js  // pure
  computeTitle.test.js
  computeCompatibility.test.js
  useTasteScope.js         // read/write users/{uid}.tasteScope, retake logic
  TasteScopeIntro.jsx
  TasteScopeQuiz.jsx
  TasteScopeResult.jsx
  TasteScopeBadge.jsx      // used in profile + cards
  TasteCompatibility.jsx   // used on other users' profiles
  index.js
```

Route registration in `App.jsx` following the existing pattern; badge insertion in the profile header and user card components (find them; do not duplicate components).

---

## 10. Out of scope for v1 (do not build yet)

- Zodiac/birth-date flavour line (planned v2, optional toggle in settings).
- Country-specific dish examples in descriptions.
- Custom SVG icons per title (use emoji placeholders now).
- Any "personality analysis" wording. Keep it playful.

---

## 11. Implementation order (each step is a separate, reviewable commit)

1. Data + pure functions + tests (`tastescopeData.js`, `computeTitle.js`, `computeCompatibility.js`). Run `vitest` for these files.
2. Firestore field + rules + hook (`useTasteScope.js`), including the 90-day retake gate.
3. Screens: intro → quiz → result, wired to the route. Verify on a 390 px wide viewport.
4. Profile badge + user-card icon.
5. Compatibility line + sheet on other users' profiles.
6. i18n pass (ar + en), bidi lint, locale scripts.
7. Move original `.jpeg` files out of `public/`, build, and deploy to a preview before production.
