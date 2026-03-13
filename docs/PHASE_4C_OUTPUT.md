# Phase 4C Output — Safe Global UI Primitive Adoption for ProAccountSettings

**Date:** 2025-03-08  
**Context:** Phase 4A (InvitationPreview) and Phase 4B (InvitationDetails) complete.  
**Scope:** ProAccountSettings only.

---

## A) Files Modified

| File | Changes |
|------|---------|
| `src/pages/business-pro/ProAccountSettings.jsx` | Buttons: `bpro-btn-primary` → `ui-btn ui-btn--primary`; Labels: added `ui-form-label`; Inputs: added `ui-form-field`; Email input, password inputs (via pwInput), Email section submit, Password section submit, Notifications section save button |
| `docs/PHASE_4C_OUTPUT.md` | Phase 4C output (this file) |

---

## B) Primitives Adopted in ProAccountSettings

| Element | Primitive | Notes |
|---------|-----------|-------|
| Email section label | `ui-form-label` | With `labelStyle` override for Pro-specific color/weight |
| Email input | `ui-form-field` | Full adoption; marginTop: 6 preserved |
| Email submit button | `ui-btn ui-btn--primary` | Full adoption |
| Password labels (Current, New, Confirm) | `ui-form-label` | With `labelStyle` override |
| Password inputs (via pwInput) | `ui-form-field` | paddingRight: 40 for eye toggle |
| Password submit button | `ui-btn ui-btn--primary` | Full adoption |
| Notifications section save button | `ui-btn ui-btn--primary` | Full adoption (section not currently rendered but code updated) |

---

## C) Duplicated Visual Patterns Reduced

| Location | Old Pattern | New Pattern |
|----------|-------------|-------------|
| Email label | labelStyle only | ui-form-label + labelStyle override |
| Email input | inputStyle | ui-form-field |
| Email submit | bpro-btn-primary | ui-btn ui-btn--primary |
| Password labels | labelStyle only | ui-form-label + labelStyle override |
| Password inputs | inputStyle via pwInput | ui-form-field + paddingRight: 40 |
| Password submit | bpro-btn-primary | ui-btn ui-btn--primary |
| Notifications save | bpro-btn-primary | ui-btn ui-btn--primary |

---

## D) Intentionally Preserved Pro-Specific Styling

| Element | Preservation |
|---------|--------------|
| **User info banner** | Purple-tinted background (rgba(167,139,250,0.06)), avatar, display name; not ui-banner (different purpose/identity) |
| **AccordionItem** | Custom expand/collapse, iconColor, sublabel; no direct ui-* mapping; layout kept |
| **Toggle** | Custom purple switch; unchanged |
| **labelStyle** | Pro-specific fontSize 0.8rem, color rgba(255,255,255,0.5), fontWeight 600; applied as override with ui-form-label |
| **errStyle, okStyle** | Error/success message styling; unchanged |
| **inputStyle** | Kept as local object; used where Pro-specific look needed; inputs now use ui-form-field |
| **pwInput eye button** | Position absolute, icon toggle; preserved |
| **DeleteSection button** | Danger styling inline; not ui-btn--danger-outline (different layout, currently not rendered) |
| **Pro layout** | Section order, spacing, marginTop 14, width 100% on buttons |

---

## E) Risky Areas Left Untouched

| Area | Reason |
|------|--------|
| Account settings logic | updateEmail, updatePassword, reauthenticateWithCredential | No logic changes |
| Pro/subscription logic | Not in scope; unchanged |
| Payment-related flows | Not present in ProAccountSettings; unchanged |
| Validation logic | Email/password validation preserved |
| Permissions, conditional rendering | Unchanged |
| AccordionItem structure | Custom component; no safe ui-card wrapper without layout risk |
| Toggle component | Custom switch; no ui-* primitive for toggles |
| User info banner | Pro branding; not ui-banner--warning (different intent) |
| Delete button | Danger styling; defer ui-btn--danger-outline until DeleteSection is rendered |
| AppearanceSection, NotificationsSection, DeleteSection | Sections not rendered; updated where applicable (Notifications save btn) |

---

## F) Recommendation: Next Low-Risk Target

**Suggested next target:** `ProDashboard` or `ProSettings` (Pro settings shell / nav)

- ProAccountSettings is now aligned with Settings, Notifications, InvitationPreview, InvitationDetails for shared patterns
- Pro layout (accordion, user banner) is preserved; only buttons, labels, and inputs adopted
- Next logical step: apply ui-primitives to other Pro dashboard pages (e.g. ProDashboard nav buttons, ProSettings layout) if they contain obvious mappings

**Alternative:** `CreateInvitation` or `CreatePrivateInvitation` — already use ui-btn; could standardize remaining form fields to ui-form-field / ui-form-label where applicable.

---

## G) Build Result

```
✓ 362 modules transformed.
✓ built in 17.58s
exit_code: 0
```

Build completed successfully.
