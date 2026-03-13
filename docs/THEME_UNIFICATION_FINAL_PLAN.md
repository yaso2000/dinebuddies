# DineBuddies — Final Theme Unification Plan

**Document type:** Architecture-level plan (not a one-off fix pass).  
**Goal:** Single theming system for visual styling across light and dark mode.  
**Last updated:** 2025-03-08

---

## Executive Summary

This plan defines the **final architecture** for theme unification: **ui-primitives** as the only global visual primitive layer; **profile-shared** as layout/structure only; **BrandKit** as accent overrides only; and **removal of legacy visual systems** (.btn, .input-field, duplicate local cards/buttons/tabs, hardcoded colors/shadows/borders). Light-theme issues are treated as architecture problems, not page-specific patches.

---

## Phase A: Full Codebase Light-Theme Defect Audit

### A.1 Light-mode defect sources (classified)

| Source category | Examples | Impact on light theme |
|-----------------|----------|------------------------|
| **Legacy class** | .btn, .btn-primary, .input-field, .form-group, .back-btn, .submit-btn | Often no explicit `[data-theme='light']` overrides; rely on :root vars. If vars are dark-biased, legacy components can have low contrast or wrong surfaces in light. |
| **Hardcoded color** | Hex/rgba in JSX (e.g. `#9ca3af`, `#334155`, `rgba(139,92,246,0.3)`, `#8b5cf6`, `#ef4444`) | Bypass theme tokens; fixed appearance in both themes; common in BusinessProfile (BrandKit fallbacks), admin (inline danger/success), Chat, CommunityChatRoom. |
| **BrandKit override** | th(tc?.joinBtnBg, 'linear-gradient(135deg, #8b5cf6, #f97316)'), th(tc?.btnShadow, '0 8px 24px rgba(139,92,246,0.3)') | Full visual system for business profile; fallbacks are hardcoded; light theme not explicitly handled in BrandKit. |
| **Duplicate local style** | .back-btn in index.css, Notifications.css, Chat.css, SettingsPages.css, ChatList.css, PrivateInvitation.css; .form-group in index.css, EditBusinessProfile.css, MenuShowcase.css, SettingsPages.css | Inconsistent light/dark behavior per page; light overrides scattered or missing. |
| **State style mismatch** | .input-field:focus uses `background: rgba(30, 41, 59, 0.8)` (dark) in index.css | Focus state stays dark in light theme. |
| **Weak borders/shadows** | --border-color in light set to rgba(15, 23, 42, 0.12); some cards use only border, no shadow | Light theme can look flat or elements can disappear on light bg. |

### A.2 Full defect inventory (by area)

| Area | Legacy / hardcoded / duplicate | Light-theme risk |
|------|-------------------------------|-------------------|
| **index.css** | .btn, .btn-primary (purple glow in hover), .form-group, .input-field (focus bg hardcoded dark), .back-btn; :root has dark defaults; [data-theme='light'] overrides only a subset of components (header, glass-card, app-container, bottom-nav, etc.) | .btn / .input-field / .form-group have no explicit light overrides. Body/html gradient forced with !important. |
| **profile-shared.css** | profile-stats-value color: var(--primary); profile-stat-label color: var(--text-muted); profile-theme-toggle, profile-add-story-btn, profile-subscription-* (visual mix with layout) | Tokens used; light theme depends on index.css [data-theme='light'] vars. |
| **BusinessProDashboard.css** | .bpro-* full visual system (sidebar, card, btn-primary, btn-secondary, stat-card, table, empty, spinner) with many hardcoded colors/shadows | No [data-theme='light'] block; bpro uses rgba/hex in file. |
| **admin.css** | .admin-btn, .admin-btn-primary/secondary/danger/success/sm, .admin-input, .admin-search-input | Admin has its own palette; no documented light theme. |
| **Profile.jsx** | profile-* (layout + visual), profile-subscription-upgrade-btn (gradient), profile-theme-toggle, profile-add-story-btn; form-group; ui-btn already used for main actions | Layout profile-* OK; custom buttons and form-group need token-only or ui-*. |
| **BusinessProfile.jsx** | Heavy inline styles with th(tc?.) and hardcoded fallbacks (gradients, shadows, join/invite CTAs); profile-stats, profile-section-header; some ui-* already | BrandKit fallbacks and inline visuals bypass theme in light mode. |
| **CreateInvitation.jsx** | form-group, input-field, many inline styles; one ui-form-surface | .input-field:focus dark bg in light theme. |
| **CreatePrivateInvitation.jsx** | form-group, elegant-input, private-back-btn; ui-btn in places | Same as CreateInvitation. |
| **InvitationTimeline** | btn btn-primary, btn btn-secondary | Legacy .btn; no light-specific rules. |
| **FriendsFeed, CompleteProfile** | .btn .btn-primary, .btn-block | Legacy .btn. |
| **Chat / CommunityChatRoom / GroupChat** | back-btn, header-back-btn, send-btn-circle, voice-play-btn, composer-icon-btn, message-input, chat-input-field | Many page-local classes; hardcoded #9ca3af etc. in CommunityChatRoom. |
| **Settings subpages** | back-btn, submit-btn (SettingsPages.css); some already ui-btn | .submit-btn and .back-btn duplicated; light overrides in SettingsPages for back-btn. |
| **MyCommunity** | back-btn, my-community-btn (--story, --post, --chat) | Local button system. |
| **Layout / Notifications / Email / Language / Privacy / Password / Billing / Payment / Subscription** | back-btn, submit-btn, admin-btn (where applicable) | back-btn and submit-btn repeated across many CSS files. |
| **Admin (all)** | admin-btn-*, admin-input, admin-search-input; inline style overrides (e.g. #dc2626, #3b82f6) in UserManagement, BusinessManagement | Second full visual system; hardcoded colors. |
| **Pro pages (already partially migrated)** | bpro-card, bpro-stat-card, bpro-btn-* still in use where not yet replaced; BusinessProDashboard.css | bpro-* has no light theme block. |
| **Components (MenuShowcase, EnhancedGallery, OfferEditor, etc.)** | form-group, item-action-btn, gallery-action-btn, publish-btn, auth-input, sc-input, link-input, time-input, comment-input | Per-component visual classes; some hardcoded colors. |

### A.3 Hardcoded value audit (summary)

- **index.css:** :root and [data-theme='light'] define tokens; .input-field:focus uses hardcoded `rgba(30, 41, 59, 0.8)`; .btn-primary:hover uses `rgba(139, 92, 246, 0.5)`; html/body use hardcoded gradients with !important.
- **JSX inline styles:** 100+ files with style={{ }} containing color, background, border, or boxShadow; BusinessProfile.jsx, admin pages, Chat, and InvitationDetails have the highest counts. Many use hex/rgba instead of var(--*).
- **BusinessProDashboard.css:** bpro-* uses many rgba/hex values for sidebar, cards, buttons, stats.
- **profile-shared.css:** Mostly var(--*) except a few (e.g. profile-subscription-upgrade-btn gradient in comment ref).
- **admin.css:** admin-btn-* use fixed colors (no theme vars).

---

## Phase B: Final Source-of-Truth Mapping

### B.1 Layer ownership

| Layer | Owns | Does not own |
|-------|------|------------------|
| **ui-primitives.css** | All visual primitives: cards, buttons, form fields, form labels, tabs, prompts, banners. Colors, borders, shadows, backgrounds must come from CSS custom properties (e.g. var(--bg-card), var(--text-main), var(--border-color), var(--primary)). | Layout (flex/grid structure, spacing tokens for page structure). |
| **profile-shared.css** | Layout and structure only: profile-shell, profile-content, profile-header, profile-identity, profile-stats (grid/flex), profile-section-content, profile-section-header, profile-actions-row, profile-section-body, profile-meta-row. Spacing tokens (--profile-*). Semantic wrappers that do not set color/background/border/shadow. | Visual primitives (card look, button look, form field look). Any profile-* that sets color, background, border, box-shadow beyond a single token (e.g. profile-stat-value color) should be refactored: either move to ui-primitives or use only tokens. |
| **BrandKit (BusinessProfile / tc)** | Accent overrides only: primary/accent color, optional button gradient, optional shadow for CTAs. Must be applied via tokens or override only specific properties (e.g. --primary, --btn-shadow) for that page, not a full second visual system. | Full button/card/form styling; hardcoded fallbacks that ignore theme. |
| **bpro-* (BusinessProDashboard.css)** | Feature-specific layout for Pro shell (sidebar, main, header, content grid). After migration: only layout (flex, grid, spacing). Visual appearance (card bg, button style, stat color) must come from ui-primitives + tokens. | Standalone visual system (bpro-card, bpro-btn-primary, bpro-stat-card visuals). |
| **admin-* (admin.css)** | Feature-specific layout for admin shell. After migration: admin layout only; buttons/inputs should use ui-btn / ui-form-field or a single admin theme token set that respects [data-theme]. | Standalone palette (admin-btn-primary with fixed hex); inline hardcoded colors in admin JSX. |
| **index.css** | Global tokens (:root, [data-theme='light'], [data-theme='dark']), base typography, app-layout structure, and legacy helpers only until removed. | Legacy .btn, .input-field, .form-group, .back-btn, .submit-btn as long-term visual source (must migrate and remove). |

### B.2 Token ownership

- **Global tokens** (index.css :root and [data-theme]) own: --bg-body, --bg-card, --bg-input, --bg-main, --hover-overlay, --text-main, --text-primary, --text-secondary, --text-muted, --border-color, --primary, --shadow-premium, --shadow-glow, --color-danger, --color-success, etc.
- **ui-primitives** must use only these (or tokens defined in index.css) for colors, borders, shadows, backgrounds. No new hardcoded values in ui-primitives.css.
- **profile-shared** may use only layout tokens (--profile-*-padding, --profile-section-gap, etc.) and global tokens for any remaining visual (e.g. profile-stat-value → var(--primary)); no hex/rgba in profile-shared for visuals.
- **BrandKit** may inject or override a small set of tokens (e.g. --primary, --btn-shadow) for BusinessProfile only; fallbacks must use global tokens, not hex.

---

## Phase C: Codebase-Wide Migration Plan by Page/Area

### C.1 Buttons

| Current | Target | Pages / components |
|---------|--------|---------------------|
| .btn .btn-primary / .btn-secondary / .btn-outline | ui-btn ui-btn--primary / ui-btn--secondary / ui-btn--ghost | InvitationTimeline, FriendsFeed, CompleteProfile |
| .back-btn | ui-btn ui-btn--ghost (or new ui-btn--back if needed) + token-only styles | All Settings subpages, ChatList, Chat, MyCommunity, NotificationsSettings, LanguageSettings, EmailSettings, PrivacySettings, PasswordSettings, BillingSettings, PaymentSettings, SubscriptionSettings, AdminPanel, UserProfile, CreatePrivateInvitation (private-back-btn) |
| .submit-btn | ui-btn ui-btn--primary (or --secondary where appropriate) | EmailSettings, SubscriptionSettings, PaymentSettings, PasswordSettings (already combined with ui-btn in some), PrivacySettings |
| .admin-btn, .admin-btn-primary, etc. | ui-btn variants + admin layout class, or dedicated admin token set that respects theme | All admin pages (AdminHome, AdminSettings, AdminNotifications, InvitationManagement, ReportsAnalytics, MigrationTools, AdminSystemTools, QuickAdminSetup, Communications, Plans, UserManagement, BusinessManagement, SubscriptionManagement, AdminChatCommunity) |
| .ds-create-btn | ui-btn ui-btn--primary | Layout.jsx |
| .private-back-btn | ui-btn ui-btn--ghost | CreatePrivateInvitation.jsx |
| .my-community-btn, .header-back-btn, .settings-back-btn | ui-btn + modifier class for layout (e.g. icon-only) or ui-btn--ghost | MyCommunity, CommunityChatRoom, Settings |
| .gallery-action-btn, .item-action-btn, .add-item-btn, .publish-btn | ui-btn (appropriate variant) where semantics match | EnhancedGallery, MenuShowcase, OfferEditor |
| .voice-play-btn, .send-btn-circle, .composer-icon-btn, .delete-recording-btn | Keep as feature-specific only if chat UX requires; otherwise ui-btn--ghost with tokens | CommunityChatRoom, Chat (evaluate per button) |
| profile-subscription-upgrade-btn, profile-theme-toggle, profile-add-story-btn | Keep in profile-shared but restyle using only tokens; or add ui-btn variant (e.g. ui-btn--icon) and use that | Profile.jsx |
| BusinessProfile Join / Create Invitation (inline) | ui-btn--primary / ui-btn--secondary + BrandKit override via token (e.g. --business-cta-bg) or data attribute; remove full inline visual object | BusinessProfile.jsx |
| options-btn, icon-btn | ui-btn ui-btn--ghost | Chat, CreatePost, etc. |

### C.2 Form fields and labels

| Current | Target | Pages / components |
|---------|--------|---------------------|
| .input-field | ui-form-field | CreateInvitation, CreatePrivateInvitation, Profile (already done for edit form), PasswordSettings (input wrappers), LocationAutocomplete, CompleteProfile |
| .form-group label | ui-form-label (and keep .form-group as layout wrapper or replace with div + gap) | CreateInvitation, CreatePrivateInvitation, MenuShowcase, CompleteProfile, EmailSettings, BusinessHours, Profile (remaining), EditBusinessProfile |
| .admin-input, .admin-search-input | ui-form-field (and admin layout class if needed) | Admin: Plans, AdminSettings, AdminNotifications, Communications, InvitationManagement, UserManagement, BusinessManagement, SubscriptionManagement, AdminLayout |
| .elegant-input, .auth-input, .sc-input, .time-input, .link-input, .message-input, .chat-input-field, .comment-input, .search-input | ui-form-field where semantics are “text input”; keep only layout/specific behavior in local class | CreatePrivateInvitation, QuickLogin, social-creator, BusinessHours, ProfileEnhancementsExtended, GroupChat, CommunityChatRoom, PostCard, Home |
| select.input-field | ui-form-field (select styling in ui-primitives or token-based in index) | CreateInvitation |
| .password-input-wrapper | Keep as structure; inner input → ui-form-field | PasswordSettings |

### C.3 Cards and surfaces

| Current | Target | Pages / components |
|---------|--------|---------------------|
| .bpro-card, .bpro-stat-card | ui-card, or ui-card + bpro layout class (structure only) | BusinessProDashboard, Pro pages that still use bpro-* for cards |
| Local card classes (e.g. .glass-card, .smart-invitation-card, .ds-widget-card) | Prefer ui-card + modifier or token-only overrides; ensure [data-theme='light'] has token overrides for these if they stay | index.css, Layout |
| Any div with inline background/border/shadow that acts as a card | ui-card + style overrides only for layout (margin, padding), not color/border/shadow | Audit per page |

### C.4 Prompts, banners, tabs

| Current | Target | Pages / components |
|---------|--------|---------------------|
| bpro-empty, local empty states | ui-prompt or ui-prompt--standalone where content is “empty state” | Pro pages, any remaining empty states |
| Local warning/amber banners | ui-banner--warning | Where semantics match |
| profile-tabs / profile-tab (structure) | Already ui-tab in Profile/BusinessProfile; ensure profile-shared only provides layout if any | Profile.jsx, BusinessProfile.jsx |
| admin tabs (e.g. Plans, InvitationManagement) | ui-tabs / ui-tab + admin layout | Admin pages |

### C.5 Hardcoded values → tokens

| Location | Action |
|----------|--------|
| index.css .input-field:focus | background: var(--bg-input) or new --input-focus-bg; remove rgba(30, 41, 59, 0.8). |
| index.css .btn-primary:hover | box-shadow: var(--shadow-glow) or --btn-primary-hover-shadow; define in :root and [data-theme='light']. |
| All JSX style={{ color: '#...', background: '...' }} | Replace with var(--text-main), var(--bg-card), etc., or move to CSS class using tokens. |
| BusinessProfile.jsx th(tc?...., 'fallback') | Fallbacks must be token-based (e.g. var(--primary), var(--bg-card)); remove hex/rgba fallbacks. |
| BusinessProDashboard.css .bpro-* | Replace every color/background/border/shadow with var(--*); add [data-theme='light'] block for bpro layout if needed. |
| admin.css .admin-btn-* | Define --admin-primary, --admin-danger, etc. in index.css for both themes; use in admin.css. Or migrate to ui-btn and use global tokens. |
| profile-shared.css | Audit; any remaining visual (e.g. profile-stat-value color) use var(--primary) only; no hex. |

### C.6 Light/dark normalization

- Ensure every primitive and legacy-replacement class has defined behavior in both [data-theme='light'] and [data-theme='dark'] (or :root).
- Add [data-theme='light'] overrides for: .btn, .btn-primary, .input-field, .form-group label, .back-btn, .submit-btn (until removed), and any .bpro-* that remain after migration.
- Ensure ui-primitives use only tokens that are set in both themes in index.css.

---

## Phase D: Deletion and Cleanup

### D.1 Forbidden legacy visual patterns (do not use after migration)

| Forbidden | Reason |
|-----------|--------|
| .btn, .btn-primary, .btn-secondary, .btn-outline, .btn-sm as primary styling | Replaced by ui-btn variants. |
| .input-field as primary input styling | Replaced by ui-form-field. |
| .form-group label with custom color/font without ui-form-label | Replaced by ui-form-label or token-only label. |
| .back-btn, .submit-btn as custom visual systems | Replaced by ui-btn; back/submit are semantics, not visual. |
| New page-local classes that duplicate card/button/form visuals | Use ui-*; local class only for layout or feature-specific structure. |
| Inline style={{ color: '...', background: '...', border: '...', boxShadow: '...' }} except documented exceptions (e.g. dynamic width/height) | Use tokens in CSS or className. |
| Hardcoded hex/rgba in CSS or JS for colors, backgrounds, borders, shadows | Use var(--*). |
| BrandKit providing full button/card styling (gradient, shadow, border) instead of accent overrides | BrandKit only overrides accent tokens. |
| profile-* classes that set color, background, box-shadow, border (beyond one token) | profile-shared is layout only; use ui-* or tokens. |
| bpro-* or admin-* as full visual system | bpro/admin only layout; visuals from ui-primitives + tokens. |

### D.2 Cleanup / deletion list (after migration)

| Item | Action |
|------|--------|
| .btn, .btn-primary, .btn-secondary, .btn-outline, .btn-sm (index.css) | Remove after all usages migrated to ui-btn. |
| .input-field, .form-group (index.css) | Remove .input-field after migration to ui-form-field; .form-group can become a layout-only wrapper (no visual) or be removed if replaced by flex/grid + ui-form-label. |
| .back-btn (index.css + Notifications.css, Chat.css, SettingsPages.css, ChatList.css, NotificationsSettings.css) | Remove; replace all with ui-btn--ghost or ui-btn--back. |
| .submit-btn (SettingsPages.css, etc.) | Remove; replace with ui-btn--primary. |
| .private-back-btn (PrivateInvitation.css) | Remove; use ui-btn. |
| .ds-create-btn (index.css) | Remove; use ui-btn--primary. |
| Duplicate .form-group / .input-field rules in EditBusinessProfile.css, MenuShowcase.css, SettingsPages.css | Remove duplicates; use global (until removed) or ui-* only. |
| .bpro-btn-primary, .bpro-btn-secondary, .bpro-card (visual), .bpro-stat-card (visual), .bpro-empty (visual) | Remove from BusinessProDashboard.css after Pro pages use ui-card, ui-btn, ui-prompt. |
| .admin-btn, .admin-btn-primary, etc. (admin.css) | Remove or reduce to layout-only after admin uses ui-btn or single token set. |
| Dead profile-* aliases | Already removed in Phase 5D/5E; none left in ui-primitives. |
| Unused tokens | Audit :root and [data-theme]; remove tokens that are no longer referenced. |
| Any CSS file that only contained legacy visual classes (after migration) | Remove or trim to layout only. |

### D.3 Document final architecture

- **docs/THEMING_MIGRATION_GUIDE.md** (or new **THEME_ARCHITECTURE.md**): State that (1) ui-primitives is the only global visual primitive layer, (2) profile-shared is layout only, (3) BrandKit is accent only, (4) no hardcoded visual values, (5) light/dark are token-driven, (6) list forbidden patterns and token ownership.
- **index.css** header: Document that :root and [data-theme] are the single source of theme tokens; legacy .btn/.input-field are deprecated and scheduled for removal.
- **ui-primitives.css** header: Already states no profile-* aliases; add “no hardcoded colors/shadows/borders; use tokens only.”

---

## Phase E: Final Recommendation on Execution Order

### E.1 Recommended order (high level)

1. **Token and light-theme baseline (index.css)**  
   - Add [data-theme='light'] overrides for .btn, .input-field, .form-group (and any .back-btn/.submit-btn that remain temporarily).  
   - Replace hardcoded values in .input-field:focus and .btn-primary:hover with tokens.  
   - Ensures legacy components improve in light mode while migration proceeds.

2. **Centralize and reduce duplicate legacy CSS**  
   - Consolidate .back-btn and .submit-btn into a single set of rules in index.css (or one legacy file) using tokens; remove duplicates from Notifications.css, Chat.css, SettingsPages.css, etc.  
   - Reduces drift and makes eventual removal easier.

3. **Migration by area (in parallel where possible)**  
   - **Settings cluster:** back-btn, submit-btn → ui-btn (already partially done).  
   - **Invitation cluster:** InvitationTimeline, CreateInvitation, CreatePrivateInvitation → ui-btn, ui-form-field, ui-form-label; remove .input-field/:focus hardcoding.  
   - **Profile/Community:** Profile.jsx (remaining profile visual → tokens), MyCommunity (my-community-btn → ui-btn), FriendsFeed, CompleteProfile (btn → ui-btn).  
   - **BusinessProfile:** Replace inline CTAs and BrandKit fallbacks with ui-btn + token overrides; ensure th() fallbacks use var(--*).  
   - **Pro shell:** Replace remaining bpro-card, bpro-btn-*, bpro-stat-card, bpro-empty with ui-card, ui-btn, ui-prompt; move bpro-* to layout only in BusinessProDashboard.css.  
   - **Admin:** Either migrate admin-btn to ui-btn + admin layout or define admin token set in index.css and refactor admin.css to use it; remove inline hex in admin JSX.  
   - **Chat/Composer:** back-btn, header-back-btn → ui-btn; composer/send/voice buttons decide per UX (keep feature-specific or ui-btn--ghost).  
   - **Layout / CreatePost / OfferEditor / MenuShowcase / EnhancedGallery:** ds-create-btn, icon-btn, gallery-action-btn, item-action-btn, publish-btn → ui-btn; form-group/input-field → ui-form-* where applicable.

4. **Hardcoded value removal**  
   - Pass over BusinessProfile.jsx, admin pages, Chat, CommunityChatRoom, and any high-count inline style files; replace color/background/border/boxShadow with tokens or classes.

5. **profile-shared visual audit**  
   - Ensure every profile-* rule is layout-only or uses a single token (e.g. color: var(--primary)); move any remaining visual to ui-primitives or tokens.

6. **Deletion and cleanup**  
   - Remove legacy .btn, .input-field, .back-btn, .submit-btn, duplicate form-group/input-field, bpro visual classes, and dead admin visual classes per D.2.  
   - Remove unused tokens.  
   - Update THEMING_MIGRATION_GUIDE and add THEME_ARCHITECTURE.md.

7. **BrandKit contract**  
   - Document that BrandKit may only override a short list of tokens (e.g. --primary, --btn-shadow, --cta-bg); all other styling from ui-primitives + global tokens.

### E.2 Phasing summary

| Phase | Focus | Outcome |
|-------|--------|--------|
| **A** | Defect audit | This document (A.1–A.3). |
| **B** | Source-of-truth map | This document (B.1–B.2). |
| **C** | Migration | By page/area (C.1–C.6); execute in order E.1. |
| **D** | Deletion and cleanup | Per D.1–D.3 after C. |
| **E** | Execution order | Follow E.1; re-audit light theme after each major area. |

---

## Document history

- 2025-03-08: Initial final theme unification plan (Phase A–E).
