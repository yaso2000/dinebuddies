# Phase 6A Output — Token and Light-Theme Baseline Stabilization

**Date:** 2025-03-08  
**Context:** Final theme unification plan (docs/THEME_UNIFICATION_FINAL_PLAN.md) complete. First architecture-level implementation phase.  
**Scope:** index.css global tokens; ui-primitives.css token consumption; legacy .input-field:focus tokenization. No broad page migrations.

---

## A) Files Modified

| File | Changes |
|------|---------|
| **src/index.css** | Normalized global tokens: --shadow-focus-ring now uses primary (color-mix with var(--primary)) in :root; [data-theme='light'] extended with --shadow-focus-ring, --shadow-card-hover, stronger --border-color (0.18); [data-theme='dark'] given explicit --shadow-focus-ring and --shadow-card-hover. Legacy .input-field:focus updated to use var(--shadow-focus-ring) and var(--bg-input) instead of hardcoded rgba. Added global token-structure comment. |
| **src/styles/ui-primitives.css** | .ui-form-field background changed from var(--bg-main) to var(--bg-input) for consistent input surface. Added TOKEN OWNERSHIP (Phase 6A) note: all visual values use global tokens only. |
| **docs/PHASE_6A_OUTPUT.md** | This output document. |

---

## B) Tokens Added/Changed

| Token | Change |
|-------|--------|
| **--shadow-focus-ring** (:root) | Was `0 0 0 3px rgba(139, 92, 246, 0.15)` (purple). Now `0 0 0 3px color-mix(in srgb, var(--primary) 25%, transparent)` so focus ring is brand-consistent and theme-aware. |
| **--shadow-focus-ring** ([data-theme='light']) | **Added.** `0 0 0 3px color-mix(in srgb, var(--primary) 30%, transparent)` so focus states are visible on light backgrounds. |
| **--shadow-focus-ring** ([data-theme='dark']) | **Added.** `0 0 0 3px color-mix(in srgb, var(--primary) 25%, transparent)` so dark theme has explicit focus ring. |
| **--shadow-card-hover** ([data-theme='light']) | **Added.** `0 8px 20px rgba(0, 0, 0, 0.08)` for light-appropriate card hover. |
| **--shadow-card-hover** ([data-theme='dark']) | **Added.** `0 8px 20px rgba(0, 0, 0, 0.2)` so dark theme has explicit card hover shadow. |
| **--shadow-card-hover** (:root) | Slightly strengthened to `0 8px 20px rgba(0, 0, 0, 0.15)` for default (dark) consistency. |
| **--border-color** ([data-theme='light']) | Changed from `rgba(15, 23, 42, 0.12)` to `rgba(15, 23, 42, 0.18)` so borders remain visible on light surfaces and cards/forms don’t blend. |
| **Legacy .input-field:focus** | No new token. Now uses **var(--shadow-focus-ring)** and **var(--bg-input)** instead of hardcoded `0 0 0 2px rgba(139, 92, 246, 0.2)` and `rgba(30, 41, 59, 0.8)`. |

---

## C) Light-Theme Baseline Issues Fixed (at Token Level)

| Issue | Fix |
|-------|-----|
| **Focus ring not theme-aware** | --shadow-focus-ring was only in :root (purple); light theme inherited it. Now [data-theme='light'] and [data-theme='dark'] both set --shadow-focus-ring using var(--primary), so focus states are visible and consistent in both themes. |
| **Legacy input focus dark in light theme** | .input-field:focus had hardcoded dark background and purple ring. Replaced with var(--bg-input) and var(--shadow-focus-ring), so light theme shows correct input focus appearance. |
| **Weak borders on light** | Light --border-color was 0.12 opacity. Increased to 0.18 so card/form borders don’t disappear on white/light gray. |
| **Missing light shadow tokens** | --shadow-card-hover and --shadow-focus-ring were undefined in [data-theme='light']. Both are now set so components using these tokens behave correctly in light mode. |
| **ui-form-field surface** | .ui-form-field used --bg-main; in dark that matches body. Switched to --bg-input so form fields use the designated input surface in both themes (consistent with legacy .input-field and rest of app). |

---

## D) Remaining Weak Token Areas (to Revisit Later)

| Area | Note |
|------|------|
| **--text-muted in light** | Currently #64748b; sufficient for WCAG on white. If contrast issues appear, consider a slightly darker value (e.g. #475569) in a later pass. |
| **Semantic colors in light** | --color-danger, --color-success, --color-info, --stat-* are not overridden in [data-theme='light']. They are already high-contrast; override only if specific components need tuning. |
| **--hover-overlay in light** | Currently rgba(0,0,0,0.04). If hover states feel too subtle on light cards, consider 0.06 or a dedicated --hover-overlay-card in a later pass. |
| **Legacy .btn / .btn-primary** | Still use index.css rules; no [data-theme='light'] overrides for .btn yet. Planned for later migration phase; token baseline does not remove legacy classes. |
| **profile-shared / bpro / admin** | Not in scope for 6A; may still use local values. Ownership alignment is documented; migration in later phases. |

---

## E) Confirmation of Ownership Alignment

| Layer | Verified |
|-------|----------|
| **ui-primitives** | Uses only global tokens (var(--bg-card), var(--bg-input), var(--text-main), var(--border-color), var(--primary), var(--shadow-premium), var(--shadow-focus-ring), var(--color-danger), var(--color-rating-filled), var(--hover-overlay), etc.). No hex/rgba for visuals. TOKEN OWNERSHIP note added. Form field surface aligned to --bg-input. |
| **index.css** | Single source of theme tokens: :root plus [data-theme='light'] and [data-theme='dark']. Token categories (surfaces, text, border, shadows, focus, semantic) documented at top of :root. Light and dark now have explicit focus and card-hover shadows. |
| **profile-shared** | Not modified this phase. Remains layout-only per plan; visual tokens it uses (e.g. --primary, --text-muted) come from index.css. |
| **BrandKit** | Not modified. Plan: accent overrides only; no change in 6A. |
| **Legacy .input-field** | Focus state now token-driven; no second visual system introduced. |

---

## F) Build Result

`npm run build` completed successfully (exit code 0). No new linter errors. Token and light-theme baseline changes are architecture-only and do not alter component logic.
