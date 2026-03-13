# Phase 4G Output — Safe Global UI Primitive Adoption for ProOffers

**Date:** 2025-03-08  
**Context:** Phase 4F (ProOverview) complete.  
**Scope:** ProOffers only.

---

## A) Files Modified

| File | Changes |
|------|---------|
| `src/pages/business-pro/ProOffers.jsx` | Header "New Offer" button: `bpro-btn-primary` → `ui-btn ui-btn--primary`; Locked state: `bpro-card` → `ui-card` (style: textAlign, padding, marginBottom 20), "View Plans" button → `ui-btn ui-btn--primary`; Empty state: outer `bpro-card` → `ui-card` (marginBottom 20), "Create First Offer" button → `ui-btn ui-btn--primary` |
| `docs/PHASE_4G_OUTPUT.md` | Phase 4G output (this file) |

---

## B) Primitives Adopted in ProOffers

| Element | Primitive | Notes |
|---------|-----------|--------|
| Header "New Offer" button | `ui-btn ui-btn--primary` | type="button" added |
| Locked state container | `ui-card` | style: textAlign center, padding 2rem, marginBottom 20 |
| Locked state "View Plans" button | `ui-btn ui-btn--primary` | type="button" added |
| Empty state outer container | `ui-card` | style: marginBottom 20 |
| Empty state "Create First Offer" button | `ui-btn ui-btn--primary` | type="button" added |

---

## C) Duplicated Visual Patterns Reduced

| Location | Old Pattern | New Pattern |
|----------|-------------|-------------|
| New Offer (header) | bpro-btn-primary | ui-btn ui-btn--primary |
| Locked state card | bpro-card | ui-card + style overrides |
| View Plans | bpro-btn-primary | ui-btn ui-btn--primary |
| Empty state wrapper | bpro-card | ui-card + marginBottom 20 |
| Create First Offer | bpro-btn-primary | ui-btn ui-btn--primary |

---

## D) Intentionally Preserved Pro-Specific Styling

| Element | Preservation |
|---------|--------------|
| **Section header** | bpro-card-header, title/subtitle inline styles |
| **Slot banner** | Tier-specific gradient (Elite gold / Pro purple), "Buy 50h Slot" button with amber styling; not ui-banner--warning |
| **OfferRow** | Custom wrapper (background, border by state), PremiumOfferCard, action bar with StatusBadge, TimeLeft |
| **Action buttons** (Edit, Freeze, Publish, Delete) | actionBtn() with dynamic colors; no ui-btn mapping (color-specific) |
| **Empty state content** | bpro-empty, bpro-empty-icon, h3, p — left unchanged per task |
| **Loading** | bpro-spinner |
| **StatusBadge, TimeLeft** | Inline styles preserved |
| **Grid layout** | repeat(auto-fill, minmax(340px, 1fr)), gap 20 |

---

## E) Risky Areas Left Untouched

| Area | Reason |
|------|--------|
| Offer load/edit/freeze/republish/delete logic | No logic changes |
| handleBuySlot, checkout, OFFER_SLOT_PACK | Subscription/payment unchanged |
| canPublish, tier, isElite, isProfessional | Conditional rendering unchanged |
| Filtering/sorting (active, frozen, expired) | Unchanged |
| onNavigate('design', { editOffer }) | Routing/navigation unchanged |
| Slot banner visibility and copy | Tier-specific; not ui-banner |
| OfferRow action bar buttons | Dynamic actionBtn(color); defer |

---

## F) Recommendation: Next Page After ProOffers

**Next low-risk target:** **ProMembers** — uses bpro-card, bpro-card-header, bpro-empty, bpro-table; same pattern as ProOverview. Adopt ui-card for the section container; leave table and empty state as-is unless a clear mapping is added later.

**Alternative:** **ProDesignStudio** or **ProNotifications** — audit for card/button patterns before adopting.

---

## G) Build Result

```
✓ 362 modules transformed.
✓ built in 9.51s
exit_code: 0
```

Build completed successfully.
