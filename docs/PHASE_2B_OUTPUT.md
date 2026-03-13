# Phase 2B Output — Safe Adoption of Global UI Primitives

**Date:** 2025-03-11  
**Context:** Phase 2A complete. Global primitives in ui-primitives.css.  
**Scope:** Profile-adjacent pages: Settings, Settings sub-pages, CreatePrivateInvitation.

---

## A) Files Modified

| File | Changes |
|------|---------|
| `src/pages/Settings.jsx` | Guest prompt → ui-prompt, ui-prompt__title, ui-prompt__desc; buttons → ui-btn ui-btn--primary, ui-btn--ghost; settings-section-card → added ui-card |
| `src/pages/Settings.css` | settings-section-card: removed background, border; added padding: 0 (ui-card provides base) |
| `src/pages/SettingsPages.css` | settings-card: removed background, box-shadow (ui-card provides); submit-btn: removed background, color, box-shadow (ui-btn--primary provides); form-group input:focus → var(--shadow-focus-ring) |
| `src/pages/PasswordSettings.jsx` | settings-card → added ui-card; submit-btn → added ui-btn ui-btn--primary |
| `src/pages/PrivacySettings.jsx` | settings-card → added ui-card; submit-btn → added ui-btn ui-btn--primary |
| `src/pages/CreatePrivateInvitation.jsx` | Insufficient-credits block → ui-card ui-card--lg, ui-prompt__title, ui-prompt__desc; buttons → ui-btn ui-btn--primary, ui-btn--ghost; form submit → ui-btn ui-btn--primary |
| `docs/PHASE_2B_OUTPUT.md` | Phase 2B output documentation (this file) |

---

## B) Pages/Components Adopted in This Phase

| Page/Component | Adoptions |
|----------------|-----------|
| **Settings.jsx** | Guest prompt (ui-prompt), section cards (ui-card), primary/ghost buttons |
| **PasswordSettings.jsx** | Card (ui-card), submit button (ui-btn ui-btn--primary) |
| **PrivacySettings.jsx** | Card (ui-card), submit button (ui-btn ui-btn--primary) |
| **CreatePrivateInvitation.jsx** | Insufficient-credits prompt (ui-card, ui-prompt elements), upgrade/back buttons, form submit button |

---

## C) Primitives Adopted Where

| Primitive | Adopted In |
|-----------|------------|
| `ui-card` | Settings (section cards), PasswordSettings, PrivacySettings, CreatePrivateInvitation (insufficient-credits) |
| `ui-card--lg` | CreatePrivateInvitation (insufficient-credits) |
| `ui-prompt` | Settings (guest block) |
| `ui-prompt--standalone` | Settings (guest block) |
| `ui-prompt__title` | Settings, CreatePrivateInvitation |
| `ui-prompt__desc` | Settings, CreatePrivateInvitation |
| `ui-btn` | Settings, CreatePrivateInvitation |
| `ui-btn--primary` | Settings, PasswordSettings, PrivacySettings, CreatePrivateInvitation |
| `ui-btn--ghost` | Settings, CreatePrivateInvitation |
| `--shadow-focus-ring` | SettingsPages.css (form input focus) |

---

## D) Duplicated Style Patterns Reduced

| Location | Old Pattern | New Pattern |
|----------|-------------|-------------|
| Settings section cards | background, border in .settings-section-card | ui-card provides; local keeps border-radius, overflow, padding:0 |
| settings-card | background, box-shadow | ui-card provides |
| submit-btn | background gradient, color, box-shadow | ui-btn--primary provides |
| form-group input:focus | box-shadow rgba | var(--shadow-focus-ring) |
| Settings guest buttons | inline styles | ui-btn ui-btn--primary, ui-btn--ghost |
| CreatePrivateInvitation insufficient-credits | inline card/button styles | ui-card, ui-prompt elements, ui-btn variants |

---

## E) Intentionally Preserved Page-Specific Differences

| Item | Preservation |
|------|--------------|
| **Settings guest card** | Gradient background and padding overridden for distinct guest CTA |
| **settings-section-card** | padding: 0 to keep edge-to-edge rows; border-radius: 16px |
| **settings-card** | padding: 2rem; border-radius: 16px (overrides ui-card) |
| **CreatePrivateInvitation elegant-form** | Kept; structure differs from ui-form-surface |
| **bpro-card, bpro-stat-card** | Business Pro dashboard layout and accent colors preserved |
| **admin-card, admin-btn** | Admin styling left as-is |
| **Invitation flow** | Logic, filters, permissions unchanged |

---

## F) Risky Areas Left Untouched

| Area | Reason |
|------|--------|
| Admin pages (InvitationManagement, UserManagement, etc.) | Uses admin theme; different visual system |
| BusinessProDashboard bpro-* components | Strong dashboard identity |
| CreateInvitation.jsx | Large, complex; separate adoption pass |
| InvitationDetails, InvitationPreview | High-traffic; avoid regressions |
| Chat, CommunityChatRoom | Specialized layouts and components |

---

## G) Recommended Next Adoption Wave

| Priority | Target | Suggested Primitives |
|----------|--------|----------------------|
| 1 | CreateInvitation.jsx | ui-form-surface, ui-form-field, ui-form-label; ui-btn variants |
| 2 | Notifications.jsx | ui-card for sections; ui-btn for actions |
| 3 | MyCommunity.jsx | ui-card for stat cards (if structurally similar) |
| 4 | ProAccountSettings, ProMessages | ui-btn--primary where appropriate |
| 5 | InvitationManagement | ui-card, ui-banner--warning (if empty/info states exist) |

---

## H) Build Result

```
✓ 362 modules transformed.
✓ built in 8.58s
exit_code: 0
```

Build completed successfully.
