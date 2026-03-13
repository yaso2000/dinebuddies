# Security Migration Notes

This project no longer allows legacy client-side migration/demo flows in normal runtime paths.

## Current Rules

- User-facing `/migration` route is removed.
- Admin migration actions are centralized under `/admin/migration`.
- Legacy migration/demo utilities are guarded with `import.meta.env.DEV` checks:
  - `src/utils/demoDataGenerator.js`
  - `src/utils/migrateRoles.js`
  - `src/utils/migrateBusinessAccounts.js`
- Legacy client plan migration utility was removed:
  - `src/utils/migratePlans.js`
- Demo management UI in admin dashboard is dev-only.

## Trusted Backend Migration Path

Use callable/cloud functions for security-sensitive updates. Current examples:

- `listCommunityMembers`
- `listUserNetwork`
- `getFollowerCount`
- `lookupBusinessByPlaceId`
- `adminAddTestLocationsToBusinesses`
- `adminCleanupLegacyUserProfiles`
- `adminRefreshPostsUserMetadata`

## Release Checklist

- Deploy required Cloud Functions before enabling related UI paths.
- Keep `users` list/query access admin-only in rules.
- Keep non-admin reads on public projections (`public_profiles`) or trusted callables.
- Do not reintroduce direct client writes/queries for privileged fields.
