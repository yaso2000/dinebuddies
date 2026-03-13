# Phase 6C Output — Legacy Button Migration Wave

**Date:** 2025-03-08  
**Context:** Phase 6A and 6B complete. First broad migration wave from docs/THEME_UNIFICATION_FINAL_PLAN.md.  
**Scope:** CreateInvitation, InvitationTimeline, FriendsFeed, CompleteProfile — button patterns only. No form/card/tab migration; no business logic changes.

---

## A) Files Modified

| File | Changes |
|------|---------|
| **src/components/Invitation/InvitationTimeline.jsx** | Replaced `btn btn-primary` with `ui-btn ui-btn--primary` for "I'm on my way"; `btn btn-secondary` with `ui-btn ui-btn--secondary` for "I've arrived" (with style override for success green via `var(--color-success)`); added `ui-btn ui-btn--primary` to "Complete meeting" button (templateStyles override preserved). Added `type="button"` where missing. |
| **src/pages/FriendsFeed.jsx** | Replaced `btn btn-primary` with `ui-btn ui-btn--primary` for "Browse partners" empty-state CTA; preserved borderRadius and padding in style. Added `type="button"`. |
| **src/pages/CompleteProfile.jsx** | Replaced `btn btn-primary btn-block` with `ui-btn ui-btn--primary` for "Save & Continue" submit; preserved width: '100%', height, fontSize, gradient, boxShadow, disabled/opacity. |
| **src/pages/CreateInvitation.jsx** | No code changes. Main submit already uses `ui-btn ui-btn--primary`; gender/age/privacy selector buttons are custom chip/toggle UI with inline styles only (no legacy .btn). |
| **docs/PHASE_6C_OUTPUT.md** | This output document. |

---

## B) Button Primitives Adopted by Page

| Page / Component | Old pattern | Primitive adopted | Preserved overrides |
|------------------|------------|-------------------|---------------------|
| **InvitationTimeline** | `btn btn-primary` ("I'm on my way") | `ui-btn ui-btn--primary` | flex: 1, padding, borderRadius, fontSize, opacity, height: auto, templateStyles?.button (border) |
| **InvitationTimeline** | `btn btn-secondary` ("I've arrived") | `ui-btn ui-btn--secondary` | flex: 1, padding, borderRadius, fontSize, background: var(--color-success), color: white, opacity, height: auto |
| **InvitationTimeline** | (no class) "Complete meeting" | `ui-btn ui-btn--primary` | templateStyles?.button (border, background, color), flex, padding, borderRadius, fontSize, fontWeight |
| **FriendsFeed** | `btn btn-primary` ("Browse partners") | `ui-btn ui-btn--primary` | borderRadius: 15px, padding: 12px 25px |
| **CompleteProfile** | `btn btn-primary btn-block` ("Save & Continue") | `ui-btn ui-btn--primary` | width: 100%, height: 56px, fontSize, fontWeight, borderRadius, gradient background, boxShadow, cursor, opacity |
| **CreateInvitation** | (none) | — | Main submit already `ui-btn ui-btn--primary`; no legacy .btn on page. |

---

## C) Duplicated Legacy Button Styling Reduced

- **InvitationTimeline:** Three action buttons no longer depend on legacy `.btn`, `.btn-primary`, or `.btn-secondary`; they use `ui-btn` variants. Template-driven overrides (templateStyles?.button) and success-color override for "I've arrived" remain inline so invitation flow and visual hierarchy are unchanged.
- **FriendsFeed:** One CTA no longer uses `.btn` / `.btn-primary`.
- **CompleteProfile:** Submit button no longer uses `.btn` / `.btn-primary` / `.btn-block`; full-width and gradient preserved via style.
- **CreateInvitation:** No legacy button classes were present to remove (submit already migrated; other controls are custom chips).

---

## D) Intentionally Preserved Page-Specific Button Styling

| Location | Preserved |
|----------|-----------|
| **InvitationTimeline** | templateStyles?.button spread for "I'm on my way" and "Complete meeting" (border, background, color) so invitation templates keep their look. |
| **InvitationTimeline** | "I've arrived" green: `background: var(--color-success)`, `color: white` (semantic success state; ui-btn--secondary base overridden). |
| **CompleteProfile** | "Save & Continue" gradient and shadow: `background: linear-gradient(135deg, var(--primary), var(--accent))`, `boxShadow: '0 4px 15px ...'` to keep current CTA emphasis. |
| **FriendsFeed** | Border radius and padding for empty-state CTA. |
| **CreateInvitation** | Gender, age, and privacy selector buttons remain custom (no ui-btn); full inline styles for selected/unselected chip appearance. |

---

## E) Deferred Button Cases

| Case | Reason |
|------|--------|
| **CreateInvitation gender/age/privacy chips** | Custom multi-select chips with selected state, icons, and distinct layout; not a direct mapping to ui-btn. Defer to a later form/control migration or leave as custom. |
| **CreateInvitationSelector close button** | Uses `.close-btn` (local class); not in the four target pages. Can be migrated in a later wave (e.g. modals/shared components). |
| **InvitationTimeline "Complete meeting" template overrides** | Kept as-is; templateStyles drive brand-specific look. No new ui-btn variant added for "gold/success" in this phase. |
| **Other pages (Home, admin, InvitationDetails_BACKUP, etc.)** | Out of scope for Phase 6C target list. |

---

## F) Recommendation for Next Migration Wave After 6C

1. **Settings and layout pages**  
   Replace remaining `.submit-btn`-only or `.btn`/`.btn-primary` usages with `ui-btn ui-btn--primary` (and variants) on EmailSettings, PaymentSettings, SubscriptionSettings, PrivacySettings, PasswordSettings where only class changes are needed; rely on central .submit-btn in index.css for layout where still used during transition.

2. **CreateInvitationSelector and shared modals**  
   Migrate `.close-btn` and similar shared button classes to `ui-btn ui-btn--ghost` (or appropriate variant) so one less local button system remains.

3. **InvitationDetails (active path)**  
   If InvitationDetails (non-backup) still uses `.btn` / `.btn-primary` / `.btn-outline`, include it in the next button wave with the same pattern (ui-btn + style overrides where needed).

4. **Form-group and input-field**  
   Per plan: migrate form wrappers and inputs to `ui-form-field` / `ui-form-label` on CreateInvitation, CreatePrivateInvitation, and other high-traffic forms in a dedicated form wave.

5. **Admin and bpro-***  
   Leave for later; admin and BusinessProDashboard have their own button systems and are out of scope for this wave.

---

## G) Build Result

`npm run build` completed successfully (exit code 0). No form logic, validation, routing, or invitation flow behavior was changed; only button class names and token usage (e.g. `var(--color-success)`) were updated.
