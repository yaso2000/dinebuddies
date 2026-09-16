# Pick One — Feature Specification (v1)

> Purpose: a fast "one of two" elimination game inside DineBuddies. Two celebrities fill the screen top and bottom; the player taps the one they prefer; the loser slides away and a new challenger slides in against the winner. After 19 taps one champion remains, the player gets a shareable story card ("My 90s icon: …") and can post it to Instagram/TikTok/WhatsApp stories. Pure entertainment; no scoring, no right answer.
>
> Stack assumptions (verify against the repo before coding): React + Vite (JSX), Firebase Auth/Firestore, i18next with `src/locales/*.json`, feature folders under `src/features/`, Capacitor for iOS/Android, Vercel for web. **Follow the conventions already used by `src/features/tastescope/` and the deck games (`src/pages/ZodiacDeck.jsx`, `RealOrAiDeck.jsx`, `SuitabilityDeck.jsx`)** — same portal-based full-screen shell, same `AppText`/bidi rules, same `t()` keys with defaults, same guest gating (`GuestBlockedRoute`).
>
> **Language policy:** English is the source language of this feature. Every `t()` call carries an English `defaultValue`; `en.json` is authoritative; `ar.json` is a translation of it (write both, but English first). Global lists are the default content for every locale; the Arab lists are an opt-in region toggle, never forced by the UI language.
>
> Items marked **[ASSUMPTION]** are defaults chosen to unblock v1; change them if the owner says otherwise, do not ask.

---

## 0. Definition of done (v1)

1. Route `/pickone` (lazy, `GuestBlockedRoute`): category picker → 19 duel rounds → result screen → share.
2. Four playable lists, 20 entries each: global male singers, global female singers, Arab male singers, Arab female singers. The global pair is the default for every UI language; the player can switch to the Arab pair with one tap, and the choice is remembered.
3. Result screen renders a 1080×1920 story card on a `<canvas>` and shares it via the existing `shareNativeOrFallback` util (file share on mobile, download fallback on web).
4. Last result per list persisted on the user document (`pickOne.<listId>`), so the profile and a future "friends who agree with you" feature can read it. No feed post in v1.
5. All strings in `en.json` (source) and `ar.json` (translation); other locales fall back to English.
6. Unit tests for the duel engine (`createDuel`, `pick`, `isFinished`).
7. Nothing in this feature sets a `zIndex` below `1000` on a fixed element, and nothing touches `.bottom-nav` (see `--z-nav` / `--z-overlay` tokens in `src/index.css`).

---

## 1. Game mechanics (the engine)

Pure, testable module: `src/features/pickone/duelEngine.js`.

```
createDuel(entries, { seed })  →  { queue, champion, challenger, round, total, history }
pick(state, 'champion' | 'challenger')  →  new state
isFinished(state)  →  boolean
```

Rules:

- `entries` is the 20-item list. Shuffle it with a seeded Fisher–Yates so the order differs per session but is reproducible from `seed` (store the seed in the result for debugging/sharing).
- **[ASSUMPTION] Late-strength ordering:** each entry carries `tier: 1 | 2` (1 = the 6–8 biggest names). After shuffling, move all `tier: 1` entries into the second half of the queue (shuffled among themselves), so the champion is not effectively decided by round 5.
- Round 1 takes the first two entries as champion (top) and challenger (bottom). On `pick`, the chosen one becomes/stays champion and the next queue item becomes challenger. `total = entries.length - 1` (19 rounds for 20 entries). `round` is 1-based.
- The **champion keeps its physical slot** (top or bottom) whichever side it was picked from — the winner never moves, only the loser's slot gets the new challenger. This avoids the "which one did I just choose?" confusion.
- `history` is an array of `{ round, winnerId, loserId }` for the result screen and the persisted result.
- No timers, no undo in v1 (**[ASSUMPTION]**; an "undo last" button is a cheap v1.1).

---

## 2. Data: lists and entries

File: `src/features/pickone/pickoneData.js`.

```js
export const LISTS = [
  { id: 'singers-global-m', category: 'singers', region: 'global', gender: 'm', tier1: [...] , entries: [...] },
  { id: 'singers-global-f', ... },
  { id: 'singers-arab-m',   ... },
  { id: 'singers-arab-f',   ... },
];
// entry shape
{ id: 'michael-jackson', name: { en: 'Michael Jackson', ar: 'مايكل جاكسون' }, tier: 1, image: '/pickone/singers/michael-jackson.webp', color: '#7c3aed' }
```

Names are data, not i18n keys (they are proper nouns; keep `name.en` and `name.ar`, and show `name.en` for every non-Arabic locale). `color` is a per-entry accent used when no image exists (see §4).

### 2.1 The four lists (20 each; `tier: 1` marked with ★)

**singers-global-m:** Michael Jackson ★, George Michael ★, Elton John ★, Prince ★, Freddie Mercury ★, Phil Collins, Sting, Bon Jovi, Bryan Adams, Eric Clapton, Lionel Richie, Bruce Springsteen, Paul McCartney, Rod Stewart, Billy Joel, Ricky Martin, Eminem ★, Tupac, Enrique Iglesias, Julio Iglesias.

**singers-global-f:** Madonna ★, Whitney Houston ★, Mariah Carey ★, Celine Dion ★, Tina Turner, Janet Jackson, Cyndi Lauper, Shania Twain, Cher, Beyoncé ★, Britney Spears ★, Shakira ★, Jennifer Lopez, Alicia Keys, Toni Braxton, Gloria Estefan, Kylie Minogue, Anita Baker, Sandra, Sinéad O'Connor.

**singers-arab-m:** كاظم الساهر ★, عمرو دياب ★, محمد عبده ★, طلال مداح, راشد الماجد ★, عبدالمجيد عبدالله ★, عبدالله الرويشد, راغب علامة, وائل كفوري, فضل شاكر, حميد الشاعري, محمد منير, هاني شاكر, مصطفى قمر, إيهاب توفيق, عبادي الجوهر, رابح صقر, محمد فؤاد, الشاب خالد, حسين الجسمي ★.

**singers-arab-f:** ماجدة الرومي ★, أصالة ★, نوال الكويتية ★, أحلام ★, نجوى كرم ★, سميرة سعيد, لطيفة, ذكرى, ديانا حداد, إليسا ★, نانسي عجرم ★, أنغام, أمل حجازي, أنوشكا, نوال الزغبي, جوليا بطرس, ميادة الحناوي, حنان, شيرين, مي حريري.

English transliterations for the Arab lists (for `name.en`): Kadim Al Sahir, Amr Diab, Mohammed Abdu, Talal Maddah, Rashed Al-Majed, Abdul Majeed Abdullah, Abdallah Al Rowaished, Ragheb Alama, Wael Kfoury, Fadl Shaker, Hamid El Shaeri, Mohamed Mounir, Hany Shaker, Mostafa Amar, Ehab Tawfik, Abadi Al Johar, Rabeh Saqer, Mohamed Fouad, Cheb Khaled, Hussain Al Jassmi / Majida El Roumi, Assala, Nawal Al Kuwaitia, Ahlam, Najwa Karam, Samira Said, Latifa, Zekra, Diana Haddad, Elissa, Nancy Ajram, Angham, Amal Hijazi, Anouchka, Nawal Al Zoghbi, Julia Boutros, Mayada El Hennawy, Hanan, Sherine, May Hariri.

### 2.2 Region defaulting

`defaultRegion = 'global'` for every locale. The category picker shows the two global lists first (male / female) and a small "Global ↔ Arab" toggle to reveal the Arab pair. Remember the last chosen region in `localStorage` (`pickone.region`) so a player who switched to Arab lands there next time. Names always render in the UI language: `name.ar` when the locale is Arabic (for global and Arab lists alike), `name.en` otherwise.

---

## 3. Assets

Folder: `public/pickone/singers/<entry-id>.webp`, 768×1024 (3:4 portrait), ≤120 KB each. Lowercase, hyphenated ids (case-sensitive hosting). **The owner supplies the images**; the code must not break when a file is missing (see §4 fallback). Preload the 20 images of the chosen list on the category screen before starting the duel (`new Image().src`), and show a light progress bar if it takes more than 300 ms.

Story background: `public/pickone/story-bg-global.webp` and `story-bg-arab.webp`, 1080×1920 (generated once; owner supplies). Fallback: a CSS-drawn gradient on the canvas.

---

## 4. Screens (all portrait; on desktop, centered phone-width column, blurred backdrop, like TikTok web)

### 4.1 Category picker (`/pickone`)

Header "Pick One" (ar: "مين تختار؟"). Two large cards: "Singers — Men" and "Singers — Women" (global by default, or the remembered region), each showing a 2×2 collage of four entries' images (or colored initials). Under them a pill toggle "🌍 Global / 🌙 Arab". A one-line hint: "Tap the one you prefer. Last one standing wins." / "اضغط على من تفضّل. يبقى واحد فقط." Tapping a card starts the duel immediately (no intro screen; the hint is the intro).

### 4.2 Duel screen (full-screen portal, `position: fixed; inset: 0; zIndex: 1000`)

- Two equal halves, top and bottom, each filled by the entry's image (`object-fit: cover`), with a bottom-anchored dark gradient and the name in bold white at the bottom of that half. **Whole half is the tap target**, minimum 44 px nothing else.
- Fallback when an image is missing or fails to load: fill the half with the entry's `color` gradient, show the name huge (clamp 2–3 rem) centered, plus the first letter faint behind it.
- Between the halves: a 56 px circle with the round counter `7 / 19` (Latin digits in all locales; the counter is not text to be localized). A thin progress bar along the very top.
- Top-right: close (✕) → confirm dialog "Leave the game? Your progress is lost." (dialog also at `zIndex ≥ 1000`).
- Animation on pick: the losing half slides out (translateY toward its edge, 220 ms) and the new challenger slides in from the same edge; the winning half does a quick 1.03 scale pulse. Disable taps during the animation. Respect `prefers-reduced-motion` (no slide, just swap).
- Hide the app bottom nav for the duration of the duel: the portal at `zIndex: 1000` already covers it (the nav is at `--z-nav: 900`), do **not** add per-page nav hacks.
- Haptic tick on pick when on Capacitor (`@capacitor/haptics` if already a dependency; otherwise skip).

### 4.3 Result screen

- Champion image large (or fallback block), name, line "Beat 19 legends" / "تغلّب على 19 فناناً", small "runner-up" line = the last loser.
- Primary button **"Share to story"** / **"شارك على الستوري"** → builds the card (§5) and calls `shareNativeOrFallback({ file, title, text, url })`. On `'no-api'` or web without file share, offer "Download image" (`saveImageDataUrl`) plus a copy-link button.
- Secondary: "Play again (same list)" (new seed) and "Try the other list" (the sibling gender in the same region).
- Tertiary text link: "See how you voted" → expandable list of the 19 duels from `history` (winner in bold, loser struck through).

---

## 5. Story card (canvas, 1080×1920)

Module: `src/features/pickone/renderStoryCard.js` → `Promise<Blob>` (PNG or WebP q0.9). Layout, from top:

1. Background image (`story-bg-<region>.webp`) or gradient fallback; a subtle dark vignette.
2. Top caption (y≈260): `"My 90s icon"` / `"مغنّيّ المفضّل من التسعينات"` — for the women's list use `"My 90s queen"` / `"مغنّيتي المفضّلة من التسعينات"`. Draw with the app's UI font (use `document.fonts.load` before drawing) and `ctx.direction = 'rtl'` + right-aligned x for Arabic.
3. Champion image inside a circle (diameter 620, centered, y≈820) with a 10 px rim in the entry's `color`, or the fallback block (color circle + huge initial). Missing image must not throw.
4. Name (y≈1230), 96 px, 900 weight, white, auto-shrink to fit 900 px width.
5. Sub-line (y≈1320): `"Beat 19 legends"` / `"تغلّب على 19 فناناً"`, 44 px, 80% white.
6. Bottom block (y≈1700): `db` wordmark (draw the SVG from `/db-logo-white.svg`) + `"Play: dinebuddies.com/pickone"` / `"العب: dinebuddies.com/pickone"`, 40 px.

Share text (for platforms that accept text): `"My 90s icon is {name}. Who's yours? dinebuddies.com/pickone"` / `"مغنّيّ المفضّل من التسعينات: {name}. ومين اختيارك؟ dinebuddies.com/pickone"`.

Card rendering must work on iOS Safari (no `OffscreenCanvas` dependency; guard `canvas.toBlob` with a `toDataURL` fallback). Reuse patterns from `InvitationShareCard.jsx` / `ShareButtons.jsx` where they already solve fonts or blob export.

---

## 6. Persistence

On finish, write to the current user's Firestore user document (same doc TasteScope writes to; merge, do not overwrite):

```
pickOne: {
  [listId]: { championId, runnerUpId, seed, playedAt: serverTimestamp(), plays: increment(1) }
}
```

Read it back on the result screen only to show "You picked {name} last time too" when the champion repeats. No Cloud Function needed in v1. Add the field to Firestore rules exactly like `tasteScope` (owner read/write only; if `tasteScope` is mirrored into `public_profiles`, do **not** mirror `pickOne` in v1).

**[ASSUMPTION] Free and unlimited** — no credits, no daily cap (unlike TasteScope). The whole point is virality.

---

## 7. i18n keys (write `en.json` first, then translate into `ar.json`; namespace `pickone.*`)

`pickone.title`, `pickone.hint`, `pickone.list.singersM`, `pickone.list.singersF`, `pickone.region.global`, `pickone.region.arab`, `pickone.leave.title`, `pickone.leave.body`, `pickone.leave.stay`, `pickone.leave.leave`, `pickone.result.beat` ({{n}}), `pickone.result.runnerUp` ({{name}}), `pickone.result.share`, `pickone.result.download`, `pickone.result.copyLink`, `pickone.result.again`, `pickone.result.other`, `pickone.result.history`, `pickone.result.sameAsLast` ({{name}}), `pickone.card.captionM`, `pickone.card.captionF`, `pickone.card.beat` ({{n}}), `pickone.card.play`, `pickone.share.text` ({{name}}).

Entry names come from data (§2), never from locale files.

---

## 8. Entry points

- Add a card/tile for Pick One wherever the deck games (`/zodiac`, `/realornai`) are surfaced (check `StoriesBar.jsx` and the games/stages hub) with the same visual weight.
- Deep link `dinebuddies.com/pickone` must open the category picker; `?list=singers-arab-f` should start that list directly (used later in ads).

---

## 9. Files to create

```
src/features/pickone/
  index.js
  pickoneData.js          lists + entries (§2)
  duelEngine.js           pure engine (§1)
  duelEngine.test.js
  usePickOne.js           state, persistence, region default
  PickOnePage.jsx         route shell + category picker
  PickOneDuel.jsx         full-screen duel (portal)
  PickOneResult.jsx       result + share
  renderStoryCard.js      canvas card (§5)
  pickone.css             only what inline styles can't do (animations, reduced-motion)
public/pickone/singers/*.webp, public/pickone/story-bg-*.webp  (owner supplies)
docs/games/PICKONE_SPEC.md  (this file)
```

Route in `src/App.jsx`: `const PickOnePage = lazy(() => import('./features/pickone/PickOnePage'));` + `<Route path="/pickone" element={<GuestBlockedRoute><PickOnePage /></GuestBlockedRoute>} />`.

---

## 10. Out of scope for v1 (do not build)

Other categories (food, names, actors), bracket/tournament mode, global vote tallies ("62% chose Madonna"), friend comparison, feed posts, credits, admin editing of lists. Design the data shape so adding a list is adding an object to `LISTS` and a folder of images — nothing else.

---

## 11. Acceptance checklist

- [ ] 19 taps end the game every time; no duplicate challengers; the champion never changes slot.
- [ ] Missing image → colored fallback, no console errors, share card still renders.
- [ ] English UI: global lists by default, English names; Arabic UI: RTL text, Arabic names on both regions, global lists still the default, toggle to Arab works and is remembered.
- [ ] Share on iOS (Capacitor) and Android opens the native sheet with the image; on desktop web offers download.
- [ ] Bottom nav is fully covered during the duel and result; no element of this feature uses a `zIndex` below 1000 while fixed.
- [ ] Lighthouse/Vite bundle: feature is lazy-loaded; images are not imported into the JS bundle.
- [ ] `npm run lint` and the engine tests pass.
