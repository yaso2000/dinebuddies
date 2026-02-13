# 🏗️ خطة إعادة هيكلة: فصل حسابات User و Business

## 🎯 المشكلة الحالية

```javascript
// Business Account الآن (خطأ - ازدواجية):
{
  display_name: "مطعم النخيل",        // اسم المطعم
  businessInfo: {
    businessName: "مطعم النخيل",      // ← نفس الاسم مكرر!
    logoImage: "logo.jpg"             // ← الصورة في مكان آخر
  }
}
```

---

## ✅ الحل المقترح

### **1. توحيد البيانات الأساسية**

```javascript
// User Account
{
  uid: "abc123",
  accountType: "user",
  role: "user",
  
  // البيانات الأساسية
  display_name: "أحمد محمد",           // اسم الشخص
  photo_url: "photo.jpg",               // صورة الشخص
  email: "ahmed@example.com",
  
  // معلومات إضافية
  bio: "أحب الطعام والتجمعات",
  following: [...],
  followersCount: 10,
  joinedCommunities: [...]
}
```

```javascript
// Business Account
{
  uid: "xyz789",
  accountType: "business",
  role: "partner",
  
  // البيانات الأساسية ← تمثل المطعم مباشرة
  display_name: "مطعم النخيل",         // اسم المطعم
  photo_url: "logo.jpg",                // لوجو المطعم
  email: "contact@alnakheel.com",
  
  // معلومات البزنس (إضافية فقط)
  businessInfo: {
    businessType: "Restaurant",
    phone: "+966 12 345 6789",
    address: "شارع الملك فهد، الرياض",
    city: "Riyadh",
    country: "SA",
    description: "مطعم فاخر...",
    coverImage: "cover.jpg",            // صورة الغلاف
    lat: 24.7136,
    lng: 46.6753,
    placeId: "ChIJ...",
    isPublished: true,
    // لا businessName ولا logoImage (موجودين فوق)
  },
  
  ownedCommunities: ["community_id"],
  followersCount: 150
}
```

---

## 📝 التغييرات المطلوبة

### **أ. BusinessSignup.jsx**

#### قبل:
```javascript
await setDoc(doc(db, 'users', user.uid), {
  display_name: formData.businessName,   // ✅
  businessInfo: {
    businessName: formData.businessName, // ❌ مكرر
    logoImage: null                       // ❌ يجب أن يكون photo_url
  }
});
```

#### بعد:
```javascript
await setDoc(doc(db, 'users', user.uid), {
  uid: user.uid,
  accountType: 'business',
  role: 'partner',
  
  // البيانات الأساسية = البزنس
  display_name: formData.businessName,    // اسم المطعم
  photo_url: null,                        // سيتم رفع اللوجو لاحقاً
  email: formData.email,
  
  // معلومات إضافية فقط
  businessInfo: {
    businessType: formData.businessType,
    phone: formData.phone,
    city: formData.city,
    country: formData.country,
    description: '',
    address: '',
    coverImage: null,
    lat: null,
    lng: null,
    placeId: null,
    isPublished: false
    // NO businessName or logoImage
  },
  
  followersCount: 0,
  ownedCommunities: [],
  created_at: serverTimestamp(),
  last_active_time: serverTimestamp()
});
```

---

### **ب. EditBusinessProfile.jsx**

#### التعديل الأساسي:
```javascript
// عند رفع اللوجو → استخدم photo_url بدلاً من businessInfo.logoImage
const handleLogoUpload = async (file) => {
  const logoUrl = await uploadBusinessImage(file, uid, 'logo');
  
  // تحديث photo_url الأساسي
  await updateDoc(doc(db, 'users', uid), {
    photo_url: logoUrl  // ← مباشرة، ليس في businessInfo
  });
};

// عند رفع الغلاف → businessInfo.coverImage
const handleCoverUpload = async (file) => {
  const coverUrl = await uploadBusinessImage(file, uid, 'cover');
  
  await updateDoc(doc(db, 'users', uid), {
    'businessInfo.coverImage': coverUrl
  });
};

// عند تعديل الاسم → display_name مباشرة
const handleNameChange = async (newName) => {
  await updateDoc(doc(db, 'users', uid), {
    display_name: newName  // ← ليس businessInfo.businessName
  });
};
```

---

### **ج. InvitationContext.jsx**

#### قبل:
```javascript
{
  name: info.businessName || 'Business',
  image: info.coverImage || '...',
  avatar: info.logoImage || ''
}
```

#### بعد:
```javascript
{
  id: doc.id,
  ownerId: doc.id,
  name: data.display_name || 'Business',      // ← من display_name
  type: info.businessType || 'Restaurant',
  image: info.coverImage || '...',
  avatar: data.photo_url || '',               // ← من photo_url
  // ... rest
}
```

---

### **د. Layout.jsx & Profile Display**

#### لا يحتاج تغيير!
- `currentUser.name` → سيكون اسم الشخص (User) أو اسم المطعم (Business) ✅
- `currentUser.avatar` → صورة الشخص أو لوجو المطعم ✅

**النظام يعمل بشفافية!**

---

## 🔄 Migration Script (للبيانات الموجودة)

```javascript
// migrateBusinessAccounts.js
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from './firebase/config';

async function migrateBusinessAccounts() {
  const usersRef = collection(db, 'users');
  const snapshot = await getDocs(usersRef);
  
  let migrated = 0;
  
  for (const userDoc of snapshot.docs) {
    const data = userDoc.data();
    
    // فقط حسابات Business
    if (data.accountType === 'business' && data.businessInfo) {
      const updates = {};
      
      // 1. نقل businessName → display_name (إذا لم يكن موجود)
      if (data.businessInfo.businessName && !data.display_name) {
        updates.display_name = data.businessInfo.businessName;
      }
      
      // 2. نقل logoImage → photo_url (إذا لم يكن موجود)
      if (data.businessInfo.logoImage && !data.photo_url) {
        updates.photo_url = data.businessInfo.logoImage;
      }
      
      // 3. حذف الحقول المكررة من businessInfo
      updates['businessInfo.businessName'] = deleteField();
      updates['businessInfo.logoImage'] = deleteField();
      
      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'users', userDoc.id), updates);
        migrated++;
        console.log(`✅ Migrated: ${userDoc.id}`);
      }
    }
  }
  
  console.log(`🎉 Migration complete! ${migrated} accounts updated.`);
}
```

---

## 📊 جدول التغييرات

| الحقل | قبل | بعد | ملاحظات |
|-------|-----|-----|---------|
| **اسم المطعم** | `businessInfo.businessName` | `display_name` | توحيد |
| **لوجو المطعم** | `businessInfo.logoImage` | `photo_url` | توحيد |
| **نوع البزنس** | `businessInfo.businessType` | `businessInfo.businessType` | لا تغيير |
| **الغلاف** | `businessInfo.coverImage` | `businessInfo.coverImage` | لا تغيير |
| **الوصف** | `businessInfo.description` | `businessInfo.description` | لا تغيير |

---

## ✅ الفوائد

1. **لا ازدواجية** - اسم واحد، صورة واحدة
2. **شفافية** - نفس الحقول للـ User و Business
3. **سهولة الصيانة** - كود أقل، أخطاء أقل
4. **Profile UI موحد** - يعرض البيانات الأساسية دائماً

---

## ⚠️ ملاحظات مهمة

1. **لا تحويل** - User يبقى User، Business يبقى Business
2. **اختيار عند التسجيل** - يجب على المستخدم اختيار النوع من البداية
3. **Business = Entity** - الحساب يمثل المطعم نفسه، ليس شخص
4. **User = Person** - الحساب يمثل شخص حقيقي

---

## 🚀 خطوات التنفيذ

### المرحلة 1: تحديث الكود
- [x] تحديث `BusinessSignup.jsx`
- [ ] تحديث `EditBusinessProfile.jsx`
- [ ] تحديث `InvitationContext.jsx`
- [ ] تحديث أي مكان يستخدم `businessInfo.businessName` أو `businessInfo.logoImage`

### المرحلة 2: Migration
- [ ] إنشاء `migrateBusinessAccounts.js`
- [ ] اختبار على بيانات تجريبية
- [ ] تنفيذ Migration على Production

### المرحلة 3: Cleanup
- [ ] حذف الحقول القديمة
- [ ] تحديث Firestore Rules
- [ ] تحديث الوثائق (Documentation)

---

**الحالة:** خطة جاهزة للتنفيذ ✅  
**الأولوية:** عالية 🔥  
**المدة المتوقعة:** 2-3 ساعات
