# 🔧 Stories Troubleshooting Guide

## 🎯 **خطوات التشخيص:**

---

## **الخطوة 1: افتح Browser Console** (F12)

### **في المتصفح:**
1. اضغط `F12` أو `Ctrl+Shift+I`
2. اذهب إلى تبويب **Console**
3. افتح صفحة `/friends` (Community)
4. شاهد الرسائل

---

## **الخطوة 2: ابحث عن هذه الرسائل:**

### **✅ السيناريو المثالي (يعمل):**
```
🔍 Loading stories...
📅 Current time: [Date]
📊 Stories found: 2
📖 Story: {partnerId: "...", type: "image", ...}
📖 Story: {partnerId: "...", type: "text", ...}
✅ Partners with stories: [{partnerId: "...", stories: [...]}, ...]
```

### **❌ مشكلة: Index لم ينتهي**
```
❌ Error loading stories: FirebaseError
Error details: FAILED_PRECONDITION
The query requires an index...
```

**الحل:**
- انتظر 5 دقائق
- تحقق من Firebase Console → Indexes
- يجب أن يكون Status = "Enabled" ✅

---

### **❌ مشكلة: لا توجد Stories**
```
🔍 Loading stories...
📅 Current time: [Date]
📊 Stories found: 0
✅ Partners with stories: []
```

**السبب المحتمل:**
1. **Stories انتهت (>24 ساعة)**
2. **expiresAt في الماضي**
3. **isActive = false**

**الحل:**
- افتح Firestore Console
- Collection: `partnerStories`
- تحقق من Documents

---

## **الخطوة 3: تحقق من Firestore Console**

### **افتح Firebase Console:**
```
https://console.firebase.google.com
→ Your Project
→ Firestore Database
→ partnerStories collection
```

### **تحقق من كل Story:**

#### **✅ Story صحيح:**
```javascript
{
  partnerId: "ABC123",
  partnerName: "KFC",
  partnerLogo: "https://...",
  type: "image" or "text",
  
  // ⏰ التوقيت مهم جداً!
  createdAt: February 10, 2026 at 8:30 AM
  expiresAt: February 11, 2026 at 8:30 AM  // في المستقبل ✅
  
  isActive: true,  // ✅
  views: [],
  likes: []
}
```

#### **❌ Story منتهي:**
```javascript
{
  expiresAt: February 9, 2026 at 8:30 AM  // في الماضي ❌
}
```

**الحل:** أنشئ Story جديد

---

#### **❌ Story غير نشط:**
```javascript
{
  isActive: false  // ❌
}
```

**الحل:** غيره يدوياً إلى `true`

---

## **الخطوة 4: تحقق من Firestore Indexes**

### **افتح Indexes Page:**
```
Firebase Console
→ Firestore Database  
→ Indexes (في القائمة الجانبية)
```

### **ابحث عن:**
```
Collection: partnerStories
Fields: expiresAt, isActive, createdAt
Status: ✅ Enabled  (يجب أن يكون كذا!)
```

### **إذا كان Status:**

#### **🟡 Building...**
- انتظر 2-5 دقائق
- Refresh الصفحة

#### **🔴 Error**
- اعمل deploy مرة أخرى:
```bash
firebase deploy --only firestore:indexes
```

---

## **الخطوة 5: اختبر Query يدوياً**

### **في Firestore Console:**
1. افتح `partnerStories` collection
2. شاهد Documents
3. تحقق من:
   - عدد Stories
   - `expiresAt` في المستقبل
   - `isActive = true`

---

## **الخطوة 6: أنشئ Story جديد (للاختبار)**

### **من My Community:**
```
1. Login كـ Business account
2. افتح My Community (/my-community)
3. اضغط "+ Story"
4. أنشئ Text story:
   - النص: "Test Story"
   - Background: أي لون
5. Post ✅
```

### **ثم:**
```
1. افتح FriendsFeed (/friends)
2. F12 → Console
3. شاهد Logs:
   - 📊 Stories found: 1 ✅
4. يجب أن ترى دائرة Story!
```

---

## **الخطوة 7: تحقق من الصفحة الصحيحة**

### **✅ الصفحة الصحيحة:**
```
URL: /friends
Header: "🌍 Community"
Text: "Discover offers..."
```

### **❌ الصفحة الخطأ:**
```
URL: /posts-feed
Header: "Partners Feed"
```

---

## **مشاكل شائعة وحلولها:**

### **1. Index لم ينتهي Building**
```
⏰ الوقت: 2-5 دقائق بعد deploy
✅ الحل: انتظر ثم Refresh
```

### **2. expiresAt في الماضي**
```
🔍 السبب: Story أقدم من 24 ساعة
✅ الحل: أنشئ story جديد
```

### **3. JavaScript Date vs Firestore Timestamp**
```
❌ JavaScript Date: new Date(...)
✅ Firestore: يقبل Date objects في queries
```

### **4. Query Permissions**
```
❌ Missing permissions
✅ الحل: تحقق من Firestore Rules:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /partnerStories/{storyId} {
      allow read: if resource.data.isActive == true;
      allow write: if request.auth != null;
    }
  }
}
```

---

## **📝 Checklist النهائي:**

قبل أن تقول "لا تظهر"، تأكد:

- ☐ فتحت `/friends` (وليس `/posts-feed`)
- ☐ Firestore Index = "Enabled"
- ☐ Story موجود في Firestore
- ☐ `expiresAt` في المستقبل
- ☐ `isActive = true`
- ☐ انتظرت 5 دقائق بعد deploy index
- ☐ عملت Refresh للصفحة (F5)
- ☐ فتحت Console (F12) وشفت Logs

---

## **🎯 أرسل لي:**

إذا لم تظهر بعد، أرسل لي:

1. **Screenshot من Console (F12)**
2. **Screenshot من Firestore partnerStories collection**
3. **Screenshot من Firestore Indexes**
4. **URL الصفحة التي تفتحها**

ومعهم هقدر أساعدك بدقة! 🚀

---

## **✨ Quick Test:**

افتح Console الآن (F12) واكتب:
```javascript
// Test Stories loading
console.log('Testing Stories...');
```

ثم افتح `/friends` وشاهد Logs! 📊
