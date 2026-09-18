# Security Remediation — Progress & Resume Point

**Last updated:** 2026-09-18 · **Branch:** `remove-affiliate-system` (NOT merged to main yet)
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
- **2.2** Google-claim OAuth endpoints require auth + bind session to caller uid (`api/business/google-claim/*`, `googleBusinessClaimApi.js`).
- **2.3** `trustFlagsUnchanged()` — no self-granted verified badge / ban / emailVerified.
- **2.4** `expireCompBusinessPlans` now also expires Apple/PayPal subs on `businessPaidUntil`.
- **2.5** Apple business subscription bound to one account (fulfillment tx.get check).
- **2.6** Removed the insecure generic `createCheckoutSession` endpoint.
- **2.8** Phone-number login removed entirely (email+password only); login-resolver endpoints deleted — root-fixes the identity-disclosure oracle.
- **2.9** Apple IAP verify fail-safe to PRODUCTION when `NODE_ENV=production`.

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
  - 2.1 `usersRepo` on `public_profiles` then tighten `users` `get`/`list` rules (biggest privacy hole; 83 files read `users` directly).
  - 2.10 AuthContext re-render storm (memoize value, fix lastSeen/location loop).
  - 2.11/2.13/2.17 unify the 3 near-duplicate chat hooks (`useMessagesWindow` + per-viewer receipts).
  - 2.12 business directory: aggregate ratings server-side + route-scoped hook.
  - 2.14 native push + deep links (`@capacitor/push-notifications` missing).
  - 2.16 delete ~91 dead files; 3.27 split giant contexts.
- **2.18–2.24 + 3.35** More dating remnants (credit copy, match-heart celebration, auto-accept 💕 message, `PRIVATE_INVITE_DATE_TEMPLATES` + `privateCardBackgrounds.js:293` zero-templates bug) + locale key sync (8 langs missing ~416 used keys; hi variable-name translation bug).
- **Medium/Low (~65)** per the audit report.

## Open follow-ups
- 🔑 Create a NEW Firebase SA key for local scripts (old one revoked); store as root `service-account-key.json` or `GOOGLE_APPLICATION_CREDENTIALS` (never `public/`).
- 🧹 Remove dead affiliate helpers from `firestore.rules` (`affiliateAgentContactFieldsOnlyUpdate` etc.) — cause a harmless deploy lint warning.
- Confirm cash-out env flags (`CASHOUT_ENABLED`, `VITE_CASHOUT_ENABLED`) are false in the DEPLOYED envs (they were set locally).
- Merge `remove-affiliate-system` → main when ready.
