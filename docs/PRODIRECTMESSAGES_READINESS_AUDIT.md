# ProDirectMessages Readiness Audit

**Date:** 2025-03-08  
**Context:** Phase 4K complete. No implementation; audit only.  
**Scope:** ProDirectMessages only.

---

## A) ProDirectMessages UI Breakdown by Safety Level

### Safe for ui-primitives now

| Element | Location | Notes |
|---------|----------|--------|
| **Search input** | ConvoList (left panel) | Same pattern as ProMembers/ProNotifications: single text input with FaSearch icon. Clear mapping to `ui-form-field` with `style={{ paddingLeft: 32 }}`. value, onChange, placeholder unchanged. |

### Maybe safe with thin overrides

| Element | Location | Notes |
|---------|----------|--------|
| **Compose input** | ChatWindow input row | Text input with flex: 1, borderRadius: 22 (pill), disabled when uploading. Could use `ui-form-field` with `style={{ flex: 1, borderRadius: 22 }}`; preserve value, onChange, onKeyDown, placeholder, disabled. Slight visual shift if primitive default radius overrides; explicit borderRadius keeps pill. |
| **Camera button** | ChatWindow input row | Icon-only, ghost style (background none, border none, muted color). Could use `ui-btn ui-btn--ghost` with `style={{ padding: 6 }}`; preserve onClick (imageRef). |
| **Scroll-to-bottom button** | ChatWindow messages area | Small circular button (36px), fixed position, purple fill. Could use `ui-btn ui-btn--primary` with size/position overrides; low impact but position/absolute and circle shape require overrides. **Defer** unless needed for consistency. |

### Should remain Pro-specific

| Element | Location | Notes |
|---------|----------|--------|
| **Root layout** | Main container | Two-panel flex, height calc, border, background; no single ui-card for whole shell. |
| **ConvoList panel** | Left column | Width 280, borderRight, header "Messages", scrollable list; structure is DM-specific. |
| **Conversation row** | ConvoList | Active/hover background, left border for active, avatar + name + lastMessage + time + unread dot; tightly coupled to selection state. Do not replace with ui-card. |
| **Empty state (no conversations)** | ConvoList | Inline FaCommentDots + "No conversations yet"; simple. Could stay as-is or optional ui-prompt later. |
| **Loading state** | ConvoList | Inline "Loading…". |
| **Chat header** | ChatWindow | Avatar, name, online/typing status; layout is chat-specific. |
| **"Select a conversation" placeholder** | ChatWindow when !convo | Centered icon + text; leave as-is. |

### Should remain chat-specific (out of scope)

| Element | Location | Notes |
|---------|----------|--------|
| **Message bubbles** | ChatWindow messages area | isOwn vs other, image/text/voice, timestamp; do not migrate. |
| **Typing indicator** | ChatWindow messages area | Animated dots; out of scope. |
| **Send button** | ChatWindow input row | Circular 38px, conditional fill (purple when text, gray when empty), disabled when !text.trim() or uploading. Logic and state are tied to compose; adopting ui-btn would require circle + conditional styling overrides. **Defer** or treat as "maybe" with heavy overrides. |

### Risky / logic-adjacent — do not touch yet

| Element | Reason |
|---------|--------|
| onSelect(convo), setActiveConvo, activeId | Selection and routing. |
| sendMessage, markAsRead, setTypingStatus | Chat context; no behavior change. |
| handleSend, handleTyping, handleImage | Compose logic; only visual class on inputs/buttons. |
| Firestore onSnapshot (conversations, messages, typing) | Realtime; unchanged. |
| messagesEndRef, scrollIntoView, showScrollBtn | Scroll behavior; unchanged. |
| Conversation row onClick and hover | Selection UX; leave row styling intact. |

---

## B) Candidate Primitive Mappings

| Element | Candidate | Override / note |
|---------|-----------|------------------|
| ConvoList search | `ui-form-field` | style: paddingLeft 32; keep value, onChange, placeholder |
| Chat compose input | `ui-form-field` (optional) | style: flex 1, borderRadius 22; keep value, onChange, onKeyDown, placeholder, disabled |
| Camera button | `ui-btn ui-btn--ghost` (optional) | style: padding 6; keep onClick |
| Send button | — | **Defer** — circular, conditional fill, disabled; no clean 1:1 |
| Scroll-to-bottom | — | **Defer** — fixed position, circle; optional later |
| Empty state (no convos) | — | Leave as-is or optional ui-prompt in a later pass |

---

## C) Areas That Must Remain Chat-Specific

- **Conversation list rows** — Active/hover state, left border, avatar, name, lastMessage, time, unread dot; selection and navigation.
- **Message list and bubbles** — Layout, isOwn vs other, image/text/voice, timestamps; no ui-card or ui-prompt on bubbles.
- **Typing indicator** — Animated dots; out of scope.
- **Chat header** — Avatar, name, online/typing copy.
- **Send button behavior and state** — Disabled when empty or uploading; conditional styling; keep logic, consider visual only in a later phase.
- **Realtime and scroll** — onSnapshot, scrollIntoView, load/scroll behavior.
- **Compose behavior** — handleSend, handleTyping, handleImage; no logic change.

---

## D) Top Risks If Migration Is Attempted Too Early

1. **Compose input** — Adding `ui-form-field` without preserving `flex: 1` and `borderRadius: 22` could break the input row layout or pill shape. Explicit style overrides required.
2. **Send button** — Replacing with `ui-btn--primary` without preserving size (38px circle), disabled state, and conditional fill (purple vs gray) would change chat UX. **Defer** send button adoption unless overrides are clearly defined.
3. **Conversation rows** — Any move to ui-card or change to row styling could affect selection highlight and hover; leave as-is.
4. **Message bubbles** — Do not touch; same as ProMessages audit.
5. **Scroll-to-bottom** — Position and shape are specific; low priority.

---

## E) Recommended Next Implementation Phase

**Recommendation: Option A — Phase 4L: safe shell-level adoption for ProDirectMessages**

- **In scope for Phase 4L:**
  - **ConvoList search input** → `ui-form-field` with `style={{ paddingLeft: 32 }}`; keep value, onChange, placeholder.
  - **Optionally:** Chat compose input → `ui-form-field` with `style={{ flex: 1, borderRadius: 22 }}`; keep all props and disabled state.
  - **Optionally:** Camera button → `ui-btn ui-btn--ghost` with `style={{ padding: 6 }}`; keep onClick.
- **Out of scope for Phase 4L:** Conversation list row styling, message bubbles, typing indicator, send button (defer), scroll-to-bottom (defer), chat header, empty/loading/placeholder blocks (or leave as-is).

**Rationale:** ConvoList search is the same pattern as already-adopted search inputs; minimal risk. Compose input and camera button are small, isolated changes with clear overrides. Sending and message rendering stay untouched. Option C (hybrid small adoption) would be “ConvoList search only” if you prefer the smallest possible first step.

---

## F) Confidence / Risk Assessment

| Area | Confidence | Risk |
|------|------------|------|
| ConvoList search → ui-form-field | High | Low |
| Compose input → ui-form-field (with overrides) | High | Low |
| Camera button → ui-btn--ghost | High | Low |
| Send button → ui-btn | Low | Medium — state and shape |
| Scroll-to-bottom → ui-btn | Medium | Low (but low value) |
| Conversation rows / message bubbles | N/A | Do not touch |

**Overall:** A **shell-level Phase 4L** (ConvoList search required; compose input and camera button optional) is appropriate and low risk. Send button and list/bubble styling should remain chat-specific for this phase.
