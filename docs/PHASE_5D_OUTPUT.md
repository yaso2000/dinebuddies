# Phase 5D Output — Profile/UI Primitives Alias Audit and Safe Alias Reduction

**Date:** 2025-03-08  
**Context:** Phase 5B (Profile.jsx) and 5C (BusinessProfile.jsx) complete. Audit only; no new page migrations.  
**Scope:** ui-primitives.css profile-* aliases; profile-shared.css structural classes; repo-wide reference check.

---

## A) Aliases Audited

All profile-* aliases defined in `src/styles/ui-primitives.css` were audited. Repo-wide grep (src, excluding comments) for each alias as **className** or **selector** usage:

| Alias | In ui-primitives.css | Referenced in repo (JSX/CSS class) | Verdict |
|-------|----------------------|------------------------------------|---------|
| profile-card | ✓ | No (Profile/BusinessProfile use ui-card) | **Removed** |
| profile-card-lg | ✓ | No | **Removed** |
| profile-form-surface | ✓ | No | **Removed** |
| profile-form-field | ✓ | No | **Removed** |
| profile-form-label | ✓ | No | **Removed** |
| profile-action-btn | ✓ | No | **Removed** |
| profile-action-btn--primary | ✓ | No | **Removed** |
| profile-action-btn--secondary | ✓ | No | **Removed** |
| profile-action-btn--ghost | ✓ | No | **Removed** |
| profile-clear-btn | ✓ | No | **Removed** |
| profile-tabs | ✓ | No | **Removed** |
| profile-tabs--horizontal | ✓ | No | **Removed** |
| profile-tab | ✓ | No (UserProfile uses profile-tab-**btn**, different) | **Removed** |
| profile-tab--active | ✓ | No | **Removed** |
| profile-tab--compact | ✓ | No | **Removed** |
| profile-card-header | ✓ | No | **Removed** |
| profile-banner-warning | ✓ | No | **Removed** |
| profile-banner-warning__title | ✓ | No | **Removed** |
| profile-banner-warning__link | ✓ | No | **Removed** |
| profile-guest-prompt | ✓ | **Yes** (GuestLoginPrompt.jsx) | **Retained** |
| profile-guest-prompt--standalone | ✓ | **Yes** (GuestLoginPrompt.jsx) | **Retained** |
| profile-guest-prompt__title | ✓ | **Yes** (GuestLoginPrompt.jsx) | **Retained** |
| profile-guest-prompt__desc | ✓ | **Yes** (GuestLoginPrompt.jsx) | **Retained** |
| profile-guest-prompt__btn | ✓ | **Yes** (GuestLoginPrompt.jsx) | **Retained** |

Note: `ExportAssets.jsx` uses the string `"profile-card"` only in a **filename** (`${safeName}-profile-card.png`), not as a CSS class — no impact on alias removal.

---

## B) Aliases Safely Removed (Phase 5D)

The following aliases were **removed** from `src/styles/ui-primitives.css` (zero remaining references, zero risk):

- profile-card  
- profile-card-lg  
- profile-form-surface  
- profile-form-field (and :focus)  
- profile-form-label  
- profile-action-btn  
- profile-action-btn--primary, --secondary, --ghost  
- profile-clear-btn  
- profile-tabs  
- profile-tabs--horizontal  
- profile-tab  
- profile-tab--active  
- profile-tab--compact  
- profile-card-header  
- profile-banner-warning  
- profile-banner-warning__title  
- profile-banner-warning__link  

The compound selector `.ui-tab--compact.profile-tab--active` / `.profile-tab--compact.profile-tab--active` was simplified to `.ui-tab--compact.ui-tab--active` only.

---

## C) Aliases Retained and Why

| Alias | Reason |
|-------|--------|
| profile-guest-prompt | GuestLoginPrompt.jsx uses it (container) |
| profile-guest-prompt--standalone | GuestLoginPrompt.jsx uses it |
| profile-guest-prompt__title | GuestLoginPrompt.jsx uses it |
| profile-guest-prompt__desc | GuestLoginPrompt.jsx uses it |
| profile-guest-prompt__btn (and :hover) | GuestLoginPrompt.jsx uses it |

**Recommendation for later:** Migrate GuestLoginPrompt.jsx to ui-prompt, ui-prompt__title, ui-prompt__desc, and ui-btn ui-btn--primary (or ui-prompt__btn). Then these aliases can be removed.

---

## D) Structural Profile Classes Intentionally Preserved

These classes are **not** aliases in ui-primitives.css; they are defined and used only in **profile-shared.css** and in Profile.jsx / BusinessProfile.jsx. They were **not** removed and are **out of scope** for alias reduction in ui-primitives:

- **Layout/shell:** profile-shell, profile-content, profile-header, profile-identity  
- **Stats:** profile-stats, profile-stat-item, profile-stat-value, profile-stat-label, profile-stats-divider  
- **Sections:** profile-section-content, profile-section-header, profile-section-body, profile-section-body--pad  
- **Actions/layout:** profile-actions-row  
- **Metadata:** profile-meta-row, profile-meta-row--sm  
- **Subscription (Profile.jsx):** profile-subscription-card, profile-subscription-quota-card, profile-subscription-trial-banner, profile-subscription-upgrade-btn  
- **Profile-specific UI:** profile-theme-toggle, profile-add-story-btn  
- **Invitation list:** profile-invitation-item, profile-invitation-item__thumb, profile-invitation-item__content, profile-invitation-item__title-row, profile-invitation-item__title, profile-invitation-item__badge, profile-invitation-item__badge--private/--public, profile-invitation-item__date, profile-invitation-item--lg  
- **Other:** profile-cover (ProfileEnhancements.jsx)  

These remain **profile-scoped** in profile-shared.css. No structural class was removed; alias reduction applied only to the duplicate definitions in ui-primitives.css that had zero references.

---

## E) Docs Updated

- **src/styles/ui-primitives.css** — Header comment updated: only profile-guest-prompt* aliases remain; Phase 5D alias reduction noted.
- **docs/PHASE_5D_OUTPUT.md** — This file (audit results, removed/retained, structural classes, recommendation).
- **docs/MIGRATION_STATUS.md** — (See below) Note current alias status and that alias reduction has begun only where safe; which classes remain profile-scoped.

---

## F) Recommendation for Next Phase

1. **Optional quick win:** Migrate **GuestLoginPrompt.jsx** to ui-prompt / ui-prompt__title / ui-prompt__desc and ui-btn ui-btn--primary (or keep ui-prompt__btn). Then remove the remaining profile-guest-prompt* aliases from ui-primitives.css.
2. **No broad alias removal** for structural profile-* (shell, content, stats, etc.) until Profile/BusinessProfile (or other consumers) are refactored to use different layout patterns or new ui-* structural primitives.
3. **Next phase** can be either: (a) GuestLoginPrompt migration + final profile-guest-prompt alias removal, or (b) continued UI primitive adoption on other pages (e.g. CreateInvitation, UserProfile), or (c) leave as-is and document.

---

## G) Build Result

`npm run build` completed successfully (exit code 0). No regressions after alias removal; GuestLoginPrompt still receives styles via the retained profile-guest-prompt* aliases.
