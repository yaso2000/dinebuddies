# 🔒 Firestore Security Rules for Special Offers

## ⚠️ **مهم جداً!**

يجب إضافة هذه القواعد إلى `firestore.rules` حتى تعمل ميزة العروض الخاصة.

---

## 📝 **القواعد المطلوبة:**

افتح ملف `firestore.rules` وأضف هذه القواعد داخل `match /databases/{database}/documents`:

```javascript
// Special Offers Collection
match /specialOffers/{offerId} {
  // السماح بالقراءة للجميع للعروض النشطة فقط
  allow read: if resource.data.status == 'active';
  
  // السماح بالإنشاء فقط للشركاء Premium
  allow create: if request.auth != null 
    && request.auth.uid == request.resource.data.partnerId
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.subscriptionTier == 'premium';
  
  // السماح بالتعديل والحذف فقط لمالك العرض
  allow update, delete: if request.auth != null 
    && request.auth.uid == resource.data.partnerId;
}
```

---

## 🔥 **الملف الكامل (مثال):**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ... القواعد الموجودة الأخرى ...
    
    // Special Offers Collection
    match /specialOffers/{offerId} {
      allow read: if resource.data.status == 'active';
      
      allow create: if request.auth != null 
        && request.auth.uid == request.resource.data.partnerId
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.subscriptionTier == 'premium';
      
      allow update, delete: if request.auth != null 
        && request.auth.uid == resource.data.partnerId;
    }
    
  }
}
```

---

## 📋 **كيفية النشر:**

### الطريقة 1: عبر Firebase Console (أسهل)

1. افتح [Firebase Console](https://console.firebase.google.com/)
2. اختر مشروعك
3. اذهب إلى **Firestore Database** من القائمة الجانبية
4. اضغط على تبويب **Rules**
5. أضف القواعد أعلاه
6. اضغط **Publish**

### الطريقة 2: عبر Firebase CLI

```bash
# تأكد من أنك في مجلد المشروع
cd C:\Users\yaser\inebuddies\dinebuddies

# نشر القواعد
firebase deploy --only firestore:rules
```

---

## ⚡ **بعد إضافة القواعد:**

1. ✅ جرب إنشاء عرض جديد مرة أخرى
2. ✅ يجب أن يعمل بدون مشاكل
3. ✅ إذا استمرت المشكلة، تحقق من الكونسول في المتصفح للأخطاء

---

## 🧪 **اختبار القواعد:**

القواعد تسمح بـ:
- ✅ **القراءة**: للجميع (فقط العروض النشطة)
- ✅ **الإنشاء**: للشركاء Premium فقط
- ✅ **التعديل/الحذف**: لمالك العرض فقط

القواعد تمنع:
- ❌ إنشاء عرض من شريك ليس Premium
- ❌ تعديل عرض من شخص آخر غير المالك
- ❌ قراءة العروض المحذوفة أو المنتهية

---

## ⚠️ **ملاحظة:**

إذا كنت في وضع **التطوير** وتريد اختباراً سريعاً دون قيود:

```javascript
// ⚠️ فقط للتطوير - لا تستخدم في الإنتاج!
match /specialOffers/{offerId} {
  allow read, write: if request.auth != null;
}
```

**لكن تذكر استبدالها بالقواعد الصحيحة قبل النشر النهائي!**
