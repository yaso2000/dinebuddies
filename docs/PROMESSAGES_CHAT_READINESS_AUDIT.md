# ProMessages Chat-Readiness Audit

**Date:** 2025-03-08  
**Context:** Phase 4D complete. No UI primitive adoption in this audit — analysis only.  
**Scope:** ProMessages only; no code changes.

---

## A) ProMessages UI Breakdown by Safety Level

### Safe for ui-primitives now

| Element | Current | Notes |
|--------|---------|--------|
| **Send button** | `bpro-btn-primary` (icon only) | Visually separable from chat logic; no send handler attached in current code. Clear mapping to `ui-btn ui-btn--primary` with padding override. |
| **Compose input** | Inline styles (padding, border, background) | Simple text input; maps to `ui-form-field` with `style={{ flex: 1 }}` to keep flex layout. No validation or chat-specific behavior in the input itself. |

### Maybe safe with thin wrappers / style overrides

| Element | Current | Notes |
|--------|---------|--------|
| **Messages area container** | `bpro-card` + flex/overflow/padding overrides | Maps to `ui-card`; need to preserve `flex: 1`, `overflowY: 'auto'`, `padding: 16`, `gap: 12`. ui-card uses 20px radius and 1rem padding — minor visual difference from bpro-card (16px radius, 24px padding). Acceptable with inline style overrides. |
| **Empty state (no messages)** | `bpro-empty` + `bpro-empty-icon` + h3 + p | Structurally similar to `ui-prompt` (centered, title, description). ui-prompt uses dashed border and primary tint; bpro-empty is neutral/gray. Could use `ui-prompt` with optional `ui-prompt__title` / `ui-prompt__desc` and keep icon — or leave as bpro-empty to avoid changing empty-state tone. |

### Should remain Pro-specific

| Element | Current | Notes |
|--------|---------|--------|
| **Section header** | `bpro-card-header` + inline title/subtitle | No direct ui-* “section header” primitive; layout (flex, space-between) is generic but the class is shared across Pro pages. Keeping bpro-card-header avoids touching shared Pro layout. |
| **Loading state** | `bpro-spinner` | No ui-* spinner in primitives; Pro purple accent. Leave as-is. |
| **Root layout** | `height: calc(100vh - 160px)`, flex column | Chat-specific viewport; not a primitive surface. |

### Should remain chat-specific (out of scope)

| Element | Current | Notes |
|--------|---------|--------|
| **Message list** | `.map(msg => ...)` | Message bubbles, avatar, sender name, timestamp — all chat UX. Do not migrate. |
| **Message bubble styling** | Inline: gradient (isMe) vs neutral, border-radius asymmetry | Core chat visual identity. Do not touch. |
| **Avatar / sender label / time** | Inline styles per message | Part of bubble layout. Do not touch. |

### Risky / logic-adjacent — do not touch yet

| Element | Current | Notes |
|--------|---------|--------|
| **Send button behavior** | Button has no `onClick` (comment: “Sending handled via CommunityChat functionality”) | Logic may live elsewhere or be incomplete. Adopting ui-btn is visual-only and safe; do not add or change any send/submit logic in this phase. |
| **Input `onKeyDown` / `value` / `onChange`** | Tied to `messageText` state | Adopting ui-form-field must not alter controlled input behavior or Enter handling. |

---

## B) Candidate Primitive Mappings

| ProMessages element | Candidate primitive | Override / note |
|---------------------|----------------------|------------------|
| Send button | `ui-btn ui-btn--primary` | `style={{ padding: '12px 20px' }}` |
| Compose input | `ui-form-field` | `style={{ flex: 1 }}` (and keep existing value/onChange/onKeyDown/placeholder) |
| Messages area wrapper | `ui-card` | `style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}`; consider marginBottom: 0 if ui-card adds margin |
| Empty state container | `ui-prompt` (optional) | Use `ui-prompt__title` for “No messages yet”, `ui-prompt__desc` for “Send your first message…”; keep icon in a wrapper. Or leave as bpro-empty. |
| Section header | — | No mapping; keep `bpro-card-header`. |
| Loading | — | No mapping; keep `bpro-spinner`. |
| Message bubbles | — | No mapping; out of scope. |

---

## C) Areas That Must Remain Chat-Specific

- **Message list rendering** — `messages.map(...)`, order, keys.
- **Message bubble layout and styling** — flex direction (row vs row-reverse), avatar, sender name, bubble background/border/radius, timestamp.
- **Realtime / data** — `onSnapshot`, Firestore path, limit(50), loading state.
- **Viewport and scroll** — height calc, overflow on the messages container, any scroll-into-view or load-more (if added later).
- **Compose behavior** — what happens on Enter, how send is triggered (current button has no handler; logic may be elsewhere). Audit does not change this; only visual class on input/button.

---

## D) Top Risks If Migration Is Attempted Too Early

1. **Messages container** — Changing `bpro-card` to `ui-card` without preserving `flex: 1` and `overflowY: 'auto'` could break the chat layout (no scroll, or wrong height). Must keep layout props.
2. **Empty state** — Replacing `bpro-empty` with `ui-prompt` changes the look (dashed border, primary tint). If Pro wants a neutral “no messages” feel, keep bpro-empty or wrap ui-prompt with neutral overrides.
3. **Send button** — If send logic is later wired to this button, adding only a class (ui-btn) is safe; adding or changing onClick is out of scope.
4. **Input** — Adding `ui-form-field` must not remove or change `value`, `onChange`, `onKeyDown`, or `placeholder`; otherwise chat behavior breaks.
5. **Shared Pro CSS** — `bpro-card`, `bpro-empty`, `bpro-card-header` are used by ProOverview, ProOffers, ProMembers, etc. Changing their usage only in ProMessages (e.g. swapping class names) does not remove shared CSS; risk is limited to ProMessages layout/visuals.

---

## E) Recommended Next Implementation Phase

**Recommendation: Option A — Phase 4E: safe partial adoption for ProMessages shell only**

- **In scope for Phase 4E (ProMessages only):**
  - Send button: `bpro-btn-primary` → `ui-btn ui-btn--primary` (padding override).
  - Compose input: add `ui-form-field`, keep all props and `style={{ flex: 1 }}`.
  - Optionally: messages area container `bpro-card` → `ui-card` with explicit layout overrides (flex: 1, overflowY, padding, gap).
- **Out of scope for Phase 4E:** Empty state (leave bpro-empty unless product explicitly wants ui-prompt), section header (keep bpro-card-header), loading (keep bpro-spinner), all message bubble and list logic.

**Rationale:** ProMessages has a small, well-defined “shell” (header, scroll container, input row, send button). Three low-risk mappings (send button, input, optionally container) align with Phase 4 style and do not touch chat logic or bubble styling. ProOverview can be done in the same phase (4E) or immediately after (4F) as a separate target.

**If preferring to minimize risk in chat:** Choose **Option B** — skip ProMessages for now and adopt ProOverview first (stats cards, bpro-card, bpro-empty, action buttons), then return to ProMessages shell in a later phase.

---

## F) Confidence / Risk Assessment

| Area | Confidence | Risk level |
|------|------------|------------|
| Send button → ui-btn--primary | High | Low — visual only; no logic change. |
| Compose input → ui-form-field | High | Low — add class + flex:1; preserve all behavior. |
| Messages container → ui-card | Medium | Low–medium — layout overrides must be exact; small visual shift (radius/padding). |
| Empty state → ui-prompt | Low | Medium — visual and tone change; better to leave as bpro-empty unless requested. |
| Section header / loading | N/A | None — no adoption recommended. |
| Message bubbles / list | N/A | Do not touch. |

**Overall:** A **low-risk, partial Phase 4E for ProMessages shell** is feasible (send button + input + optional container). Confidence is high for button and input; medium for container. Empty state and everything inside the message list should remain Pro/chat-specific for this phase.
