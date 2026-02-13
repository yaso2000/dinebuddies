# 🎁 Special Offers Feature - Premium Business Feature

## 📋 Overview
A premium feature that allows business partners to create and display special offers/discounts to attract customers.

---

## ✅ Feature Specifications

### 🎯 Offer Content:
- **Title**: Offer headline (e.g., "30% Off on Burgers")
- **Description**: Brief explanation of the offer
- **Image**: Eye-catching visual
- **Discount**: Percentage (e.g., 30%)
- **Menu Item**: Specific item/category (e.g., Burgers, Pizza, Drinks)
- **Start Date**: When offer begins
- **End Date**: When offer expires (flexible: minutes, days, years)

### 🔒 Access Control:
- **Only Premium Partners**: `subscriptionTier === 'premium'`
- **One Active Offer**: Only 1 offer can be active at a time per partner

### 📍 Display Locations:
1. **Partner Profile**: Prominent banner above tabs
2. **Partners Directory**: Badge on partner card
3. **Community Feed**: Can be posted as announcement
4. **Notifications**: Sent to community members

---

## 🗄️ Firestore Structure

### Collection: `specialOffers`

```javascript
{
  id: "auto-generated",
  partnerId: "user_id",
  partnerName: "KFC Restaurant",
  title: "30% Off on All Burgers",
  description: "Get 30% discount on all our delicious burgers this weekend!",
  imageUrl: "https://...",
  discount: 30, // percentage
  menuItem: "Burgers", // or "All Menu", "Pizza", etc.
  startDate: Timestamp,
  endDate: Timestamp,
  isActive: true,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  
  // Stats
  views: 0,
  clicks: 0,
  
  // Status
  status: "active" | "expired" | "draft"
}
```

---

## 🎨 UI Design

### 1️⃣ **In Partner Profile** (Above Tabs):

```
┌──────────────────────────────────────┐
│ 🎁 SPECIAL OFFER - LIMITED TIME!     │
│ ┌────────┐                           │
│ │ Image  │ 30% Off on All Burgers!   │
│ │        │ Valid until: Feb 15, 2026 │
│ └────────┘ [View Details →]          │
└──────────────────────────────────────┘
```

**Design:**
- Gold gradient background
- Pulsing "HOT" badge
- Large discount percentage
- Clear CTA button

---

### 2️⃣ **Management Interface** (For Partner Owner):

When logged in as partner owner, show:

```
┌──────────────────────────────────────┐
│ 🎁 Current Special Offer             │
│ ┌────────────────────────────────┐   │
│ │ [Active Offer Display]         │   │
│ │ [Edit] [Delete] [View Stats]   │   │
│ └────────────────────────────────┘   │
│                                      │
│ [+ Create New Offer] (if no active)  │
└──────────────────────────────────────┘
```

---

### 3️⃣ **Create/Edit Form**:

Fields:
- 📸 Image Upload (required)
- ✏️ Offer Title (required, max 60 chars)
- 📝 Description (required, max 200 chars)
- 💰 Discount % (required, 1-99)
- 🍔 Menu Item (required, text input)
- 📅 Start Date (default: now)
- 📅 End Date (required)

Validation:
- Only 1 active offer allowed
- End date must be after start date
- Only Premium tier can create

---

## 🔔 Notification System

When offer is created/updated:
1. Send notification to all community members
2. Optional: Post to partner's feed
3. Show badge on Partners Directory

---

## 📊 Analytics (Future Enhancement)

Track:
- Total views
- Click-through rate
- Popular menu items
- Best performing times

---

## 🚀 Implementation Steps

### Phase 1: Basic Structure ✅
1. Create Firestore collection structure
2. Add offer display in Partner Profile
3. Add creation form for partners
4. Basic validation

### Phase 2: Premium Check ✅
1. Verify subscription tier
2. Limit to 1 active offer
3. Auto-expire old offers

### Phase 3: UI Polish ✅
1. Animated banner
2. Beautiful card design
3. Responsive layout

### Phase 4: Integration (Future)
1. Partners Directory badge
2. Community notifications
3. Feed posts
4. Analytics dashboard

---

## 🎨 Color Scheme

```css
--offer-gradient: linear-gradient(135deg, #f59e0b, #d97706);
--offer-text: #ffffff;
--offer-border: rgba(251, 191, 36, 0.3);
--offer-shadow: 0 8px 32px rgba(245, 158, 11, 0.3);
```

---

## 📝 Translation Keys

### English:
```json
{
  "special_offer": "Special Offer",
  "limited_time_offer": "Limited Time Offer",
  "offer_valid_until": "Valid until",
  "discount_on": "Off on",
  "create_special_offer": "Create Special Offer",
  "edit_offer": "Edit Offer",
  "delete_offer": "Delete Offer",
  "offer_title": "Offer Title",
  "offer_description": "Description",
  "discount_percentage": "Discount %",
  "menu_item": "Menu Item",
  "offer_image": "Offer Image",
  "premium_feature": "Premium Feature",
  "upgrade_to_create_offers": "Upgrade to Premium to create special offers",
  "one_offer_limit": "You can only have 1 active offer at a time",
  "offer_created": "Offer created successfully!",
  "offer_updated": "Offer updated successfully!",
  "offer_deleted": "Offer deleted successfully!"
}
```

### Arabic:
```json
{
  "special_offer": "عرض خاص",
  "limited_time_offer": "عرض لفترة محدودة",
  "offer_valid_until": "صالح حتى",
  "discount_on": "خصم على",
  "create_special_offer": "إنشاء عرض خاص",
  "edit_offer": "تعديل العرض",
  "delete_offer": "حذف العرض",
  "offer_title": "عنوان العرض",
  "offer_description": "وصف العرض",
  "discount_percentage": "نسبة الخصم %",
  "menu_item": "الصنف",
  "offer_image": "صورة العرض",
  "premium_feature": "ميزة بريميوم",
  "upgrade_to_create_offers": "قم بالترقية للبريميوم لإنشاء عروض خاصة",
  "one_offer_limit": "يمكنك إنشاء عرض واحد نشط فقط",
  "offer_created": "تم إنشاء العرض بنجاح!",
  "offer_updated": "تم تحديث العرض بنجاح!",
  "offer_deleted": "تم حذف العرض بنجاح!"
}
```

---

## ✅ Checklist

- [ ] Firestore collection setup
- [ ] Offer display banner in profile
- [ ] Create/Edit form
- [ ] Premium tier validation
- [ ] Image upload functionality
- [ ] Auto-expire logic
- [ ] Translation keys
- [ ] Responsive design
- [ ] Loading states
- [ ] Error handling

---

**Status**: Ready for Implementation 🚀  
**Priority**: High  
**Estimated Time**: 3-4 hours
