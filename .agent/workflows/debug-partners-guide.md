# 🔍 Debug Partners - Quick Guide

## How to Use:

### 1. Navigate to Debug Page
```
http://localhost:5173/debug-partners
```

### 2. Check Your Status

**If you see:**
- ❌ "Account Type: NOT 'business'" → You need to convert your account
- ✅ "Account IS a business account!" → Your account is correct

**If you see:**
- ❌ "No business accounts found" → Database has no business accounts yet
- ✅ "Found X business account(s)" → Database has businesses

### 3. What to Do:

**Scenario A: Your account is NOT business**
1. Go to Settings → Convert to Business
2. Fill in the form
3. Watch the console for:
   - "Converting to business with data: {...}"
   - "✅ Successfully updated Firestore"
   - "✅ User profile refreshed"
4. Return to /debug-partners
5. You should now see your account listed

**Scenario B: Your account IS business but not showing**
1. Open Browser Console (F12)
2. Go to /partners
3. Look for:
   - "Fetching business accounts..."
   - "Query returned X documents"
   - "Total businesses found: X"
4. If count is 0, check Firestore Rules
5. If count > 0, check if your UID is in the list

**Scenario C: Everything looks good**
1. Your account should appear on /partners
2. Try refreshing the page
3. Try clearing browser cache

---

## Quick Links:
- Debug Page: `/debug-partners`
- Partners Page: `/partners`
- Convert Account: `/convert-to-business`
- Settings: `/settings`

---

## Common Issues:

### Issue 1: accountType is undefined
**Fix**: Convert your account from Settings

### Issue 2: accountType is 'user' not 'business'
**Fix**: Re-convert your account

### Issue 3: Business account exists but not showing
**Fix**: Check Firestore Rules for 'users' collection read permissions

### Issue 4: Console shows error
**Fix**: Share the error message for further help
