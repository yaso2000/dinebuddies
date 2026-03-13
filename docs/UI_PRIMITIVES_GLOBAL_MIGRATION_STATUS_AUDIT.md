# UI Primitives Global Migration Status Audit

**Date:** 2025-03-08  
**Context:** Phases 1A through 4L complete. Status and planning only; no code changes.  
**Scope:** Entire app; styling architecture and adoption status.

---

## A) Migration Coverage Summary

| Area | Pages / components | Adoption status | Notes |
|------|--------------------|-----------------|--------|
| **Profile pages** | Profile.jsx, BusinessProfile.jsx, UserProfile.jsx | **Legacy (profile-*)** | Profile.jsx: 55 profile-* refs, btn btn-primary/outline, form-group, input-field. BusinessProfile: 36 profile-* refs. Not yet migrated to ui-*; aliases allow same CSS. |
| **Settings / account** | Settings.jsx, PrivacySettings, PasswordSettings, NotificationsSettings, ProAccountSettings | **Partially / fully adopted** | Settings: ui-btn, ui-card, ui-prompt--standalone. Privacy/Password: ui-btn, ui-card. ProAccountSettings: ui-btn, ui-form-field, ui-form-label. NotificationsSettings: back-btn (legacy). |
| **Invitation pages** | InvitationPreview, InvitationDetails, CreateInvitation, CreatePrivateInvitation | **Partially adopted** | Preview/Details: ui-btn, ui-card (Details). CreateInvitation: ui-btn, ui-card (one section). CreatePrivateInvitation: ui-btn, ui-card--lg, ui-prompt__*. Remaining: form-group, input-field, many inline/legacy buttons. |
| **Notifications** | Notifications.jsx | **Adopted** | ui-btn (primary, secondary, ghost, danger-outline), ui-form-field, ui-card (notification-item). |
| **Pro pages** | ProAccountSettings, ProSettings, ProOverview, ProOffers, ProMembers, ProMessages, ProDesignStudio, ProNotifications, ProSubscription, ProDirectMessages | **Shell / partial adopted** | All have at least ui-btn or ui-form-field or ui-card where audited; ProSettings/ProNotifications/ProSubscription/ProDirectMessages/ProDesignStudio/ProOffers/ProMembers/ProOverview/ProMessages/ProAccountSettings touched in 4C–4L. Stat cards, offer rows, plan cards, conversation rows, message bubbles intentionally left. |
| **Chat / DM** | ProMessages, ProDirectMessages, CommunityChatRoom, GroupChat | **ProMessages/DM shell adopted** | ProMessages: ui-card, ui-form-field, ui-btn. ProDirectMessages: ui-form-field (2), ui-btn--ghost. CommunityChatRoom/GroupChat: legacy (send-btn-circle, voice-play-btn, etc.); not audited for Phase 4. |
| **Admin / business-only** | AdminPanel, AdminHome, AdminSettings, AdminNotifications, BusinessManagement, ReportsAnalytics | **Legacy** | admin-btn, admin-btn-primary/secondary/danger/success; back-btn. No ui-* adoption. Separate system by design. |
| **BrandKit / business-specific** | BrandKit.jsx, ExportAssets, ProOfferTemplates, SocialCreator | **Legacy / child components** | BrandKit/ExportAssets: bpro-stat-card, bpro-btn-primary. ProOfferTemplates/SocialCreator: sc-btn, etc. Not in scope for 4A–4L; Pro shell only adopted. |

---

## B) Major Areas by Adoption Status

| Status | Areas |
|--------|--------|
| **Fully using primitives (for their scope)** | Notifications.jsx; ProNotifications, ProDirectMessages (shell); ProAccountSettings; ProSettings (danger zone + legal); ProSubscription (two buttons); ProDesignStudio (buttons). |
| **Partially adopted** | InvitationPreview, InvitationDetails; CreateInvitation, CreatePrivateInvitation; Settings, PrivacySettings, PasswordSettings; ProOffers, ProMembers, ProOverview, ProMessages; MyCommunity (ui-card on stat cards). |
| **Audited but intentionally deferred** | ProMessages message bubbles; ProNotifications filter pills; ProSubscription plan cards & upgrade CTAs; ProDirectMessages send button; ProOffers OfferRow action buttons; empty states (bpro-empty) where ui-prompt not a clear fit. |
| **Intentionally excluded / separate system** | Admin (admin-btn system); CommunityChatRoom/GroupChat (chat-specific buttons); Home (map controls, FAB); feature-specific (VideoRecorder, MediaUpload, EnhancedGallery, SocialCreator, OfferEditor) — custom semantics. |
| **Legacy, not yet audited** | Profile.jsx, BusinessProfile.jsx (profile-* + .btn, .form-group, .input-field); PrivateInvitationPreview (action-btn-*); InvitationTimeline (btn btn-primary/secondary); QuickLogin (auth-tab-btn, btn-auth-social); various back-btn, close-btn, icon-btn across pages. |

---

## C) Remaining Top Targets (Ranked)

| Rank | Target | Reason | Risk | Primitive reuse |
|------|--------|--------|------|------------------|
| 1 | **Profile.jsx** | High traffic; profile-* already aliased to ui-*; .btn and .input-field overlap with ui-btn, ui-form-field. Migrating to ui-* would allow future alias removal. | Medium (many refs, form layout) | High (cards, tabs, buttons, form fields) |
| 2 | **BusinessProfile.jsx** | Same as Profile; profile-* heavy. | Medium | High |
| 3 | **CreateInvitation / CreatePrivateInvitation** | Large forms; already use some ui-btn, ui-card. form-group + input-field could adopt ui-form-surface, ui-form-field, ui-form-label incrementally. | Medium (form layout, validation) | High |
| 4 | **ExportAssets (Pro child)** | Small surface; bpro-stat-card, bpro-btn-primary; could adopt ui-card, ui-btn. | Low | Medium |
| 5 | **BrandKit.jsx** | bpro-stat-card, bpro-btn-primary; similar to other Pro pages. | Low–medium | Medium |
| 6 | **PrivateInvitationPreview** | action-btn-outline/primary → ui-btn variants. | Low | High |
| 7 | **InvitationTimeline** | btn btn-primary/secondary → ui-btn. | Low | High |
| 8 | **Admin system** | admin-btn-* could map to ui-btn variants in a dedicated pass; lower priority (separate system). | Low (contained) | Medium |

---

## D) Current Theme Debt Summary

| Debt type | Location | Notes |
|-----------|----------|--------|
| **profile-* aliases** | ui-primitives.css | profile-card, profile-tabs, profile-action-btn, profile-form-field, profile-form-label, profile-guest-prompt, profile-banner-warning, profile-clear-btn alias to ui-*. Comment: "Remove aliases only after migrating those pages to ui-*". Profile.jsx, BusinessProfile.jsx still use profile-*. |
| **Dual selectors** | ui-primitives.css | Every primitive has two selectors (e.g. .ui-card, .profile-card). Increases CSS size slightly; no functional issue while aliases remain. |
| **Legacy .btn** | index.css | .btn, .btn-primary, .btn-secondary, .btn-outline, .btn-sm, etc. Still used: Profile.jsx, Home.jsx, InvitationTimeline, PasswordSettings (submit uses ui-btn). Documented as "keep until broad migration". |
| **Legacy .input-field / .form-group** | index.css | .form-group, .input-field used in Profile.jsx, PasswordSettings, CreateInvitation, CreatePrivateInvitation. Overlap with ui-form-field documented; .form-group has no ui-* wrapper equivalent. |
| **bpro-* in Pro** | BusinessProDashboard.css | bpro-card, bpro-card-header, bpro-stat-card, bpro-btn-primary, bpro-btn-secondary, bpro-empty, bpro-spinner, bpro-table. Pro pages now use ui-* for many buttons/cards/inputs; bpro-* still used for stat cards, tables, empty state, spinner, headers. |
| **Page-local duplicate styling** | Various | Inline styles next to adopted primitives (e.g. style overrides on ui-btn, ui-card). Acceptable; reduces only when more structure moves to primitives. |
| **Scattered back-btn / icon-btn** | NotificationsSettings, PasswordSettings, MyCommunity, AdminPanel, etc. | back-btn, icon-btn, close-btn are page- or section-specific; no global primitive for "back" or "icon-only" yet. Could be standardized later. |

---

## E) Primitive Maturity Assessment

| Primitive | Maturity | Adoption | Notes |
|-----------|----------|----------|--------|
| **ui-card** | Mature, broadly reusable | Good | Used in Settings, Notifications, InvitationDetails, CreateInvitation, CreatePrivateInvitation, ProOverview, ProOffers, ProMembers, ProMessages, MyCommunity, PasswordSettings, PrivacySettings. Optional ui-card--lg used. |
| **ui-btn** | Mature, broadly reusable | Very good | All variants (primary, secondary, ghost, danger-outline) used across Pro, Settings, Notifications, InvitationPreview/Details, CreateInvitation, CreatePrivateInvitation. Most new button adoption uses ui-btn. |
| **ui-form-field** | Mature, needs more adoption | Good | Used in ProAccountSettings, ProMembers, ProNotifications, ProMessages, ProDirectMessages, Notifications. Profile and Create* still use .input-field. |
| **ui-form-label** | Mature, needs more adoption | Limited | ProAccountSettings; Profile/Create* use .form-group label or inline. |
| **ui-prompt** | Mature, needs more adoption | Limited | ui-prompt--standalone in Settings; ui-prompt__title/__desc in CreatePrivateInvitation, MyCommunity. Empty states often still bpro-empty or inline. |
| **ui-banner--warning** | Mature but low adoption | Low | Defined in ui-primitives.css; no grep hits in pages. Draft/amber banners (InvitationPreview, etc.) kept custom. Good for future warning-style banners. |
| **ui-tabs / ui-tab** | Mature but low adoption | Low | Profile/BusinessProfile use profile-tabs (alias). ProNotifications filter pills deferred. Tabbed UIs could adopt in Profile or admin. |

**Summary:** ui-card and ui-btn are the most adopted and stable. ui-form-field and ui-form-label are mature but still compete with .input-field and .form-group. ui-prompt, ui-banner, ui-tabs are mature in CSS but underused in pages.

---

## F) Recommended Next Phase with Reasoning

**Recommendation: Option C — Hybrid small adoption + cleanup**

- **Phase 5A (small adoption):** Choose **one** high-value, lower-risk target for a single wave:
  - **Preferred:** **PrivateInvitationPreview** — action-btn-outline and action-btn-primary → ui-btn--secondary and ui-btn--primary. Small surface, high primitive reuse, low regression risk.
  - **Alternative:** **InvitationTimeline** — btn btn-primary / btn-secondary → ui-btn. Very small surface.
- **Phase 5A (cleanup / debt prep):** No alias removal yet. Do **one** of:
  - Add a short "Migration status" section to THEMING_MIGRATION_GUIDE.md or a new MIGRATION_STATUS.md that points to this audit and lists Profile, BusinessProfile, CreateInvitation as next-wave candidates.
  - Or add a single comment in ui-primitives.css or index.css noting that Profile.jsx and BusinessProfile.jsx are the largest remaining profile-* consumers and that after migrating them to ui-*, profile-* aliases can be removed.

**Why not A only (next-wave adoption in a ranked page):** Profile.jsx is the highest value but has 55 profile-* refs and mixed .btn/.form-group; a full Phase 5A on Profile alone is a large change. Doing one smaller page (PrivateInvitationPreview or InvitationTimeline) first keeps momentum and risk low.

**Why not B only (alias/debt reduction prep):** Removing aliases before migrating Profile/BusinessProfile would break those pages. Prep (documentation, comments) is safe; actual removal should follow migration.

**Why not D (pause):** The rollout is in a good state; one small adoption (e.g. PrivateInvitationPreview) plus light documentation is low effort and aligns with the existing phased approach.

---

## G) Confidence / Risk Assessment

| Action | Confidence | Risk |
|--------|------------|------|
| **PrivateInvitationPreview → ui-btn** | High | Low |
| **InvitationTimeline → ui-btn** | High | Low |
| **Profile.jsx full migration** | Medium | Medium (scope, form layout) |
| **BusinessProfile.jsx full migration** | Medium | Medium |
| **CreateInvitation form fields** | Medium | Medium (validation, layout) |
| **Alias removal** | High (once Profile/BusinessProfile use ui-*) | High if done too early |
| **Admin ui-btn adoption** | Medium | Low (contained) |

**Overall:** The migration is **stable and well-documented**. The safest next step is **Option C**: one small adoption (PrivateInvitationPreview or InvitationTimeline) plus a brief documentation update. Profile and BusinessProfile remain the largest strategic targets for a later, dedicated phase.
