# Business Plans – Full Audit & Cleanup Proposal (No Execution)

This document lists every file and value involved in **business** plan logic, the current source of truth, legacy/conflicting names, mixing with user plans, and a **proposed cleanup plan for business plans only**. **Nothing is executed until you approve.**

---

## 1. Every file involved in business-plan logic

### Config / source of truth
| File | Role |
|------|------|
| `src/config/planDefaults.js` | **Primary source**: `BASE_SUBSCRIPTION_PLANS` includes business plans p4 (Professional), p5 (Elite), p6 (Free Partner). Fields: `type: 'business'`, `tier`, `stripePriceId`, `name`, `price`, `features`, `offerSlots`, `offerPerpetual`, etc. |
| `src/config/subscriptionPlans.js` | **Generic/legacy**: `SUBSCRIPTION_PLANS` has `free`, `basic`, `pro`, `premium` (no `professional`/`elite`). Used by AdminDashboard, BusinessLimitsEditor; **not** the source of truth for business tier *names*. |

### UI – partner profile & dashboard
| File | Usage |
|------|--------|
| `src/pages/PartnerProfile.jsx` | Reads `partner.subscriptionTier`; uses `tier === 'professional' \|\| tier === 'elite'` for isPaid, `tier === 'elite'` for isElite; badge labels `elite_partner` / `professional_partner`. |
| `src/pages/BusinessDashboard.jsx` | Reads `userProfile?.subscriptionTier` or `userProfile?.businessInfo?.subscriptionTier`; treats `elite` or `premium` as Elite for redirect; shows plan badge (Free / Professional / Elite). |
| `src/pages/BusinessProDashboard.jsx` | Same tier read; only `elite` or `premium` can access; else redirect to `/business-dashboard`. |
| `src/components/Layout.jsx` | `businessTier` from `userProfile?.subscriptionTier` or `userProfile?.businessInfo?.subscriptionTier`; `canAccessDesktopDashboard = elite \|\| premium`. |
| `src/pages/Settings.jsx` | For business: `subscriptionTier === 'premium'` shows Premium badge (legacy). |
| `src/pages/business-pro/ProSubscription.jsx` | Uses `BASE_SUBSCRIPTION_PLANS` filtered by `type === 'business' && price > 0`; tier from `userProfile?.subscriptionTier`; compares `plan.tier === tier` (elite/professional). |
| `src/pages/business-pro/ProOffers.jsx` | Tier from `userProfile?.subscriptionTier`; isElite / isProfessional. |
| `src/pages/business-pro/BrandKit.jsx` | isPaid from `businessInfo?.subscription?.tier === 'elite'` or `businessInfo?.tier === 'premium'` or `'elite'` (mixed paths). |

### Services & backend
| File | Usage |
|------|--------|
| `src/services/premiumOfferService.js` | Reads `userData.subscriptionTier`; allows `elite` or `professional`; writes offer with `tier: 'elite' \|\| 'professional'`. |
| `src/services/offerService.js` | isElite from `data.subscriptionTier === 'elite' \|\| 'premium'` or `data.plan === 'Elite'`. |
| `src/services/adminSecurityService.js` | `adminSetUserSubscriptionTier(targetUid, subscriptionTier, isBusinessUser)` – callable only. |
| `functions/index.js` | `adminSetUserSubscriptionTier`: allowed business tiers = `['free', 'professional', 'elite']`; writes `users/{uid}` with `subscriptionTier`; for non-business uses `USER_WEEKLY_PRIVATE_QUOTAS`. `consumeOfferCredit`: tier from user doc, elite exempt. |
| `functions/webhook.js` | `getTierForPlan(planId)`: maps planId string to tier (`elite`, `professional`, `premium`, `pro`, `free`). Writes `subscriptionTier` and `weeklyPrivateQuota` on checkout/subscription update/cancel. |

### Components (feature gates / display)
| File | Usage |
|------|--------|
| `src/components/EnhancedGallery.jsx` | `tier = partner?.subscriptionTier`; MAX_IMAGES: elite/premium 20, professional 6, else 20. |
| `src/components/DeliveryLinksSection.jsx` | isPaid = `professional` or `elite`. |
| `src/components/PlanBadge.jsx` | Generic badge; accepts tier prop (e.g. `elite`). |
| `src/components/CreateBusinessAccount.jsx` | **Problem**: dropdown has `free`, `basic`, `pro`, `premium` (user-style names), not business tiers. |

### Admin
| File | Usage |
|------|--------|
| `src/pages/admin/Plans.jsx` | Loads/syncs from Firestore `subscriptionPlans`; seed from `BASE_SUBSCRIPTION_PLANS`; form has `tier` placeholder "free, pro, vip, professional, elite"; filters by `type === 'business'` for display. |
| `src/pages/admin/UserManagement.jsx` | `BIZ_TIERS`: free, professional, elite; `USER_TIERS`: free, pro, vip; updates via `adminSecurityService.setUserSubscriptionTier` with `isBusinessUser`. |
| `src/pages/admin/AdminDashboard.jsx` | Counts paid users with `['pro', 'vip', 'professional', 'elite'].includes(u.subscriptionTier)` (mixes user and business). |
| `src/pages/AdminPanel.jsx` | **Problem**: subscription dropdown only has Free / Pro / Premium (vip) – **no business tiers**; `TIER_QUOTAS` only has free/pro/vip. So AdminPanel cannot set business users to professional/elite. |

### Other
| File | Usage |
|------|--------|
| `src/pages/SubscriptionSettings.jsx` | For business: shows Elite/Professional/Free Partner labels; embeds `ProSubscription`; for user: free/pro/premium. |
| `src/context/InvitationContext.jsx` | Loads plans from Firestore `subscriptionPlans` + merge with `BASE_SUBSCRIPTION_PLANS`; `MONTHLY_PRIVATE_QUOTAS` = user only (pro, premium, vip). No business quota here. |
| `src/pages/PricingPage.jsx` | Uses `subscriptionPlans` from InvitationContext; filters by `plan.type === selectedPlanType` ('partner' vs 'user'). |
| `src/utils/demoDataGenerator.js` | Sets `subscriptionTier: 'premium' \|\| 'free'` on demo partners – legacy name. |

---

## 2. Current business-plan values in code, Firestore, Stripe, UI, translations

### Tier values (business only)
- **free** – Free Partner
- **professional** – Professional Partner (Pro)
- **elite** – Elite Partner  
- **premium** – Treated as **alias for elite** in many places (Layout, BusinessDashboard, BusinessProDashboard, EnhancedGallery, offerService). Not in planDefaults business plans; legacy.

### Firestore
- **Collection**: `users/{userId}`
- **Fields**:
  - `subscriptionTier`: string, one of `free` | `professional` | `elite` (and legacy `premium`).
  - Optional: `businessInfo.subscriptionTier` or `businessInfo.tier` (read in Layout, BusinessDashboard, BrandKit – inconsistent).
  - `subscriptionStatus`, `currentPlan`, `stripeCustomerId`, `weeklyPrivateQuota` (used for user plans; business uses subscriptionTier for feature gates).
- **Collection**: `subscriptionPlans` (admin/Plans, InvitationContext, PricingPage). Documents have `type: 'business'`, `tier`, `stripePriceId`, `name`, `price`, etc. Seeded from `planDefaults.js`.

### Stripe mappings (from planDefaults.js)
| Plan | type | tier | stripePriceId |
|------|------|------|----------------|
| p4 Professional Partner | business | professional | price_1T4DfJKpQn3RDJUC4ANefmpl |
| p5 Elite Partner | business | elite | price_1T4DlqKpQn3RDJUC6vrueW0n |
| p6 Free Partner | business | free | (none) |

### UI labels (hardcoded or keyed)
- PartnerProfile: `t('elite_partner')`, `t('professional_partner')`
- ProSubscription: "Elite Partner", "Professional Partner", "Free Partner", "Current Plan", "Upgrade to Elite →", "Start with Professional →"
- BusinessDashboard: "Elite Partner", "Professional", "Free Plan", "Upgrade Now", "Try Elite Partner FREE!"
- SubscriptionSettings: "Elite Partner", "Professional Partner", "Free Partner"

### Translations
- `en.json`: `elite_partner`: "Elite Partner", `professional_partner`: "Professional Partner"
- `ar.json`: `elite_partner`: "شريك نخبوي", `professional_partner`: "شريك احترافي"

### Admin
- UserManagement: BIZ_TIERS labels "🆓 Free", "⚡ Professional", "👑 Elite"
- Plans.jsx: tier input placeholder "free, pro, vip, professional, elite"; badge by `p.type === 'business'` → "Partner"

### Functions
- **index.js**  
  - `adminSetUserSubscriptionTier`: allowed business = `['free', 'professional', 'elite']`; writes `users/{targetUid}` with `subscriptionTier` (merge).
  - `consumeOfferCredit`: reads `subscriptionTier`; elite exempt.
- **webhook.js**  
  - `getTierForPlan(planId)`: returns `'elite'` if planId includes 'elite', `'professional'` if includes 'professional', etc.
  - Writes `subscriptionTier` and `weeklyPrivateQuota` on checkout/subscription update/cancel (same user doc for both user and business).

---

## 3. Legacy or conflicting business-plan names

| Name | Where | Issue |
|------|--------|------|
| **premium** | Layout, BusinessDashboard, BusinessProDashboard, EnhancedGallery, Settings, BrandKit, offerService, AdminDashboard count, demoDataGenerator | Used as **alias for elite** for business. planDefaults business plans use `elite` only. Creates ambiguity with **user** Premium (vip). |
| **basic** | subscriptionPlans.js, CreateBusinessAccount dropdown, getNextTier | In SUBSCRIPTION_PLANS and CreateBusinessAccount but **not** in planDefaults business plans. Confusing if shown for business. |
| **pro** | subscriptionPlans.js, user plans, AdminPanel dropdown, InvitationContext quotas | **User** plan. If set on a business user by mistake (e.g. AdminPanel), they get user quota logic, not professional. |
| **vip** | planDefaults p3 (user), InvitationContext MONTHLY_PRIVATE_QUOTAS, UserManagement USER_TIERS, webhook getTierForPlan | **User** tier (Premium). AdminPanel uses "vip" for Premium. Not a business tier. |
| **plan.id / planId** | ProSubscription uses `plan.id` (e.g. p4, p5) and `plan.tier` (professional, elite); webhook uses metadata planId (could be p4/p5 or tier string) | getTierForPlan(planId) is string-based (includes 'elite', 'professional'); so p4/p5 work. Slight risk if planId format changes. |
| **businessInfo.subscriptionTier** / **businessInfo.tier** | Layout, BusinessDashboard, BrandKit | Redundant with top-level `subscriptionTier`; inconsistent read path. |

---

## 4. Mixing between business plans and regular user plans

- **Same Firestore field**: `users.subscriptionTier` holds either user tier (free, pro, vip) or business tier (free, professional, elite). Distinction is by `role`/`accountType` (business vs user).
- **AdminPanel**: Only offers Free / Pro / Premium (vip). Used for "all" users; if applied to a business account, would **overwrite** with pro/vip – wrong for business.
- **AdminDashboard**: Counts "paid" as `['pro', 'vip', 'professional', 'elite']` – mixes user and business in one list.
- **SubscriptionSettings**: Correctly branches: business → ProSubscription (elite/professional/free); user → userPlans (free/pro/premium).
- **InvitationContext**: `MONTHLY_PRIVATE_QUOTAS` only has pro/premium/vip (user). Business accounts don’t use this for private invites.
- **webhook.js**: Single `getTierForPlan` and same user doc update for both user and business; relies on planId/metadata to derive tier. If planId is from business product, tier becomes elite/professional.
- **CreateBusinessAccount**: Dropdown is free/basic/pro/premium (user-style); should be business tiers (free, professional, elite) for new business signups.
- **Plans.jsx**: Single list of all plans; filters by `type === 'business'` for display. Good. Tier placeholder mixes user and business names.

---

## 5. Exact source of truth for business plans

- **Canonical tier set**: `free` | `professional` | `elite`. (Legacy: `premium` treated as elite in several files.)
- **Canonical field**: **`users/{userId}.subscriptionTier`** (top-level). Optional `businessInfo.subscriptionTier` / `businessInfo.tier` exist but are redundant and inconsistent.
- **Read path**: Everywhere that needs business tier should read **`user.subscriptionTier`** (or from AuthContext: `userProfile.subscriptionTier`). For partner profile: `partner.subscriptionTier`.
- **Write paths**:
  - **Admin**: `adminSetUserSubscriptionTier` (functions) with `isBusinessUser: true` and tier in `['free','professional','elite']` → writes `users/{targetUid}.subscriptionTier` (merge).
  - **Stripe**: webhook `handleCheckoutComplete` / `handleSubscriptionUpdate` / `handleSubscriptionCanceled` → writes `users/{userId}.subscriptionTier` (and other subscription fields).
  - **Direct (avoid in production)**: `updateDoc(doc(db,'users',uid), { subscriptionTier })` in AdminPanel/UserManagement; AdminPanel currently only sets user tiers.
- **Plan catalog (pricing, features, Stripe)**:
  - **Code**: `src/config/planDefaults.js` → `BASE_SUBSCRIPTION_PLANS` with `type === 'business'` (p4, p5, p6).
  - **Firestore**: `subscriptionPlans` collection, docs with `type: 'business'`; synced from planDefaults by admin Plans "Sync".
  - **Stripe**: Price IDs in planDefaults (p4, p5); checkout uses `plan.stripePriceId` and metadata `planId` (e.g. p4/p5).

---

## 6. Proposed cleanup plan (business plans only) – no execution until approved

### Goal
- Single, clear set of business tiers: **free**, **professional**, **elite**.
- No use of **premium** for business (reserve premium for user plan).
- Single read path for business tier: **`subscriptionTier`** at user root.
- Admin and UI consistently use only business tiers for business accounts.
- No behavior change for **user** plans (free, pro, vip/premium).

### Phase A – Source of truth and reads (non-breaking)

1. **Treat `subscriptionTier` as single source**
   - No new fields. Keep writing only to `users.{uid}.subscriptionTier` for business.
   - Optionally: one-time migration or Cloud Function to copy `businessInfo.subscriptionTier` / `businessInfo.tier` into top-level `subscriptionTier` if present and role is business, then stop reading from businessInfo for tier (see Phase C).

2. **Normalize “premium” → “elite” for business**
   - In every **read** that treats business tier:
     - Where it currently does `tier === 'elite' || tier === 'premium'`, replace with: treat `premium` as elite only when the account is business (e.g. `(tier === 'elite' || (tier === 'premium' && isBusiness))`), or
     - Prefer: when loading business user, if `subscriptionTier === 'premium'` set display tier to `'elite'` (or write back `'elite'` in a one-time migration so all business docs use `elite` only).
   - Files to touch: Layout, BusinessDashboard, BusinessProDashboard, EnhancedGallery, Settings (business branch), BrandKit, offerService (if it uses premium for business). After migration, simplify to only `tier === 'elite'`.

3. **Stop reading tier from businessInfo**
   - Layout, BusinessDashboard, BusinessProDashboard: use only `userProfile?.subscriptionTier` (and ensure AuthContext loads it from `users` doc root). Remove fallback to `userProfile?.businessInfo?.subscriptionTier` or `businessInfo.tier`.
   - BrandKit: use only `userProfile?.subscriptionTier` (and optionally role) for isPaid; remove `businessInfo?.subscription?.tier` and `businessInfo?.tier`.

### Phase B – Admin and UI (business only)

4. **AdminPanel**
   - Detect business users (e.g. `user.role === 'business'` or `user.accountType === 'business'`).
   - If business: show subscription dropdown with only **Free**, **Professional**, **Elite** (values `free`, `professional`, `elite`), and call `adminSetUserSubscriptionTier(userId, newTier, true)`.
   - If user: keep current dropdown (Free, Pro, Premium/vip). No change to TIER_QUOTAS for user.

5. **CreateBusinessAccount**
   - Replace plan dropdown options with business-only: **Free**, **Professional**, **Elite** (values `free`, `professional`, `elite`). Remove basic/pro/premium for this form. Save to user doc as `subscriptionTier` when creating the business account.

6. **Admin Plans.jsx**
   - No change to Firestore or Stripe. Optional: in tier placeholder/help text, state that for business plans only `free`, `professional`, `elite` are valid.

7. **UserManagement**
   - Already correct (BIZ_TIERS: free, professional, elite). Ensure dropdown for business users uses BIZ_TIERS and `isBusinessUser: true` in callable.

### Phase C – Data and backend (optional, after A/B)

8. **One-time migration (optional)**
   - Query all `users` where `role === 'business'` (or accountType business).
   - If `subscriptionTier === 'premium'`, set `subscriptionTier: 'elite'`.
   - If `businessInfo.subscriptionTier` or `businessInfo.tier` is set and top-level `subscriptionTier` is missing, set `subscriptionTier` from that value (and normalize premium → elite). Then remove tier from businessInfo if you no longer want it there.

9. **Functions**
   - **index.js**: `adminSetUserSubscriptionTier` – already allows only `['free','professional','elite']` for business. No change.
   - **webhook.js**: For business planIds (e.g. p4, p5), `getTierForPlan` already returns 'professional'/'elite'. Ensure Stripe metadata for business checkouts always sends a planId that maps to professional or elite; no change if already correct.

10. **subscriptionPlans.js**
    - Do **not** rename or remove existing keys (free, basic, pro, premium) to avoid breaking any user or legacy code that still uses getPlanById('pro') etc.
    - Optional later: add a separate export e.g. `BUSINESS_TIERS = ['free','professional','elite']` and use it only where business logic is needed; keep SUBSCRIPTION_PLANS as-is for user/generic use.

### Phase D – Translations and copy

11. **Translations**
    - Ensure `elite_partner` and `professional_partner` exist in ar/en (already do). Use them everywhere partner badge is shown.
    - Any hardcoded "Premium" for business in Settings/ProSubscription/BusinessDashboard: change to "Elite" (or use translation key).

12. **Documentation**
    - In code or in a short doc: “Business tiers are exactly: free, professional, elite. Stored in users.subscriptionTier. User tiers (free, pro, vip) are separate.”

### Out of scope (no change in this cleanup)

- User plans (free, pro, vip/premium), MONTHLY_PRIVATE_QUOTAS, InvitationContext user logic.
- Stripe Price IDs or product names in Stripe Dashboard.
- Firestore rules (no change needed for subscriptionTier).
- Adding new business tiers or new plans in planDefaults.

---

## 7. Summary table – business only

| Item | Current | After cleanup (proposed) |
|------|---------|---------------------------|
| Canonical tier values | free, professional, elite, (premium as alias) | free, professional, elite |
| Stored in | users.subscriptionTier (+ optional businessInfo) | users.subscriptionTier only |
| Read path | Mixed (root + businessInfo) | user.subscriptionTier only |
| AdminPanel for business | Uses user dropdown (wrong) | Separate dropdown: Free / Professional / Elite |
| CreateBusinessAccount | free/basic/pro/premium | free / professional / elite |
| “premium” for business | Treated as elite in code | Normalized to elite in DB; code only checks elite |
| Source of truth for catalog | planDefaults.js (p4,p5,p6) + Firestore subscriptionPlans | Unchanged |

---

**No code or data has been modified. This is a proposal only; implement after your approval.**

---

## 8. Phase A + B implementation report (executed)

Phase A and Phase B have been implemented. No data migration was run. Regular user plans and Stripe setup were not changed.

### File-by-file change report

| File | Changes |
|------|--------|
| **`src/components/Layout.jsx`** | Business tier now read only from `userProfile?.subscriptionTier`. Removed fallback to `userProfile?.businessInfo?.subscriptionTier`. Legacy: `premium` is normalized to `elite` for `canAccessDesktopDashboard`. |
| **`src/pages/BusinessDashboard.jsx`** | Desktop redirect uses only `userProfile?.subscriptionTier`. Removed `userProfile?.businessInfo?.subscriptionTier`. Legacy: `premium` treated as elite for redirect. |
| **`src/pages/BusinessProDashboard.jsx`** | Guard/redirect uses only `userProfile?.subscriptionTier`. Removed `userProfile?.businessInfo?.subscriptionTier`. Legacy: `premium` normalized to elite for access. |
| **`src/pages/business-pro/BrandKit.jsx`** | `isPaid` now derived only from `userProfile?.subscriptionTier` (professional, elite, or legacy premium). Removed reads from `businessInfo?.subscription?.tier` and `businessInfo?.tier`. |
| **`src/pages/AdminPanel.jsx`** | Imported `adminSecurityService`. For **business** users (`accountType === 'business'`): dedicated subscription dropdown with **Free**, **Professional**, **Elite** only; on change calls `adminSecurityService.setUserSubscriptionTier(userId, newTier, true)`. For **non-business** users: unchanged dropdown (Free, Pro, Premium) and existing `updateSubscription` (updateDoc + TIER_QUOTAS). Business dropdown value normalizes legacy `premium` to display as `elite`. |
| **`src/pages/AdminPanel.css`** | Added `.plan-hint` style for the "Business plan" label next to the business dropdown. |
| **`src/components/CreateBusinessAccount.jsx`** | Replaced "Initial Plan" dropdown with business-only: **Free**, **Professional**, **Elite** (values `free`, `professional`, `elite`). Removed basic/pro/premium. Form field renamed to `subscriptionTier`; on create, `subscriptionTier` is written on the user doc root; `businessInfo` no longer stores `subscriptionPlan`. |

### Remaining business-plan legacy references (not changed in Phase A/B)

| Location | Reference | Notes |
|----------|-----------|--------|
| **`src/pages/AdminDashboard.jsx`** | `business.businessInfo?.subscriptionPlan` (lines 117, 163, 503) | Plan label/limits; should eventually use `business.subscriptionTier`. |
| **`src/components/BusinessLimitsEditor.jsx`** | `business.businessInfo?.subscriptionPlan` (line 10) | Default plan for limits; should use `business.subscriptionTier`. |
| **`src/hooks/useEffectiveLimits.js`** | `businessData.subscriptionPlan`; businessData from `businessInfo` | Should read tier from user doc root `subscriptionTier`. |
| **`src/config/subscriptionPlans.js`** | `getPlanById` with free/basic/pro/premium | Business needs professional/elite keys or a separate map. |
| **`src/pages/Settings.jsx`** | `userProfile?.subscriptionTier === 'premium'` for business (line 383) | Display only; legacy until migration. |
| **`src/services/offerService.js`** | `data.subscriptionTier === 'premium'` | Legacy alias for elite; left as-is. |
| **`BUSINESS_PLANS_AUDIT_AND_CLEANUP_PROPOSAL.md`** | Old read paths in text | Documentation; can be updated. |

No other active `src` files read `businessInfo.subscriptionTier` or `businessInfo.tier` for business plan logic. Backups were not modified.
