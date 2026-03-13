# Phase 5C Output — BusinessProfile.jsx Targeted UI Primitive Adoption

**Date:** 2025-03-08  
**Context:** Phase 5B (Profile.jsx) complete. High-impact, controlled migration in BusinessProfile.jsx only. No alias removal.  
**Scope:** BusinessProfile.jsx; BrandKit (th/tc) and business-specific behavior preserved.

---

## A) Files Modified

| File | Changes |
|------|---------|
| `src/pages/BusinessProfile.jsx` | **Buttons:** Loading "Back to Home" → ui-btn ui-btn--secondary; Discard (services form) & Del (service cards) → ui-btn--danger-outline; Draft banner close (✕) → ui-btn--ghost; Review modal Cancel → ui-btn--ghost; Share modal Close → ui-btn--ghost. **Cards/tabs:** About card → ui-card ui-card--lg (style with th() preserved); Tabs container → ui-tabs ui-tabs--horizontal; Tab buttons → ui-tab ui-tab--compact, ui-tab--active (style with th() preserved). **Form/banner:** Services add form container → ui-form-surface; icon search input, service name, description → ui-form-field; labels → ui-form-label; Draft banner → ui-banner--warning, ui-banner--warning__title, ui-banner--warning__link. |
| `docs/PHASE_5C_OUTPUT.md` | This output document. |

**Local CSS:** No changes. profile-* aliases remain in ui-primitives.css.

---

## B) Primitives Adopted in BusinessProfile.jsx

| Element | Primitive | Notes |
|---------|-----------|--------|
| Loading "Back to Home" | `ui-btn ui-btn--secondary` | style: marginTop |
| Services form Discard | `ui-btn ui-btn--danger-outline` | padding overrides |
| Service card "Del" | `ui-btn ui-btn--danger-outline` | padding, fontSize |
| Draft banner close (✕) | `ui-btn ui-btn--ghost` | padding, color, fontSize |
| Review modal Cancel | `ui-btn ui-btn--ghost` | flex, padding |
| Share modal Close | `ui-btn ui-btn--ghost` | width, marginTop, padding |
| About card | `ui-card ui-card--lg` | th(tc) for bg, border, boxShadow preserved |
| Tabs container | `ui-tabs ui-tabs--horizontal` | th(tc) for background, border, boxShadow preserved |
| Tab buttons | `ui-tab ui-tab--compact`, `ui-tab--active` | th(tc) for active background, shadow, color preserved |
| Services add form container | `ui-form-surface` | th(tc?.cardBg) preserved |
| Icon search input | `ui-form-field` | padding override |
| Service name / description | `ui-form-field` | — |
| Service Name / Description labels | `ui-form-label` | — |
| Draft banner | `ui-banner--warning` | — |
| Draft banner title | `ui-banner--warning__title` | — |
| Draft banner "Upgrade Plan" link | `ui-banner--warning__link` | — |

---

## C) Duplicated Visual Patterns Reduced

- **Buttons:** Replaced inline "Back to Home", profile-clear-btn (Discard/Del), draft close, review Cancel, share Close with ui-btn variants; removed redundant border/background/color where covered by primitives.
- **Cards/tabs:** Replaced profile-card profile-card-lg, profile-tabs profile-tabs--horizontal, profile-tab profile-tab--compact/profile-tab--active with ui-card ui-card--lg, ui-tabs ui-tabs--horizontal, ui-tab ui-tab--compact/ui-tab--active; BrandKit style overrides kept.
- **Form/banner:** Replaced profile-form-surface, profile-form-field, profile-form-label and profile-banner-warning / __title / __link with ui-form-surface, ui-form-field, ui-form-label and ui-banner--warning / __title / __link.

---

## D) Intentionally Preserved BusinessProfile-Specific Styling

| Element | Preservation |
|---------|--------------|
| **BrandKit (th, tc)** | All th(tc?.…) overrides for cardBg, border, accent, btnShadow, cardShadow, joinBtnBg, inviteBtnBg, etc. unchanged |
| **EditActionBtn** | Custom circular edit button with tc?.accent; not switched to ui-btn |
| **Join Community / Create Invitation** | Full inline styles with th(tc?.joinBtnBg, inviteBtnBg, btnBorderRadius, etc.); deferred |
| **Category (business type) button** | Custom overlay pill; deferred |
| **Cover/logo labels, Favourite/Share hero buttons** | Custom overlay styles; deferred |
| **Card preview overlay (Share/Download)** | Custom modal buttons; deferred |
| **+ Add / Save (services form)** | Custom disabled/state colors; deferred |
| **"➕ Add Your First Service"** | th(tc?.footerBg) gradient; deferred |
| **Review modal Submit** | th(tc?.footerBg, accentText); deferred |
| **Google Maps, Instagram/Twitter/Facebook** | Brand gradients and th(tc); deferred |
| **profile-shell, profile-header, profile-stats, profile-content, profile-section-content** | Layout/semantic classes unchanged |
| **profile-section-header** | Section headers unchanged |
| **Child components** | DeliveryLinksSection, BusinessHours, EnhancedGallery, EnhancedReviews, MenuShowcase, etc. unchanged |

---

## E) What Remains Deferred in BusinessProfile.jsx

| Area | Reason |
|------|--------|
| **Join Community / Create Invitation buttons** | Heavy BrandKit (th(tc?.joinBtnBg, inviteBtnBg, btnBorderRadius, btnShadow, etc.)); preserve as-is. |
| **EditActionBtn** | BrandKit-driven circle button (tc?.accent); custom. |
| **Category (business type) pill** | Overlay pill with hover; custom. |
| **Hero Favourite / Share** | Overlay icon buttons; custom. |
| **Card preview overlay (Share Image / Download)** | Modal-specific; could adopt ui-btn in a follow-up. |
| **Services: + Add, Save (N), ➕ Add Your First Service** | Custom state/disabled and th(tc?.footerBg); defer. |
| **Review modal Submit** | th(tc?.footerBg, accentText); BrandKit. |
| **Open in Google Maps, Instagram, Twitter, Facebook** | Brand gradients and th(tc); defer. |
| **Lightbox / Share modal** | Close and nav buttons; low priority, could adopt ui-btn--ghost in follow-up. |
| **profile-stats, profile-section-header, profile-content** | Layout/semantic; no 1:1 ui-* swap. |

**profile-* aliases:** Left intact. No alias removal in this phase.

---

## F) Alias-Removal Planning After Phase 5C

- **Profile.jsx** (Phase 5B) and **BusinessProfile.jsx** (Phase 5C) now use ui-* for the migrated elements; many profile-* usages remain (layout classes, deferred buttons, EditActionBtn, etc.).
- **Alias removal is not yet safe.** Remaining profile-* usage in both files includes: profile-shell, profile-header, profile-stats, profile-stat-item, profile-stat-value, profile-stat-label, profile-stats-divider, profile-content, profile-section-content, profile-section-header. These have no ui-* equivalents in the primitive set (they are structural/semantic in profile-shared.css).
- **Next step for alias removal:** (1) Either add ui-* equivalents for shell/content/section structure and migrate those, or (2) keep profile-* for layout and remove only the aliases that are now unused (e.g. profile-card, profile-tabs, profile-tab, profile-form-surface, profile-form-field, profile-form-label, profile-clear-btn, profile-banner-warning and __title/__link). A targeted cleanup could remove just the aliases whose class names no longer appear in Profile.jsx or BusinessProfile.jsx, then run a full grep to confirm no other consumers.
- **Recommendation:** Plan a small **alias-audit phase** after 5C: list all profile-* aliases in ui-primitives.css and grep the codebase for each; remove only aliases with zero remaining references. Leave structural profile-* (shell, content, stats, etc.) in profile-shared.css and do not remove their aliases until those pages no longer use them or they are given ui-* names.

---

## G) Build Result

`npm run build` completed successfully (exit code 0). No new linter errors in BusinessProfile.jsx.
