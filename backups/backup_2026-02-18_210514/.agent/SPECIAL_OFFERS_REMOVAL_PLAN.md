# 🗑️ خطة حذف ميزة Special Offers بالكامل

## 📋 الملفات المتأثرة

### 1. **Components للحذف:**
- ✅ `src/components/SpecialOfferBanner.jsx` - حذف كامل
- ✅ `src/components/OfferModal.jsx` - حذف كامل

### 2. **Pages تحتاج تعديل:**
- ⚠️ `src/pages/PartnerProfile.jsx` - إزالة كود Special Offers
- ⚠️ `src/pages/Home.jsx` - إزالة عرض Special Offers
- ⚠️ `src/pages/Partners.jsx` - إزالة أي إشارات
- ⚠️ `src/pages/CreateInvitation.jsx` - إزالة pre-fill من offers

### 3. **Firestore:**
- ⚠️ `specialOffers` collection - سيبقى في قاعدة البيانات لكن لن يُستخدم
- ⚠️ لا توجد rules خاصة بـ specialOffers في firestore.rules

### 4. **Translations:**
- ⚠️ `src/locales/en.json` - إزالة مفاتيح الترجمة
- ⚠️ `src/locales/ar.json` - إزالة مفاتيح الترجمة

---

## 🔍 الكود المرتبط بـ Special Offers

### في PartnerProfile.jsx:
1. State: `specialOffer`, `loadingOffer`, `showOfferModal`, `offerForm`
2. Functions: `fetchSpecialOffer()`, `handleSaveOffer()`, `handleCreateWithOffer()`
3. Imports: `SpecialOfferBanner`, `OfferModal`
4. UI: عرض البانر، زر Create Offer

### في Home.jsx:
1. State: `specialOffers`, `loadingOffers`
2. Function: `fetchSpecialOffers()`
3. UI: Special Offers Carousel

### في CreateInvitation.jsx:
1. Pre-fill data من `offerData` في location.state
2. Banner عرض خاص في أعلى الصفحة

---

## ⚙️ خطوات التنفيذ

### المرحلة 1: حذف Components
1. حذف `SpecialOfferBanner.jsx`
2. حذف `OfferModal.jsx`

### المرحلة 2: تنظيف PartnerProfile.jsx
1. إزالة imports
2. إزالة states
3. إزالة functions
4. إزالة UI elements
5. إزالة زر "Create Special Offer"

### المرحلة 3: تنظيف Home.jsx
1. إزالة state
2. إزالة fetch function
3. إزالة carousel UI

### المرحلة 4: تنظيف CreateInvitation.jsx
1. إزالة معالجة offerData
2. إزالة البانر

### المرحلة 5: تنظيف Partners.jsx
1. فحص وإزالة أي إشارات

### المرحلة 6: تنظيف Translations
1. إزالة مفاتيح من en.json
2. إزالة مفاتيح من ar.json

---

## 📊 التقدم

- [ ] حذف SpecialOfferBanner.jsx
- [ ] حذف OfferModal.jsx
- [ ] تنظيف PartnerProfile.jsx
- [ ] تنظيف Home.jsx
- [ ] تنظيف CreateInvitation.jsx
- [ ] تنظيف Partners.jsx
- [ ] تنظيف Translations

---

## ⚠️ ملاحظات مهمة

1. **Firestore Collection:** لن نحذف collection من Firebase لأنها قد تحتوي على بيانات قديمة
2. **Backward Compatibility:** الكود الجديد يجب أن يتجاهل offerData في state
3. **Premium Features:** التحقق من أن حذف Offers لا يؤثر على باقي مميزات Premium

---

## 🎯 الهدف النهائي

✅ إزالة كل أثر لـ Special Offers من:
- Frontend Code
- UI/UX
- Translations
- Navigation flows

❌ لن نحذف من:
- Firestore database (للحفاظ على البيانات القديمة)
