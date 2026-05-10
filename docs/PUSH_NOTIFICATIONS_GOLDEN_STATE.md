# Push notifications — golden state (reference & restore)

**Purpose:** This document freezes the **known-working** FCM + PWA setup (including iPhone).  
If push breaks after unrelated changes, **restore the patterns listed here** before experimenting again.

**Tag suggestion (you run locally):** after verifying production:

`git tag -a push-notifications-golden -m "FCM+PWA+iOS working baseline"`

---

## Do not break (invariants)

1. **Vercel SPA rewrite must NOT swallow the messaging worker or manifest**  
   The catch-all rewrite must exclude at least:
   - `firebase-messaging-sw.js`
   - `manifest.json`
   - `sw.js` (legacy)  
   **Current pattern** in `vercel.json`:

   `"source": "/((?!api/)(?!firebase-messaging-sw\\.js)(?!manifest\\.json)(?!sw\\.js).*)"`

   If this regresses to `/((?!api/).*)` only, iOS/Android may load **HTML instead of JS** for the worker → **no FCM token**.

2. **`dist/firebase-messaging-sw.js` must match `public/` after every production build**  
   Handled by `postbuild` in `package.json` (copy `public/firebase-messaging-sw.js` → `dist/`).  
   `VERCEL_PREDIST=1` builds must still copy SW (see `scripts/vercel-build.mjs`).

3. **Single FCM worker at scope `/`**  
   Only `firebase-messaging-sw.js` for messaging + precache. Do not register a second SW on `/` without unregistering the other.

4. **Firebase compat version in SW = same major as app**  
   `public/firebase-messaging-sw.js` uses `importScripts` for **12.8.0** compat scripts — keep aligned with `package.json` `firebase` major.

5. **Do not add `onBackgroundMessage` + `showNotification` in the SW** while the server sends `webpush.notification` — duplicates on iOS.

6. **Server payload (Cloud Functions)**  
   - `sendEachForMulticast` with `webpush.notification` + `fcm_options.link` (absolute `https://www.dinebuddies.com/...`).  
   - Helpers: `fcmAbsoluteAppUrl`, `fcmSafeIconUrl`, chunk tokens ≤ **500**.  
   - Trigger: `onNotificationCreated` on `notifications/{id}`.

7. **Client**  
   - `initNotifications` + `saveFcmToken` in `src/services/notificationService.js` (VAPID, SW ready, unregister wrong SW, `setDoc` merge fallback if user doc missing).  
   - Foreground: `onMessage` without `showNotification` (in-app / Firestore UX).  
   - iOS: reliable use from **Home Screen PWA**; Safari tab is limited by Apple.

8. **`manifest.json`**  
   Keep `gcm_sender_id` aligned with Firebase `messagingSenderId` (web FCM).

---

## File map (golden touchpoints)

| Area | File |
|------|------|
| Vercel rewrites + SW headers | `vercel.json` |
| FCM send + trigger | `functions/index.js` (`sendPushToUser`, `onNotificationCreated`) |
| SW + precache + click | `public/firebase-messaging-sw.js` → copied to `dist/` |
| Token + SW registration | `src/services/notificationService.js` |
| Login init + iOS retry | `src/context/AuthContext.jsx` (`initNotifications`, delayed retry) |
| Install / enable UX | `src/components/PushNotificationPrompt.jsx` |
| Build copy SW | `package.json` `postbuild`, `build:firebase` |
| Predist safety | `scripts/vercel-build.mjs` |

---

## Deploy checklist (minimal)

1. `npm run build` (or `build:firebase`) — confirm `dist/firebase-messaging-sw.js` exists and matches `public/`.  
2. Deploy hosting (Vercel and/or Firebase).  
3. Deploy functions: `firebase deploy --only functions` (or your pipeline).  
4. iPhone: open app from **Home Screen icon**, accept notifications, confirm `fcmTokens` on `users/{uid}` in Firestore.

---

## Safe small changes later

- Copy / UI text in `PushNotificationPrompt.jsx`  
- Notification list layout (`Notifications.jsx`) **without** changing SW registration, Vercel rewrites, or Functions multicast shape  
- Icons / `CACHE_NAME` bump in `firebase-messaging-sw.js` when you intentionally bust SW cache

---

## Restore quickly (git)

```bash
git checkout push-notifications-golden -- path/to/file
# or full tree if needed:
git checkout push-notifications-golden -- vercel.json public/firebase-messaging-sw.js src/services/notificationService.js functions/index.js
```

Replace `push-notifications-golden` with your actual tag or commit hash.

---

*Last aligned with worker cache name: `dinebuddies-v19-sw-route-fix` (see `public/firebase-messaging-sw.js`). When bumping `CACHE_NAME`, update this line in the doc.*
