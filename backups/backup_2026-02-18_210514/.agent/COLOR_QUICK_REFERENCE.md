# 🎨 DineBuddies Color System - Quick Reference

## 🚀 الأكثر استخداماً

```css
/* الألوان الأساسية */
var(--primary)         /* #8b5cf6 - بنفسجي */
var(--secondary)       /* #f43f5e - وردي */
var(--luxury-gold)     /* #fbbf24 - ذهبي */

/* الألوان الدلالية */
var(--color-success)   /* #10b981 - أخضر ✓ */
var(--color-error)     /* #ef4444 - أحمر ✗ */
var(--color-warning)   /* #f59e0b - برتقالي ⚠ */
var(--color-info)      /* #06b6d4 - أزرق ℹ */

/* الخلفيات */
var(--bg-body)         /* #020617 - الأغمق */
var(--bg-card)         /* #0f172a - غامق */
var(--bg-elevated)     /* #1e293b - مرفوع */
var(--bg-hover)        /* #334155 - hover */

/* النصوص */
var(--text-main)       /* #f8fafc - رئيسي */
var(--text-secondary)  /* #cbd5e1 - ثانوي */
var(--text-muted)      /* #94a3b8 - خافت */

/* الحدود */
var(--border-color)    /* rgba(255,255,255,0.1) */
var(--radius-md)       /* 18px */

/* التباعد */
var(--space-md)        /* 16px */
var(--space-lg)        /* 24px */
```

---

## 🎨 درجات الألوان (عند الحاجة)

### Primary (بنفسجي)
```
50  100  200  300  400  [500] 600  700  800  900
⬜  ⬜   ⬜   ⬜   ⬜   🟣   🟣   🟣   ⬛   ⬛
          فاتح        ←   أساسي  →      غامق
```

قاعدة: `500` = اللون الأساسي، `600` = hover

---

## ✅ الاستخدام الصحيح

```jsx
// ✅ صحيح
<button style={{
  background: 'var(--primary)',
  color: 'var(--btn-text)',
  padding: 'var(--space-md)',
  borderRadius: 'var(--radius-md)'
}}>

// ❌ خطأ
<button style={{
  background: '#8b5cf6',
  color: '#ffffff',
  padding: '16px',
  borderRadius: '18px'
}}>
```

---

## 🔄 التحويل السريع

| ❌ قديم | ✅ جديد |
|---------|---------|
| `#8b5cf6` | `var(--primary)` |
| `#10b981` | `var(--color-success)` |
| `#ef4444` | `var(--color-error)` |
| `16px padding` | `var(--space-md)` |
| `rgba(255,255,255,0.1)` | `var(--border-color)` |

---

## 🎯 حالات الاستخدام

### زر Success
```css
background: var(--color-success);
color: white;
```

### تنبيه Error
```css
background: var(--error-900);
border: 1px solid var(--error-500);
color: var(--error-100);
```

### كرت مرفوع
```css
background: var(--bg-elevated);
border: 1px solid var(--border-color);
```
