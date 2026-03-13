# DineBuddies Theming Migration Guide

**Last updated:** Phase 5A (2025-03-08)

This guide explains the global UI primitive layer, alias strategy, and safe adoption patterns. Use it when adding new UI or migrating legacy styles.

**Current rollout status:** See `docs/MIGRATION_STATUS.md` for rollout summary, alias policy, and next-wave candidates.

---

## 1. Current Primitive Layer

**Location:** `src/styles/ui-primitives.css`

The primitive layer provides reusable classes for common surfaces and controls:

| Primitive | Use Case |
|-----------|----------|
| `ui-card`, `ui-card--lg` | Card surfaces, section wrappers |
| `ui-form-surface` | Form containers with subtle primary border |
| `ui-form-field` | Text inputs, selects (full-width) |
| `ui-form-label` | Simple block labels |
| `ui-btn` + `ui-btn--primary`, `--secondary`, `--ghost`, `--danger-outline` | Action buttons |
| `ui-tab`, `ui-tab--compact`, `ui-tab--active` | Tab buttons, filter pills |
| `ui-tabs`, `ui-tabs--horizontal` | Tab containers |
| `ui-banner--warning` | Warning/info banners |
| `ui-prompt`, `ui-prompt--standalone`, `ui-prompt__title`, `ui-prompt__desc`, `ui-prompt__btn` | Empty states, guest prompts |

---

## 2. Profile-* Aliases (Do Not Remove)

For backward compatibility, `profile-*` classes are aliased to `ui-*` in the same file:

- `profile-card` → `ui-card`
- `profile-tabs`, `profile-tab`, etc. → `ui-tabs`, `ui-tab`, etc.
- `profile-action-btn`, `profile-clear-btn` → `ui-btn` variants
- `profile-form-surface`, `profile-form-field`, `profile-form-label` → `ui-form-*`
- `profile-guest-prompt`, `profile-banner-warning` → `ui-prompt`, `ui-banner--warning`

**Why they exist:** Profile.jsx, BusinessProfile.jsx, and GuestLoginPrompt.jsx still use `profile-*`. Removing aliases would break those pages until they are migrated to `ui-*`.

**Deprecation:** Remove aliases only after migrating profile pages to `ui-*` (Phase 4A or later).

---

## 3. When to Use ui-btn vs Legacy .btn

| Situation | Use |
|-----------|-----|
| **New code** | `ui-btn ui-btn--primary` (or other variant) |
| **Legacy pages** (CreateInvitation, etc.) | `.btn .btn-primary` still works |
| **Settings / Notifications / MyCommunity** | `ui-btn` (already adopted) |

Legacy `.btn` and `.btn-primary` live in `index.css`. Prefer `ui-btn` for new work; gradual migration is fine.

---

## 4. When to Use ui-form-* vs Legacy Form Helpers

| Situation | Use |
|-----------|-----|
| **New forms** | `ui-form-surface` + `ui-form-field` + `ui-form-label` |
| **CreateInvitation** (elegant-label + icon) | Keep `elegant-label`, `form-group`, `input-field` |
| **Simple inputs** (e.g. search) | `ui-form-field` |
| **Form wrapper** | `ui-form-surface` for card-like form blocks |

- `.form-group`: Layout wrapper (flex, gap). No direct ui-* equivalent; keep for structure.
- `.input-field`: Overlaps with `ui-form-field`; use `ui-form-field` where structure allows.
- `.elegant-label`: Icon + label row; stay page-specific for CreateInvitation.

---

## 5. Safe Adoption Pattern

1. **Identify** a surface/button/input that matches a primitive.
2. **Add** the primitive class alongside existing classes (e.g. `className="my-card ui-card"`).
3. **Remove** redundant declarations from local CSS (background, border, padding if fully covered).
4. **Keep** page-specific overrides (e.g. padding: 0, border-radius) where layout requires.
5. **Test** visually; ensure no regression.

---

## 6. What NOT to Touch Yet

| Area | Reason |
|------|--------|
| **Admin system** | Own theme (admin.css, `--admin-*`) |
| **BrandKit / business themes** | Theme injection, complex overrides |
| **bpro-* (BusinessProDashboard)** | Strong dashboard identity |
| **Chat surfaces** | Specialized layout and components |
| **Profile-* aliases** | Remove only after migration |
| **Invitation creation logic** | No changes to flow or validation |
| **Public/private invitation separation** | Structural; do not alter |

---

## 7. Recommended Next Targets (Post-Phase 3B)

From Phase 3A audit:

1. **InvitationPreview** — Low risk; card/button surfaces
2. **InvitationDetails** — Medium risk; action buttons, surfaces
3. **ProAccountSettings** — Low risk; form inputs, buttons

---

## 8. Related Docs

- `docs/PHASE_3A_THEME_DEBT_AUDIT.md` — Full theme debt assessment
- `docs/PHASE_2C_OUTPUT.md` — Last adoption wave (CreateInvitation, Notifications, MyCommunity)
- `docs/PHASE_2B_OUTPUT.md` — Settings, CreatePrivateInvitation adoptions
