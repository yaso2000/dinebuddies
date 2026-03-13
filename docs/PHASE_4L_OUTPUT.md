# Phase 4L Output — Safe Shell-Level UI Primitive Adoption for ProDirectMessages

**Date:** 2025-03-08  
**Context:** ProDirectMessages readiness audit complete. Shell-level adoption only.  
**Scope:** ProDirectMessages only; ConvoList search, compose input, camera button.

---

## A) Files Modified

| File | Changes |
|------|---------|
| `src/pages/business-pro/ProDirectMessages.jsx` | ConvoList search input: added `ui-form-field`, style `{ paddingLeft: 32 }`; Compose input: added `ui-form-field`, style `{ flex: 1, borderRadius: 22 }`; Camera button: `ui-btn ui-btn--ghost` with style `{ padding: 6, color }` |
| `docs/PHASE_4L_OUTPUT.md` | Phase 4L output (this file) |

---

## B) Primitives Adopted in ProDirectMessages

| Element | Primitive | Notes |
|---------|-----------|--------|
| ConvoList search input | `ui-form-field` | style: paddingLeft 32; value, onChange, placeholder unchanged |
| Compose input | `ui-form-field` | style: flex 1, borderRadius 22; value, onChange, onKeyDown, placeholder, disabled unchanged |
| Camera button | `ui-btn ui-btn--ghost` | style: padding 6, color; onClick unchanged |

---

## C) Duplicated Styling Reduced

| Location | Old Pattern | New Pattern |
|----------|-------------|-------------|
| ConvoList search | Inline width, padding, background, border, color, fontSize, outline | ui-form-field + paddingLeft 32 |
| Compose input | Inline flex, padding, background, border, borderRadius, color, fontSize, outline | ui-form-field + flex 1, borderRadius 22 |
| Camera button | Inline background none, border none, color, cursor, padding, fontSize | ui-btn ui-btn--ghost + padding, color override |

---

## D) Preserved Layout Overrides

| Element | Preserved |
|---------|-----------|
| ConvoList search | paddingLeft: 32 (icon space) |
| Compose input | flex: 1, borderRadius: 22 (pill in compose row) |
| Camera button | padding: 6, color: rgba(255,255,255,0.3) |
| All | value, onChange, onKeyDown, placeholder, disabled, onClick; compose row flex/gap/alignment unchanged |

---

## E) Untouched Chat-Specific Areas

| Area | Status |
|------|--------|
| Send button | Unchanged (circular, conditional fill, disabled) |
| Conversation rows | Unchanged (active/hover, avatar, name, lastMessage, time, unread) |
| Message bubbles | Unchanged |
| Typing indicator | Unchanged |
| Chat header | Unchanged |
| Empty state (no conversations) | Unchanged |
| Loading state | Unchanged |
| "Select a conversation" placeholder | Unchanged |
| Scroll-to-bottom button | Unchanged |
| Realtime / read / send logic | Unchanged |
| Selection (onSelect, activeId) | Unchanged |

---

## F) Recommendation: Send Button in a Later Micro-Phase

**Keep send button deferred for now.** The audit noted the send button has circular size (38px), conditional fill (purple when text, gray when empty), and disabled state when `!text.trim() || uploading`. Migrating it would require non-trivial overrides (borderRadius: '50%', width/height, conditional background) and risks affecting the compose-row layout or visual hierarchy.

**Recommendation:** Do **not** add a micro-phase for the send button unless the team explicitly wants to align it with `ui-btn`; in that case, use `ui-btn ui-btn--primary` with style overrides for size (38px), borderRadius: '50%', and disabled opacity/cursor, and preserve the conditional background in inline style or a small local class. Until then, leaving it as-is is the lowest-risk option.

---

## G) Build Result

```
✓ 362 modules transformed.
✓ built in 8.08s
exit_code: 0
```

Build completed successfully.
