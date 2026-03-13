# UI Primitives Migration Status

**Last updated:** Phase 5E (2025-03-08)

Short reference for current rollout state and next-wave priorities. For full audit see `docs/UI_PRIMITIVES_GLOBAL_MIGRATION_STATUS_AUDIT.md`.

---

## Current Rollout Summary

- **Phases 1A–4L, 5A–5E complete.** Pro shell, Settings, Notifications, InvitationPreview/Details, PrivateInvitationPreview, **Profile.jsx (5B)**, **BusinessProfile.jsx (5C)**, **GuestLoginPrompt (5E)**, and others use `ui-btn`, `ui-form-field`, `ui-card`, `ui-tabs`, `ui-prompt`, `ui-banner--warning`, etc. where adopted.
- **Phase 5E:** GuestLoginPrompt was migrated to ui-prompt / ui-prompt--standalone / ui-prompt__title / ui-prompt__desc / ui-prompt__btn. All **profile-guest-prompt*** aliases were removed from ui-primitives.css. **No profile-* aliases remain** in ui-primitives.css.
- **Structural profile-* classes** (shell, content, stats, section-header, invitation-item, subscription-*, theme-toggle, etc.) remain in **profile-shared.css** only and are intentionally profile-scoped; they are not part of ui-primitives alias cleanup.
- **Admin, CommunityChatRoom/GroupChat, Home, and feature components** use their own button/control systems; intentionally out of scope for the current rollout.

---

## profile-* Alias Status (Post–Phase 5E)

- **In ui-primitives.css:** **None.** All profile-* aliases have been removed. GuestLoginPrompt.jsx was migrated to ui-prompt* in Phase 5E and the last set (profile-guest-prompt*) was removed. ui-primitives.css now contains only .ui-* selectors.
- **Structural profile-* (profile-shared.css):** Do not remove. Classes such as profile-shell, profile-content, profile-stats, profile-section-header, profile-invitation-item*, profile-subscription-*, etc. are still in active use and have no ui-* replacement. They remain intentionally profile-scoped and are **not** part of ui-primitives alias cleanup.

---

## Next-Wave Candidates

1. **CreateInvitation / CreatePrivateInvitation** — Incremental adoption of ui-form-field, ui-form-label, ui-btn where safe.
2. **UserProfile.jsx** — Uses profile-invitation-item* and profile-tab-btn; optional migration later.
3. Further rollout on other pages per global audit (no remaining profile-* alias cleanup in ui-primitives).

See the global audit for full ranking and risk notes.

---

## Phase 5A–5E Notes

- **5A:** PrivateInvitationPreview — low-risk button adoption.
- **5B:** Profile.jsx — buttons, form fields, card/tabs, guest prompt migrated to ui-*.
- **5C:** BusinessProfile.jsx — buttons, card/tabs, form/banner migrated to ui-*; BrandKit preserved.
- **5D:** Alias audit; removed all profile-* aliases in ui-primitives.css that had zero references; retained only profile-guest-prompt* (GuestLoginPrompt.jsx). Structural profile-* in profile-shared.css intentionally preserved.
- **5E:** GuestLoginPrompt.jsx migrated to ui-prompt / ui-prompt--standalone / ui-prompt__title / ui-prompt__desc / ui-prompt__btn; removed remaining profile-guest-prompt* aliases from ui-primitives.css. **No profile-* aliases remain in ui-primitives.css.** Structural profile-* in profile-shared.css unchanged.
