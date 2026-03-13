# Phase 3B Output — Targeted Cleanup of Safe Residual Theme Debt

**Date:** 2025-03-08  
**Context:** Phase 3A audit complete. Low-risk cleanup and stabilization pass.  
**Scope:** Documentation, comments, safe CSS normalization. No broad migrations.

---

## A) Files Modified

| File | Changes |
|------|---------|
| `src/styles/ui-primitives.css` | Expanded header: role, profile-* alias explanation, when to use, deprecation notes |
| `src/styles/profile-shared.css` | Added deprecation comments for alias pointers (profile-card, profile-action-btn, profile-tabs, profile-guest-prompt, profile-form-*) |
| `src/index.css` | Added legacy class documentation blocks for .btn, .form-group/.input-field, .elegant-label (Phase 3B) |
| `src/pages/Notifications.css` | Normalized var(--border) → var(--border-color), var(--background) → var(--bg-main), back-btn:hover var(--border) → var(--hover-overlay) |
| `docs/THEMING_MIGRATION_GUIDE.md` | **New.** Lightweight guide: primitive layer, alias strategy, ui-btn vs .btn, ui-form-* vs legacy, safe adoption pattern, exclusions |
| `docs/PHASE_3B_OUTPUT.md` | Phase 3B output (this file) |

---

## B) Duplicated CSS Reduced in This Phase

| Location | Change |
|----------|--------|
| Notifications.css | Replaced undefined/inconsistent tokens: `var(--border)` → `var(--border-color)`, `var(--background)` → `var(--bg-main)` for notification-icon, `var(--border)` → `var(--hover-overlay)` for back-btn:hover |

No further CSS removal in this phase; duplication was already trimmed in Phase 2C. This phase focused on token normalization where vars were undefined or inconsistent.

---

## C) Documentation / Comments Added or Improved

| Location | Addition |
|----------|----------|
| ui-primitives.css | Header: ROLE, PROFILE-* ALIASES (do not remove), WHEN TO USE, reference to migration guide |
| profile-shared.css | Deprecation notes on profile-card, profile-action-btn, profile-tabs, profile-guest-prompt, profile-form-* alias pointers |
| index.css | Three blocks: (1) .btn/.btn-primary overlap with ui-btn, (2) .form-group/.input-field overlap with ui-form-*, (3) .elegant-label vs ui-form-label |
| docs/THEMING_MIGRATION_GUIDE.md | Full guide: primitives table, alias strategy, ui-btn vs .btn, ui-form-* vs legacy, safe adoption pattern, exclusions, next targets |

---

## D) Legacy Class Assessment (.btn, .form-group, .input-field, .elegant-label)

| Class | Current Role | Overlap with ui-primitives | Recommendation |
|-------|--------------|----------------------------|----------------|
| **.btn** | Base layout (flex, padding, border-radius). Modifiers: .btn-primary, .btn-block, .btn-sm, .btn-outline | .btn-primary overlaps with ui-btn--primary | Keep; new code should prefer ui-btn. Gradual migration where safe. |
| **.form-group** | Layout wrapper (flex column, gap). No ui-* equivalent | None | Keep; structure helper. No direct primitive. |
| **.input-field** | Input styling (width, padding, border, focus) | Overlaps with ui-form-field | Keep where elegant-label + icon used; use ui-form-field for simple inputs. Gradual migration. |
| **.elegant-label** | Icon + label row (CreateInvitation, CreatePrivateInvitation) | ui-form-label is label-only, no icon | Stay page-specific. Do not broadly replace. |

---

## E) Anything Intentionally Left Untouched

| Area | Reason |
|------|--------|
| Admin system (admin.css, --admin-*) | Separate theme; excluded from cleanup |
| BrandKit, bpro-* | Business-specific; excluded |
| Chat surfaces | Specialized layout; not touched |
| Profile-* aliases | Not removed; deprecation documented only |
| Invitation flow, validation | No logic changes |
| CreateInvitation form structure | elegant-label, form-group, input-field preserved |
| SettingsPages.css .form-group | Duplicate definition with index.css; left as-is (scoped to settings) |
| index.css .input-field:focus box-shadow | Differs from --shadow-focus-ring; not unified (would change visuals) |

---

## F) Recommended First Implementation Target After Cleanup

**InvitationPreview**

- Small surface area, card/button-heavy
- Low risk
- Good candidate for ui-card, ui-btn adoption in Phase 4A

---

## G) Build Result

```
✓ 362 modules transformed.
✓ built in 8.70s
exit_code: 0
```

Build completed successfully.
