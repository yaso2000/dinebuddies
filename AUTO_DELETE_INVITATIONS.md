# 🗑️ حذف الدعوات المكتملة تلقائياً - Cloud Function

## 📋 المنطق الجديد

### 1️⃣ عند اكتمال الدعوة (Completed)
- ✅ تظهر في الصفحة الرئيسية بعنوان "مكتملة" لمدة **ساعة واحدة**
- ✅ الشات يبقى نشطاً
- ✅ يمكن الوصول للدعوة بالرابط

### 2️⃣ بعد ساعة من الاكتمال
- ❌ **تختفي** من الصفحة الرئيسية
- ✅ لكن تبقى موجودة (يمكن الوصول بالرابط)
- ✅ الشات يبقى نشطاً

### 3️⃣ بعد 24 ساعة من الاكتمال
- ❌ **حذف كامل** للدعوة
- ❌ حذف الشات والرسائل
- ❌ حذف كل البيانات

---

## ✅ ما تم تنفيذه

### 1. تحديث `updateMeetingStatus`
```javascript
// في InvitationContext.jsx
const updateMeetingStatus = async (id, status) => {
    const updateData = {
        meetingStatus: status
    };
    
    // حفظ وقت الاكتمال
    if (status === 'completed') {
        updateData.completedAt = serverTimestamp();
    }
    
    await updateDoc(invitationRef, updateData);
};
```

### 2. تحديث منطق الصفحة الرئيسية
```javascript
// في Home.jsx
// إخفاء الدعوات المكتملة بعد ساعة
if (inv.meetingStatus === 'completed' && inv.completedAt) {
    const completedTime = inv.completedAt.toDate();
    const oneHourAfterCompletion = new Date(completedTime.getTime() + 60 * 60 * 1000);
    if (now > oneHourAfterCompletion) return false;
}
```

### 3. إزالة منطق إغلاق الشات
- ✅ الشات يبقى نشطاً دائماً
- ✅ يُحذف فقط عند حذف الدعوة

---

## 🔧 الخطوة التالية: Cloud Function للحذف التلقائي

### إعداد Cloud Function

#### 1. تثبيت Firebase Functions
```bash
cd c:\Users\yaser\inebuddies\dinebuddies
firebase init functions
```

اختر:
- Language: **JavaScript**
- ESLint: **Yes**
- Install dependencies: **Yes**

#### 2. إنشاء الدالة

في ملف `functions/index.js`:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

// تشغيل كل ساعة
exports.deleteExpiredInvitations = functions.pubsub
    .schedule('every 1 hours')
    .onRun(async (context) => {
        const now = admin.firestore.Timestamp.now();
        const twentyFourHoursAgo = new Date(now.toDate().getTime() - (24 * 60 * 60 * 1000));

        try {
            // البحث عن الدعوات المكتملة منذ أكثر من 24 ساعة
            const expiredInvitations = await db.collection('invitations')
                .where('meetingStatus', '==', 'completed')
                .where('completedAt', '<=', admin.firestore.Timestamp.fromDate(twentyFourHoursAgo))
                .get();

            console.log(`Found ${expiredInvitations.size} expired invitations to delete`);

            const batch = db.batch();
            let deleteCount = 0;

            for (const doc of expiredInvitations.docs) {
                // حذف الرسائل أولاً
                const messagesSnapshot = await db.collection('invitations')
                    .doc(doc.id)
                    .collection('messages')
                    .get();

                messagesSnapshot.forEach(msgDoc => {
                    batch.delete(msgDoc.ref);
                });

                // حذف الدعوة
                batch.delete(doc.ref);
                deleteCount++;

                // Firestore batch limit is 500
                if (deleteCount >= 500) {
                    await batch.commit();
                    deleteCount = 0;
                }
            }

            if (deleteCount > 0) {
                await batch.commit();
            }

            console.log(`Successfully deleted ${expiredInvitations.size} expired invitations`);
            return null;
        } catch (error) {
            console.error('Error deleting expired invitations:', error);
            return null;
        }
    });
```

#### 3. نشر Cloud Function
```bash
firebase deploy --only functions
```

---

## 🧪 الاختبار

### اختبار سريع (للتطوير):

1. **أنشئ دعوة**
2. **اجعلها مكتملة** (Mark as Completed)
3. **تحقق من Firestore** - يجب أن ترى `completedAt` timestamp
4. **انتظر ساعة** - يجب أن تختفي من الصفحة الرئيسية
5. **افتح بالرابط** - يجب أن تكون موجودة
6. **انتظر 24 ساعة** - يجب أن تُحذف تماماً

### اختبار Cloud Function يدوياً:

```bash
# في Firebase Console
# اذهب إلى Functions
# اضغط على "deleteExpiredInvitations"
# اضغط "Test function"
```

---

## 📊 مراقبة الحذف

### في Firebase Console:
1. اذهب إلى **Functions**
2. اختر `deleteExpiredInvitations`
3. اضغط **Logs**
4. ستر ى:
   - عدد الدعوات المحذوفة
   - أي أخطاء

---

## ⚙️ إعدادات إضافية (اختيارية)

### تغيير التوقيت:

```javascript
// كل 6 ساعات
.schedule('every 6 hours')

// كل يوم في منتصف الليل
.schedule('0 0 * * *')

// كل ساعة
.schedule('every 1 hours')
```

### تغيير مدة الحذف:

```javascript
// 12 ساعة بدلاً من 24
const twelveHoursAgo = new Date(now.toDate().getTime() - (12 * 60 * 60 * 1000));

// 48 ساعة
const fortyEightHoursAgo = new Date(now.toDate().getTime() - (48 * 60 * 60 * 1000));
```

---

## 💰 التكلفة

Cloud Functions مجانية حتى:
- 2 مليون استدعاء/شهر
- 400,000 GB-ثانية/شهر

دالة تعمل كل ساعة = **720 استدعاء/شهر** ✅ مجاني تماماً!

---

## ✅ الخلاصة

### تم التنفيذ:
- ✅ حفظ وقت الاكتمال في Firestore
- ✅ إخفاء الدعوات المكتملة بعد ساعة
- ✅ إزالة منطق إغلاق الشات

### يحتاج تنفيذ:
- ⏳ Cloud Function للحذف التلقائي بعد 24 ساعة

**الشات الجماعي جاهز ويعمل بشكل مثالي!** 🎉
