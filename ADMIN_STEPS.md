# 📋 **خطوات تشغيل Admin Panel - خطوة بخطوة**

## ✅ **تم إصلاح المشكلة!**

المشكلة كانت: `AdminRoute` يستخدم `useAuth()` خارج الـ `AuthProvider`
الحل: نقل `AdminRoute` إلى ملف منفصل

---

## 🚀 **الخطوات الكاملة:**

### **الخطوة 1: تشغيل التطبيق**

افتح PowerShell كـ Administrator وشغل:

```powershell
# اذهب للمجلد:
cd C:\Users\yaser\.gemini\antigravity\playground\temporal-coronal

# شغل التطبيق:
npm run dev
```

**النتيجة المتوقعة:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

---

### **الخطوة 2: افتح المتصفح**

```
افتح: http://localhost:5173
```

---

### **الخطوة 3: سجل دخول كأدمن**

```
Email: y.abohamed@gmail.com
Password: كلمة المرور الخاصة بك
```

---

### **الخطوة 4: اذهب لصفحة Migration**

**الطريقة الأولى (مباشرة):**
```
اكتب في المتصفح:
http://localhost:5173/admin/migration
```

**الطريقة الثانية (من Dashboard):**
```
1. اذهب إلى: http://localhost:5173/admin
2. سيتم توجيهك تلقائياً إلى: /admin/dashboard
3. في شريط العنوان، غير dashboard إلى migration
```

---

### **الخطوة 5: شغل Migration**

```
1. في صفحة Migration Tools
2. اضغط زر "Run Migration"
3. اضغط "OK" في التأكيد
4. انتظر رسالة النجاح
```

**النتيجة المتوقعة:**
```
✅ Migration Successful!
Successfully migrated 3 plans

Migrated Plans:
• Free Plan (ID: xxx)
• Pro Plan (ID: xxx)
• Premium Plan (ID: xxx)
```

---

### **الخطوة 6: تحقق من الباقات**

```
اذهب إلى: http://localhost:5173/admin/plans
```

**يجب أن ترى:**
```
✅ 3 بطاقات باقات
✅ Free Plan - $0/month
✅ Pro Plan - $39/month (Most Popular)
✅ Premium Plan - $79/month
```

---

### **الخطوة 7: اختبر صفحة Pricing**

```
اذهب إلى: http://localhost:5173/pricing
```

**يجب أن ترى:**
```
✅ الباقات الـ3 تظهر
✅ تأتي من Firestore (ليس من الكود)
```

---

## 🔧 **إذا واجهت مشاكل:**

### **مشكلة: PowerShell لا يشغل npm**

```powershell
# شغل PowerShell كـ Administrator
# ثم شغل:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# ثم جرب مرة أخرى:
npm run dev
```

---

### **مشكلة: الصفحة تعيد توجيه إلى "/"**

**السبب:** لست مسجل دخول كأدمن

**الحل:**
```
1. سجل خروج
2. سجل دخول بـ: y.abohamed@gmail.com
3. جرب مرة أخرى
```

---

### **مشكلة: "Migration cancelled"**

**السبب:** توجد باقات في Firestore بالفعل

**الحل:**
```
1. اضغط "OK" في التأكيد
2. أو احذف الباقات القديمة من /admin/plans
3. ثم شغل Migration مرة أخرى
```

---

## 📍 **جميع روابط Admin:**

```
Dashboard:        http://localhost:5173/admin/dashboard
Users:            http://localhost:5173/admin/users
Plans:            http://localhost:5173/admin/plans
Create Plan:      http://localhost:5173/admin/plans/new
Migration:        http://localhost:5173/admin/migration
```

---

## ✅ **Checklist:**

```
☐ npm run dev شغال
☐ http://localhost:5173 يفتح
☐ سجلت دخول كأدمن
☐ /admin/migration يفتح
☐ Migration نجح
☐ /admin/plans يعرض 3 باقات
☐ /pricing يعرض الباقات
```

---

**جرب الآن وأخبرني بالنتيجة!** 🚀
