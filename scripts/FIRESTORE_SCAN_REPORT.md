# Firestore scan report – business accounts (pre-migration)

**Purpose:** Verify business user documents before running `migrate_business_plans_strict.js`.  
**Script:** `node scripts/scan_business_plans_pre_migration.js`  
**Note:** Run in an environment with Firestore read access to the `users` collection (e.g. local with service account or emulator). The script does **not** modify any data.

---

## How to run

```bash
cd /path/to/dinebuddies
node scripts/scan_business_plans_pre_migration.js
```

If you use Firebase Admin (e.g. service account), you can switch the script to `firebase-admin` and `admin.firestore()` for full read access.

---

## Report sections (output by the script)

After a successful run, the script prints:

1. **Count of documents by subscriptionTier value**  
   For each value of `users.subscriptionTier` among business accounts (including `(missing)`), the number of documents.

2. **Documents where subscriptionTier is NOT one of: free, professional, elite**  
   Count, breakdown by invalid value, and up to 20 UIDs.

3. **Documents that contain legacy fields**  
   Counts for:
   - Any of: `businessInfo.subscriptionTier`, `businessInfo.tier`, `businessInfo.subscriptionPlan`
   - Each of the three fields separately.

4. **Five sample documents (sanitized) that would be modified**  
   For each sample: `uid`, `subscriptionTier`, `accountType`, `role`, and which legacy fields exist (values redacted/shortened). No email or real names.

---

## Placeholder results (fill after running)

If the scan could not be run in this environment, run it locally and paste the console output below.

```
Total business accounts: ___

1. Count by subscriptionTier:
   free: ___
   professional: ___
   elite: ___
   (missing): ___
   premium: ___   (or other values)

2. Invalid subscriptionTier count: ___
   UIDs: ...

3. With legacy fields:
   Any: ___
   businessInfo.subscriptionTier: ___
   businessInfo.tier: ___
   businessInfo.subscriptionPlan: ___

4. Would be modified: ___
   Sample 1: { uid, subscriptionTier, ... }
   ...
```

---

*Last run in this environment: failed (Missing or insufficient permissions). Run the script locally with Firestore read access to get the actual report.*
