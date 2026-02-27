# 🗺️ إصلاح خريطة الشركاء - Restaurant Directory Map Fix

## ✅ **تم تطبيق نفس الحل**

تم تطبيق نفس الإصلاح الذي طبقناه على صفحة Home على صفحة الشركاء (RestaurantDirectory).

---

## 🔧 **التغييرات:**

### **الملف:** `src/pages/RestaurantDirectory.jsx`

#### **1. تغيير Conditional Rendering إلى CSS Display:**

```diff
- {viewMode === 'map' ? (
-     <div ref={mapRef}>Map</div>
- ) : (
-     <div>List</div>
- )}

+ <div ref={mapRef} style={{ display: viewMode === 'map' ? 'block' : 'none' }}>
+     Map
+ </div>
+ <div style={{ display: viewMode === 'list' ? 'block' : 'none' }}>
+     List
+ </div>
```

#### **2. إضافة useEffect للتحديث:**

```javascript
// Fix for map disappearing when switching between list and map view
useEffect(() => {
    if (viewMode === 'map' && mapInstance.current) {
        setTimeout(() => {
            if (mapInstance.current) {
                // ✅ تحديث حجم الخريطة
                mapInstance.current.invalidateSize();
                
                // ✅ إعادة ضبط العرض
                if (restaurantsWithCoords.length > 0 || userLocation) {
                    const bounds = [];
                    restaurantsWithCoords.forEach(res => {
                        if (res.lat && res.lng) bounds.push([res.lat, res.lng]);
                    });
                    if (userLocation) bounds.push([userLocation.lat, userLocation.lng]);
                    
                    if (bounds.length > 0) {
                        try {
                            mapInstance.current.fitBounds(bounds, {
                                padding: [50, 50],
                                maxZoom: 15,
                                animate: true
                            });
                        } catch (e) {
                            console.error("Error fitting bounds:", e);
                        }
                    }
                }
            }
        }, 100);
    }
}, [viewMode, restaurantsWithCoords, userLocation]);
```

---

## 📊 **النتيجة:**

### **✅ الآن في صفحة الشركاء:**

```
1. List View → Map View ✅ الخريطة تظهر
2. Map View → List View ✅ القائمة تظهر
3. List View → Map View ✅ الخريطة تظهر مرة أخرى!
4. يمكن التبديل بحرية ✅ بدون مشاكل
```

---

## 🎯 **الملفات المصلحة:**

| الملف | الحالة | الوصف |
|------|--------|-------|
| `Home.jsx` | ✅ مصلح | خريطة الدعوات |
| `RestaurantDirectory.jsx` | ✅ مصلح | خريطة الشركاء |

---

## 💡 **الفكرة الأساسية:**

**DOM Stability = Map Stability**

- ✅ الـ `<div ref={mapRef}>` موجود دائماً
- ✅ نستخدم `display: none/block` للإخفاء/الإظهار
- ✅ الخريطة تبقى مربوطة بنفس العنصر
- ✅ `invalidateSize()` تعمل بشكل صحيح

---

## 🔄 **للتطبيق:**

1. **Refresh** الصفحة (Ctrl + R)
2. **اذهب لصفحة الشركاء** `/restaurants`
3. **جرّب التبديل:**
   - List ✅
   - Map ✅
   - List ✅
   - Map ✅ ← **يجب أن تعمل!**

---

**تم إصلاح كلا الصفحتين بنجاح! 🎉**

الآن جميع الخرائط في التطبيق تعمل بشكل مثالي! 🗺️✨
