# 📱 Partner Stories Feature - Like Instagram

## 🎯 المفهوم

تحويل البوستات إلى **Stories** تظهر للمستخدمين بشكل جذاب مثل Instagram.

---

## ✨ المميزات المطلوبة

### 1. **عرض Stories في الأعلى**
```
[ 🔴 Story1 ] [ ⚪ Story2 ] [ ⚪ Story3 ] →
  Partner1      Partner2      Partner3
```

- دوائر في الأعلى
- النشط (غير مشاهد) = حلقة ملونة
- المشاهد = حلقة رمادية

### 2. **Story Viewer (Full Screen)**
- عند الضغط → Full screen
- صورة/نص كبير
- Progress bar في الأعلى
- انتقال تلقائي (5 ثواني)
- Tap يسار/يمين للتنقل
- زر X للإغلاق

### 3. **انتهاء الصلاحية**
- تختفي بعد 24 ساعة
- عداد تنازلي "منذ 5 ساعات"

### 4. **التفاعل**
- Like من داخل Story
- Comment (اختياري)
- Share (اختياري)

---

## 🏗️ البنية المقترحة

### Components الجديدة:

#### 1. **StoriesBar.jsx**
```jsx
// دوائر في الأعلى قابلة للتمرير
<div className="stories-bar">
  <StoryCircle partner={...} viewed={false} />
  <StoryCircle partner={...} viewed={true} />
</div>
```

#### 2. **StoryViewer.jsx**
```jsx
// Full screen viewer
<div className="story-viewer">
  <ProgressBar stories={5} current={2} />
  <StoryContent story={...} />
  <NavigationControls />
</div>
```

#### 3. **StoryCircle.jsx**
```jsx
// دائرة واحدة
<div className="story-circle">
  <img src={partnerLogo} />
  <div className="story-ring active" />
</div>
```

---

## 📊 بنية البيانات

### Firestore Collection: `partnerStories`

```javascript
{
  id: string,
  partnerId: string,
  partnerName: string,
  partnerLogo: string,
  
  // Story Content
  type: 'image' | 'text',
  image: string (if type=image),
  text: string (if type=text),
  backgroundColor: string (if type=text),
  
  // Metadata
  createdAt: timestamp,
  expiresAt: timestamp, // createdAt + 24 hours
  
  // Engagement
  views: [userId1, userId2, ...],
  likes: [userId1, userId2, ...],
  
  // Status
  isActive: boolean // false if expired
}
```

---

## 🎨 التصميم

### Stories Bar:
```
┌──────────────────────────────────────┐
│  [🔴●] [⚪○] [🔴●] [⚪○]  →          │
│   KFC   Pizza  Cafe  Sushi           │
└──────────────────────────────────────┘
```

### Story Viewer:
```
┌────────────────────────────────────┐
│ ████░░░░░░ (Progress)              │
│                                    │
│                                    │
│         📸 صورة كبيرة              │
│         أو نص                      │
│                                    │
│                                    │
│ ❤️ 45 likes  👁️ 120 views         │
│                                    │
│ [Partner Name]    [منذ 3 ساعات]    │
└────────────────────────────────────┘
  ← Tap          Tap →       ✕
```

---

## 🔧 الوظائف المطلوبة

### 1. **إنشاء Story (للشريك)**
```javascript
const createStory = async (partnerId, content) => {
  const story = {
    partnerId,
    ...content,
    createdAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    views: [],
    likes: [],
    isActive: true
  };
  
  await addDoc(collection(db, 'partnerStories'), story);
};
```

### 2. **عرض Stories النشطة**
```javascript
const getActiveStories = () => {
  const now = new Date();
  return query(
    collection(db, 'partnerStories'),
    where('expiresAt', '>', now),
    where('isActive', '==', true),
    orderBy('createdAt', 'desc')
  );
};
```

### 3. **تسجيل المشاهدة**
```javascript
const markAsViewed = async (storyId, userId) => {
  const storyRef = doc(db, 'partnerStories', storyId);
  await updateDoc(storyRef, {
    views: arrayUnion(userId)
  });
};
```

### 4. **حذف Stories المنتهية**
```javascript
// Cloud Function تعمل كل ساعة
const cleanupExpiredStories = async () => {
  const now = new Date();
  const expired = await getDocs(
    query(
      collection(db, 'partnerStories'),
      where('expiresAt', '<', now)
    )
  );
  
  expired.forEach(doc => deleteDoc(doc.ref));
};
```

---

## 🎯 خطة التنفيذ

### المرحلة 1: البنية الأساسية ✅
1. إنشاء Firestore collection
2. إنشاء StoryCircle component
3. إنشاء StoriesBar component

### المرحلة 2: العرض ✅
4. إنشاء StoryViewer component
5. Progress bar
6. Navigation (tap/swipe)

### المرحلة 3: التفاعل ✅
7. Views tracking
8. Likes
9. Auto-advance timer

### المرحلة 4: الإدارة ✅
10. Partner story creation UI
11. Expiry management
12. Delete stories

---

## 💡 مزايا إضافية (مستقبلية)

- **Insights:** عدد المشاهدات لكل story
- **Highlights:** حفظ stories دائمة
- **Polls/Questions:** تفاعل أكثر
- **Music/Stickers:** مثل Instagram
- **Story Replies:** رسائل خاصة

---

## ⚙️ الإعدادات التقنية

### Auto-advance Timer:
```javascript
const STORY_DURATION = 5000; // 5 seconds
```

### Navigation:
```javascript
// Tap left 1/3 → Previous
// Tap right 2/3 → Next
// Swipe down → Close
```

### Animations:
```css
transition: opacity 0.3s, transform 0.3s;
transform: scale(0.9) → scale(1);
```

---

## 🚀 هل نبدأ؟

**الخطة:**
1. أنشئ Components الأساسية
2. أضيف إلى Home page
3. أنشئ Story creation UI للشريك
4. أضيف الانيميشن والتفاعل

**موافق؟** أبدأ الآن! 🎨✨
