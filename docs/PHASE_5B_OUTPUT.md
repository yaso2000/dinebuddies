# Phase 5B Output — Profile.jsx Targeted UI Primitive Adoption

**Date:** 2025-03-08  
**Context:** Phases 1A–5A complete. High-impact, controlled migration in Profile.jsx only.  
**Scope:** Profile.jsx; no alias removal; no child feature modules.

---

## A) Files Modified

| File | Changes |
|------|---------|
| `src/pages/Profile.jsx` | Buttons: profile-action-btn → ui-btn (secondary/primary); btn btn-primary/btn-outline → ui-btn--primary/ghost; profile-clear-btn → ui-btn--danger-outline; guest prompt button → ui-btn--primary; Manage subscription & + Top Up → ui-btn--secondary/ghost. Form: input-field/textarea → ui-form-field; labels → ui-form-label. Card/tabs: profile-card → ui-card; profile-card-header profile-tabs → ui-card-header ui-tabs; profile-tab / profile-tab--active → ui-tab / ui-tab--active. Guest prompt container: profile-guest-prompt → ui-prompt; title/desc → ui-prompt__title, ui-prompt__desc. |
| `docs/PHASE_5B_OUTPUT.md` | This output document. |

**Local CSS:** No changes. profile-shared.css and Profile.css unchanged; profile-* aliases remain in ui-primitives.css.

---

## B) Primitives Adopted in Profile.jsx

| Element | Primitive | Notes |
|---------|-----------|--------|
| Edit Profile button | `ui-btn ui-btn--secondary` | style: flex 1 |
| Create Invitation button | `ui-btn ui-btn--primary` | style: flex 1 |
| Save (edit form) | `ui-btn ui-btn--primary` | style: flex 1 |
| Cancel (edit form) | `ui-btn ui-btn--ghost` | style: flex 1 |
| Guest login button | `ui-btn ui-btn--primary` | style: width 100%, padding 12px |
| Clear All (private posts) | `ui-btn ui-btn--danger-outline` | — |
| Manage subscription | `ui-btn ui-btn--secondary` | style: width 100%, marginTop, padding, fontSize |
| + Top Up | `ui-btn ui-btn--ghost` | style: marginTop, fontSize, padding |
| Name input | `ui-form-field` | style overrides for center, font |
| Bio textarea | `ui-form-field` | style overrides for center, minHeight |
| Form labels (name, gender, age category, bio) | `ui-form-label` | style overrides for muted, center |
| Invitations card container | `ui-card` | — |
| Card header / tabs row | `ui-card-header ui-tabs` | — |
| Tab buttons (Public / Private / Joined) | `ui-tab`, `ui-tab--active` | — |
| Guest prompt container | `ui-prompt` | — |
| Guest prompt title / description | `ui-prompt__title`, `ui-prompt__desc` | — |

---

## C) Duplicated Visual Patterns Reduced

- **Buttons:** Replaced `profile-action-btn profile-action-btn--secondary/primary`, `btn btn-primary`, `btn btn-outline`, `profile-clear-btn`, and inline-styled Manage subscription / + Top Up with `ui-btn` variants; removed redundant inline border/background/color/cursor where covered by primitives.
- **Form:** Replaced `input-field` and raw `<label>` styling with `ui-form-field` and `ui-form-label`; kept only layout/typography overrides (textAlign, fontSize, minHeight).
- **Card/tabs:** Replaced `profile-card`, `profile-card-header profile-tabs`, `profile-tab`, `profile-tab--active` with `ui-card`, `ui-card-header ui-tabs`, `ui-tab`, `ui-tab--active`.
- **Guest prompt:** Replaced `profile-guest-prompt`, `profile-guest-prompt__title`, `profile-guest-prompt__desc` with `ui-prompt`, `ui-prompt__title`, `ui-prompt__desc`.

---

## D) Intentionally Preserved Profile-Specific Styling

| Element | Preservation |
|---------|---------------|
| **profile-shell, profile-content, personal-view** | Page layout and structure |
| **profile-identity, host-avatar-container, host-avatar** | Avatar and identity block |
| **profile-theme-toggle** | Theme switch (custom icon button; deferred) |
| **profile-add-story-btn** | Add Story floating button (custom position/size; deferred) |
| **Gender / Age category buttons** | Custom selected state and grid layout; not mapped to ui-btn |
| **profile-stats, profile-stat-item, profile-stat-value, profile-stat-label, profile-stats-divider** | Stats row layout and typography |
| **profile-subscription-card, profile-subscription-quota-card, profile-subscription-trial-banner** | Subscription section layout |
| **profile-subscription-upgrade-btn** | Custom gradient CTA; deferred |
| **profile-actions-row** | Flex container for Edit / Create Invitation |
| **profile-section-body** | Inner content area of invitations card |
| **profile-meta-row, profile-stat-label** (in section body) | Section headings and layout |
| **InvitationListItem, profile-invitation-item*** | Invitation list structure and styling |
| **premium-plan-card** | Custom padding/border/decoration; not switched to ui-card |
| **StatisticsCards, Achievements, FavoritePlaces** | Child components unchanged |
| **form-group** | Wrapper for form fields; kept for layout |

---

## E) What Remains Deferred in Profile.jsx

| Area | Reason |
|------|--------|
| **profile-theme-toggle** | Custom icon button with specific hover/scale; keep profile-* for now. |
| **profile-add-story-btn** | Floating circle, absolute position, custom color; keep profile-*. |
| **profile-subscription-upgrade-btn** | Custom gradient (rating-filled + primary); differs from ui-btn--primary. |
| **Gender / Age category selector buttons** | Custom selected state (border, background, transform, checkmark); not a simple ui-btn variant. |
| **profile-subscription-*, profile-stats, profile-section-body, profile-meta-row, profile-stat-label** | Layout/semantic classes; no 1:1 ui-* equivalent or low-risk swap. |
| **InvitationListItem (profile-invitation-item*)** | Child structure; trivially safe only if we add ui-card to wrapper; left for a later micro-phase. |
| **premium-plan-card** | Custom styling; could add ui-card + overrides in a follow-up. |

**profile-* aliases:** Left intact in `ui-primitives.css`. No alias removal in this phase.

---

## F) BusinessProfile.jsx Next vs Profile Follow-up

- **Recommendation:** Proceed to **BusinessProfile.jsx** next (Phase 5C) for strategic impact: it is the other main consumer of profile-* and shares the same design language. After both Profile.jsx and BusinessProfile.jsx use ui-* where adopted, alias removal can be planned.
- **Optional Profile follow-up (micro-phase):** If desired before BusinessProfile, a small follow-up could: (1) add `ui-btn ui-btn--ghost` (or keep as-is) to theme toggle and add `ui-card` to premium-plan-card with overrides; (2) leave profile-subscription-upgrade-btn and gender/age buttons as-is. Not required for Phase 5B completion.

---

## G) Build Result

`npm run build` completed successfully (exit code 0). No new linter errors in Profile.jsx.
