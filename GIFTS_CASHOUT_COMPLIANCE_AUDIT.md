# Gifts → Cherries → Jar → Cash-out — Compliance & Security Audit

**Date:** 2026-09-18
**Scope:** Gift feature only (send gift → cherries → jar → real-money cash-out).
**Build reviewed:** v1.0.79 (79) source at `functions/`, `src/`, `firestore.rules`.

---

## 0. Executive verdict

| Question | Answer |
|---|---|
| Does the app violate Apple/Google as **currently shipped**? | **Most likely NO** — because cash-out is **disabled by default** (`CASHOUT_ENABLED=false` / `VITE_CASHOUT_ENABLED` off). With cash-out off, gifts are just internal spendable credits → compliant. |
| Does it violate them **once cash-out is turned on**? | **HIGH RISK — likely YES.** Cashable "cherries" ultimately originate from **IAP-purchased credits**, and both stores forbid cashing out IAP currency for real money. |
| Is there a critical security hole regardless of store policy? | **YES — CRITICAL.** Firestore rules let a normal user **write their own credit/cherry balance directly from the client**, bypassing all Cloud Functions. This is exploitable today (free paid features) and becomes **real-money theft** the moment cash-out is enabled. |

**Bottom line:** The server-side money logic (Cloud Functions) is genuinely well-built — atomic, idempotent, gated. But it is undermined by (1) a Firestore-rules hole that lets clients forge balances, and (2) a store-policy conflict that switching payment rails (PayPal/Stripe) will **not** solve.

---

## 1. How the system actually works (verified)

**Money flow:**
```
User A buys CREDITS  →  via Apple IAP (iOS) / Google Play (Android) / Stripe·PayPal (web)
        │                (purchase wallet = paidCredits — NEVER cashable)
        ▼
User A sends a GIFT to User B   (functions/giftCredits.js — sendProfileGift)
        │  atomic tx: debit A's paidCredits, credit B
        ▼
User B receives 30% as CHERRIES   (savedCredits ; GIFT_RECIPIENT_VALUE_RATE = 0.3)
        │  lifetime totalSavedCreditsEarned drives the visual Jar/Shield tier
        ▼
User B redeems a JAR package   (functions/cashout.js — requestCashout)
        │  Bronze 625cr=$6.25 · Silver 1250=$12.5 · Gold 2500=$25 · Platinum 5000=$50 · Diamond 10000=$100
        │  (rate: 100 cherries = $1)
        ▼
Admin marks PAID → pays MANUALLY via PayPal (functions/cashout.js — resolveCashoutRequest)
```

**Key facts verified in code:**
- Purchases are **correctly platform-gated**: `src/utils/commercePlatform.js` forces Apple IAP on iOS, Google Play on Android, Stripe/PayPal only on web. ✅
- On iOS credits are granted only after **server-side StoreKit 2 verification** (`functions/appStoreBilling.js`). ✅
- Cash-out is **not automated** — `resolveCashoutRequest` only flips a status; a human pays via PayPal off-platform. No PayPal Payouts / Stripe Connect code exists.
- All *intended* balance changes happen in **atomic Firestore transactions** with idempotency locks. ✅
- Cash-out is **feature-flagged off** on both client and server for store launch. ✅
- Only **gift-received cherries** are cashable; **purchased credits are explicitly not** (UI states this). ✅ Good design intent.

---

## 2. Store-policy analysis

### 2.1 Apple App Store
- **Purchase side: compliant** — uses IAP on iOS.
- **Cash-out side (when enabled): violates.** Relevant guidelines:
  - **3.1.1** — IAP content must stay in the app; you may not buy currency via IAP and convert it to money.
  - **3.2.2 (Unacceptable)** — apps must not "enable the exchange of currencies or virtual currencies bought via IAP for real money."
  - **3.2.1(vii)** — person-to-person *gifts of money* are allowed **only if they do NOT use IAP**. Here the gift is funded by IAP credits → conflict.
- **Bait-and-switch risk (3.2.1 / 2.3.1):** flipping `VITE_CASHOUT_ENABLED=true` **without a new App Review submission** = the app behaving differently than reviewed. This alone can get the app pulled and the developer account terminated — independent of the cash-out rule itself.

### 2.2 Google Play
- **Purchase side: compliant** — uses Google Play Billing on Android.
- **Cash-out side (when enabled): high risk.** Play's Payments policy requires Play Billing for in-app digital goods and does **not** permit converting Play-Billing-purchased virtual currency back into cash. Same "different behavior than reviewed" deceptive-behavior risk applies.
- Not gambling (no chance element), so the Real-Money Gambling policy is not the issue — the **Payments / monetization** policy is.

### 2.3 "Replace it with PayPal & Stripe" — important
Switching the payout rail to **PayPal Payouts** or **Stripe Connect** does **NOT** fix the store problem. The stores object to **what** is being cashed out (value that originated from IAP), not **which** rail delivers it. Automating payouts would actually make things **worse**:
- It turns a manual, reviewable process into an automated money-movement system → **money-transmitter / e-money licensing** exposure (AUSTRAC in Australia, FinCEN MSB in the US, etc.).
- It removes the human fraud check that is currently your main safeguard.

**The only genuinely clean options:**
1. Keep cash-out **permanently disabled in the App Store / Play builds**, and offer it (if at all) **only on the web app** outside the stores; **or**
2. Restructure so cashable earnings **never derive from IAP purchases** (e.g., creator earnings funded by ad revenue or real-world services); **or**
3. Qualify as a formal tipping/creator-payout platform and accept Apple's cut via IAP-compliant mechanisms (hard, and still gray).

---

## 3. Security weak points

### 🔴 CRITICAL #1 — Clients can mint their own cherries/credits (Firestore rules hole)
**Where:** `firestore.rules:487-491` (general owner-update rule) + `firestore.rules:356-362` (`affiliateServerOnlyUserKeys`).

The owner-update rule allows a user to change **any field on their own `users/{uid}` doc except `role`/`accountType`**:
```
allow update: if isOwner(userId) && ownerAffiliateWriteGuards() &&
                 tasteScopeWriteOk() && pickOneWriteOk() &&
                 !diff().affectedKeys().hasAny(['role', 'accountType']);
```
The guard functions protect only **affiliate** fields, **tasteScope**, and **pickOne**. They do **NOT** protect `savedCredits`, `paidCredits`, `totalSavedCreditsEarned`, `totalCreditsPurchased`, `pendingCashoutRequestId`.

**Impact:** a normal signed-in user can, with a direct client Firestore write (no Cloud Function), set:
```js
updateDoc(doc(db,'users',myUid), { savedCredits: 100000, paidCredits: 999999 })
```
- **Today (cash-out off):** unlimited free invites/AI, unlimited gifting funded by fake credits.
- **When cash-out is on:** set `savedCredits` = 10000, request a Diamond jar → **$100 real payout of money you never funded.** Repeatable. This is direct theft.

The excellent server-side transaction code in `functions/` is bypassed entirely, because it reads `user.savedCredits` from a doc the client controls (`functions/cashout.js:155`).

**Fix:** add an explicit guard so no client owner-update may touch financial fields. Route ALL balance changes exclusively through Admin-SDK callables. E.g.:
```
function noFinancialFieldChange() {
  return !request.resource.data.diff(resource.data).affectedKeys().hasAny([
    'paidCredits','savedCredits','freeCredits',
    'totalCreditsPurchased','totalCreditsSpent','totalSavedCreditsEarned',
    'pendingCashoutRequestId','subscriptionTier','subscriptionStatus',
    'currentPlan','businessPaidUntil'
  ]);
}
```
and AND it into every owner `allow update` rule (especially `:487-491`).

### 🟠 HIGH #2 — Clients can forge ledger entries
**Where:** `firestore.rules:1491` — `credit_transactions` `create` is allowed for any signed-in user whose `userId` matches.

A user can fabricate fake `credit_transactions` rows (e.g., a fake `purchase` of 10000). This doesn't change balances by itself, but it **corrupts the audit trail admins review before approving a cash-out**. Combined with #1, an attacker can forge both a fake balance **and** matching fake ledger rows so a fraudulent cash-out looks legitimate to a human reviewer.
**Fix:** set `credit_transactions` `create` to admin/server-only (`allow create: if isAdminOrPanelStaff();`).

### 🟠 HIGH #3 — No KYC/AML on payees; laundering/chargeback vector
Cash-out collects only a free-form PayPal email, with no identity check, no velocity limits, and no link back to a **settled, non-chargebacked** funding purchase. Attack: buy credits with a **stolen card** (User A) → gift to User B → cash out to PayPal → original charge is later charged back. You lose the paid-out cash and the goods. The 30% haircut is only a "cost" of laundering, not a barrier.
**Fix (if cash-out ever ships):** KYC over a threshold, payout holds until funding purchases clear chargeback windows, per-user/day velocity caps, and block payout when funding source was refunded/revoked.

### 🟡 MEDIUM #4 — Feature-flag "bait-and-switch"
Enabling cash-out via env var without resubmitting to the stores is itself a policy violation (see 2.1/2.2). Treat enabling cash-out as requiring a **new store review**, not a config toggle.

### 🟡 LOW #5 — 30% vs "50%" documentation mismatch
Executable code is 30% everywhere (`GIFT_RECIPIENT_VALUE_RATE = 0.3`), but stale comments/copy say 50% in `functions/creditsCore.js:5`, `functions/giftCredits.js:2`, `src/pages/CreditsWallet.jsx:66-67`. The rendered UI is correct (30%). Cosmetic, but fix to avoid confusion/disputes.

### ✅ Not an issue — service-account key
`service-account-key.json` exists locally but is **git-ignored and not tracked** — good.

---

## 4. What you did RIGHT (the "big precautions" hold up)
- Cash-out disabled by default on client **and** server. ✅
- Purchase credits explicitly **non-cashable**; only gift-received cherries cashable. ✅
- Business accounts cannot send/receive gifts or cash out. ✅
- One pending cash-out per user; fixed jar packages only (no arbitrary amounts). ✅
- Atomic, idempotent server transactions; StoreKit/Play server verification. ✅
- Manual admin review before any payout. ✅
- Correct per-platform payment gating (IAP on mobile, cards on web). ✅

---

## 5. Prioritized action list
1. **NOW (security, independent of stores):** close the Firestore-rules holes #1 and #2. These are exploitable **today**.
2. **Before ever enabling cash-out:** treat it as a new store submission; assume Apple/Google will scrutinize IAP→cash conversion; get legal advice on money-transmitter/AML licensing in your operating countries.
3. **Do not** automate payouts via PayPal/Stripe expecting it to satisfy the stores — it won't, and it raises regulatory exposure.
4. **Strategic:** if cash-out is core to the product, plan to offer it **on web only** (outside the app stores) or redesign earnings so cashable value never originates from IAP.
5. Fix the 30%/50% copy mismatch.

---

*This audit reviewed source only. Verify against your live Firestore rules deployment and any server middleware not in this repo before acting.*
