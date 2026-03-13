# Phase 4H Output — Safe Global UI Primitive Adoption for ProMembers

**Date:** 2025-03-08  
**Context:** Phase 4G (ProOffers) complete.  
**Scope:** ProMembers only.

---

## A) Files Modified

| File | Changes |
|------|---------|
| `src/pages/business-pro/ProMembers.jsx` | Search input: added `ui-form-field`, style reduced to `{ paddingLeft: 38 }`; Empty state outer: `bpro-card` → `ui-card` (marginBottom 20); Table container: `bpro-card` → `ui-card` (padding 0, overflow hidden, marginBottom 20) |
| `docs/PHASE_4H_OUTPUT.md` | Phase 4H output (this file) |

---

## B) Primitives Adopted in ProMembers

| Element | Primitive | Notes |
|---------|-----------|--------|
| Search input | `ui-form-field` | paddingLeft: 38 for search icon; value, onChange, placeholder unchanged |
| Empty state outer container | `ui-card` | style: marginBottom 20 |
| Table section container | `ui-card` | style: padding 0, overflow hidden, marginBottom 20 |

---

## C) Duplicated Visual Patterns Reduced

| Location | Old Pattern | New Pattern |
|----------|-------------|-------------|
| Search input | Inline styles (width, padding, background, border, etc.) | ui-form-field + paddingLeft 38 |
| Empty state wrapper | bpro-card | ui-card + marginBottom 20 |
| Table wrapper | bpro-card | ui-card + padding 0, overflow, marginBottom 20 |

---

## D) Intentionally Preserved Pro-Specific Styling

| Element | Preservation |
|---------|--------------|
| **Section header** | bpro-card-header, title/subtitle inline styles |
| **Search icon** | FaSearch absolute positioning, color, size |
| **Empty state content** | bpro-empty, bpro-empty-icon, h3, p (search vs no-members copy) — unchanged per task |
| **Table** | bpro-table, thead/tbody structure |
| **Member row** | Avatar, display name, @id, profileType badge (business orange / user purple), location, “Joined Communities” column |
| **Loading** | bpro-spinner |

---

## E) Risky Areas Left Untouched

| Area | Reason |
|------|--------|
| getCommunityMembers, setMembers | Data fetching unchanged |
| filtered (search filter) | Filtering logic unchanged |
| Role/profileType display | No logic change |
| Conditional rendering | loading → spinner; filtered.length === 0 → empty vs table unchanged |
| No invite/remove/action buttons | None present to migrate |
| Routing/navigation | None in ProMembers |

---

## F) Recommendation: Next Page After ProMembers

**Next low-risk target:** **ProDesignStudio** or **ProNotifications** — audit for card/button/input patterns; adopt ui-card, ui-btn, ui-form-field where clearly safe.

**Alternative:** **ProSubscription** — may have plans/cards and CTAs; audit before adopting.

---

## G) Build Result

```
✓ 362 modules transformed.
✓ built in 7.72s
exit_code: 0
```

Build completed successfully.
