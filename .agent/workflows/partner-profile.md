---
description: Partner Profile Feature - How to use and access
---

# Partner Profile Feature

## Overview
The Partner Profile feature allows business partners (restaurants, cafes, etc.) to display and edit comprehensive information about their establishment.

## Features
- ✅ **Business Information**: Name, type, description
- ✅ **Menu/Services Description**: Detailed menu or services offered
- ✅ **Weekly Working Hours**: Full week schedule with open/close times
- ✅ **Contact Information**: Phone and website
- ✅ **Edit Mode**: Toggle between view and edit modes
- ✅ **Permission System**: Role-based access control
- ✅ **Demo Mode**: Testing mode for development
- ✅ **Responsive Design**: Beautiful, modern UI with Arabic support

## Permission System

### User Roles
The app supports three types of users:

1. **👤 Regular User (`user`)**: 
   - Can view all restaurant profiles
   - Can join communities
   - **Cannot** edit any restaurant profiles

2. **🏢 Partner Owner (`partner_owner`)**:
   - Can view all restaurant profiles
   - Can **only edit their own** restaurant profiles
   - Owns specific restaurants (stored in `ownedRestaurants` array)

3. **👑 Admin (`admin`)**:
   - Can view all restaurant profiles
   - Can edit **any** restaurant profile
   - Full system access

### Demo Mode vs Production Mode

#### 🔓 Demo Mode (Current - For Development)
- **Status**: `isDemoMode = true`
- **Behavior**: **Anyone can edit any restaurant**
- **Purpose**: Testing and development
- **Visual Indicator**: Yellow banner showing "وضع التجربة مفعّل"
- **Features**: Quick account switcher to test different roles

#### 🔒 Production Mode (For Live App)
- **Status**: `isDemoMode = false`
- **Behavior**: **Only authorized users can edit**
  - Regular users: No edit button visible
  - Partner owners: Can only edit their own restaurants
  - Admins: Can edit everything
- **Purpose**: Real-world usage with proper security
- **Visual Indicator**: No banner, clean interface

### How to Switch Modes

In `src/context/InvitationContext.jsx`, line ~57:
```javascript
const [isDemoMode, setIsDemoMode] = useState(true); // Change to false for production
```

**For Production**: Set to `false`
**For Development/Testing**: Set to `true`

## How to Test Different Roles

When in Demo Mode, use the quick account switcher buttons:

1. **مستخدم عادي (Regular User)**: 
   - No edit button appears
   - Can only view profiles

2. **مالك منشأة (Partner Owner)**:
   - Edit button appears only on `res_1` (Le Bistro Premium)
   - Cannot edit other restaurants

3. **مدير (Admin)**:
   - Edit button appears on all restaurants
   - Full access

## How to Access

### From Restaurant Directory
1. Navigate to `/restaurants` (Partner Directory)
2. Click the info icon (ℹ️) on any restaurant card
3. You'll be redirected to `/partner/:id`

### Direct URL
- Access directly via: `/partner/res_1`, `/partner/res_2`, etc.

## How to Edit
1. Open a partner profile page
2. Click the "تعديل" (Edit) button in the top-right corner
3. Make your changes:
   - Edit business name and type
   - Update description
   - Modify menu/services
   - Change working hours for each day
   - Update contact information
4. Click "حفظ" (Save) to save changes
5. Click "إلغاء" (Cancel) to discard changes

## Working Hours
- Each day can be toggled on/off
- Set custom opening and closing times
- Supports 24-hour format
- Displays "مغلق" (Closed) for non-working days

## Data Structure
Partner data includes:
```javascript
{
  id: 'res_1',
  name: 'Business Name',
  type: 'Business Type',
  description: 'About the business...',
  menuDescription: 'Menu items...',
  phone: '+966 XX XXX XXXX',
  website: 'www.example.com',
  workingHours: {
    sunday: { open: '12:00', close: '23:00', isOpen: true },
    // ... other days
  }
}
```

## Files Modified
- `src/pages/PartnerProfile.jsx` - New partner profile page
- `src/pages/RestaurantDirectory.jsx` - Added info button
- `src/App.jsx` - Added route
- `src/locales/ar.json` - Added translations
- `src/data/mockData.js` - Enhanced restaurant data

## Next Steps
- Connect to backend API for persistent data storage
- Add image upload for business photos
- Add gallery section
- Add reviews and ratings management
