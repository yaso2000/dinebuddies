# 💰 **خطة بناء نظام الاشتراكات الكامل**

## 📊 **الوضع الحالي:**

### **✅ ما هو موجود:**
```
✅ صفحة Pricing جاهزة وجميلة
✅ باقات معرّفة في InvitationContext
✅ تكامل Stripe موجود
✅ Cloud Functions للدفع
✅ 3 باقات للأفراد (Free, Pro, Premium)
✅ Stripe Price IDs موجودة
```

### **❌ ما ينقص:**
```
❌ باقات الشركاء (Partners)
❌ إدارة الاشتراكات من لوحة الأدمن
❌ تتبع الاشتراكات في Firestore
❌ تطبيق القيود (Limits) على المستخدمين
❌ صفحة إدارة الاشتراك للمستخدم
❌ Webhooks للتحديثات التلقائية
❌ إلغاء/تجديد الاشتراك
```

---

## 🎯 **خطة العمل الشاملة:**

### **المرحلة 1: باقات الشركاء (أولوية عالية جداً)**

#### **1.1 إضافة باقات Partners:**
```javascript
// في InvitationContext.jsx
{
    id: 'partner-basic',
    name: 'باقة الشريك الأساسية',
    type: 'partner',
    price: 199,
    duration: { type: 'month', value: 1 },
    features: [
        'صفحة شريك مخصصة',
        'حتى 50 دعوة شهرياً',
        'إحصائيات أساسية',
        'دعم عبر البريد'
    ],
    limits: {
        invitations: 50,
        photos: 10,
        videos: 2
    }
},
{
    id: 'partner-pro',
    name: 'باقة الشريك المحترف',
    type: 'partner',
    price: 399,
    duration: { type: 'month', value: 1 },
    features: [
        'دعوات غير محدودة',
        'صور وفيديوهات غير محدودة',
        'إحصائيات متقدمة',
        'إعلانات مميزة',
        'دعم فوري'
    ],
    limits: {
        invitations: -1, // unlimited
        photos: -1,
        videos: -1,
        featured: true
    }
}
```

#### **1.2 تطبيق القيود (Limits):**
```javascript
// دالة للتحقق من القيود
const checkUserLimits = async (userId, action) => {
    const user = await getDoc(doc(db, 'users', userId));
    const subscription = user.data().subscription;
    
    if (!subscription || !subscription.active) {
        // استخدام حدود الباقة المجانية
        return { allowed: false, limit: 5 };
    }
    
    const plan = subscriptionPlans.find(p => p.id === subscription.planId);
    // تحقق من الحدود
};
```

---

### **المرحلة 2: إدارة الاشتراكات (أولوية عالية)**

#### **2.1 Firestore Schema:**
```javascript
// users/{userId}
{
    subscription: {
        planId: 'p2',
        status: 'active', // active, canceled, expired, trial
        startDate: Timestamp,
        endDate: Timestamp,
        stripeCustomerId: 'cus_xxx',
        stripeSubscriptionId: 'sub_xxx',
        cancelAtPeriodEnd: false,
        currentPeriodStart: Timestamp,
        currentPeriodEnd: Timestamp
    },
    usage: {
        invitationsThisMonth: 3,
        lastReset: Timestamp
    }
}
```

#### **2.2 صفحة إدارة الاشتراك:**
```
/subscription
- عرض الباقة الحالية
- تاريخ التجديد
- الاستخدام الحالي (3/20 دعوة)
- ترقية الباقة
- إلغاء الاشتراك
- تاريخ الفواتير
```

---

### **المرحلة 3: Stripe Webhooks (أولوية عالية)**

#### **3.1 Cloud Function للـ Webhooks:**
```javascript
// functions/index.js
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    
    switch (event.type) {
        case 'customer.subscription.created':
            // تفعيل الاشتراك
            break;
        case 'customer.subscription.updated':
            // تحديث الاشتراك
            break;
        case 'customer.subscription.deleted':
            // إلغاء الاشتراك
            break;
        case 'invoice.payment_succeeded':
            // تجديد الاشتراك
            break;
        case 'invoice.payment_failed':
            // فشل الدفع
            break;
    }
});
```

---

### **المرحلة 4: لوحة تحكم الأدمن (أولوية متوسطة)**

#### **4.1 صفحة إدارة الباقات:**
```
/admin/plans
- عرض جميع الباقات
- إضافة باقة جديدة
- تعديل باقة
- تفعيل/تعطيل باقة
- تغيير الأسعار
- إضافة خصومات
```

#### **4.2 صفحة إدارة الاشتراكات:**
```
/admin/subscriptions
- عرض جميع الاشتراكات
- فلترة (نشط، ملغي، منتهي)
- البحث بالمستخدم
- إلغاء اشتراك
- منح اشتراك مجاني
- عرض تاريخ الفواتير
```

#### **4.3 إحصائيات الإيرادات:**
```
/admin/revenue
- الإيرادات الشهرية
- الإيرادات السنوية
- عدد المشتركين لكل باقة
- معدل التحويل
- معدل الإلغاء (Churn Rate)
- رسوم بيانية
```

---

### **المرحلة 5: تحسينات UX (أولوية منخفضة)**

#### **5.1 Trial Period:**
```javascript
// تجربة مجانية لمدة 7 أيام
{
    trialDays: 7,
    trialEnd: Timestamp
}
```

#### **5.2 Promo Codes:**
```javascript
// أكواد خصم
{
    code: 'LAUNCH50',
    discount: 50, // %
    validUntil: Timestamp,
    maxUses: 100
}
```

#### **5.3 Referral Program:**
```javascript
// برنامج الإحالة
{
    referralCode: 'USER123',
    referredUsers: [],
    rewards: {
        freeMonth: true
    }
}
```

---

## 📋 **الأولويات:**

### **🔥 عالية جداً (ابدأ الآن):**
```
1. باقات الشركاء (Partner Plans)
2. تطبيق القيود (Limits Enforcement)
3. Stripe Webhooks
4. Firestore Schema للاشتراكات
```

### **⚡ عالية (الأسبوع القادم):**
```
5. صفحة إدارة الاشتراك للمستخدم
6. لوحة الأدمن - إدارة الباقات
7. لوحة الأدمن - إدارة الاشتراكات
```

### **📊 متوسطة (بعد أسبوعين):**
```
8. إحصائيات الإيرادات
9. تاريخ الفواتير
10. إلغاء/ترقية الاشتراك
```

### **✨ منخفضة (لاحقاً):**
```
11. Trial Period
12. Promo Codes
13. Referral Program
```

---

## 🛠️ **الأدوات الضرورية:**

### **1. Stripe Dashboard:**
```
✅ إنشاء Products
✅ إنشاء Prices
✅ إعداد Webhooks
✅ Test Mode للتجربة
```

### **2. Firebase Functions:**
```
✅ createCheckoutSession (موجود)
❌ stripeWebhook (يجب إنشاؤه)
❌ cancelSubscription
❌ updateSubscription
```

### **3. Firestore Rules:**
```javascript
// يجب تحديث القواعد
match /users/{userId} {
    allow read: if request.auth.uid == userId;
    allow write: if request.auth.uid == userId 
        && !request.resource.data.diff(resource.data).affectedKeys()
            .hasAny(['subscription.stripeCustomerId']);
}
```

---

## 💡 **توصيتي:**

### **الترتيب المقترح:**
```
الأسبوع 1:
✅ باقات الشركاء
✅ Firestore Schema
✅ تطبيق القيود الأساسية

الأسبوع 2:
✅ Stripe Webhooks
✅ صفحة إدارة الاشتراك
✅ اختبار شامل

الأسبوع 3:
✅ لوحة الأدمن - الباقات
✅ لوحة الأدمن - الاشتراكات
✅ إحصائيات الإيرادات
```

---

## 🎯 **الخلاصة:**

```
✅ لديك أساس جيد (Pricing Page + Stripe)
❌ تحتاج باقات الشركاء (أولوية قصوى)
❌ تحتاج Webhooks (ضروري للتحديثات)
❌ تحتاج لوحة أدمن (لإدارة كل شيء)

الأولوية:
1. باقات الشركاء
2. Webhooks
3. لوحة الأدمن
```

---

**هل تريد البدء بباقات الشركاء أولاً؟ أم تفضل ترتيب آخر؟** 🚀
