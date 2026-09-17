# Rating 16+ — Remove every dating signal (build 72)

**Goal.** DineBuddies must read, to a user and to an App Store reviewer, as a *social dining
invitations* app with a normal follow system. No dating, no romance, no hearts, nowhere —
UI, i18n (all 10 locales), AI prompts, admin, assets, legal pages. Store rating target: 16+.
Terms & privacy: minimum age becomes 16 with protections for 16–17.

Do NOT rename Firestore field names or collection names (no data migration). Change what the
app *shows and does*, and normalise legacy values on read.

Work in the order below. After each section run the relevant tests and `npm run build`.

---

## 0. Global text sweep (do first, then again at the end)

Search (case-insensitive) in `src/`, `src/locales/*.json` (ar, en, de, es, fr, hi, it, pt, tr, ur),
`functions/`, `public/`, `docs/` for:
`dating`, `date` (only where it means a romantic date — NOT calendar date), `romantic`,
`romance`, `crush`, `love` (romantic sense), `heart`, `soulmate`, `partner` (romantic sense —
NOT business "partner"), `serious relationship`, `مواعدة`, `موعد` (romantic), `رومانسي`,
`علاقة جدية`, `حب`, `قلب`, `شريك` (romantic sense).

Replace or remove every hit. Produce `docs/RATING16_SWEEP_REPORT.md` listing each changed
key/file with old → new text so it can be reviewed.

Vocabulary to use instead: *meet-up, dining invitation, table buddy, friends, getting
acquainted, companion for a meal, social*.

---

## 1. Registration / profile completion (`CompleteProfile.jsx`, `ProfileCompletionModal.jsx`)

- Age category stays **mandatory**. New option list (ids and labels):
  `16-17`, `18-24`, `25-34`, `35-44`, `45-54`, `55+`.
  Update `DATING_AGE_CATEGORIES` in `src/constants/datingProfile.js` (rename the file to
  `profileDemographics.js` and update imports; keep exported names or alias them).
- Legacy derived `age` field: derive `16` for `16-17`.
- Age stays private (never rendered on public profile). Replace the notice
  `age_private_notice` with: "Your age group never appears on your profile — we use it only to
  show you people and invitations suited to your age." (all locales).
- Keep the "gender and age category cannot be changed after saving" warning.
- Keep nickname, gender, photo unchanged.

### 1a. Minor safety rule (server-side, mandatory)
Define `isMinor(user) = user.ageCategory === '16-17'`.
- A minor and an adult can never: send/receive a **private invitation**, start or continue a
  **direct chat**, or appear in each other's **people discovery / user directory / suggested
  friends**.
- Public social invitations, business/venue pages, TasteScope, Pick One remain open to all.
- Enforce in Cloud Functions + Firestore security rules (not only in UI). UI additionally hides
  the buttons. Add unit tests for the rule.
- Answer in App Store Connect: In‑App Controls → Age Assurance = Yes (self‑declaration).

---

## 2. Remove the dating switch, hearts and relationship tiers

Files: `src/utils/openToDating.js`, `src/utils/datingToggleLock.js` (+ tests),
`src/utils/connectConnection.js`, `src/utils/chatHelpers.js`, `src/utils/userDirectory.js`,
`src/components/profile/PrivateProfileFields.jsx`, `src/pages/Profile.jsx`,
`src/constants/defaultProfileMedia.js`, `src/admin/pages/DemoUsersPage.jsx`,
`src/components/UserDirectory/UserDirectoryFilters.jsx`.

- Delete `openToDating.js`, `datingToggleLock.js` and their tests. Remove the "open to
  dating" switch from the profile form entirely. Treat `users.openToDating` as always false;
  never write it again.
- `connectConnection.js`: a single connection kind `friendship`. Remove `DATING` and
  `ACQUAINTANCE` kinds, heart action, and celebration variants. Mutual follow ⇒ friends ⇒
  chat unlocks. One celebration: "You're now friends".
- Remove the dating filter/toggle from the user directory and discovery.
- `lookingFor` (users) and `personalInviteCategory` / `occasionType` (invitations):
  remove `serious` from `PERSONAL_INVITE_CATEGORIES` and `SOCIAL_INVITE_TYPES`.
  Normalisers map legacy `dating` and `serious` → `acquaintance` on read. Keep the
  `acquaintance` single‑invitee rule as is.
- Demo users generator: no dating fields, no "dating open" copy.

---

## 3. Remaining fields and copy

- `firstDatePlaceHint`: keep the DB field; UI label → "My favourite place to meet friends"
  (`profile_first_date_place_*` keys renamed to `profile_meetup_place_*`).
- `invitePreference` (any / men only / women only): keep. Section title → "Comfort & safety —
  who can send me a private invitation". Default `any`.
- i18n key `available_for_dating` → `available_for_private_invite` (text unchanged).
- AI text studio: subtitle → "Tips for social meet‑ups and table etiquette";
  starter `ai_text_starter_first_date` → "How do I stay safe when meeting someone new?";
  `ai_prompt_private_default` → "Write a warm, friendly invitation title and short message
  for this occasion." Audit every server‑side prompt (functions/) for the same words.
- Admin copy: `admin_invitations_lead` filter types → "public / private";
  `admin_demo_users_lead` → remove "dating open".

---

## 4. Invitations

- Remove category `serious` (both constants files). Legacy invitations with
  `occasionType: 'Serious relationship'` render as "Getting acquainted".
- Delete `public/invitation-card-backgrounds/serious/` and its rows in
  `socialCardBackgrounds.js`.
- **All card backgrounds are being replaced** (5 categories × 10) with a new cartoon/3D
  style, **no humans at all**, no hearts. Keep the exact file names and paths
  (`friendship-1 … acquaintance-10`) so no code changes are needed; only the image files change.
  Owner supplies the images.
- Cover AI prompt for private invites → friendly, food‑centred, never romantic.

---

## 5. TasteScope, Pick One, generated text

- TasteScope: it is a food‑behaviour quiz. Titles, readings and the Claude prompt must
  describe eating style, sharing, exploration, rhythm — **never** attraction, partners or
  relationships. Add an explicit instruction line to the prompt. "Compatibility" between
  two users is labelled "Table match" (who you'd enjoy a meal with).
- Pick One: already food‑only. Clean‑up: remove the `singers-arab-f` comment in
  `PickOnePage.jsx`; delete empty `public/pickone/singers/`; update `docs/games/PICKONE_SPEC.md`.

---

## 6. Legal pages (`PrivacyPolicy.jsx`, `TermsOfService.jsx`, ar + en)

- Minimum age 18 → 16 everywhere. Add a short section "Members aged 16–17" describing the
  rule in §1a (no private invitations/chats with adults; not shown to adults in discovery).
- Remove any dating/relationship wording. Update "Last Updated" to the release date.
- Company: DineBuddies Pty Ltd (ABN 76 700 910 916), Australia.
- (Other privacy‑policy additions — purchases, AI providers, deletion, moderation — are
  tracked separately.)

---

## 7. Store metadata (owner, App Store Connect + Google Play)

- Screenshots: replace any frame showing hearts / "Chat only when it's mutual" style copy.
- Description/keywords: no "dating", "match", "singles".
- Age rating questionnaire: Age Assurance = Yes; mature/suggestive = none; alcohol =
  infrequent/mild (venue listings); no unrestricted web; UGC/messaging/social = Yes.
- Google Play IARC questionnaire re‑answered to match.

---

## Done checklist
- [ ] Sweep report reviewed, zero remaining hits in all 10 locales.
- [ ] Tests pass (`npm test`), `npm run build` clean, `npx cap sync ios/android`.
- [ ] Minor rule verified with two test accounts (16–17 vs 25–34).
- [ ] New card backgrounds in place, `serious/` folder gone.
- [ ] Build 72 archived and uploaded.
