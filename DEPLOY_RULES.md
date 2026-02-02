# تحديث Firestore Rules ✅

## ما تم إضافته

تم إضافة قواعد أمان لـ **رسائل الشات الجماعي** في الدعوات:

```javascript
match /invitations/{invitationId} {
  // ... القواعد الموجودة ...
  
  // رسائل الشات الجماعي
  match /messages/{messageId} {
    // القراءة: فقط المضيف والأعضاء المقبولين
    allow read: if isAuthenticated() && (
      get(/databases/$(database)/documents/invitations/$(invitationId)).data.author.id == request.auth.uid ||
      request.auth.uid in get(/databases/$(database)/documents/invitations/$(invitationId)).data.joined
    );
    
    // الكتابة: فقط المضيف والأعضاء المقبولين
    allow create: if isAuthenticated() && (
      get(/databases/$(database)/documents/invitations/$(invitationId)).data.author.id == request.auth.uid ||
      request.auth.uid in get(/databases/$(database)/documents/invitations/$(invitationId)).data.joined
    ) && request.resource.data.senderId == request.auth.uid;
    
    // الحذف: فقط صاحب الرسالة
    allow delete: if isAuthenticated() && resource.data.senderId == request.auth.uid;
  }
}
```

## الخطوة التالية: نشر القواعد

**يجب تنفيذ هذا الأمر لنشر القواعد:**

```bash
firebase deploy --only firestore:rules
```

---

## بعد النشر:

1. انتظر 10-30 ثانية حتى تُطبق القواعد
2. أعد تحميل الصفحة
3. جرب إرسال رسالة مرة أخرى

---

**الشات سيعمل بعد نشر القواعد!** 🚀
