# Google Play + Android setup

DineBuddies is **web + Google Play together**: same Firebase backend. **Stripe on web**, **Google Play Billing on native Android**.

## Status checklist

| Step | Status |
|------|--------|
| Capacitor config (`com.dinebuddies.mobile`) | Done |
| `android/` native shell | Done |
| npm scripts `android:sync` / `cap:open` | Done |
| Play Billing native plugin (`GooglePlayBilling`) | Done |
| Play Console app + credit SKUs | You — see `docs/PLAY_CONSOLE_CHECKLIST.md` |
| Service account env on Cloud Functions | You |
| Signed AAB → Internal testing | You + Android Studio |
| Store listing / Data safety / content rating | You |
| Release signing (`keystore.properties`) | Template ready — you create the keystore |

## What is already in the repo

| Layer | Files |
|-------|--------|
| Product SKUs | `functions/googlePlayCatalog.js`, `src/config/googlePlayCommerce.js` |
| Server verify + consume | `functions/googlePlayBilling.js` → `verifyGooglePlayCreditsPurchase` |
| Client routing | `src/utils/commercePlatform.js`, `src/hooks/useCreditsPurchase.js` |
| Wallet UI | `src/pages/CreditsWallet.jsx` |
| Android shell | `android/` (Capacitor 8) |

## Daily Android workflow

```bash
npm run android:sync   # build web → copy into android/
npm run cap:open       # open Android Studio
```

## 1. Google Play Console (your account)

Follow the full step-by-step checklist:

→ **[`docs/PLAY_CONSOLE_CHECKLIST.md`](./PLAY_CONSOLE_CHECKLIST.md)**

Summary: create app `com.dinebuddies.mobile` → store listing + policy URLs → four credit SKUs → API service account → `google-services.json` → signed AAB → Internal testing.

## 2. Capacitor Android shell (done in repo)

Already added:

- `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`
- `android/` project (`applicationId` = `com.dinebuddies.mobile`)
- `capacitor.config.json`

## 3. Billing plugin (native) — done

Local Capacitor plugin registered as **`GooglePlayBilling`**:

| Piece | Path |
|-------|------|
| Native | `android/app/src/main/java/com/dinebuddies/app/GooglePlayBillingPlugin.java` |
| Registration | `MainActivity.java` → `registerPlugin(GooglePlayBillingPlugin.class)` |
| Billing Library | `com.android.billingclient:billing:8.0.0` in `android/app/build.gradle` |
| Web bridge | `src/utils/googlePlayBillingClient.js` → `launchBillingFlow({ productId })` → `{ purchaseToken }` |

Flow: Play purchase sheet → `purchaseToken` → Cloud Function `verifyGooglePlayCreditsPurchase` (verify + consume + grant credits).

```bash
npm run android:sync
npm run cap:open
```

In Android Studio: sync Gradle, build a signed **AAB**, upload to **Internal testing**.

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

## 8. Google Sign-In (Android)

| Item | Value |
|------|--------|
| Firebase Android app | package `com.dinebuddies.mobile` |
| Config file | `android/app/google-services.json` (gitignored — keep local copy) |
| Plugin | `@capacitor-firebase/authentication` |
| Native bridge | `src/platform/nativeGoogleAuth.js` (from `AuthContext.signInWithGoogle`) |
| Device SHA helper | `AppSigningInfo` plugin → prints `Device SHA-1` on Error 10 |

### Working config (verified 2026-07-28, build 1.0.38)

Google Sign-In Error 10 was fixed by registering the **exact** device SHA-1 in Firebase (a near-miss SHA differing by two hex characters failed):

| Role | SHA-1 (no colons, lowercase) |
|------|------------------------------|
| Device / required | `8f83e80478ebd15cdd2c84ef5abe630640d688bd` |
| Upload keystore (local release APK) | `32c47db7c1d6dcff44edfe42f589a41a8a7645a9` |

**Do not remove** these fingerprints from Firebase → Project settings → Android app. After any SHA change: download a fresh `google-services.json`, replace `android/app/google-services.json`, then `npm run android:sync` and rebuild.

Near-miss that must **not** be used: `8f83e80478ebd15cdd2c84ef5abe63064d0688bd`.

### Facebook Login (Android) — verified 2026-07-28, build 1.0.40+

Meta Developer Console → App settings → Basic → Android:

| Field | Value |
|------|--------|
| Package name | `com.dinebuddies.mobile` |
| Class name | `com.dinebuddies.mobile.MainActivity` |
| Key hashes | see below |

Key hashes (keep all):

```
MsR9t8HW3P9E7f5C9YmkGop2Rak=
7ukitpf0qRaaU7mvNKDt/qWmEps=
j4PoBHjr0VzdLITvWr5jBkDWiL0=
4AUl2AMRpERKOs0cijJFTKwcnSA=
```

Local secrets (gitignored): `android/facebook.properties` (`clientToken`), `android/app/google-services.json`, `android/keystore/`.

After changing auth or web assets: `npm run android:sync`, then generate a new signed **AAB**/APK and bump `versionCode`.
