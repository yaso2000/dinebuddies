# Firestore Scan Report — Business Accounts (Pre-Migration)

**Scope:** `users` collection, documents where `accountType === 'business'`  
**Purpose:** Read-only verification before running the strict business-plans migration.  
**No data was modified. The migration was not run.**

---

## How to generate this report

Run the scan script in an environment with Firestore **read** access to `users`:

```bash
node scripts/scan_business_plans_pre_migration.js
```

Paste the script output below (or keep it as your report). The script prints sections 1–5 and the readiness conclusion.

---

## 1. Count of documents grouped by `subscriptionTier` value

| subscriptionTier value | Count |
|------------------------|-------|
| *(populate by running the script)* | |

*Script output lists each value present among business docs (e.g. `free`, `professional`, `elite`, `(missing)`, `premium`, etc.) and the count.*

---

## 2. Documents where `subscriptionTier` is not exactly one of: `free`, `professional`, `elite`

- **Count:** *(run script)*
- **Breakdown by value:** *(run script)*
- **UIDs (up to 50):** *(run script)*

*Only values that are exactly the strings `free`, `professional`, or `elite` (after trim) are considered valid. Missing, empty, or any other value (e.g. `premium`, `basic`, `pro`) are listed here.*

---

## 3. Count of business documents that contain legacy fields

| Legacy field | Count |
|--------------|-------|
| Any of: `businessInfo.subscriptionTier`, `businessInfo.tier`, `businessInfo.subscriptionPlan` | *(run script)* |
| `businessInfo.subscriptionTier` | *(run script)* |
| `businessInfo.tier` | *(run script)* |
| `businessInfo.subscriptionPlan` | *(run script)* |

---

## 4. Five sanitized sample business documents that would be modified

*The script outputs up to 5 sample documents (sanitized: no email, names redacted, legacy values truncated) that would be modified by `migrate_business_plans_strict.js` — i.e. they have an invalid `subscriptionTier` and/or at least one legacy field.*

*(Paste script output for "Sample 1" … "Sample 5" here.)*

---

## 5. Readiness for strict migration

**Conclusion:** *(fill after running the script)*

- If **ready:**  
  All business documents have `subscriptionTier` exactly one of `free`, `professional`, `elite`, and none contain `businessInfo.subscriptionTier`, `businessInfo.tier`, or `businessInfo.subscriptionPlan`.  
  **The dataset is READY for strict migration.**

- If **not ready:**  
  There are documents with `subscriptionTier` not in `{ free, professional, elite }` and/or documents that still contain legacy fields.  
  **The dataset is NOT ready for strict migration without review.** Run `migrate_business_plans_strict.js` to normalize tiers and remove legacy fields, or fix data manually first.

---

*This report was not populated with live data in this environment (Firestore returned "Missing or insufficient permissions"). Run `node scripts/scan_business_plans_pre_migration.js` locally with read access to fill sections 1–5 and the conclusion.*
