# Phase 4F Output — Safe Global UI Primitive Adoption for ProOverview

**Date:** 2025-03-08  
**Context:** Phase 4E (ProMessages shell) complete.  
**Scope:** ProOverview only.

---

## A) Files Modified

| File | Changes |
|------|---------|
| `src/pages/business-pro/ProOverview.jsx` | Recent Members section: outer container `bpro-card` → `ui-card` with style overrides (marginBottom: 20, padding: 24, borderRadius: 16) to preserve exact layout and appearance |
| `docs/PHASE_4F_OUTPUT.md` | Phase 4F output (this file) |

---

## B) Primitives Adopted in ProOverview

| Element | Primitive | Notes |
|---------|-----------|--------|
| Recent Members section container | `ui-card` | Style overrides preserve bpro-card-equivalent padding (24), radius (16), marginBottom (20) |

---

## C) Duplicated Visual Patterns Reduced

| Location | Old Pattern | New Pattern |
|----------|-------------|-------------|
| Recent Members wrapper | bpro-card (shared Pro CSS) | ui-card + inline style overrides |

---

## D) Intentionally Preserved Pro-Specific Styling

| Element | Preservation |
|---------|--------------|
| **StatCard** | bpro-stat-card, bpro-stat-icon + color variants (purple, orange, green, blue), bpro-stat-value, bpro-stat-label; hover (translateY, border-color) and metrics layout kept |
| **Stats grid** | bpro-stats-grid (grid, gap, marginBottom) unchanged |
| **Section header** | bpro-card-header, bpro-card-title, bpro-card-subtitle for Recent Members |
| **Empty state** | bpro-empty, bpro-empty-icon for "No members yet" — neutral tone preserved; ui-prompt not adopted |
| **Table** | bpro-table for Recent Members list — no ui-* table primitive |
| **Loading** | bpro-spinner unchanged |
| **Trend indicator** | Inline styles (green/red, FaArrowUp) in StatCard preserved |
| **Member row** | Avatar, role, location inline styles unchanged |

---

## E) Risky Areas Left Untouched

| Area | Reason |
|------|--------|
| Metrics/data logic | getCommunityMembers, getDocs (invitations, reviews), setStats, setRecentMembers unchanged |
| Filtering/sorting | members slice(0, 5), activeInv filter logic unchanged |
| Analytics behavior | No changes to data fetching or computation |
| Routing/navigation | None in ProOverview |
| Conditional rendering | loading → spinner; recentMembers.length → empty vs table unchanged |
| Stat cards | Pro-specific hover and colored icon boxes; no safe 1:1 ui-card mapping without losing behavior |

---

## F) Recommendation: Next Page After ProOverview

**Next low-risk target:** **ProOffers** — uses bpro-card, bpro-card-header, bpro-empty, bpro-btn-primary for "Create offer" / "Go to Design Studio" / "Subscribe" actions. Clear mappings: card → ui-card (with overrides where needed), action buttons → ui-btn ui-btn--primary. Empty state can remain bpro-empty for consistency with ProOverview.

**Alternative:** **ProMembers** — similar card + empty + table pattern; adopt ui-card for section container first, then buttons if any.

---

## G) Build Result

```
✓ 362 modules transformed.
✓ built in 8.83s
exit_code: 0
```

Build completed successfully.
