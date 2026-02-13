# 🔧 تحديثات إضافية مطلوبة - Business Account Restructure

## ✅ التحديثات المكتملة

1. ✅ **BusinessSignup.jsx** - لا يحفظ businessName أو logoImage في businessInfo
2. ✅ **EditBusinessProfile.jsx** - يقرأ/يكتب من display_name و photo_url
3. ✅ **InvitationContext.jsx** - يعرض display_name و photo_url
4. ✅ **migrateBusinessAccounts.js** - سكريبت Migration جاهز

---

## ⚠️ الملفات التي تحتاج تحديث يدوي

### **الأولوية 1: ملفات العرض الأساسية**

#### 1. **PartnerProfile.jsx** (18 استخدام)
**الموقع:** `src/pages/PartnerProfile.jsx`

**التغييرات المطلوبة:**
```javascript
// قبل:
businessInfo.businessName
businessInfo.logoImage

// بعد:
display_name  // أو userProfile.display_name
photo_url     // أو userProfile.photo_url
```

**الأسطر:**
- Line 410: `partnerName: offer.partnerName || partner?.businessInfo?.businessName`
- Line 538: `restaurantName: businessInfo.businessName`
- Line 570-571: عنوان 

 Meta
- Line 673: عنوان الصفحة
- Line 790-802: عرض اللوجو

---

#### 2. **BusinessDashboard.jsx** (3 استخدامات)
**الموقع:** `src/pages/BusinessDashboard.jsx`

**التغييرات:**
```javascript
// Line 191
{businessInfo.businessName || 'Your Business'}
→ {userProfile.display_name || 'Your Business'}

// Line 163-165 (Logo display)
{businessInfo.logoImage ? ...}
→ {userProfile.photo_url ? ...}
```

---

#### 3. **Settings.jsx** (7 استخدامات)
**الموقع:** `src/pages/Settings.jsx`

**التغييرات:**
```javascript
// Lines 183-184, 196-197, 202 (Avatar display)
userProfile?.businessInfo?.logoImage
→ userProfile?.photo_url

// Lines 197, 202 (Name display)
userProfile?.businessInfo?.businessName
→ userProfile?.display_name
```

---

### **الأولوية 2: صفحات Admin**

#### 4. **AdminDashboard.jsx**
```javascript
// Lines 107, 225
business.businessInfo?.businessName || business.display_name
→ business.display_name  // فقط

// Lines 200-202 (Logo)
business.businessInfo?.logoImage
→ business.photo_url
```

#### 5. **AdminPanel.jsx**
```javascript
// Line 76 (Search)
user.businessInfo?.businessName?.toLowerCase()
→ user.display_name?.toLowerCase()

// Line 168
user.businessInfo?.businessName || user.display_name
→ user.display_name
```

#### 6. **admin/PartnerManagement.jsx**
```javascript
// Line 64, 223, 364
partner.businessInfo?.businessName
→ partner.display_name
```

#### 7. **admin/UserManagement.jsx**
```javascript
// Line 484
selectedUser.businessInfo.businessName
→ selectedUser.display_name
```

---

### **الأولوية 3: Components**

#### 8. **BusinessCard.jsx**
```javascript
// Lines 23, 35, 90
business.businessInfo?.businessName
→ business.display_name

// Logo usage (if any)
business.businessInfo?.logoImage
→ business.photo_url
```

#### 9. **BusinessLimitsEditor.jsx**
```javascript
// Line 399
business.businessInfo?.businessName || business.display_name
→ business.display_name
```

#### 10. **CreateBusinessAccount.jsx**
**مثل BusinessSignup تماماً - نفس التحديث**

#### 11. **StoriesBar.jsx**
```javascript
// Line 17
userProfile?.businessInfo?.logoImage
→ userProfile?.photo_url
```

---

### **الأولوية 4: صفحات أخرى**

#### 12. **Partners.jsx**
```javascript
// Lines 75, 150, 370, 385
info.businessName
→ data.display_name (نفس طريقة InvitationContext)
```

#### 13. **MyCommunity.jsx**
```javascript
// Line 127-128
businessInfo.businessName
businessInfo.logoImage
→ userProfile.display_name
→ userProfile.photo_url
```

#### 14. **MyCommunities.jsx**
```javascript
// Lines 74-75
businessInfo.businessName
businessInfo.logoImage
→ display_name
→ photo_url
```

#### 15. **CommunityChat.jsx**
```javascript
// Lines 127-128
businessInfo.businessName
businessInfo.logoImage
→ display_name
→ photo_url
```

#### 16. **RestaurantDirectory.jsx**
```javascript
// Lines 200-203
res.logoImage || res.businessInfo?.logoImage
→ res.photo_url
```

#### 17. **Home.jsx**
```javascript
// Lines 993, 1008
offer.partnerData?.businessInfo?.businessName
→ offer.partnerData?.display_name
```

#### 18. **CreatePost.jsx** & **CreateStory.jsx**
```javascript
// Fallback chains
data.businessInfo?.businessName
→ data.display_name
```

---

## 🔧 **طريقة التحديث (Pattern)**

### **للقراءة:**
```javascript
// ❌ قديم
const name = businessInfo.businessName || 'Business';
const logo = businessInfo.logoImage;

// ✅ جديد
const name = display_name || 'Business';
const logo = photo_url;

// ✅ من userProfile
const name = userProfile.display_name || 'Business';
const logo = userProfile.photo_url;

// ✅ من data (في Context/Snapshot)
const name = data.display_name || 'Business';
const logo = data.photo_url;
```

### **للكتابة (في Updates):**
```javascript
// ❌ قديم
await updateDoc(doc(db, 'users', uid), {
  'businessInfo.businessName': newName,
  'businessInfo.logoImage': newLogo
});

// ✅ جديد
await updateDoc(doc(db, 'users', uid), {
  display_name: newName,
  photo_url: newLogo
  // businessInfo يحتوي فقط على معلومات إضافية
});
```

---

## 📝 **Testing Checklist**

بعد التحديثات، تحقق من:

- [ ] BusinessSignup يحفظ display_name و photo_url
- [ ] EditBusinessProfile يحدّث display_name و photo_url
- [ ] PartnerProfile يعرض الاسم واللوجو الصحيح
- [ ] BusinessDashboard يعرض الاسم واللوجو
- [ ] Partners Page (Directory) يعرض الشركاء بشكل صحيح
- [ ] Settings يعرض بروفايل البزنس
- [ ] CommunityChat يعرض اسم المطعم
- [ ] Map Markers تعرض اللوجو الصحيح

---

## 🚀 **الخطوات التالية**

1. **تحديث الملفات المتبقية** (الأولوية 1 أولاً)
2. **تشغيل Migration Script:**
   ```javascript
   import migrateBusinessAccounts from './utils/migrateBusinessAccounts';
   
   // في Console:
   migrateBusinessAccounts();
   ```
3. **اختبار شامل** للتأكد من عمل كل شيء
4. **حذف الحقول القديمة** من Firestore Rules إذا لزم الأمر

---

**الحالة:** 25% مكتمل (4 من 18 ملف)  
**المتبقي:** 14 ملف يحتاج تحديث  
**المدة المتوقعة:** 1-2 ساعة
