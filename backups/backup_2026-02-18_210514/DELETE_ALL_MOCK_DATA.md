# 🗑️ **حذف جميع البيانات الوهمية من Firestore**

## 🎯 **ما يجب حذفه:**

من الصورة، يوجد الكثير من البيانات في:
```
✅ invitations - الكثير من الدعوات الوهمية
✅ users - مستخدمين وهميين
✅ conversations - محادثات قديمة
✅ notifications - إشعارات قديمة
✅ communityMessages - رسائل قديمة
✅ communityPosts - منشورات قديمة
```

---

## 🛠️ **الحل: حذف شامل**

### **الطريقة 1: حذف يدوي (موصى به)**

#### **1. افتح Firestore Console:**
```
https://console.firebase.google.com
→ اختر مشروعك
→ Firestore Database
```

#### **2. احذف من كل collection:**

**invitations:**
```
1. افتح collection: invitations
2. احذف جميع documents
   (يمكنك تحديد الكل والحذف دفعة واحدة)
```

**users:**
```
1. افتح collection: users
2. احذف جميع documents ماعدا:
   - y.abohamed@gmail.com
   - yazo
```

**conversations:**
```
1. افتح collection: conversations
2. احذف جميع documents
```

**notifications:**
```
1. افتح collection: notifications
2. احذف جميع documents
```

**communityMessages:**
```
1. افتح collection: communityMessages
2. احذف جميع documents
```

**communityPosts:**
```
1. افتح collection: communityPosts
2. احذف جميع documents
```

**typing:**
```
1. افتح collection: typing
2. احذف جميع documents
```

**restaurants:**
```
1. افتح collection: restaurants (إن وجدت)
2. احذف جميع documents
```

**partner_notifications:**
```
1. افتح collection: partner_notifications (إن وجدت)
2. احذف جميع documents
```

---

### **الطريقة 2: باستخدام Firebase CLI (أسرع)**

```bash
# تثبيت Firebase CLI (إذا لم يكن مثبت):
npm install -g firebase-tools

# تسجيل الدخول:
firebase login

# حذف collection كاملة:
firebase firestore:delete invitations --recursive
firebase firestore:delete conversations --recursive
firebase firestore:delete notifications --recursive
firebase firestore:delete communityMessages --recursive
firebase firestore:delete communityPosts --recursive
firebase firestore:delete typing --recursive

# ملاحظة: لا تحذف users - احذفها يدوياً
```

---

## ⚠️ **مهم جداً:**

### **لا تحذف:**
```
✅ users/y.abohamed@gmail.com
✅ users/yazo (إذا كان حساب حقيقي)
```

### **احذف كل شيء آخر:**
```
❌ جميع invitations
❌ جميع conversations
❌ جميع notifications
❌ جميع communityMessages
❌ جميع communityPosts
❌ جميع typing
❌ جميع users الوهميين
```

---

## 📋 **قائمة التحقق:**

بعد الحذف، تحقق من:

```
☐ invitations: 0 documents
☐ conversations: 0 documents
☐ notifications: 0 documents
☐ communityMessages: 0 documents
☐ communityPosts: 0 documents
☐ typing: 0 documents
☐ users: 2 documents فقط (المالك + yazo)
```

---

## 🚀 **بعد الحذف:**

### **1. أعد تشغيل التطبيق:**
```bash
# أوقف التطبيق (Ctrl+C)
# ثم شغله من جديد:
npm run dev
```

### **2. تحقق من الصفحات:**
```
✅ الرئيسية: لا دعوات
✅ Partners: لا شركاء (أو فقط الحقيقيين)
✅ Messages: لا محادثات
✅ Notifications: لا إشعارات
```

---

## 💡 **نصيحة:**

**استخدم الطريقة اليدوية (Console) لأول مرة:**
```
✅ أكثر أماناً
✅ تتحكم في كل document
✅ لا خطر حذف بيانات مهمة
```

**استخدم Firebase CLI للمرات القادمة:**
```
✅ أسرع
✅ مناسب للحذف الشامل
```

---

## 🎯 **الخطوات الموصى بها:**

```
1. افتح Firestore Console
2. ابدأ بـ invitations (احذف الكل)
3. ثم conversations (احذف الكل)
4. ثم notifications (احذف الكل)
5. ثم communityMessages (احذف الكل)
6. ثم communityPosts (احذف الكل)
7. ثم typing (احذف الكل)
8. أخيراً users (احذف الوهميين فقط)
```

---

**ابدأ الآن! 🚀**

**الرابط:**
https://console.firebase.google.com/project/YOUR-PROJECT-ID/firestore
