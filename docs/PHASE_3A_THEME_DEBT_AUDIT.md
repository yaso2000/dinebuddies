# Phase 3A — Theme Debt Audit and Deprecation Planning

**Date:** 2025-03-08  
**Context:** Phases 1A–1D-B, 2A–2C complete. Global primitives adopted in profiles, settings, CreatePrivateInvitation, CreateInvitation, Notifications, MyCommunity.  
**Scope:** Audit only. No broad migrations. Minimal code changes.

---

## A) Final Theme Debt Summary

### 1. Alias Layer (profile-* ↔ ui-*)

All alias pairs live in `ui-primitives.css` via dual selectors. No separate `profile-*` rules.

| profile-* Alias | ui-* Primitive | Usage Count | Notes |
|-----------------|----------------|-------------|-------|
| profile-card | ui-card | ~5 | Profile.jsx, BusinessProfile.jsx |
| profile-card-lg | ui-card--lg | 1 | BusinessProfile.jsx |
| profile-tabs, profile-tab, profile-tab--active | ui-tabs, ui-tab, ui-tab--active | ~10 | Profile.jsx, BusinessProfile.jsx |
| profile-tab--compact, profile-card-header | ui-tab--compact, ui-card-header | ~6 | BusinessProfile.jsx |
| profile-action-btn, --primary, --secondary, --ghost | ui-btn variants | ~6 | Profile.jsx |
| profile-form-surface, profile-form-field, profile-form-label | ui-form-* | ~8 | BusinessProfile.jsx |
| profile-clear-btn | ui-btn--danger-outline | 2 | Profile.jsx, BusinessProfile.jsx |
| profile-banner-warning, __title, __link | ui-banner--warning, etc. | 1 | BusinessProfile.jsx |
| profile-guest-prompt, __title, __desc, __btn | ui-prompt, etc. | ~8 | Profile.jsx, GuestLoginPrompt.jsx |

**Profile-* non-aliases (profile-shared.css):** profile-shell, profile-content, profile-header, profile-stats, profile-actions, profile-section, profile-invitation-item, profile-theme-toggle, profile-subscription-card, profile-add-story-btn, etc. These have their own layout/semantic definitions and are intentionally separate.

**UserProfile.jsx:** Uses `profile-tab-btn` (scoped inline `<style>`), not ui-tab. Separate pattern; not part of alias layer.

### 2. Global Legacy Patterns (index.css)

| Pattern | Definition | Usage Scope | Notes |
|---------|------------|-------------|-------|
| .btn, .btn-primary, .btn-block | index.css | CreateInvitation (partial), multiple pages | Some replaced by ui-btn; many still use btn |
| .form-group | index.css | CreateInvitation, CreatePrivateInvitation, many forms | Structure; no ui-* equivalent |
| .input-field | index.css | Forms across app | Visual overlap with ui-form-field |
| .elegant-label | index.css | CreateInvitation, CreatePrivateInvitation, Profile, etc. | Icon + label; differs from ui-form-label |

### 3. Page-Local Duplication

| Location | Pattern | Primitive Overlap | Status |
|----------|---------|-------------------|--------|
| Notifications.css | back-btn, settings-btn, mark-all-btn | ui-btn | Partially adopted; some overrides kept |
| MyCommunity.css | my-community-stat-card | ui-card | Adopted; duplicated styles removed |
| SettingsPages.css | settings-card, submit-btn | ui-card, ui-btn | Adopted; overrides for padding |
| CreateInvitation | create-form, form-group, elegant-label | ui-form-* | Not migrated; complex structure |
| InvitationDetails, InvitationPreview | Custom card/button styles | ui-card, ui-btn | Not yet adopted |

### 4. Hardcoded Styles

High-concentration pages (inline rgba/#hex):

- BusinessProfile.jsx: 165+ (theme injection, BrandKit)
- CreateInvitation.jsx: 22
- CreatePrivateInvitation.jsx: 25
- BrandKit.jsx: 226
- ProAccountSettings.jsx: 35 (inline inputStyle, labelStyle, etc.)
- ProOffers, ProDesignStudio, BusinessSignup: 20–40 each

Most are BrandKit/business-specific or intentional accent overrides.

### 5. Admin & BusinessPro

- **admin.css:** Own system (--admin-*, admin-card, admin-btn, etc.). Not aligned with ui-primitives.
- **BusinessProDashboard.css:** bpro-card, bpro-stat-card, dashboard layout. Intentionally separate.

---

## B) Remaining Alias / Deprecation Map

### Aliases Safe to Retire Later (after migration to ui-*)

| profile-* | Condition | Risk |
|-----------|-----------|------|
| profile-card, profile-card-lg | All usages migrated to ui-card, ui-card--lg | Low |
| profile-tabs, profile-tab, profile-tab--active | Migrate Profile, BusinessProfile to ui-tab | Medium |
| profile-action-btn variants | Migrate remaining to ui-btn | Low |
| profile-form-surface, profile-form-field, profile-form-label | Migrate BusinessProfile add-service form | Low |
| profile-clear-btn | Migrate to ui-btn--danger-outline | Low |
| profile-banner-warning, __title, __link | Keep; only BusinessProfile | Low |
| profile-guest-prompt, __title, __desc, __btn | Migrate Profile, GuestLoginPrompt to ui-prompt | Low |

### Aliases to Keep as Compatibility Layer (for now)

- All profile-* primitives: keep dual selectors until Profile/BusinessProfile are migrated to ui-*.
- No removal until: (1) grep shows zero profile-card, profile-tab, etc. in JSX; (2) visual regression tests pass.

### Conditions Before Removing Aliases

1. Profile.jsx and BusinessProfile.jsx use ui-card, ui-tab, ui-btn, ui-prompt instead of profile-*.
2. GuestLoginPrompt.jsx uses ui-prompt.
3. Full visual check of profile pages.
4. Build passes.

### ui-primitives.css Organization

- Ready for long-term ownership.
- Dual selectors are acceptable for backward compatibility.
- Consider a future step: move profile-* aliases to a separate `ui-primitives-aliases.css` import for clear deprecation path.

---

## C) Remaining Hardcoded / Repeated Styling Ranked by Priority

| Priority | Target | Pattern | Effort | Risk |
|----------|--------|---------|--------|------|
| 1 | ProAccountSettings | inputStyle, labelStyle, AccordionItem inline | Medium | Low |
| 2 | InvitationPreview | Card/button surfaces | Low | Low |
| 3 | InvitationDetails | Action buttons, surfaces | Medium | Medium |
| 4 | CreateInvitation | elegant-label, form-group (partial mapping) | High | Medium |
| 5 | ProMessages | Form inputs, buttons | Medium | Low |
| 6 | CommunityChatRoom, Chat | Message input, composer | Medium | Medium |
| 7 | InvitationManagement | admin-* system | N/A | Keep separate |
| 8 | BusinessProfile | BrandKit, theme injection | N/A | Keep separate |

---

## D) Primitive Maturity Assessment

| Primitive | Status | Notes |
|-----------|--------|-------|
| **Cards** (ui-card, ui-card--lg) | Stable, needs wider adoption | Used in Settings, CreatePrivateInvitation, Notifications, MyCommunity, CreateInvitation. Profile/BusinessProfile still use profile-card. |
| **Buttons** (ui-btn, ui-btn--primary, --secondary, --ghost, --danger-outline) | Stable, needs wider adoption | Well adopted. Remaining: InvitationDetails, InvitationPreview, ProAccountSettings. |
| **Forms** (ui-form-surface, ui-form-field, ui-form-label) | Stable but narrow adoption | CreateInvitation (Privacy), Notifications (search), BusinessProfile (add service). elegant-label/form-group still dominant in CreateInvitation. |
| **Tabs** (ui-tab, ui-tab--compact, ui-tabs) | Stable | Profile (profile-tab alias), BusinessProfile, Notifications. UserProfile uses profile-tab-btn (scoped). |
| **Banners** (ui-banner--warning) | Stable but low adoption | Only BusinessProfile draft banner. Most banners are page-specific (restriction, venue info). |
| **Prompts** (ui-prompt, ui-prompt--standalone, __title, __desc, __btn) | Stable | Settings, CreatePrivateInvitation, Profile, GuestLoginPrompt, MyCommunity (__desc). |

**Summary:** Cards and buttons are most mature. Forms need wider use. Banners are niche. No primitives need refinement before broader rollout.

---

## E) Recommended Next Migration Targets

| Rank | Target | Rationale | Primitives | Risk |
|------|--------|-----------|------------|------|
| 1 | **InvitationPreview** | Small surface area, card/button-heavy, low traffic | ui-card, ui-btn | Low |
| 2 | **InvitationDetails** | High traffic; incremental adoption on surfaces/buttons | ui-card, ui-btn | Medium |
| 3 | **ProAccountSettings** | Inline-heavy; inputs and buttons can use primitives | ui-form-field, ui-btn | Low |
| 4 | **ProMessages** | Form-like; ui-form-field, ui-btn | Low |
| 5 | **InvitationManagement** | Admin system; leave admin-* as-is | None | N/A |
| 6 | **CreateInvitation form fields** | Complex; elegant-label with icons | ui-form-field where 1:1 | Medium |
| 7 | **CommunityChatRoom / Chat** | Specialized message UI | ui-form-field for input | Medium |

---

## F) Recommended Next Phase with Reasoning

**Recommendation: Phase 3B — Targeted Cleanup of Safe Residual Debt**

**Reasoning:**

1. **Phase 2C just expanded adoption.** A short stabilization and cleanup phase reduces risk before more adoption.
2. **Low-risk cleanup exists:** Trim remaining duplication in Notifications.css (back-btn, settings-btn, delete-all-btn), document btn vs ui-btn usage, and align SettingsPages.css overrides.
3. **Profile/BusinessProfile migration is large.** Defer to Phase 4A or later; keep profile-* aliases in place.
4. **InvitationPreview/InvitationDetails are good 4A targets** after 3B, when debt is documented and cleaned.

**Alternative:** Phase 4A (next-wave adoption) is viable if business priority is feature parity over debt reduction. In that case, InvitationPreview and ProAccountSettings are the safest first targets.

**Hybrid micro-phase:** One-day cleanup: (1) add inline comments in ui-primitives.css marking profile-* as compatibility aliases; (2) document btn/form-group vs ui-* in a short RULE or doc. No JSX changes.

---

## G) Risk / Confidence Assessment

| Area | Risk | Confidence |
|------|------|------------|
| Removing profile-* aliases now | High | Do not remove |
| Migrating Profile/BusinessProfile to ui-* | Medium | Plan in 4A+ |
| Phase 3B cleanup (CSS only) | Low | High |
| InvitationPreview adoption | Low | High |
| InvitationDetails adoption | Medium | Medium |
| CreateInvitation form fields | Medium | Medium |
| Admin/BusinessPro surfaces | High | Do not touch |
| BrandKit / theme injection | High | Do not touch |

**Overall:** Phase 3A audit is complete. Debt is documented. Profile-* aliases remain safe. Phase 3B (targeted CSS cleanup) is the recommended next step.
