# Phase 2A Output — Global UI Primitives Extraction

**Date:** 2025-03-11  
**Context:** Profile theming closure audit complete. Profiles stable. Extract reusable primitives.  
**Scope:** Create global UI primitives layer; backward-compatible aliases for profile classes.

---

## A) Files Created

| File | Purpose |
|------|---------|
| `src/styles/ui-primitives.css` | Global reusable UI primitives (card, form, button, tabs, banner, prompt) |
| `docs/PHASE_2A_OUTPUT.md` | Phase 2A output documentation (this file) |

---

## B) Files Modified

| File | Changes |
|------|---------|
| `src/main.jsx` | Added import `./styles/ui-primitives.css` (after profile-shared.css) |
| `src/styles/profile-shared.css` | Removed extracted rule blocks; added comments pointing to ui-primitives.css |

---

## C) Global Primitives Created

| Primitive | Description |
|-----------|-------------|
| `.ui-card`, `.ui-card--lg` | Content card surface |
| `.ui-form-surface` | Form container with border and padding |
| `.ui-form-field` | Input/textarea field with focus ring |
| `.ui-form-label` | Form label |
| `.ui-btn` | Base button |
| `.ui-btn--primary` | Primary gradient button |
| `.ui-btn--secondary` | Secondary outlined button |
| `.ui-btn--ghost` | Ghost transparent button |
| `.ui-btn--danger-outline` | Danger outline button |
| `.ui-tabs`, `.ui-tabs--horizontal` | Tab bar container |
| `.ui-tab`, `.ui-tab--active`, `.ui-tab--compact` | Tab button and variants |
| `.ui-card-header` | Card header with border |
| `.ui-banner--warning`, `__title`, `__link` | Warning/info banner |
| `.ui-prompt`, `.ui-prompt--standalone`, `__title`, `__desc`, `__btn` | Prompt/empty-state block |

---

## D) Mapping from Profile Classes to Global Primitives

| Profile Class | New Primitive | Relationship |
|---------------|---------------|--------------|
| `profile-card` | `ui-card` | Aliased (dual selector) |
| `profile-card-lg` | `ui-card--lg` | Aliased |
| `profile-form-surface` | `ui-form-surface` | Aliased |
| `profile-form-field` | `ui-form-field` | Aliased |
| `profile-form-label` | `ui-form-label` | Aliased |
| `profile-action-btn` | `ui-btn` | Aliased |
| `profile-action-btn--primary` | `ui-btn--primary` | Aliased |
| `profile-action-btn--secondary` | `ui-btn--secondary` | Aliased |
| `profile-action-btn--ghost` | `ui-btn--ghost` | Aliased |
| `profile-clear-btn` | `ui-btn--danger-outline` | Aliased |
| `profile-tabs` | `ui-tabs` | Aliased |
| `profile-tabs--horizontal` | `ui-tabs--horizontal` | Aliased |
| `profile-tab` | `ui-tab` | Aliased |
| `profile-tab--active` | `ui-tab--active` | Aliased |
| `profile-tab--compact` | `ui-tab--compact` | Aliased |
| `profile-card-header` | `ui-card-header` | Aliased |
| `profile-banner-warning` | `ui-banner--warning` | Aliased |
| `profile-banner-warning__title` | `ui-banner--warning__title` | Aliased |
| `profile-banner-warning__link` | `ui-banner--warning__link` | Aliased |
| `profile-guest-prompt` | `ui-prompt` | Aliased |
| `profile-guest-prompt--standalone` | `ui-prompt--standalone` | Aliased |
| `profile-guest-prompt__title` | `ui-prompt__title` | Aliased |
| `profile-guest-prompt__desc` | `ui-prompt__desc` | Aliased |
| `profile-guest-prompt__btn` | `ui-prompt__btn` | Aliased |

---

## E) Backward Compatibility Strategy

**Dual-selector aliasing:** Each rule in `ui-primitives.css` uses a combined selector, e.g.:

```css
.ui-card,
.profile-card {
  /* shared styles */
}
```

- Profile pages keep using `profile-*` classes; no HTML changes.
- New code can use `ui-*` classes directly.
- Both names resolve to the same styles.
- `profile-shared.css` no longer defines these rules; they live only in `ui-primitives.css`.

---

## F) Profile Pages Consumption

Profiles continue to use `profile-*` classes. They receive the same styles via the aliases in `ui-primitives.css`, so they consume the global layer indirectly.

**Direct adoption:** Profile pages do not use `ui-*` in JSX; they use `profile-*` as before. The `profile-*` selectors are defined in `ui-primitives.css`.

---

## G) Non-Profile Adoptions

None in Phase 2A. Extraction and profile-backed validation were the focus; adoption on other pages is left for Phase 2B.

---

## H) Remaining Work for Phase 2B

| Task | Description |
|------|-------------|
| Migrate settings/account pages | Use `ui-card`, `ui-form-*`, `ui-btn--*` where applicable |
| Migrate invitations pages | Use `ui-card`, `ui-tabs`, `ui-banner--warning` where applicable |
| Migrate business dashboard/profile-adjacent | Use `ui-card`, `ui-btn` variants, `ui-tabs` |
| Replace legacy `.btn`, `.btn-primary` | Map to `ui-btn--primary` where it makes sense |
| Document migration patterns | Guidance for adopting `ui-*` on new pages |

---

## I) Build Result

```
✓ 362 modules transformed.
✓ built in 7.62s
exit_code: 0
```

Build completed successfully.
