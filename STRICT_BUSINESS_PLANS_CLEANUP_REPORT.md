# Strict Business Plans Cleanup – Report

## Summary

- **Business plans** exist only as: **free**, **professional**, **elite** (no legacy aliases or fallbacks).
- **Single source of truth:** `users/{userId}.subscriptionTier` only; no reads from `businessInfo` for tier/plan.
- **Migration script** normalizes existing business data and removes legacy fields (run with Firestore write access).

---

## 1. Every file changed

| # | File |
|---|------|
| 1 | `src/config/subscriptionPlans.js` |
| 2 | `src/components/Layout.jsx` |
| 3 | `src/pages/BusinessDashboard.jsx` |
| 4 | `src/pages/BusinessProDashboard.jsx` |
| 5 | `src/pages/business-pro/BrandKit.jsx` |
| 6 | `src/services/offerService.js` |
| 7 | `src/components/EnhancedGallery.jsx` |
| 8 | `src/pages/AdminPanel.jsx` |
| 9 | `src/pages/AdminDashboard.jsx` |
| 10 | `src/components/BusinessLimitsEditor.jsx` |
| 11 | `src/hooks/useEffectiveLimits.js` |
| 12 | `src/pages/Settings.jsx` |
| 13 | `src/pages/Profile.jsx` |
| 14 | `src/utils/demoDataGenerator.js` |
| 15 | `src/components/CreateBusinessAccount.jsx` |
| 16 | `scripts/migrate_business_plans_strict.js` (new) |

**Total: 16 files (15 modified, 1 new).**

---

## 2. Every data field migrated

Migration script **`scripts/migrate_business_plans_strict.js`** affects only business user documents (`accountType === 'business'` or `role === 'business'`) in the **`users`** collection.

### Fields written (normalized)

| Collection | Field | Action | Values |
|------------|--------|--------|--------|
| `users` | `subscriptionTier` | Set or overwrite | One of `free`, `professional`, `elite`. Legacy values normalized: `premium` → `elite`; `basic` or `pro` → `professional`; any other → `free`. |

### Fields removed (deleted from document)

| Collection | Field | Action |
|------------|--------|--------|
| `users` | `businessInfo.subscriptionTier` | Deleted when present |
| `users` | `businessInfo.tier` | Deleted when present |
| `users` | `businessInfo.subscriptionPlan` | Deleted when present |

### Source of tier during migration

- Primary: **`users/{userId}.subscriptionTier`**
- Fallback (only if root missing): **`users/{userId}.businessInfo.subscriptionTier`**, then **`businessInfo.tier`**, then **`businessInfo.subscriptionPlan`** — value is normalized then written to **`users.subscriptionTier`** and the three `businessInfo.*` fields above are deleted.

**No other collections or fields are read or written by the migration.**

---

## 3. Every place where business-plan logic was cleaned up

### 3.1 Removed legacy aliases and fallbacks

| File | Location / concern | Cleanup |
|------|--------------------|--------|
| **Layout.jsx** | `businessTier` / `canAccessDesktopDashboard` | Removed `businessInfo.subscriptionTier` fallback; removed `premium` → `elite` alias. Tier from `userProfile?.subscriptionTier` only; `canAccessDesktopDashboard = (businessTier === 'elite')`. |
| **BusinessDashboard.jsx** | Desktop redirect, elite badge, copy | Removed `businessInfo.subscriptionTier`; removed `premium` → `elite` in redirect; UI checks only `subscriptionTier === 'elite'`; copy says "Elite features" not "premium". |
| **BusinessProDashboard.jsx** | Access guard | Removed `businessInfo.subscriptionTier` and `premium` alias; `isElite = (tier === 'elite')` only. |
| **BrandKit.jsx** | `isPaid` | Removed `businessInfo?.subscription?.tier` and `businessInfo?.tier`; removed `premium`; `isPaid = (tier === 'professional' \|\| tier === 'elite')`. |
| **offerService.js** | `isElite` for offer credits | Removed `subscriptionTier === 'premium'` and `data.plan === 'Elite'`; `isElite = (data.subscriptionTier === 'elite')`. |
| **EnhancedGallery.jsx** | `MAX_IMAGES` by tier | Removed `premium` from condition; tier is `elite` \|\| `professional` \|\| else. |
| **AdminPanel.jsx** | Business dropdown value | Removed display alias `premium` → `elite`; value is one of `free` / `professional` / `elite`, else shown as `free`. |

### 3.2 Removed business-plan reads from businessInfo

| File | Location / concern | Cleanup |
|------|--------------------|--------|
| **Layout.jsx** | Tier source | No read from `businessInfo.subscriptionTier` or `businessInfo.tier`. |
| **BusinessDashboard.jsx** | Tier source | No read from `businessInfo.subscriptionTier`. |
| **BusinessProDashboard.jsx** | Tier source | No read from `businessInfo.subscriptionTier`. |
| **BrandKit.jsx** | Paid tier source | No read from `businessInfo.subscription` or `businessInfo.tier`. |
| **AdminDashboard.jsx** | Plan for cards, filter, Pro+ count | All use `business.subscriptionTier`; no `businessInfo.subscriptionPlan`. |
| **BusinessLimitsEditor.jsx** | Default plan for limits | `planId` from `business.subscriptionTier` only; no `businessInfo.subscriptionPlan`. |
| **useEffectiveLimits.js** | Plan and limits | Plan from `userData.subscriptionTier` (user doc root); custom limits still from `userData.businessInfo` (no tier/plan fields read there). Removed `businessInfo.subscriptionPlan` and soft-launch premium override. |

### 3.3 Single source of truth: `users.subscriptionTier` only

| File | Usage |
|------|--------|
| **Layout.jsx** | `userProfile?.subscriptionTier` for business tier and desktop dashboard access. |
| **BusinessDashboard.jsx** | `userProfile?.subscriptionTier` for redirect and UI. |
| **BusinessProDashboard.jsx** | `userProfile?.subscriptionTier` for guard. |
| **BrandKit.jsx** | `userProfile?.subscriptionTier` for `isPaid`. |
| **AdminPanel.jsx** | Business users: dropdown reads/writes `user.subscriptionTier` via `adminSetUserSubscriptionTier`. |
| **AdminDashboard.jsx** | `business.subscriptionTier` for plan badge, filter, Pro+ count. |
| **BusinessLimitsEditor.jsx** | `business.subscriptionTier` for `planId` and defaults. |
| **useEffectiveLimits.js** | `userData.subscriptionTier` from user doc for plan id. |
| **Settings.jsx** | Business section: `userProfile?.subscriptionTier` for labels and badges. |
| **Profile.jsx** | Business: badge and free-check use `userProfile.subscriptionTier`. |
| **offerService.js** | `data.subscriptionTier` from user doc for elite check. |
| **EnhancedGallery.jsx** | `partner?.subscriptionTier` (partner = user doc). |
| **CreateBusinessAccount.jsx** | Form field `subscriptionTier`; on create, writes `subscriptionTier` on user doc; no `businessInfo.subscriptionPlan`. |

### 3.4 Labels, gating, limits, settings, admin, creation (only free / professional / elite)

| File | What was updated |
|------|-------------------|
| **subscriptionPlans.js** | Added `professional` and `elite` plan objects and PLAN_BADGES; added `BUSINESS_TIERS` and `getNextBusinessTier()`. `getPlanById()` supports business tiers. |
| **AdminPanel.jsx** | Business dropdown options: Free, Professional, Elite only; uses `adminSetUserSubscriptionTier(..., true)`. |
| **AdminDashboard.jsx** | Plan filter options: Free, Professional, Elite. Pro+ count = `subscriptionTier === 'professional' \|\| 'elite'`. Cards use `business.subscriptionTier` for badge/limits. |
| **BusinessLimitsEditor.jsx** | `planId` restricted to `free` \|\| `professional` \|\| `elite`; uses `getNextBusinessTier`. |
| **Settings.jsx** | Business subscription section: labels and badges only Elite / Professional / Free; no Premium for business. |
| **SubscriptionSettings.jsx** | No change for business; business branch already uses ProSubscription (elite/professional/free). |
| **CreateBusinessAccount.jsx** | Initial plan dropdown: Free, Professional, Elite only; saves `subscriptionTier` on user doc. |
| **demoDataGenerator.js** | Demo businesses: tier is `elite` or `free` only (no `premium`). |

### 3.5 Separation of business vs user plan logic

| File | Change |
|------|--------|
| **Profile.jsx** | Business: badge and “free” upgrade button use `userProfile.subscriptionTier`. User: still use `subscriptionPlan` / `subscriptionTier`. Explicit branch by `userProfile?.role === 'business'`. |
| **SubscriptionSettings.jsx** | `isPremium = !isBusiness && subscriptionTier === 'premium'` — premium only for non-business. Business branch unchanged (ProSubscription). |
| **AdminPanel.jsx** | Business: separate dropdown (Free/Professional/Elite) and `updateBusinessSubscription` → `adminSetUserSubscriptionTier(..., true)`. User: existing dropdown (Free/Pro/Premium) and `updateSubscription` (updateDoc + TIER_QUOTAS). |

---

## 4. Migration script (strict business-data cleanup)

- **Script:** `scripts/migrate_business_plans_strict.js`
- **Run:** `node scripts/migrate_business_plans_strict.js` (with `.env` / `.env.local` and Firestore write access).
- **Scope:** Only documents in `users` with `accountType === 'business'` or `role === 'business'`.
- **Behavior:**  
  - Normalizes `subscriptionTier` to `free` \|\| `professional` \|\| `elite` (premium→elite, basic/pro→professional, other→free).  
  - Deletes `businessInfo.subscriptionTier`, `businessInfo.tier`, `businessInfo.subscriptionPlan` when present.

---

## 5. Confirmation: no active business code uses legacy names or sources

- **businessInfo.subscriptionTier / businessInfo.tier / businessInfo.subscriptionPlan**  
  Grep in `src` for these: **no matches**. No active business code reads plan/tier from `businessInfo`.

- **Legacy business tier name “premium”**  
  No business code path checks `subscriptionTier === 'premium'`. The only remaining `premium` tier check is in **SubscriptionSettings.jsx** for **user** plans: `!isBusiness && subscriptionTier === 'premium'`. Correct.

- **Legacy “basic” / “pro” for business**  
  AdminDashboard plan filter and CreateBusinessAccount options use only Free, Professional, Elite. No business-only use of `basic` or `pro` for tier.

- **Valid business tiers in code**  
  All business gating, labels, and limits use only `free`, `professional`, `elite` (and single source `users.subscriptionTier`).

**Conclusion:** No active business code uses legacy business plan names or old business plan sources.

---

## 6. Confirmation: regular user plan logic unchanged except where separation was necessary

- **Unchanged (user plans only):**  
  User tiers (free, pro, vip), **TIER_QUOTAS** in AdminPanel, **InvitationContext** user quotas and plan loading, **Plans.jsx** (Firestore `subscriptionPlans`), Stripe user checkout, **SubscriptionSettings** user plan list and `isPremium`, **getNextTier** (user chain: free→basic→pro→premium).

- **Changed only to separate business from user:**  
  - **Profile.jsx:** Business branch uses `subscriptionTier` for badge and free-check; user branch still uses `subscriptionPlan` / `subscriptionTier`. No change to user-only logic.  
  - **AdminPanel.jsx:** Business and user each have their own dropdown and update path; user path and TIER_QUOTAS unchanged.  
  - **SubscriptionSettings.jsx:** `isPremium` explicitly scoped to `!isBusiness`; no change to user plan display.

**Conclusion:** Regular user plan logic was not changed except where separation from business was necessary (Profile, AdminPanel, SubscriptionSettings); user tiers, quotas, and Stripe flow are unchanged.
