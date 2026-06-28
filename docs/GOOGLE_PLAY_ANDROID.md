# Google Play billing — Android setup

DineBuddies uses **Stripe on web** and **Google Play Billing on native Android** (same credit ledger on Firebase).

## What is already in the repo

| Layer | Files |
|-------|--------|
| Product SKUs | `functions/googlePlayCatalog.js`, `src/config/googlePlayCommerce.js` |
| Server verify + consume | `functions/googlePlayBilling.js` → `verifyGooglePlayCreditsPurchase` |
| Client routing | `src/utils/commercePlatform.js`, `src/hooks/useCreditsPurchase.js` |
| Wallet UI | `src/pages/CreditsWallet.jsx` |

## 1. Google Play Console

1. Create app with package **`com.dinebuddies.app`** (must match `GOOGLE_PLAY_PACKAGE_NAME`).
2. **Monetize → Products → In-app products** — add **consumable** products:

   | Product ID | Credits |
   |------------|---------|
   | `dine_credits_200` | 200 |
   | `dine_credits_500` | 500 |
   | `dine_credits_1000` | 1000 |
   | `dine_credits_3000` | 3000 |

3. **Setup → API access** — link a Google Cloud service account with **View financial data** + **Manage orders**.
4. Download service account JSON → minify to one line → set in `functions/.env`:

   ```env
   GOOGLE_PLAY_PACKAGE_NAME=com.dinebuddies.app
   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
   ```

5. Deploy functions:

   ```bash
   npm run deploy:firebase-functions
   ```

## 2. Capacitor Android shell

From repo root (after `npm run build`):

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init DineBuddies com.dinebuddies.app --web-dir dist
npx cap add android
npx cap sync android
```

`capacitor.config.json` is already in the repo.

## 3. Billing plugin (native)

Install a Capacitor Google Play Billing plugin and register it as **`GooglePlayBilling`** with:

- `launchBillingFlow({ productId })` → resolves with `{ purchaseToken }`

The web client calls this in `src/utils/googlePlayBillingClient.js`.

Example community plugin: `@codetrix-studio/capacitor-google-play-billing` (verify compatibility with your Capacitor version before production).

After adding the plugin:

```bash
npx cap sync android
```

Open **`android/`** in Android Studio, set `minSdkVersion` ≥ 23, enable **Billing Library** in Gradle, sign the app, upload AAB to **Internal testing**.

## 4. Purchase flow

```
User taps Buy (Android app)
  → GooglePlayBilling.launchBillingFlow
  → verifyGooglePlayCreditsPurchase (Cloud Function)
  → Google Play Developer API validates token
  → paidCredits += N (Firestore)
  → product consumed on Play (repurchase allowed)
```

Idempotency: `google_play_credit_fulfillments/{tokenHash}`.

## 5. Testing

- Add license testers in Play Console → **Settings → License testing**.
- Install from **Internal testing** track ( sideload APK alone may not bill correctly ).
- Callable debug: `getGooglePlayCommerceStatus`.

## 6. Business subscription (later)

Monthly business plan on Android needs a **subscription** SKU + `purchases.subscriptionsv2` verification (separate from credit consumables). Stripe remains for web business checkout until that is built.

## 7. Policy

Do **not** offer Stripe credit checkout inside the native Android app for digital goods — use Google Play only. Web (`dinebuddies.com`) keeps Stripe.
