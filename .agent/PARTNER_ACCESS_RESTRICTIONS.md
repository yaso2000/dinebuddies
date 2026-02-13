# ✅ Partner/Business Account Access Restrictions

## 🎯 **الهدف:**
منع حسابات البزنس/الشركاء من:
- الانضمام لمجتمعات شركاء آخرين
- استضافة دعوات في أماكن شركاء آخرين
- الانضمام للدعوات (محظور سابقاً)

---

## 📋 **الملفات المعدّلة:**

### **1️⃣ `Layout.jsx`**
**التعديل**: إضافة أيقونة "Partners" لحسابات البزنس في شريط التنقل

**قبل:**
```jsx
{/* Hide Partners for business accounts */}
{!isBusinessAccount && (
    <Link to="/restaurants">
        <FaStore className="nav-icon" />
        <span>{t('nav_partners')}</span>
    </Link>
)}
```

**بعد:**
```jsx
{/* Partners - Show for everyone */}
<Link to="/restaurants">
    <FaStore className="nav-icon" />
    <span>{t('nav_partners')}</span>
</Link>
```

---

### **2️⃣ `App.jsx`**
**التعديل**: إزالة `BusinessBlockedRoute` من route `/restaurants`

**قبل:**
```jsx
<Route path="/restaurants" element={
    <BusinessBlockedRoute>
        <RestaurantDirectory />
    </BusinessBlockedRoute>
} />
```

**بعد:**
```jsx
<Route path="/restaurants" element={<RestaurantDirectory />} />
```

---

### **3️⃣ `Partners.jsx`**
**التعديل**: إزالة useEffect الذي كان يحظر البزنس من الدخول

**قبل:**
```jsx
useEffect(() => {
    const checkAccess = async () => {
        // ... check if business account
        if (userData.accountType === 'business' || userData.accountType === 'partner') {
            navigate('/', { replace: true }); // BLOCK
        }
    };
    checkAccess();
}, [navigate]);
```

**بعد:**
```jsx
// Business accounts can now view partners list (but cannot join or host invitations)
```

---

### **4️⃣ `RestaurantDirectory.jsx`**
**التعديل**: إخفاء أزرار "Host Invitation" و "Join" للبزنس

**الإضافات:**
```jsx
import { useAuth } from '../context/AuthContext';

const RestaurantCard = ({ res }) => {
    const { userProfile } = useAuth();
    const isBusinessAccount = userProfile?.accountType === 'business';
    
    // ...
    
    {/* Host Invitation - Hidden for business */}
    {!isOwner && !isBusinessAccount && (
        <button onClick={handleCreateInvite}>
            Host Invitation Here
        </button>
    )}
    
    {/* Join Button - Hidden for business */}
    {isOwner ? (
        <span>Owner</span>
    ) : !isBusinessAccount ? (
        <button onClick={toggleCommunity}>
            {isJoined ? 'Joined' : 'Join'}
        </button>
    ) : null}
}
```

---

### **5️⃣ `PartnerProfile.jsx`**
**التعديل**: إخفاء أزرار "Join Community" و "Host Invitation" للبزنس

**الإضافات:**
```jsx
// في أعلى الـ component
const isOwner = currentUser?.uid === partnerId;

// Join Community Button
{currentUser?.uid !== partnerId && userProfile?.accountType !== 'business' ? (
    <button onClick={handleJoinCommunity}>
        Join Community ({memberCount} members)
    </button>
) : currentUser?.uid === partnerId ? (
    <div>Your Community ({memberCount} members)</div>
) : null}

// Host Invitation Button
{currentUser?.uid !== partnerId && userProfile?.accountType !== 'business' ? (
    <button onClick={handleCreateInvitation}>
        Create Invitation Here
    </button>
) : /* ... */}
```

---

### **6️⃣ `BusinessCard.jsx`**
**الوضع الحالي**: زر "Host Invitation Here" **مخفي بالفعل** للبزنس

```jsx
const isBusinessAccount = userProfile?.accountType === 'business';

{!isBusinessAccount && (
    <button onClick={handleCreateInvitation}>
        Host Invitation Here
    </button>
)}
```

---

### **7️⃣ إخفاء الخريطة عن المالك في `PartnerProfile.jsx`**
**التعديل**: الخريطة تظهر للزبائن فقط

```jsx
const isOwner = currentUser?.uid === partnerId;

{/* Map - Visible to customers only */}
{!isOwner && businessInfo.coordinates?.lat && businessInfo.coordinates?.lng && (
    <div>
        <SimpleMap ... />
    </div>
)}
```

---

### **8️⃣ إضافة مفاتيح الترجمة**

**`en.json` و `ar.json`:**
```json
{
    "payment_methods": "Payment Methods / طرق الدفع",
    "billing_history": "Billing History / سجل الفواتير",
    "advertising": "Advertising / الإعلانات",
    "manage_campaigns": "Manage Campaigns / إدارة الحملات",
    "ad_analytics": "Ad Analytics / تحليلات الإعلانات"
}
```

---

## 🎯 **النتيجة النهائية:**

### **حسابات البزنس/الشركاء:**
✅ **يمكنها:**
- رؤية صفحة Partners (`/restaurants`)
- رؤية كروت الشركاء الآخرين
- رؤية تفاصيل الشركاء
- رؤية Dashboard الخاص بها

❌ **لا يمكنها:**
- الانضمام لمجتمعات شركاء آخرين
- استضافة دعوات في أماكن شركاء آخرين
- الانضمام للدعوات (محظور سابقاً)
- رؤية الخريطة في Dashboard الخاص بها

### **المستخدمون العاديون:**
✅ **يمكنهم:**
- كل شيء كما كان (لا تغيير)

---

## 📝 **ملاحظات:**

1. **Account Types:**
   - `'business'` - حساب البزنس/الشريك (الوحيد المستخدم)
   - `'partner'` - موجود في الكود للتوافق لكن غير مستخدم فعلياً
   - `'admin'` - حساب الأدمن
   - `'guest'` - حساب الضيف
   - (default) - مستخدم عادي

2. **الأسطر الفارغة في `Partners.jsx`:**
   - موجودة لكن لا تؤثر على عمل الكود
   - يمكن تنظيفها يدوياً إذا لزم الأمر

---

**✅ تم الانتهاء بنجاح! 🎉**
