# Phase 1B Output — Shared Profile Theming Layer

**Date:** 2025-03-11  
**Scope:** Profile.jsx, BusinessProfile.jsx — shared wrapper structure only  
**Constraints:** No redesign, no business logic changes, no invitation flow changes

---

## A) Files Created

| File | Purpose |
|------|---------|
| `src/styles/profile-shared.css` | Shared profile semantic classes and tokens |

---

## B) Files Modified

| File | Changes |
|------|---------|
| `src/main.jsx` | Import `./styles/profile-shared.css` |
| `src/pages/Profile.jsx` | Added profile-shell, profile-content, profile-identity, profile-stats, profile-stats-item, profile-stats-value, profile-stats-label, profile-actions-row, profile-card |
| `src/pages/BusinessProfile.jsx` | Added profile-shell, profile-header, profile-stats, profile-actions, profile-content, profile-section-content, profile-card profile-card-lg, profile-section-header |

---

## C) Shared Profile Groups Implemented

| Group | Class | Usage |
|-------|-------|-------|
| **profile-shell** | `.profile-shell` | Outer page wrapper; padding-bottom, background, min-height |
| **profile-content** | `.profile-content` | Main content area; horizontal padding |
| **profile-header** | `.profile-header` | Hero/cover structure; flex column, centered |
| **profile-identity** | `.profile-identity` | Avatar + name + metadata block; text-center, margin |
| **profile-stats** | `.profile-stats` | Stats row container; flex, gap, margin-bottom |
| **profile-stats-item** | `.profile-stats-item` | Single stat block |
| **profile-stats-value** | `.profile-stats-value` | Stat number |
| **profile-stats-label** | `.profile-stats-label` | Stat label (e.g. "Reviews", "Members") |
| **profile-actions** | `.profile-actions` | Action buttons column; gap, width, margin-bottom |
| **profile-actions-row** | `.profile-actions-row` | Action buttons row; flex, gap, margin-bottom |
| **profile-section** | `.profile-section` | Section wrapper; margin-bottom |
| **profile-section-content** | `.profile-section-content` | Section content; flex column, gap |
| **profile-section-header** | `.profile-section-header` | Section title (h3); size, weight, color |
| **profile-card** | `.profile-card` | Content card surface; bg, border, radius, padding, shadow |
| **profile-card-lg** | `.profile-card-lg` | Larger card variant; radius 24px, padding 24px |

---

## D) Unified Parts Between Profile.jsx and BusinessProfile.jsx

| Shared Group | Profile.jsx | BusinessProfile.jsx |
|--------------|-------------|---------------------|
| **profile-shell** | ✓ Outer wrapper | ✓ Outer wrapper (combined with page-container) |
| **profile-content** | ✓ Wraps personal-view | ✓ Content area (tabs + sections) |
| **profile-header** | Not used (Profile uses personal-view structure) | ✓ Hero/cover wrapper |
| **profile-identity** | ✓ Avatar + name block | Not used (Business uses logo+name in header) |
| **profile-stats** | ✓ Followers/Following row | ✓ Reviews/Members/Invites row |
| **profile-actions** | Not used (actions use profile-actions-row) | ✓ Join + Create Invitation |
| **profile-actions-row** | ✓ Edit + Create Invitation | N/A (uses profile-actions column) |
| **profile-card** | ✓ Invitations tabs card | ✓ About card (with profile-card-lg) |
| **profile-section-content** | Not used | ✓ About tab sections |
| **profile-section-header** | Not used | ✓ "About Us" h3 |

---

## E) Page-Specific Differences (Kept as Variants)

| Aspect | Profile.jsx | BusinessProfile.jsx |
|--------|-------------|---------------------|
| **Header** | personal-view; theme toggle; avatar center | profile-header; cover image; logo+name overlay; BrandKit |
| **Stats** | Followers/Following (2 items) | Reviews/Members/Invites (3 items); BrandKit badgeBg |
| **Actions** | Edit, Create Invitation (row) | Join Community, Create Invitation (column); BrandKit joinBtnBg |
| **Sections** | StatisticsCards, Achievements, FavoritePlaces | Tabs (About, Menu, Services, Hours, Contact); EnhancedGallery, EnhancedReviews, MenuShowcase |
| **Card styling** | profile-card (base) | profile-card + profile-card-lg; BrandKit cardBg, border, shadow |

---

## F) Hardcoded Values Replaced in Phase 1B

| Location | Replaced | With |
|----------|----------|------|
| Profile.jsx outer wrapper | `paddingBottom: '100px'` | `profile-shell` (--profile-shell-padding-bottom) |
| Profile.jsx content | `padding: '0 1rem 1rem'` | `profile-content` |
| Profile.jsx stats | Inline flex/gap styles | `profile-stats`, `profile-stats-item`, `profile-stats-value`, `profile-stats-label` |
| Profile.jsx actions | `display: flex; gap: 12px; marginBottom: 1rem` | `profile-actions-row` |
| Profile.jsx invitations card | `background, padding, borderRadius, border` | `profile-card` |
| BusinessProfile.jsx shell | `paddingBottom: '100px'` | `profile-shell` |
| BusinessProfile.jsx header | Inline flex structure | `profile-header` |
| BusinessProfile.jsx stats box | Inline styles | `profile-stats` + BrandKit overrides |
| BusinessProfile.jsx actions | Inline column layout | `profile-actions` |
| BusinessProfile.jsx content area | `padding: '0 1rem 2rem 1rem'` | `profile-content` + var(--profile-content-padding) |
| BusinessProfile.jsx About card | Inline card styles | `profile-card profile-card-lg` + BrandKit overrides |

---

## G) Deferred for Phase 1C (Child Components)

- StatisticsCards, Achievements, FavoritePlaces (ProfileEnhancements)
- EnhancedGallery, EnhancedReviews, MenuShowcase (BusinessProfile)
- InvitationListItem styling
- Tab buttons (profile-tab-btn, BusinessProfile tab pills)
- Cover photo upload buttons (ProfileEnhancements CoverPhoto)
- Gender/age selects, interest chips (Profile.jsx)
- Subscription/credits cards
- DeliveryLinksSection, BusinessHours, GroupChat
- Draft banner, Service add form
- Any invitation flow logic or modals

---

## H) Risky Areas Left Untouched

- BrandKit (`tc`, `th`) — BusinessProfile continues to use for badgeBg, border, accent, etc.
- Theme toggle button (Profile.jsx) — inline styles retained
- Header preview overlay (BusinessProfile) — modal styles unchanged
- Tab bar styling (BusinessProfile) — sticky tabs with BrandKit
- All child component internals (EnhancedGallery, MenuShowcase, etc.)
- Page-container (Layout) — not modified
- Invitation flow and CreateInvitationSelector

---

## Summary

Phase 1B introduced a shared profile layer with semantic classes and tokens. Both Profile.jsx and BusinessProfile.jsx now use:

- `profile-shell` for page wrapper
- `profile-content` for main content padding
- `profile-stats` for stats rows
- `profile-card` for content surfaces
- `profile-actions` / `profile-actions-row` for action areas
- `profile-header`, `profile-identity`, `profile-section-*` where applicable

Visual output remains aligned with the current app. BusinessProfile BrandKit overrides apply on top of shared tokens. No invitation logic or child internals were refactored.
