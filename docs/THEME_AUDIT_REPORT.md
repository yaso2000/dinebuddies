# DineBuddies Theme Audit & Classification Report

**Date:** 2025-03-08  
**Scope:** User Profile, Business Profile and their child components  
**Goal:** Document current theming/styling architecture — no redesign, no behavior change.

---

## A) File/Component Dependency Map

### User Profile Dependency Tree

```
Profile.jsx
├── useTheme() ─────────────────── ThemeContext.jsx (isDark, toggleTheme)
├── index.css (via main.jsx) ───── Global styles
├── ProfileEnhancements.jsx
│   ├── ProfileEnhancements.css
│   ├── CoverPhoto, StatisticsCards, Achievements
│   └── Statistics data (inline colors: #8b5cf6, #10b981, #f59e0b, #3b82f6)
├── ProfileEnhancementsExtended.jsx
│   ├── ProfileEnhancements.css (shared)
│   ├── FavoritePlaces
│   ├── SmartPlaceSearch.jsx
│   ├── MediaSelector.jsx → MediaUpload.css, UnifiedCamera
│   └── LocationAutocomplete.jsx
├── CreateInvitationSelector.jsx
│   └── CreateInvitationSelector.css
├── ImageUpload.jsx
│   └── ImageUpload.css
└── InvitationListItem (inline in Profile.jsx)
```

### Business Profile Dependency Tree

```
BusinessProfile.jsx
├── index.css (via main.jsx)
├── DeliveryLinksSection.jsx
├── BusinessHours.jsx
│   └── BusinessHours.css
├── EnhancedGallery.jsx
│   └── EnhancedGallery.css
├── EnhancedReviews.jsx
│   └── EnhancedReviews.css
├── MenuShowcase.jsx
│   └── MenuShowcase.css
├── GroupChat.jsx
│   └── CommunityChatRoom.css
├── ShareButtons.jsx
│   └── InstagramStoryTemplate.jsx
├── CreateInvitationSelector.jsx
│   └── CreateInvitationSelector.css
├── ServiceModal.jsx
├── PremiumBadge.jsx
├── PremiumPaywallModal.jsx
├── DraftSavedModal.jsx
├── BrandKit.jsx (business-pro/)
├── PlanBadge.jsx
└── colorUtils.js (getContrastText, lum)
```

**Theme propagation:** BusinessProfile passes BrandKit (`tc`, `th`) into EnhancedGallery, EnhancedReviews, MenuShowcase, BusinessHours. Profile uses `useTheme()` directly; BusinessProfile does not use ThemeContext.

---

## B) Grouped Theme Audit Report

### Foundations

| Item | Location | Status |
|------|----------|--------|
| **Colors** | | |
| `--primary`, `--primary-hover` | index.css `:root` | shared and reusable |
| `--luxury-gold`, `--premium-orange` | index.css | duplicated (alias primary) |
| `--text-main`, `--text-secondary`, `--text-muted` | index.css | shared and reusable |
| `--border-color` | index.css | shared and reusable |
| `--bg-body`, `--bg-card`, `--bg-input` | index.css | shared and reusable |
| `--bg-secondary` | Used in CSS but NOT defined in `:root` | broken for dark/light mode |
| `--transition-fast` | Referenced in index.css but NOT defined | broken |
| **Typography** | | |
| `--font-heading`, `--font-body`, `--font-arabic` | index.css | shared and reusable |
| `font-size: 15px` on body | index.css | hardcoded, should be token |
| `h1–h4` sizes (20px, 18px, 16px, 15px) | index.css | hardcoded |
| **Spacing** | | |
| `--header-height: 60px`, `--nav-height: 70px` | index.css | shared |
| `gap: 12px`, `padding: 8px 10px` etc. | Inline in Profile/BusinessProfile | hardcoded, should be tokenized |
| **Radius** | | |
| `--radius-sm`, `--radius-md`, `--radius-lg` | index.css | shared and reusable |
| `borderRadius: 12px`, `20px`, `50%` etc. | Inline everywhere | duplicated, should use tokens |
| **Shadows** | | |
| `--shadow-premium`, `--shadow-glow` | index.css | shared |
| `0 4px 12px rgba(...)`, `0 8px 24px` etc. | Profile, BusinessProfile, CSS | hardcoded and duplicated |
| **Borders** | | |
| `rgba(139, 92, 246, 0.08)` | index.css, multiple files | hardcoded |
| `1px solid var(--border-color)` | Various | shared |
| **Transitions** | | |
| `transition: all 0.2s` | Profile, ProfileEnhancements.css | hardcoded |
| `transition: all var(--transition-fast)` | index.css | broken (var undefined) |

---

### Shared UI Components

| Component | File | Status |
|-----------|------|--------|
| **Buttons** | | |
| `.btn`, `.btn-primary` | index.css | shared |
| `.edit-gallery-btn`, `.edit-menu-btn`, `.edit-hours-btn` | EnhancedGallery.css, MenuShowcase.css, BusinessHours.css | duplicated pattern |
| `.edit-*-btn.active` | EnhancedGallery.css, MenuShowcase.css | `#ef4444` hardcoded |
| **Inputs** | | |
| `.input-field` | index.css | shared |
| **Tabs** | | |
| Profile `activeTab` (public/private) | Profile.jsx | inline styles |
| BusinessProfile tabs (about, menu, etc.) | BusinessProfile.jsx | BrandKit-aware |
| **Badges** | | |
| Private/Public pills | Profile.jsx InvitationListItem | rgba(251,191,36), rgba(139,92,246) hardcoded |
| Stats labels (Reviews, Members, Invites) | BusinessProfile.jsx | `#fbbf24`, `#4f46e5`, `#22c55e` hardcoded |
| **Cards** | | |
| `.glass-card`, `.stat-card`, `.achievement` | index.css, ProfileEnhancements.css | shared |
| `.menu-item-card`, `.gallery-item` | MenuShowcase.css, EnhancedGallery.css | profile-specific |
| **Modals** | | |
| CreateInvitationSelector | CreateInvitationSelector.css | `rgba(2,6,23,0.85)` hardcoded |
| Header preview overlay | BusinessProfile.jsx | `#1e1e2e`, `rgba(0,0,0,0.8)` |
| **Menus** | | |
| Gallery move menu | EnhancedGallery.jsx | `#3b82f6`, `rgba(59,130,246,0.2)` |

---

### Profile Shared Groups

| Group | User Profile | Business Profile | Status |
|-------|--------------|------------------|--------|
| **Cover** | CoverPhoto (ProfileEnhancements) | BusinessProfile header | ProfileEnhancements: `#667eea`, `#764ba2`, `white`, `#1f2937`; BusinessProfile: BrandKit + `#1e1e2e`, `linear-gradient` |
| **Avatar/Logo** | Profile avatar | Business logo | Profile: inline; BusinessProfile: BrandKit, `rgba(255,255,255,0.25)` |
| **Identity block** | Name, bio | Business name, type | Both inline-heavy |
| **Action bar** | Edit/Save, theme toggle | Join, Create Invitation, Share | BusinessProfile uses BrandKit; Profile uses `var(--primary)` |
| **Stats blocks** | StatisticsCards | Reviews, Members, Invites | Profile: var(--accent); BusinessProfile: `#fbbf24`, `#4f46e5`, `#22c55e` hardcoded |
| **Section headers** | ProfileEnhancements.css | BusinessProfile tabs, section headers | ProfileEnhancements: var; BusinessProfile: mixed |
| **Section cards** | `.stat-card`, `.achievement` | Gallery, Menu, Reviews | Shared pattern, inconsistent tokens |
| **Media/Gallery** | N/A | EnhancedGallery | `#ef4444`, `#1a1a1a`, category colors hardcoded |
| **Reviews** | ProfileEnhancements review-item | EnhancedReviews | `#fbbf24`, `#d1d5db` in EnhancedReviews.css |

---

### User Profile Only

- Cover upload button: `background: white`, `color: #1f2937` (ProfileEnhancements.css) — broken for dark mode
- Cover settings button: `background: rgba(255,255,255,0.95)` — broken for dark mode
- Interest chips, gender selects: `rgba(139,92,246,0.15)` — hardcoded
- Achievement gold: `rgba(251,191,36,0.3)` — hardcoded
- Sign-out button: `#ef4444` — hardcoded

---

### Business Profile Only

- Stats labels: `#fbbf24`, `#4f46e5`, `#22c55e` — hardcoded, not theme-aware
- Tab hover: `#8b5cf6`, `#f59e0b`, `#22c55e` — hardcoded
- Header preview modal: `#1e1e2e`, `rgba(0,0,0,0.6)` — hardcoded
- Join/Create Invitation buttons: BrandKit-aware but fallbacks hardcoded
- Service add form: `#ef4444`, `#10b981` — hardcoded
- Draft banner: `rgba(245,158,11,...)` — hardcoded

---

### Dark/Light Theme Handling

| Item | Status |
|------|--------|
| **ThemeProvider** | ThemeContext.jsx sets `data-theme` on `document.documentElement` |
| **CSS variables** | `:root` + `[data-theme='light']` in index.css |
| **body theme** | `body.classList.toggle('light-mode')` but `.light-mode` rarely targeted |
| **Profile** | Uses `useTheme()`; some `isDark ? 'var(--luxury-gold)' : 'var(--primary)'` |
| **BusinessProfile** | Does not use useTheme; relies on BrandKit only |
| **ProfileEnhancements.css** | `white`, `#1f2937` on cover buttons — broken for light mode (dark text on dark bg) |
| **MenuShowcase.css** | `.category-btn.active { background: white; color: #1a1a1a }` — broken for light mode |
| **CreateInvitationSelector.css** | `#f1f5f9`, `#e2e8f0` — light-theme specific, not scoped |

---

## C) Proposed Shared Grouping Model for Future Refactor

```
┌─────────────────────────────────────────────────────────────────┐
│ THEME LAYER                                                      │
├─────────────────────────────────────────────────────────────────┤
│ 1. Tokens (index.css :root / [data-theme])                       │
│    - color, typography, spacing, radius, shadow, border          │
│    - Define --bg-secondary, --transition-fast                    │
├─────────────────────────────────────────────────────────────────┤
│ 2. Base Components (index.css or components/base/)               │
│    - .btn, .btn-primary, .btn-outline, .btn-sm                   │
│    - .input-field, .form-group                                   │
│    - .glass-card, .stat-card                                     │
├─────────────────────────────────────────────────────────────────┤
│ 3. Profile Shared Components                                     │
│    - Cover block (cover overlay, upload, settings)               │
│    - Identity block (avatar, name, badges)                       │
│    - Stats row (Reviews, Members, Invites — shared tokens)       │
│    - Section card (header + content)                             │
│    - Action bar (primary/secondary buttons)                      │
├─────────────────────────────────────────────────────────────────┤
│ 4. Profile Variants                                              │
│    - User Profile: interests, achievements, invitations          │
│    - Business Profile: BrandKit override, gallery, menu, reviews │
└─────────────────────────────────────────────────────────────────┘
```

**Shared tokens to introduce:**
- `--stat-reviews`, `--stat-members`, `--stat-invites` (or single `--stat-accent` with variants)
- `--radius-card`, `--radius-pill`, `--radius-avatar`
- `--shadow-card`, `--shadow-modal`
- `--spacing-xs` … `--spacing-xl`
- `--transition-fast`, `--transition-normal`

---

## D) Top 20 Highest-Priority Hardcoded Styling Problems

| # | Priority | Location | Problem | Fix |
|---|----------|----------|---------|-----|
| 1 | Critical | index.css | `--bg-secondary` used but never defined | Add to `:root` and `[data-theme='light']` |
| 2 | Critical | index.css | `--transition-fast` used but never defined | Add `--transition-fast: 0.2s` to `:root` |
| 3 | High | ProfileEnhancements.css | Cover buttons `background: white`, `color: #1f2937` | Use `var(--bg-card)`, `var(--text-main)` |
| 4 | High | MenuShowcase.css | `.category-btn.active { background: white; color: #1a1a1a }` | Use `var(--bg-card)`, `var(--text-main)` |
| 5 | High | BusinessProfile.jsx | Stats labels `#fbbf24`, `#4f46e5`, `#22c55e` | Introduce `--stat-reviews`, `--stat-members`, `--stat-invites` |
| 6 | High | Profile.jsx | Private/Public pills rgba(251,191,36), rgba(139,92,246) | Use token + alpha or semantic vars |
| 7 | High | EnhancedGallery.css, MenuShowcase.css | `.edit-*-btn.active { background: #ef4444 }` | Use `var(--danger)` or token |
| 8 | High | EnhancedReviews.css | `#fbbf24`, `#d1d5db` for stars | Use `var(--rating-filled)`, `var(--rating-empty)` |
| 9 | High | ProfileEnhancements.jsx | `defaultCover = linear-gradient(#667eea, #764ba2)` | Use theme gradient token |
| 10 | Medium | Profile.jsx | Delete/sign-out `#ef4444` | Tokenize danger color |
| 11 | Medium | BusinessProfile.jsx | Header preview `#1e1e2e`, `rgba(0,0,0,0.6)` | Use `var(--bg-card)`, `var(--overlay)` |
| 12 | Medium | Profile.jsx | Gender/interest selects `rgba(139,92,246,...)` | Use `var(--primary)` with alpha |
| 13 | Medium | DeliveryLinksSection, ShareButtons | `#8b5cf6`, `#a78bfa`, `linear-gradient(#8b5cf6,#ec4899)` | Use `var(--primary)` or BrandKit |
| 14 | Medium | CreateInvitationSelector.css | `rgba(2,6,23,0.85)`, `#f1f5f9` | Use theme vars |
| 15 | Medium | BusinessProfile.jsx | Tab hover colors `#8b5cf6`, `#f59e0b`, `#22c55e` | Centralize in BrandKit or tokens |
| 16 | Medium | EnhancedGallery.jsx | CATEGORIES colors `#f59e0b`, `#3b82f6`, etc. | Tokenize category palette |
| 17 | Medium | Profile.jsx | Achievement/green `#48bb78`, `rgba(72,187,120,...)` | Add `--success` token |
| 18 | Low | Multiple | `borderRadius: 12px`, `20px`, `8px` inline | Replace with `var(--radius-md)`, etc. |
| 19 | Low | Multiple | `boxShadow: 0 4px 12px rgba(0,0,0,0.1)` | Replace with `var(--shadow-card)` |
| 20 | Low | ProfileEnhancements.css | `rgba(244,63,94,0.1)` remove-place-btn | Use semantic danger token |

---

## Summary

- **No Tailwind.** Plain CSS + inline styles.
- **No styled-components.** Uses global CSS and component-level CSS files.
- **ThemeContext** exists; Profile uses it, BusinessProfile does not.
- **BrandKit** (businessInfo.brandKit) drives BusinessProfile visuals; many fallbacks are hardcoded.
- **CSS variables** are partially defined; `--bg-secondary` and `--transition-fast` are missing.
- **Cover, avatar, stats, section cards** have overlapping patterns but no shared component/token set.
- **Light theme** has overrides in index.css but several components still use dark-only values.

**Recommended next steps (post-audit):**
1. Define missing tokens (`--bg-secondary`, `--transition-fast`, `--danger`, `--success`, stat colors).
2. Add light-theme rules for ProfileEnhancements cover buttons and MenuShowcase active tab.
3. Introduce shared profile block components (cover, stats row, section card).
4. Gradually replace top 20 hardcoded values with tokens.
