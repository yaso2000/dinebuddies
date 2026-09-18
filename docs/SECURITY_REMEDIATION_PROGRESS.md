# Security Remediation — Progress & Resume Point

**Last updated:** 2026-09-18 (dating cleanup A–D done + web-deployed) · **Branch:** `remove-affiliate-system` (NOT merged to main yet)
**Driving audit:** `docs/AUDIT_REPORT_2026-09-18.md` (9 critical, 21 high, ~35 medium, ~30 low)

Resume point for continuing the audit remediation in a later session.

---

## ✅ DONE and DEPLOYED to production

### Critical (1.1–1.9) — all fixed + live
- **1.1** Credit minting: `creditFieldsUnchanged()` (update) + `creditFieldsZeroOnCreate()` (create) in `firestore.rules`; ledger `credit_transactions` create locked.
- **1.2** `api/proxy.js` open SSRF/XSS proxy → https-only + trusted image-host allowlist + image-only + size/timeout + nosniff.
- **1.3** PayPal: verify captured **amount** + server-fixed **currency** + require a server-created order (`functions/paypal.js`).
- **1.4/1.5/1.6** Minor-safety age gates (server): `createOrGetConversation`, `publishPrivateInvitationDraft`, `claimPrivateInvitationShare` reject minor↔adult; `ageCategoryImmutableOnceSet()` in rules.
- **1.7** Child-safety page → 16+ with 16–17 protections (`ChildSafetyStandards.jsx`, ar+en).
- **1.8** Dating remnants: `"Private"` label fixed in tr/es/it/pt/fr; dating FAQ bullet removed in en/ar/de/es/fr/it/pt/tr.
- **1.9** Both leaked service-account keys revoked in GCP (`23b4e21e9b45`, `fe17903de003`); key file removed from `public/`+`dist`+native bundles; backfill scripts no longer read from `public/`.

### High (done)
- **3.1** Destructive/financial admin callables (role change, delete user/partner, subscription + free-credit grants) now require a full admin (owner/token.admin) via assertFullAdmin — panel staff can no longer self-promote or grant.
- **2.2** Google-claim OAuth endpoints require auth + bind session to caller uid (`api/business/google-claim/*`, `googleBusinessClaimApi.js`).
- **2.3** `trustFlagsUnchanged()` — no self-granted verified badge / ban / emailVerified.
- **2.4** `expireCompBusinessPlans` now also expires Apple/PayPal subs on `businessPaidUntil`.
- **2.5** Apple business subscription bound to one account (fulfillment tx.get check).
- **2.6** Removed the insecure generic `createCheckoutSession` endpoint.
- **2.8** Phone-number login removed entirely (email+password only); login-resolver endpoints deleted — root-fixes the identity-disclosure oracle.
- **2.9** Apple IAP verify fail-safe to PRODUCTION when `NODE_ENV=production`.

### More security (user present, deployed)
- **2.7** Stripe refund/chargeback credit clawback (isolated, clamps to balance).
- **3.1** Destructive/financial admin actions -> full admin only (assertFullAdmin).
- **3.3** mirrorEmailVerifiedFromAction requires auth + own-email (closed enumeration oracle).
- **3.9** Email business signup strips self-granted google_business_verified badge.
- **Anti-fraud:** per-user velocity limits (10/h, 30/d) on Stripe + PayPal credit purchases.
- 2.8 phone-number login removed entirely (resolver deleted).

### Safe hardening done while user was away (validated, deployed)
- **3.5** `api/cron/ingest-pending-venues.js` fails CLOSED (503) when `CRON_SECRET` unset — ⚠️ confirm `CRON_SECRET` IS set in Vercel or venue ingestion 503s.
- Removed dead `affiliateAgentContactFieldsOnlyUpdate()` from `firestore.rules` (cleared deploy lint warnings).
- **Self-review of deployed rules:** confirmed no legit-flow regression from the new guards (credit sync writes same values; ageCategory first-set allowed; `emailVerified`/`banned`/quota fields are NOT client-written — the `useBusinessProfile.js:86 emailVerified:true` is an in-memory projection, not a Firestore write).
- **3.22** Added safe security headers in `vercel.json` (X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, X-Frame-Options SAMEORIGIN). CSP/HSTS intentionally deferred (need testing).

### Also done earlier
- Store anti-steering: external payment (Stripe/PayPal/saved cards/billing/cash-out) hidden on native iOS/Android; only Apple IAP / Google Play shown.
- Cash-out (jars) disabled server+client (`CASHOUT_ENABLED`/`VITE_CASHOUT_ENABLED=false`, native-hidden).
- Affiliate system fully removed; orphan-data cleanup: `scripts/cleanup-affiliate-data.mjs` (dry-run by default).

### Deploy mechanics (important)
- **Rules:** `firebase deploy --only firestore:rules --project dinebuddies --non-interactive` (uses CLI login `yazo@dinebuddies.com`). ⚠️ NOT `npm run deploy:firebase-rules` — that script uses the **revoked** SA key in `.env`.
- **Functions:** `npm run deploy:firebase-functions "<names>"` (or `all` to also delete orphans). CLI login auth.
- **Web:** `npm run deploy` → Vercel prod → `www.dinebuddies.com`.

---

## ⏳ REMAINING (hardest-first, per audit phases)

- **2.7** Refund/dispute credit clawback (Stripe webhook has no `charge.refunded`/dispute handler; also Apple/Play). Needs charge→fulfillment mapping + handling already-spent credits. **Complex — dedicated session.**
- **2.8** `login-resolver` turns any business phone into the login email without password. **Sensitive auth change.**
- **2.1 + 2.10–2.17** Architectural, **multi-week**, do incrementally (app stays deployable):
  - 2.1 `usersRepo` on `public_profiles` then tighten `users` `get`/`list` rules (biggest privacy hole; ~79 files read `users` directly).
    - **Slices 1–4 DONE (committed, NOT deployed).** Expanded `toPublicProfile` `userPublic` (bio, age, ageCategory, diningPersona, joinReasons, lookingFor, invitePreference, gallery, cover, cardTheme, isOnline, countryCode, COARSE geo ~1km) + `businessPublic` (profileLikes, communityMemberCount). Migrated these cross-user readers to `public_profiles`: `userDirectory.js`, `businessRankingStats.js`, `Layout.jsx` (communities card), host-card caches (`InviteReceivedPage`, `InboxScreen`, `InvitationInboxOverlay`), `InvitationDetails.jsx` (requesters+joined), `BlockedUsersSettings`, `DeclinedInvitationsSettings`, `SocialInvitationDetails`, `SocialInvitationInviteePanel`. Deploy order (deferred, together): functions → `adminBackfillPublicProfiles` callable → web.
    - **Full survey done** (categorized inventory of all 84 `users` read sites). OWN ~33 (keep, isOwner). CROSS-PUBLIC ~23 (~12 migrated; remaining: chat-room participant `onSnapshot`s in `useStageChatRoom.js:319/598`, `useSocialInvitationChatRoom.js:464` [flagged for the 2.13 hook refactor], `Chat.jsx:496` header, `InvitationContext.jsx:906/1006/1384` name/gender/role, `useBusinessProfile.js:498/700`, `useJoinedStages.js:193`, `useJoinedCommunities.js:97/117`). ADMIN ~27 (keep).
    - **Reverse-index FOUNDATION DONE (committed, NOT deployed):** `users/{uid}.followers[]` reverse index — `maintainFollowersReverseIndex()` in `syncPublicProfileOnUserWrite` keeps it in sync on `following[]` changes; `adminBackfillFollowers` callable rebuilds it; `firestore.rules followersUnchanged()` blocks client writes (added to all 6 client update paths). Deploy order: functions → `adminBackfillFollowers` → then the gate rewrite below can go live.
    - **NEXT — gate rewrite (needs foundation deployed+backfilled first):** rewrite `isConnectionComplete`/`checkCanMessage` (`connectConnection.js`, `chatHelpers.js`) + `useCanMessageMember.js` to compute mutual-follow from `viewerFollowing.includes(target) && viewerFollowers.includes(target)` (both from the viewer's OWN doc via AuthContext `userProfile.followers`) instead of reading `target.following`. Then update callers: `ChatContext.jsx:122/292`, `useConversationConnectionAllowed.js:92`, `DiscoveryCard.jsx:130`, `UserDirectoryCard.jsx:96`, `connectConnection` callers, `InvitationContext.jsx:1477`. DECISION NEEDED: the age-class check in `isConnectionComplete` (`sameAgeClass`, reads target `ageCategory`) — drop it client-side (server `createOrGetConversation` already enforces minor↔adult) OR project a coarse minor flag. Remaining non-following CROSS-PRIVATE: blocked/muted lists (`Chat.jsx:367`, `userSocialLists.js:21`, `useCommunityChatRoom.js:234/260`), `privacySettings.allowFollowing` (`InvitationContext.jsx:1726`, `FollowersList.jsx:50`), `availableForPrivateInvite` (`privateInviteAvailability.js:22`), email query (`authEmailConflict.js` — fails-closed, no change), droppable existence check (`businessLikeService.js:87`).
    - **THE LOCK GATE = CROSS-PRIVATE (17 sites), dominated by `following[]` (10 sites):** all messaging/mutual-follow/connection gates read another user's `following[]` (`ChatContext.jsx:122/292`, `Chat.jsx:367`, `useCanMessageMember.js:52`, `useConversationConnectionAllowed.js:92`, `DiscoveryCard.jsx:130`, `UserDirectoryCard.jsx:96`, `connectConnection.js:48`, `feedSocialGraph.js:49`, `InvitationContext.jsx:1477/1726`). Plus blocked/muted lists, `privacySettings.allowFollowing`, `availableForPrivateInvite`, the email→user `query`, and one droppable existence check (`businessLikeService.js:87`). **Sub-project needed before locking:** a readable follow-graph mirror (e.g. owner-readable `followers` list/subcollection maintained by a trigger) so "does X follow me / mutual?" reads the VIEWER's own doc, not the target's. THEN reconcile ADMIN queries to `limit<=200` and tighten `firestore.rules:529/533` to owner+admin.
  - 2.10 AuthContext re-render storm (memoize value, fix lastSeen/location loop).
  - 2.11/2.13/2.17 unify the 3 near-duplicate chat hooks (`useMessagesWindow` + per-viewer receipts).
  - 2.12 business directory: aggregate ratings server-side + route-scoped hook.
  - 2.14 native push + deep links (`@capacitor/push-notifications` missing).
  - 2.16 delete ~91 dead files; 3.27 split giant contexts.
- **2.18–2.24 + 3.35 (dating remnants) — ✅ DONE (committed, web-deployed 2026-09-18; NOT on native).** 5 commits (A–D) on `remove-affiliate-system`:
  - (A) Live romantic UI: match-celebration heart→friends icon; PairShowcase 💕 fallback removed; retired romantic `PRIVATE_INVITE_DATE_TEMPLATES` art and fixed the `privateCardBackgrounds.js` zero-templates bug (family/work/acquaintance now map to neutral friendship/social art — **verified live in the invite creator**); InvitationContext isDating→isPersonalInvite.
  - (B) AI prompts: restored the deleted `privateInvitationAiPrompt.js` (its missing import was silently breaking `api/ai/generate.ts`) as non-romantic; neutralized supportAgent, parseAiRequest, GeminiService tone.
  - (C) All 10 locales swept for romantic wording (wallet/credit copy, invite subtitles, FAQ, toasts, "your date"→"your guest", base private_pair_*); also fixed non-dating glitches (dup "private or private", wrong `${DATING_INVITATION_PUBLISH_CREDITS}` placeholder, calendar-date mistranslations).
  - (D) notificationHelpers "Dating match!"→"New friendship!"; CommunityGuidelines (en+ar) dropped "dating space"; profileGifts/OfferTemplateRenderer/motion-post copy; deleted dead relationshipAdvice modules.
  - LEFT intentionally: internal enum values (`mode/cardTemplateSet:'dating'`), dead `social_tpl_*`/`private_tpl_*` label keys, zodiac "Romantic" trait — none user-visible/behavioral.
- **STILL OPEN — locale key sync (separate from dating):** 8 langs missing ~416 used keys; hi has variable-name translation bug (`{{अवधि}}` etc.). Not romantic — a completeness/i18n issue.
- **Medium/Low (~65)** per the audit report.

## Open follow-ups
- 🔑 Create a NEW Firebase SA key for local scripts (old one revoked); store as root `service-account-key.json` or `GOOGLE_APPLICATION_CREDENTIALS` (never `public/`).
- 🧹 Remove dead affiliate helpers from `firestore.rules` (`affiliateAgentContactFieldsOnlyUpdate` etc.) — cause a harmless deploy lint warning.
- Confirm cash-out env flags (`CASHOUT_ENABLED`, `VITE_CASHOUT_ENABLED`) are false in the DEPLOYED envs (they were set locally).
- Merge `remove-affiliate-system` → main when ready.
