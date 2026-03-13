# ProSubscription Readiness Audit

**Date:** 2025-03-08  
**Context:** Phase 4J complete. No implementation; audit only.  
**Scope:** ProSubscription only.

---

## A) ProSubscription Readiness Summary

### UI classification

| Classification | Elements |
|----------------|----------|
| **Safe for ui-primitives now** | "Manage Billing" button (single secondary-style button in Current Plan banner) |
| **Maybe safe with thin overrides** | Plan card outer container — could use `ui-card` with conditional style overrides for isCurrent / isRecommended border and background; risk of altering tier-specific emphasis. |
| **Should remain Pro/subscription-specific** | Current Plan banner (tier-specific gradient: Elite gold, Professional purple, Free neutral); "CURRENT" and "RECOMMENDED" badges on cards; plan card border/background by state (current vs recommended vs neutral); price display and "First month FREE"; feature list with checkmarks; section heading "Plan Overview" / "Available Plans". |
| **Risky / logic-adjacent** | handleUpgrade (checkout, Stripe, loading state); handleManageBilling (external URL); tier/isElite/isProfessional; plan.tier, plan.recommended, isCurrent; CTA copy and disabled state ("Current Plan" vs "Upgrade to Elite →" / "Start with Professional →"); any change that could affect which plan is highlighted or which button fires checkout. |

### Primitive compatibility

| Primitive | Fit |
|-----------|-----|
| **ui-card** | Plan cards use dynamic background/border (isCurrent → gold tint, isRecommended → purple, else neutral). Using `ui-card` would require inline overrides for each state; doable but easy to regress. **Maybe** with explicit overrides; **defer** card adoption if the goal is lowest risk. |
| **ui-btn** | **Manage Billing:** clear fit for `ui-btn ui-btn--secondary` with padding/gap override. **Current Plan (disabled):** could use `ui-btn ui-btn--secondary` disabled; low risk. **Upgrade CTAs:** plan-specific gradients (recommended = gold, else purple). `ui-btn--primary` is a single gradient (primary → luxury-gold); does not match both gold-only and purple-only cases. Adopting would require conditional classes or strong overrides; **defer** or keep as inline. |
| **ui-banner--warning** | Current Plan banner is an info/status banner (tier-specific gradient), not a warning. **No mapping.** |
| **ui-prompt** | No empty state or prompt block in ProSubscription. **Not applicable.** |
| **ui-form-*** | No form fields. **Not applicable.** |
| **ui-tabs** | No tabs; plan grid is cards. **Not applicable.** |

### Areas identified in the page

| Area | Description | Safe to adopt? |
|------|-------------|----------------|
| **Current Plan banner** | Tier-based gradient, label, description, "Manage Billing" button | Button only → ui-btn--secondary |
| **Section heading** | "Plan Overview" / "Available Plans" | Leave as-is (no heading primitive) |
| **Plan cards** | Grid of pricing cards with badge, name, description, price, features, CTA | Card: maybe with overrides; badges/price/features: leave as-is |
| **CURRENT / RECOMMENDED badges** | Absolute-position badges on cards | Leave as-is |
| **Manage Billing** | Single secondary-style button | **Yes** → ui-btn ui-btn--secondary |
| **Current Plan (disabled)** | Disabled button on current plan card | **Yes** → ui-btn ui-btn--secondary disabled |
| **Upgrade CTAs** | "Upgrade to Elite →" / "Start with Professional →" with gradient by plan | **Defer** — tier-specific gradients |

---

## B) Candidate Primitive Mappings

| Element | Candidate | Override / note |
|---------|-----------|------------------|
| Manage Billing | `ui-btn ui-btn--secondary` | style: padding 10px 18px, gap 8; preserves icon + label |
| Current Plan (disabled) | `ui-btn ui-btn--secondary` | disabled; existing disabled styles or primitive disabled |
| Plan card container | `ui-card` (optional) | style: dynamic background, border, padding 24px, borderRadius 16 by isCurrent / isRecommended; **defer** unless explicit overrides are added |
| Upgrade CTA | — | **No safe 1:1** — gold vs purple gradient; defer |

---

## C) Areas That Must Remain Subscription-Specific

- **Current Plan banner** — Tier-based gradient (Elite gold, Professional purple, Free neutral), border, and copy (e.g. "1 permanent offer slot", "1 offer slot × 50h/week"). Do not replace with a generic banner primitive.
- **Plan card state styling** — Border and background driven by `isCurrent` (gold) and `isRecommended` (purple). Any card adoption must preserve these.
- **CURRENT / RECOMMENDED badges** — Position, gradient, and text; no ui-* equivalent.
- **Price and discount** — e.g. "$X AUD", "/ month", "First month FREE" — layout and typography.
- **Feature list** — Checkmark list; structure can stay as-is.
- **handleUpgrade / handleManageBilling** — No logic or behavior change; only visual class/attribute changes where safe.
- **Loading state** — `loading === plan.id` and button disabled/opacity; preserve.

---

## D) Top Risks If Migration Is Attempted Too Early

1. **Plan cards to ui-card** — Default ui-card background/border would override tier-specific styling. Forgetting to pass through `isCurrent` / `isRecommended` in style would remove the intended “current” and “recommended” emphasis and cause visual regressions.
2. **Upgrade CTAs to ui-btn--primary** — Primary uses one gradient; ProSubscription uses two (gold for recommended, purple for non-recommended). Switching both to primary would blur plan hierarchy; switching only one would be inconsistent. Keep as inline or defer until a plan-specific variant exists.
3. **Current Plan banner** — Replacing with ui-banner--warning or another primitive would change meaning and look; tier-specific gradient and copy must stay.
4. **Checkout / billing logic** — Any change to onClick, disabled, or loading that could affect when handleUpgrade or handleManageBilling run.

---

## E) Recommended Next Implementation Phase

**Recommendation: Option C — Hybrid small adoption only**

- **In scope for Phase 4K (ProSubscription):**
  - **Manage Billing** → `ui-btn ui-btn--secondary` with padding/gap override.
  - **Current Plan (disabled)** → `ui-btn ui-btn--secondary` with `disabled`; keep or align disabled styling.
- **Out of scope for Phase 4K:** Current Plan banner styling, plan card containers, CURRENT/RECOMMENDED badges, upgrade CTAs, price/features layout, and all subscription/checkout logic.

**Rationale:** Two buttons have a clear, low-risk mapping. Adopting plan cards or upgrade CTAs would require conditional overrides and carries higher regression risk; leaving them for a later pass keeps this phase minimal and safe.

**Alternative:** **Option A** — Full Phase 4K with the two buttons above only (same as Option C). **Option B** — Skip ProSubscription and adopt another page first — reasonable if the team prefers to tackle pages with more generic card/button patterns before subscription-specific UI.

---

## F) Confidence / Risk Assessment

| Area | Confidence | Risk |
|------|------------|------|
| Manage Billing → ui-btn--secondary | High | Low |
| Current Plan (disabled) → ui-btn--secondary | High | Low |
| Plan card → ui-card with overrides | Medium | Medium — must preserve isCurrent / isRecommended |
| Upgrade CTA → ui-btn | Low | Medium — two gradients, no single primitive fit |
| Banner / badges / price / features | N/A | Leave as-is |

**Overall:** A **small Phase 4K limited to the two buttons** is low risk and appropriate. Broader card or CTA adoption should wait until overrides and/or variants are clearly defined to preserve subscription look and hierarchy.
