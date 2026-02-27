# User Storage and Membership Logic Review

## Overview
Based on the comprehensive audit of the `users` collection and associated components, the logic for managing different user types (Regular, Business, Admin) is sound but has some areas where standardization can improve robustness, especially in a "fresh" database state.

## 🛠️ Core Storage Logic

### 1. `users` Collection (Primary Source of Truth)
All account types reside in the same collection, differentiated by `accountType` and `role`.

| User Type | `accountType` | `role` | Key Fields |
| :--- | :--- | :--- | :--- |
| **Individual** | `individual` | `user` | `displayName`, `gender`, `ageCategory`, `isProfileComplete` |
| **Business** | `business` | `partner` | `businessInfo` (nested object), `display_name` (standardized) |
| **Admin** | `admin` | `admin` | Full system access via `AdminLayout` |
| **Staff/Support** | `individual` | `staff` / `support` | Shared permissions with specific restrictions |

### 2. Business Membership (Communities)
DineBuddies uses a dual-sync mechanism for business "members" (followers):
*   **User Side**: `joinedCommunities` (array of Partner UIDs)
*   **Partner Side**: `communityMembers` (array of User UIDs)
*   **Self-Healing**: The `MyCommunity.jsx` page automatically syncs the partner's list from the users' lists if they go out of sync.

## ⚠️ Findings & Observations

### 1. Account Identity Standardization
In some legacy components, `nickname` was used instead of `displayName`. New logic consistently uses `displayName` (individual) and `businessInfo.businessName` (business), mapped to `display_name` in some migration contexts.

### 2. Profile Guards for Businesses
The `ProfileGuard.jsx` component currently checks for `gender` and `ageCategory`. This might incorrectly block business accounts who haven't set these (as they aren't required for businesses).

### 3. Account Deletion Safety
Critical administrative actions are restricted to a "Super Owner" list (emails: `admin@dinebuddies.com`, `y.abohamed@gmail.com`, `yaser@dinebuddies.com`, `info@dinebuddies.com.au`).

## 📋 Proposed Actions

| Area | Change | Rationale |
| :--- | :--- | :--- |
| **Standardization** | Unify `isBusinessAccount` check helper. | Clearer code maintenance. |
| **Profile Guard** | Allow `business` accounts to bypass Individual profile checks. | Prevents business users from being stuck in the "Complete Profile" flow. |
| **Data Integrity** | Propose a "Cleanup" script for orphaned invitations. | Removes potential UI ghosts from deleted accounts. |

---

## 🔒 Security Audit
*   **Firestore Rules**: Confirmed basic protection is active.
*   **Admin Access**: Only users with `role: 'admin'` can access `/admin/*`.
*   **Ownership**: Business owners can only edit their own profile/community.
