# Phase 6B Output — Centralize and Reduce Duplicate Legacy CSS

**Date:** 2025-03-08  
**Context:** Phase 6A token and light-theme baseline complete. Second execution phase from docs/THEME_UNIFICATION_FINAL_PLAN.md.  
**Scope:** index.css, shared style files, legacy clusters (.btn, .input-field, .form-group, .back-btn, .submit-btn). No broad page migrations; no JSX rewrites.

---

## A) Files Modified

| File | Changes |
|------|---------|
| **src/index.css** | Added `--bg-hover` token in :root, [data-theme='light'], and [data-theme='dark']. Added central `.submit-btn` definition (layout + primary appearance using tokens; hover/active/disabled). Replaced `.btn-primary:hover` hardcoded `box-shadow` with `var(--shadow-glow)`. |
| **src/pages/Notifications.css** | Removed duplicate `.back-btn` and `.back-btn:hover` block; rely on global definition from index.css. |
| **src/pages/SettingsPages.css** | Removed duplicate `.back-btn` / `.back-btn:hover` and entire `.submit-btn` block; both now use index.css. |
| **src/pages/Chat.css** | Removed full duplicate `.back-btn` block; kept minimal scoped override `.chat-header .back-btn` for margin-right and font-size only. |
| **src/pages/NotificationsSettings.css** | Replaced full `.settings-header .back-btn` block with minimal overrides: default `background: var(--bg-body)`, hover `background: var(--bg-hover)` and `transform: scale(1.1)`. Layout/size inherited from index.css. |
| **docs/PHASE_6B_OUTPUT.md** | This output document. |

---

## B) Legacy CSS Clusters Centralized / Reduced

| Cluster | Before | After |
|---------|--------|--------|
| **.back-btn** | Full definitions in index.css, Notifications.css, SettingsPages.css, Chat.css, NotificationsSettings.css (scoped), ChatList.css (scoped). | Single canonical definition in index.css. Duplicates removed from Notifications, SettingsPages, Chat. NotificationsSettings and Chat keep only context-specific overrides (background/hover or layout). ChatList.css unchanged (intentionally different design: transparent, no border). |
| **.submit-btn** | Defined only in SettingsPages.css (layout + hover/active/disabled; no base colors). | Single definition in index.css with full token-based primary appearance (gradient, color, shadow) plus layout and states. SettingsPages.css reference removed. |
| **.btn-primary:hover** | Hardcoded `box-shadow: 0 0 30px rgba(139, 92, 246, 0.5)` in index.css. | Uses `var(--shadow-glow)` for theme consistency and future tuning. |

---

## C) Token Alignment Improvements

| Change | Detail |
|--------|--------|
| **--bg-hover** | New token in :root (dark), [data-theme='light'], and [data-theme='dark'] so legacy and overrides (e.g. settings back button hover) use a consistent, theme-aware hover surface instead of page-local values. |
| **.submit-btn** | Uses `var(--primary)`, `var(--primary-hover)`, `var(--text-white)`, `var(--shadow-glow)`; no hardcoded colors. Composes with ui-btn when both classes are used (e.g. submit-btn ui-btn ui-btn--primary). |
| **.btn-primary:hover** | Box-shadow now `var(--shadow-glow)` instead of purple rgba; aligns with global token set. |

---

## D) Legacy Patterns Intentionally Left for Later

| Pattern | Reason |
|---------|--------|
| **.form-group** (index.css, EditBusinessProfile.css, MenuShowcase.css, SettingsPages.css) | Definitions differ (flex vs block, label weight/size, margin). Consolidating would change appearance; requires a later migration or design decision. |
| **.input-field** | Single definition in index.css; PrivateInvitation.css keeps `.private-theme .input-field` overrides for that flow. No structural duplication to remove. |
| **.btn / .btn-primary / .btn-outline** (index.css) | Still widely used; Phase 6B does not remove or broadly replace. EditBusinessProfile.css and PrivateInvitation.css keep their own .btn/.btn-primary overrides for page-specific look. |
| **ChatList.css .chat-list-header .back-btn** | Intentionally different (transparent, no border); left as scoped override. |
| **PrivateInvitation.css .private-theme** | Page-specific theme; not consolidated in this phase. |
| **EditBusinessProfile.css .btn / .btn-primary / .btn-outline** | Page-specific gradients/shadows; token alignment deferred to avoid UI change. |
| **admin.css, bpro-*** | Out of scope; no changes. |

---

## E) Recommended Next Migration Wave After 6B

1. **Legacy .btn / .btn-primary usage**  
   Replace with `ui-btn ui-btn--primary` (and variants) on high-traffic or already-touched pages (e.g. CreateInvitation, InvitationTimeline, FriendsFeed, CompleteProfile) and then consolidate or remove .btn from index.css when unused.

2. **.form-group consolidation**  
   Either define one canonical .form-group in index.css (layout + label token-only) and reduce local overrides to true page-specific only, or migrate form wrappers to structure + `ui-form-label` / `ui-form-field` and phase out .form-group.

3. **Settings and layout pages**  
   Continue replacing remaining legacy button/input classes with ui-primitives where low-risk (e.g. remaining submit buttons that only use `.submit-btn` could add `ui-btn ui-btn--primary` and rely on central .submit-btn for layout only, then eventually drop .submit-btn).

4. **BusinessProDashboard.css (bpro-*)**  
   Per THEME_UNIFICATION_FINAL_PLAN Phase C: replace bpro visual values with tokens and add [data-theme='light'] where needed; then migrate to ui-card / ui-btn where possible.

5. **Admin**  
   Per plan: either introduce admin token set that respects [data-theme] or migrate admin buttons/inputs to ui-primitives with an admin layout class.

---

## F) Build Result

`npm run build` completed successfully (exit code 0). No JSX changes; CSS-only centralization and token alignment. No new linter errors. If any page previously depended on a removed local .back-btn or .submit-btn variant (e.g. different hover), it now uses the global definition or the minimal overrides left in NotificationsSettings and Chat.
