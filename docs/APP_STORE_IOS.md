# Apple App Store + iOS setup

DineBuddies is **web + Google Play + Apple App Store**, each with its own payment channel:
**Stripe + PayPal on web**, **Google Play Billing on native Android**, **Apple In-App Purchase on native iOS**.
The iOS app must never show Stripe/PayPal checkout — Apple App Store Review Guideline 3.1.1
requires Apple's own IAP for anything unlocked inside the app.

## Status checklist

| Step | Status |
|------|--------|
| Capacitor iOS platform (`ios/`) | Done — committed and pushed |
| Codemagic CI → TestFlight (`codemagic.yaml`) | Done — committed and pushed, not yet triggered |
| Apple IAP native plugin (`AppleStoreBillingPlugin`) | Done |
| App Store Connect app (`com.dinebuddies.app`, Apple ID 6802827926) | Done |
| 4 credit IAP products + 1 business subscription | Done |
| App Store Server API key (Key ID `C2346QQ4K2`) | Done |
| Apple Root CA certificates (`functions/apple-certs/`) | Done |
| Cloud Functions env vars | Done — deployed |
| Signed build → TestFlight | You (via Codemagic) |
| Sandbox purchase test | You |
| Native iOS sign-in (Google/Facebook/Apple) code | Done |
| Enable "Sign In with Apple" capability on `com.dinebuddies.app` | You (Apple Developer Portal) |
| Add iOS platform to Facebook app in Meta Developer Console | You |

## What is already in the repo

| Layer | Files |
|-------|-------|
| Product catalog | `functions/appStoreCatalog.js`, `src/config/appStoreCommerce.js` |
| Server verify + grant | `functions/appStoreBilling.js` → `verifyAppleCreditsPurchase`, `verifyAppleBusinessSubscription` |
| Client routing | `src/utils/commercePlatform.js`, `src/hooks/useCreditsPurchase.js` |
| Wallet UI | `src/pages/CreditsWallet.jsx` |
| Business subscription UI | `src/pages/business-pro/ProSubscription.jsx` |
| iOS native plugin | `ios/App/App/AppleStoreBillingPlugin.swift` |

## 0. Commit `ios/` and `codemagic.yaml` (do this first)

Both were created in an earlier session but were **never committed to git** (confirmed via
`git status` — they show as untracked). Codemagic builds from the git remote, so nothing has
ever actually been built from them yet. Review and commit:

```bash
git add ios/ codemagic.yaml
git commit -m "Add iOS Capacitor platform and Codemagic CI config"
```

## 1. App Store Connect (your account)

1. Create the app (bundle id `com.dinebuddies.app`) in App Store Connect if not already done.
2. **In-App Purchases** → create 4 **Consumable** products, with these *exact* product ids
   (must match `functions/appStoreCatalog.js` / `src/config/appStoreCommerce.js`):
   - `com.dinebuddies.app.credits_200` (200 Dine Credits)
   - `com.dinebuddies.app.credits_500` (500 Dine Credits)
   - `com.dinebuddies.app.credits_1000` (1000 Dine Credits)
   - `com.dinebuddies.app.credits_3000` (3000 Dine Credits)
3. **Subscriptions** → create a new subscription group, then one **auto-renewable subscription**:
   - `com.dinebuddies.app.business_monthly` (monthly, priced to match the existing
     `STRIPE_PRICE_BUSINESS_MONTHLY` plan on web)
4. **Users and Access → Integrations → App Store Server API** → generate a key:
   - Download the `.p8` private key (you only get one download — save it securely)
   - Note the **Key ID** and **Issuer ID**

## 2. Apple Root CA certificates

The server-side verifier (`SignedDataVerifier`, used by `functions/appStoreBilling.js`) needs
Apple's root certificates on disk to validate the signature chain of every purchase.

1. Download from <https://www.apple.com/certificateauthority/> (the current **G3** root, plus
   the older Apple Inc. Root cert for compatibility): `AppleRootCA-G3.cer`, `AppleIncRootCertificate.cer`.
2. Place them in `functions/apple-certs/`. `functions/appStoreEnv.js`'s `resolveAppleRootCertPaths()`
   reads every `.cer` file in that folder automatically (no path env var needed) — these are
   public certificates, not secrets, so `functions/apple-certs/` is committed to version control.

## 3. Cloud Functions env vars

Add to `functions/.env` (and the deployed Functions runtime config):

```
APPLE_IAP_BUNDLE_ID=com.dinebuddies.app
APPLE_IAP_KEY_ID=<Key ID from step 1.4>
APPLE_IAP_ISSUER_ID=<Issuer ID from step 1.4>
APPLE_IAP_PRIVATE_KEY_BASE64=<base64 of the .p8 file — run: base64 -w0 AuthKey_XXXX.p8>
APPLE_IAP_APP_APPLE_ID=<numeric App Store Connect app id, production only — omit for sandbox testing>
APPLE_IAP_MODE=sandbox
```

Base64-encoding the key (rather than the `\n`-escaping style used for `FIREBASE_PRIVATE_KEY`)
avoids the newline-escaping bug already hit once with that variable.

Switch `APPLE_IAP_MODE=production` once the app is live on the Store — this must match where
the actual purchases are coming from (TestFlight/sandbox testers vs. real customers), or
verification will fail.

## 4. Codemagic → TestFlight

Once `ios/` and `codemagic.yaml` are committed (step 0), trigger a Codemagic build. This is the
**first real compile check** for `AppleStoreBillingPlugin.swift` — it cannot be compiled or
tested from this (Windows) environment. Confirm the build succeeds and a TestFlight build is
produced before doing anything else on iOS.

## 5. Sandbox purchase test (do this yourself, once TestFlight build is live)

1. App Store Connect → Users and Access → Sandbox → Testers → create a sandbox tester account.
2. On a real iPhone (or Simulator with a signed-in sandbox account), install the TestFlight build.
3. Sign out of your real Apple ID in Settings → App Store, sign in with the sandbox tester there.
4. Open the app → Dine Credits wallet → buy each of the 4 packs. Confirm:
   - The native Apple purchase sheet appears (not Stripe/PayPal).
   - `paidCredits` increases on the corresponding `users/{uid}` Firestore doc.
   - A doc appears in `apple_iap_credit_fulfillments/{transactionId}`.
5. From a business account, open Settings → Subscription → Upgrade to Paid. Confirm:
   - The native Apple subscription sheet appears.
   - `subscriptionTier` becomes `'paid'`, `subscriptionProvider` becomes `'apple'`,
     `businessPaidUntil` is set ~1 month out, on `users/{uid}`.
   - A doc appears in `apple_business_plan_fulfillments/{originalTransactionId}`.
6. Sandbox subscriptions renew on an accelerated schedule (minutes, not a month) — useful for
   confirming the app correctly re-verifies and refreshes `businessPaidUntil` on repeat visits,
   since there is no live webhook wired up yet (see Non-Goals in the implementation plan).

## 6. Policy

Do **not** offer Stripe/PayPal checkout inside the native iOS app for Dine Credits or the
Business subscription — use Apple In-App Purchase only. Web (`dinebuddies.com`) keeps
Stripe + PayPal. Android keeps Google Play Billing (see `docs/GOOGLE_PLAY_ANDROID.md`).

## 7. Native iOS sign-in (Google / Facebook / Apple)

The web `signInWithRedirect` OAuth flow does not work inside the native iOS WKWebView — it
requires a full-page browser navigation that cannot round-trip back into the app. All three
sign-in buttons now use the native `@capacitor-firebase/authentication` plugin on iOS instead
(same plugin Android already used for Google/Facebook), gated by `isNativeIos()` in
`src/platform/nativeGoogleAuth.js`, `nativeFacebookAuth.js`, and the new `nativeAppleAuth.js`.

Two manual, one-time steps are required in Apple/Meta's own consoles before this works — the
code alone is not enough:

1. **Apple Developer Portal** → Certificates, Identifiers & Profiles → Identifiers →
   `com.dinebuddies.app` → check **Sign In with Apple** → Save. The provisioning profile used
   by Codemagic (the one manually registered earlier in Codemagic's code-signing vault) must
   then be regenerated so it includes the new capability — go to Profiles, select the App Store
   profile for this app, click Edit → Save (or Generate a fresh one) so it picks up the updated
   capability list.
2. **Meta Developer Console** (developers.facebook.com) → your app (App ID `1718617005774108`) →
   Settings → Basic → scroll to Platforms → Add Platform → iOS → Bundle ID `com.dinebuddies.app`
   → Save Changes. Mirrors the existing Android platform entry for the same app
   (see `docs/GOOGLE_PLAY_ANDROID.md`).

Until step 1 is done, native Apple sign-in will fail even though the app code and entitlement
file (`ios/App/App/App.entitlements`) are correctly in place — Apple rejects the sign-in request
server-side if the capability isn't enabled for the bundle ID. Google sign-in has no extra
manual step (the reversed client ID URL scheme is already wired into `Info.plist`).

## 8. Known gaps / follow-ups (not built in this pass)

- **Android Business subscription still uses Stripe** (`docs/GOOGLE_PLAY_ANDROID.md` §6) — a
  pre-existing gap, not fixed by this iOS work. Recommended follow-up for full Play Store
  payments-policy compliance.
- **No Apple Server Notifications V2** — subscription status is only refreshed when the client
  re-verifies (e.g. visiting the subscription settings screen), not pushed on renewal/cancellation.
  Fine for launch; revisit if stale `businessPaidUntil` becomes a real problem.
- **Personal "premium/vip" Stripe tier has no Apple equivalent** — it also has no live web UI
  caller today (dead code), so it was intentionally left out of this pass.
