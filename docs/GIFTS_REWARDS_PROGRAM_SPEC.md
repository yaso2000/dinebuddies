# Gifts → Cherries → Jars → Rewards Program — Specification

**Status:** SPEC ONLY — do not implement until explicitly instructed. Phase A and Phase B are
separate work orders; never start Phase B while implementing Phase A.
**Date:** 2026-09-19
**Reviewed code:** `functions/cashout.js`, `functions/cashoutShieldTiers.js`,
`functions/giftCredits.js`, `functions/creditsCore.js`, `functions/creditsSpendMath.js`,
`functions/appStoreBilling.js`, `functions/googlePlayBilling.js`, `functions/stripe.js`,
`src/pages/CreditsWallet.jsx`, `src/components/cashout/ShieldCashoutSection.jsx`,
`src/utils/cashoutShieldTiers.js`, `src/pages/TermsOfService.jsx`, `firestore.rules`.
**Related:** `GIFTS_CASHOUT_COMPLIANCE_AUDIT.md` (2026-09-18), `docs/RATING16_DATING_REMOVAL_SPEC.md`.

---

## 0. Model and vocabulary (unchanged unless stated)

| Term | Firestore | Meaning |
|---|---|---|
| Purchase wallet | `users.paidCredits` | Bought via Apple IAP / Google Play Billing / Stripe / PayPal. Spendable in-app, giftable. **Never** cash-redeemable. |
| Cherries (savings wallet) | `users.savedCredits` | 30% of each gift received (`GIFT_RECIPIENT_VALUE_RATE = 0.3`). Spendable in-app. Only source of redeemable value. |
| Jar | fixed package in `cashoutShieldTiers.js` | Bronze 625 / Silver 1,250 / Gold 2,500 / Platinum 5,000 / Diamond 10,000 cherries = $6.25 / $12.50 / $25 / $50 / $100. Value is strictly linear (2 of a tier = 1 of the next). |
| Rewards Program | web only | The user-facing name of cash / voucher redemption. Never call it "cash-out" in any user-facing string. |

Principles that every change below must preserve:

1. Purchased credits never become cash. Cherries never become gifts.
2. Every cherry must be traceable to one `profile_gifts` document, and every gift to one sender.
3. The store builds (iOS / Android) never show a cash value, a redemption button, a link to the
   Rewards Program, or a WebView of it. All redemption UI lives on the web app only.
4. No chance element anywhere near cherries or jars (no random bonus, no mystery jar).
5. Enabling the program is a **new store submission with explicit review notes**, never a
   config flip alone.

---

## PHASE A — Do now, before the next store submission

Goal: make the gift ledger provenance-safe and refund-aware while the program stays OFF.
Nothing in Phase A changes what the user sees in the store builds, except the Terms text (A6).

### A1. Gifts are paid from the purchase wallet only

`functions/giftCredits.js` — in the `spendCreditsInTransaction` call for `profile_gift_send`,
change `allowSavedCredits: true` → `allowSavedCredits: false`.

- Error path: when `paidCredits < amount`, throw the existing `INSUFFICIENT_CREDITS` with an
  extra detail `{ code: 'INSUFFICIENT_CREDITS', wallet: 'purchase' }`.
- Client (`src/utils/sendProfileGift.js` and the gift sheet): on that error show
  `gift_needs_purchase_credits` = "Gifts are sent from your purchase balance. Top up to send this gift."
  (add to all 10 locales; Arabic: "الهدايا تُرسل من رصيد الشراء. اشحن رصيدك لإرسال هذه الهدية.").
- All other spend sites keep `allowSavedCredits: true` (invitations, AI, TasteScope,
  Pro Lite, offers, feedback tickets).
- Update the stale comments that say 50% → 30% in `functions/creditsCore.js:5` and
  `functions/giftCredits.js` header, and `src/pages/CreditsWallet.jsx` (~line 66).

### A2. Gift maturity ("ripening") and pending cherries

Add to `users`:
- `savedCreditsPending` (number, default 0) — cherries younger than the maturity window.
- `savedCredits` keeps its meaning but now holds **matured** cherries only.

Add to `profile_gifts`:
- `maturesAt` (Timestamp) = `deliveredAt + GIFT_MATURITY_DAYS` (constant, default **60**, in
  `functions/creditsCore.js`, exported; mirror in `src/utils/walletCredits.js`).
- `status` gains values: `pending` (delivered, not matured) → `matured` → optionally
  `reversed` (see A3). Existing docs with `status: 'completed'` are treated as `matured`
  (backfill script, see A7).
- `reversedAt`, `reversalReason`, `reversalSourceId` (nullable).

Behaviour:
- `grantSavedCreditsInTransaction` (creditsCore) gains an option `pending: true`. Gifts use it:
  increment `savedCreditsPending` and `totalSavedCreditsEarned`; do **not** touch
  `savedCredits`. Ledger row: `balanceType: 'saved_pending'`, `wallet: 'savings'`.
- Spending (`planCreditSpend`) — available saved balance for **in-app spend** =
  `savedCredits + savedCreditsPending` (pending cherries may be spent in-app; the cost to us
  is negligible and the UX stays as today). Deduct order: paid → savedCredits → savedCreditsPending.
  Ledger must record `savedUsed` and `savedPendingUsed` separately.
- Scheduled function `matureGiftCredits` (every 6 hours): query `profile_gifts` where
  `status == 'pending' && maturesAt <= now`, limit 500 per run; per gift, in a transaction:
  move `min(savedAmount, user.savedCreditsPending)` from `savedCreditsPending` to
  `savedCredits`, set gift `status: 'matured'`, write ledger row `type: 'gift_matured'`.
  (If the user already spent the pending cherries in-app, move whatever remains; never go
  negative.)
- Wallet UI (`CreditsWallet.jsx`): show cherries as one number (`savedCredits +
  savedCreditsPending`). Add a small secondary line only when pending > 0:
  `cherries_ripening` = "{{count}} cherries ripening" (Arabic: "{{count}} كرزة قيد النضج").
  No dates, no dollar values, no explanation of refunds in the app.

### A3. Refund and dispute webhooks → reverse gifts

New file `functions/purchaseReversals.js` exporting `applyPurchaseReversal({ uid, credits,
source, sourceId, reason })` plus four entry points:

| Rail | Entry point | Event |
|---|---|---|
| Apple | `onRequest` `appStoreServerNotifications` (V2, JWS verified with Apple root certs already in `functions/apple-certs`) | `REFUND`, `REVOKE` |
| Google Play | scheduled `pollGooglePlayVoidedPurchases` (every 6 h, `purchases.voidedpurchases.list`, cursor stored in `system/playVoidedCursor`) | voided purchase tokens |
| Stripe | `onRequest` `stripeWebhook` (signature verified) | `charge.refunded`, `charge.dispute.created` |
| PayPal | `onRequest` `paypalWebhook` (signature verified) | `PAYMENT.CAPTURE.REFUNDED`, `CUSTOMER.DISPUTE.CREATED` |

`applyPurchaseReversal`, in one transaction per gift (idempotent on `sourceId`):
1. Look up the original grant in `credit_transactions` (`type: 'purchase'`, `relatedId ==
   sourceId`) to get `uid` and `credits`. If already reversed (`purchase_reversals/{sourceId}`
   exists) → return.
2. Deduct `credits` from the buyer: `paidCredits` may go **negative** (allowed only via this
   path; `planCreditSpend` treats negative as 0 available). Ledger `type: 'purchase_reversed'`.
3. Reverse the buyer's gifts, newest first, sent **after** the purchase `createdAt`, until the
   reversed `sentAmount` total ≥ `credits`. For each gift with `status in (pending, matured)`:
   - set `status: 'reversed'`, `reversedAt`, `reversalSourceId`;
   - deduct `savedAmount` from the recipient: first `savedCreditsPending`, then
     `savedCredits`; if the recipient has already redeemed/spent it, write the remainder to
     `users.savedCreditsDebt` (number, default 0) — it is netted against the next redemption
     request (Phase B) and never shown as negative in the wallet;
   - ledger row for the recipient `type: 'gift_reversed'`, `relatedId: giftId`;
   - notification to the recipient: `gift_reversed_notice` = "A gift you received was
     reversed by the sender's payment provider." (no amounts, no sender name).
4. Write `purchase_reversals/{sourceId}` with `{ uid, credits, source, giftsReversed: [ids],
   createdAt }`.
5. If the buyer has ≥ 2 reversals in 90 days → set `users.giftingSuspended: true`;
   `sendProfileGift` rejects with `GIFTING_SUSPENDED` (user-facing: "Gifting is temporarily
   unavailable on this account.").

Also: `verifyAppleCreditsPurchase` — call the App Store Server API
**Send Consumption Information** endpoint after granting credits (consumption status =
fully consumed once any credit from that grant is spent; otherwise partially/not consumed).
This lowers approval of abusive refund requests. Keep it best-effort (log on failure).

Env / config to add (`functions/.env` keys, values supplied by the owner, not by the agent):
`APPLE_ASN_ENABLED`, `STRIPE_WEBHOOK_SECRET`, `PAYPAL_WEBHOOK_ID`. Document the URLs to
register in App Store Connect, Stripe Dashboard and PayPal Developer in
`docs/GIFTS_REWARDS_PROGRAM_OPS.md` (create it).

### A4. Minors are outside the gift economy

Using `isMinorUser` (`src/constants/ageCategories.js`; add a server mirror
`functions/ageCategories.js` with the same logic, `MINOR_AGE_CATEGORY = '16-17'`):
- `sendProfileGift` rejects if **either** sender or recipient is a minor:
  `GIFT_MINOR_BLOCKED` → "Gifts are available for adult accounts only."
- Client hides the gift button on minor profiles and for minor viewers.
- Existing minor balances are untouched (spendable in-app as today).

### A5. Store-build hygiene (verify, do not redesign)

- Keep `CASHOUT_ENABLED=false` (server) and `VITE_CASHOUT_ENABLED` unset (client) for every
  store build. `ShieldCashoutSection` must remain behind `CASHOUT_UI_ENABLED && !isGooglePlay
  && !isAppleStore` (already true — add a unit test asserting the component is not rendered
  when `isAppleStore` or `isGooglePlay` is true, even with the flag on).
- Grep `src/` and all locales for `$`, `USD`, `cash`, `cash-out`, `withdraw`, `PayPal email`,
  `نقد`, `سحب` and confirm every hit is either the credits *purchase* flow or inside
  `ShieldCashoutSection` / `cashout_*` keys. Rename the `cashout_*` locale keys to `rewards_*`
  and move their English/Arabic copy to neutral wording (see B4) so nothing in the bundle says
  "cash out" even if unused.
- Confirm `firestore.rules`: owner updates cannot change `paidCredits`, `savedCredits`,
  `savedCreditsPending`, `savedCreditsDebt`, `totalSavedCreditsEarned`,
  `pendingCashoutRequestId`, `giftingSuspended` (extend the existing guard at ~line 397–420);
  `credit_transactions` and `profile_gifts` remain server-write-only; `cashout_requests`
  readable by owner, writable only by server.

### A6. Terms of Service wording (in-app page)

`src/pages/TermsOfService.jsx` — keep 9.1–9.3. Replace 9.4 / 9.4a (both languages) with a
single clause that does not depend on the flag:

> **9.4 Rewards Program.** From time to time we may offer eligible adult users a Rewards
> Program through our website, under its own terms, allowing certain savings balances to be
> exchanged for partner vouchers or other rewards. The Program is not part of the mobile app,
> may be unavailable in your country, and may be changed or withdrawn at any time. Nothing in
> the app grants a right to redeem credits for money.

Arabic:
> **9.4 برنامج المكافآت.** قد نتيح من وقت لآخر للمستخدمين البالغين المؤهلين برنامج مكافآت عبر موقعنا الإلكتروني، بشروطه الخاصة، يسمح باستبدال أرصدة ادخار معيّنة بقسائم لدى شركائنا أو مكافآت أخرى. البرنامج ليس جزءاً من تطبيق الهاتف، وقد لا يكون متاحاً في بلدك، ويجوز تعديله أو إيقافه في أي وقت. لا شيء في التطبيق يمنح حقاً في استبدال الكريدت بأموال.

Remove the `isCashoutFeatureEnabled` import from this page.

### A7. Backfill and tests

- One-off script `scripts/backfill-gift-maturity.mjs` (dry-run flag): for every
  `profile_gifts` doc with `status: 'completed'` set `status: 'matured'`,
  `maturesAt = deliveredAt + 60d` (already in the past for old gifts). Do not move balances
  (existing `savedCredits` are treated as matured).
- Unit tests: `creditsSpendMath` (pending order, negative paid = 0 available), reversal
  selection (newest-first, stops at amount), maturity move never negative, minor gate,
  `allowSavedCredits:false` for gifts.
- `npm test` and `npm run build` must pass. Produce `docs/GIFTS_PHASE_A_REPORT.md` listing
  every changed file and every new locale key (all 10 locales).

---

## PHASE B — Rewards Program (build only when instructed; ships with a new store submission)

Goal: turn the dormant cash-out into a web-only Rewards Program with vouchers and (where
legal and payable) cash, without touching the store builds beyond the Terms text of A6.

### B1. Eligibility (server, `requestRedemption` — rename of `requestCashout`)

All of the following, checked inside the transaction:
- Program enabled: `REWARDS_ENABLED=true` (rename of `CASHOUT_ENABLED`).
- Caller is a personal account (not business), not a minor, `emailVerified` on the auth token,
  account `createdAt` ≥ 30 days ago, `giftingSuspended != true`.
- Country (`users.countryCode`, set at profile completion) is in `REWARDS_CASH_COUNTRIES`
  for cash or `REWARDS_VOUCHER_COUNTRIES` for vouchers (env, comma-separated ISO codes).
- KYC: `users.rewardsKyc.status == 'verified'` for **cash**; not required for vouchers below
  `REWARDS_VOUCHER_KYC_THRESHOLD_USD` (default 100 per rolling 30 days).
- Balance: only matured `savedCredits`, net of `savedCreditsDebt`.
- One pending request per user (existing rule).
- Caps: per request ≤ `REWARDS_MAX_REQUEST_USD` (default 500); per rolling 30 days ≤
  `REWARDS_MAX_MONTHLY_USD` (default 1,000); any request > `REWARDS_MANUAL_REVIEW_USD`
  (default 100) is created with `status: 'review'` instead of `pending`.
- `MAX_JAR_COUNT_PER_TIER` → 10.

### B2. Jars and redemption types

`cashoutShieldTiers.js` (both copies) gains `cashRedeemable` and `voucherRedeemable`:

| Jar | cherries | value | cash | voucher |
|---|---|---|---|---|
| Bronze | 625 | $6.25 | no | yes |
| Silver | 1,250 | $12.50 | no | yes |
| Gold | 2,500 | $25 | yes | yes |
| Platinum | 5,000 | $50 | yes | yes |
| Diamond | 10,000 | $100 | yes | yes |

Request payload: `{ items: [{ tier, count }], method: 'voucher' | 'cash', payout: {...} }`.
- `voucher`: `{ partnerId }` — a business account with `rewardsVoucherPartner: true`; the
  server issues a `vouchers/{id}` doc `{ userId, partnerId, valueUsd, code (12 chars,
  unambiguous alphabet), status: 'active' | 'redeemed' | 'expired', expiresAt (+180 d) }`.
  Partner redeems by code from the business dashboard (new page, Phase B2b). No admin step.
- `cash`: `{ provider: 'stripe_connect' | 'manual_paypal', accountRef }`. Stripe Connect
  Express onboarding on the web (`/rewards/onboarding`) stores `users.rewardsKyc` =
  `{ provider: 'stripe', accountId, status }` from `account.updated` webhooks. `manual_paypal`
  stays as the existing admin-marked flow but additionally requires `legalName`, `country`,
  and a checkbox attesting the PayPal account belongs to the user. Keep the existing 7–14 day
  wording.

### B3. Admin (`src/admin/pages/CashoutsPage.jsx` → `RewardsPage.jsx`)

- Tabs: Review (`status: 'review'`), Pending, Paid, Rejected, Vouchers.
- Per request show: matured balance at request time, reversals on the account (count / 90 d),
  gifts funding this balance grouped by sender with sender account age, KYC status, prior
  payouts total. One-click "Approve → pending", "Reject (reason)", "Mark paid (reference)".
- Stripe Connect transfers are triggered from "Mark paid" via `stripe.transfers.create`
  (idempotency key = requestId); result stored on the request.

### B4. Web UI (`ShieldCashoutSection` → `RewardsSection`, web route `/rewards`)

- Rendered only on web (existing platform gate) and only when the program is enabled for the
  user's country; otherwise the section shows nothing (not a teaser).
- Copy uses "Rewards", "redeem", "voucher", "payout"; dollar values may be shown **here only**.
- Locale keys `rewards_*` (renamed from `cashout_*`), all 10 locales.
- Public page `/rewards-terms` (web only): program terms, eligibility (18+, countries),
  maturity, reversals, caps, tax responsibility of the recipient.

### B5. Store submission checklist for enabling

1. Build with Phase A + B merged; store builds unchanged in behaviour (verify A5 test).
2. App Review notes (Apple) and Play Console "app content" declarations: state plainly that
   virtual gifts are bought via IAP / Play Billing; recipients aged 18+ may join a Rewards
   Program on the website after identity verification; the app contains no redemption UI or
   link. Attach the `/rewards-terms` URL.
3. Privacy: update the App Store privacy labels and Play Data safety for identity and payment
   data collected on the web (KYC via Stripe).
4. Legal sign-off (owner's task, not the agent's): Australian advice on AUSTRAC/ASIC
   classification of the "platform pays content providers" model; per-country check before
   adding a country to `REWARDS_CASH_COUNTRIES`.
5. Only then set `REWARDS_ENABLED=true` on the server and `VITE_REWARDS_ENABLED=true` on the
   **web** deployment (never in the Capacitor builds).

---

## Out of scope / explicitly forbidden

- Any in-app (iOS/Android) mention of money, USD, PayPal, payout, redemption, or the Rewards
  Program URL. Deep links from push notifications to `/rewards` are also forbidden.
- Bonus cherries, random rewards, streak multipliers, or any yield on held jars.
- Automated payouts to unverified accounts, or any payout rail other than those in B2.
- Re-gifting from the savings wallet.
- Changing the 30% rate or the jar values without updating Terms 9.3 and this document.
