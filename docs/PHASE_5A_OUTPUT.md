# Phase 5A Output — PrivateInvitationPreview + Migration Status Doc

**Date:** 2025-03-08  
**Context:** Global migration status audit complete. One small adoption + short docs update.  
**Scope:** PrivateInvitationPreview (buttons only); docs/MIGRATION_STATUS.md; THEMING_MIGRATION_GUIDE.md pointer.

---

## A) Files Modified

| File | Changes |
|------|---------|
| `src/pages/PrivateInvitationPreview.jsx` | Edit button: `action-btn-outline` → `ui-btn ui-btn--secondary`, style reduced to flex 1, height 50px, borderRadius 15; Send button: `action-btn-primary` → `ui-btn ui-btn--primary`, style reduced to flex 2, height 50px, borderRadius 15 |
| `docs/MIGRATION_STATUS.md` | Created: rollout summary, profile-* alias note, next-wave candidates, Phase 5A note |
| `docs/THEMING_MIGRATION_GUIDE.md` | Added "Last updated" Phase 5A and one-line pointer to MIGRATION_STATUS.md |
| `docs/PHASE_5A_OUTPUT.md` | Phase 5A output (this file) |

---

## B) Primitives Adopted in PrivateInvitationPreview

| Element | Primitive | Notes |
|---------|-----------|--------|
| Edit button | `ui-btn ui-btn--secondary` | style: flex 1, height 50px, borderRadius 15; onClick, disabled unchanged |
| Send invitations button | `ui-btn ui-btn--primary` | style: flex 2, height 50px, borderRadius 15; onClick, disabled unchanged |

---

## C) Duplicated Button Styling Reduced

| Location | Old Pattern | New Pattern |
|----------|-------------|-------------|
| Edit | action-btn-outline + full inline (border, background, color, fontWeight, display, alignItems, justifyContent, gap) | ui-btn ui-btn--secondary + layout overrides |
| Send | action-btn-primary + full inline (border, background, color, fontWeight, boxShadow, etc.) | ui-btn ui-btn--primary + layout overrides |

---

## D) Intentionally Preserved Preview-Specific Styling

| Element | Preservation |
|---------|--------------|
| **preview-action-bar** | Container margin, maxWidth, padding, gap, borderRadius, border, backdropFilter, boxShadow |
| **Button layout** | flex 1 / flex 2, height 50px, borderRadius 15 |
| **Sticky header, back button** | Unchanged (inline styles) |
| **premium-banner-warning, private-mock-details, hero, reveal-text** | Unchanged |
| **handlePublish, navigate(create-private)** | Logic unchanged |

---

## E) Documentation Updated

- **docs/MIGRATION_STATUS.md** created with: current rollout summary; note that profile-* aliases must remain until Profile.jsx and BusinessProfile.jsx are migrated; next-wave candidates (Profile.jsx, BusinessProfile.jsx, CreateInvitation/CreatePrivateInvitation); note that Phase 5A chose a low-risk page first.
- **docs/THEMING_MIGRATION_GUIDE.md** updated: "Last updated" set to Phase 5A; one-line pointer to MIGRATION_STATUS.md for current rollout status.

---

## F) Recommendation for Next Step After Phase 5A

**Next step:** Plan **Phase 5B** (or next wave) for one of:

- **Profile.jsx** — Migrate profile-* and .btn/.form-group/.input-field to ui-* in stages; enables future alias removal.
- **BusinessProfile.jsx** — Same approach.
- **InvitationTimeline** — Very small: btn btn-primary/secondary → ui-btn (quick win).

Prefer Profile or BusinessProfile for strategic impact; InvitationTimeline for another low-risk win before a larger profile migration.

---

## G) Build Result

`npm run build` completed successfully (exit code 0). No new linter errors in `PrivateInvitationPreview.jsx`.
