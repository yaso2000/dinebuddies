# تقرير التدقيق الشامل — DineBuddies
**التاريخ:** 18 سبتمبر 2026 · **المصدر:** `C:\Users\yaser\v1\dinebuddies` (الحالة الحالية على القرص، آخر commit `35b92e5b`)
**النطاق:** `src/` (~174 ألف سطر، 898 ملف)، `api/` (30 نقطة نهاية Vercel)، `functions/` (~40 دالة callable)، `firestore.rules` (1743 سطر)، `storage.rules`، الترجمات العشر، إعدادات البناء والنشر.
**الطريقة:** أربعة تدقيقات متوازية (أمان، بنية الواجهة، الترجمة/إزالة المواعدة/حماية القاصرين، المدفوعات/النشر) ثم تحقق يدوي من كل ما هو حرج/عالٍ بقراءة السطر المذكور. كل بند فيه `ملف:سطر` حتى يستطيع أي وكيل أو مطور الوصول إليه مباشرة.

---

## 0. الخلاصة التنفيذية

التطبيق **أكبر وأنضج مما يبدو** من الخارج: أنظمة الدفع الأربعة (Stripe/PayPal/Apple/Google) تتحقق من الإيصالات على الخادم وتستخدم معاملات Firestore وسجلّ ائتمانات مقفلاً أمام العميل — وهذا أصعب جزء وقد أُنجز صحيحاً. لكن لأن كل وكيل كان يصلح ما يُطلب منه فقط، تراكمت **ثغرات على الحواف**: قاعدة إنشاء المستخدم تسمح بسكّ رصيد مجاني، وكيل proxy مفتوح على نطاقك، عملة PayPal يختارها العميل، حماية القاصرين موجودة في الواجهة لكن يمكن الالتفاف عليها من الخادم، وبقايا "المواعدة" ما زالت مرئية للمستخدم في عدة لغات وفي صفحة معايير حماية الطفل نفسها (18+).

**عدد البنود:** 9 حرجة، 21 عالية، ~35 متوسطة، ~30 منخفضة.

**الخلاصة الاستراتيجية:** لا تُعِد البناء من الصفر. الباك-إند (القواعد + الدوال + الدفع) يحتاج **إصلاحات موضعية محددة** لا هدماً. الواجهة تحتاج **إعادة بناء تدريجية لخمس وحدات بعينها** (السياقان العملاقان، طبقة الدردشة، دليل الأعمال، قراءة المستخدمين) بينما يبقى الباقي كما هو.

---

## 1. حرج — يُصلَح قبل أي إصدار جديد

### 1.1 أي مستخدم يستطيع سكّ رصيد Dine Credits لنفسه
- **الملف:** `firestore.rules:507-511` (قاعدة `allow create` على `users/{uid}`)، `firestore.rules:587` (المالك يستطيع حذف وثيقته)
- **المشكلة:** كل قواعد **التحديث** محمية بـ `creditFieldsUnchanged()`، لكن قاعدة **الإنشاء** ليست كذلك. الوثيقة تُنشأ من العميل (`src/context/AuthContext.jsx:1244-1246, 1279`)، فيستطيع أي مستخدم عند التسجيل — أو بحذف وثيقته وإعادة إنشائها — كتابة `{ paidCredits: 10000000, savedCredits: 10000000 }`. كل عمليات الإنفاق على الخادم تثق بهذه الحقول.
- **الأثر:** دعوات وذكاء اصطناعي وهدايا وباقة Pro Lite مجاناً بلا حدود؛ وإذا فُعّل `CASHOUT_ENABLED` يصبح مساراً لسحب مال حقيقي.
- **الإصلاح (سطر واحد في القواعد + نشر):** في قاعدة الإنشاء أضف شرط أن تكون `paidCredits`, `savedCredits`, `freeCredits`, `totalCreditsPurchased`, `totalCreditsSpent`, `totalSavedCreditsEarned` كلها صفراً و`pendingCashoutRequestId` غير موجود. ثم أوقف كتابة حقول المحفظة من العميل في `AuthContext.jsx:1244-1246`. الأفضل لاحقاً: إنشاء الوثيقة من trigger على الخادم ومنع حذف المالك لوثيقته (يمرّ عبر `requestAccountDeletion`).

### 1.2 `api/proxy.js` وكيل مفتوح بلا مصادقة (SSRF + XSS على نطاقك)
- **الملف:** `api/proxy.js:2-28`
- **المشكلة:** يأخذ `?url=` ويجلبه بلا مصادقة ولا قائمة نطاقات مسموحة ولا حد للحجم، ويعيد `Content-Type` كما جاء. `https://www.dinebuddies.com/api/proxy?url=https://attacker/x.html` يعرض HTML المهاجم على أصل dinebuddies.com (وصول لحالة Firebase Auth وlocalStorage)، ويجعل خوادم Vercel الخاصة بك أداة جلب لأي عنوان.
- **الإصلاح:** `requireAuth` + السماح فقط بـ `https:` ومضيفي Firebase Storage/Google CDN التي يستخدمها `mediaService.js`/`shareCardCanvas.js` + تمرير `image/*` فقط + حد 10MB + timeout + `X-Content-Type-Options: nosniff`.

### 1.3 سعر PayPal ثابت لكن **العملة** يختارها العميل
- **الملف:** `functions/paypal.js:17-22, 101-118, 571, 583-586, 690, 698-701`؛ الالتقاط لا يتحقق من المبلغ (`419-466, 744-815`)
- **المشكلة:** `resolveOrderCurrency(data?.currency)` يقبل أي رمز من ثلاثة أحرف. استدعاء `createPayPalCreditsOrder({packageId:'credits_3000', currency:'PHP'})` مباشرة = دفع ₱25 (~0.45$) مقابل 3000 رصيد، و₱29 مقابل باقة أعمال مدفوعة (لا تنتهي أبداً، انظر 2.4).
- **الإصلاح:** احذف `currency` و`clientMode` من مدخلات الدالة؛ جدول أسعار على الخادم بحسب `packageId × currency`؛ عند الالتقاط قارن `capture.amount.value` و`currency_code` بالمتوقع وارفض غير ذلك.

### 1.4 الدردشة المباشرة تُنشأ من دالة سحابية **بلا فحص عمري** — بوابة القاصرين لا تعمل هنا
- **الملف:** `functions/index.js:1907-1989` (`createOrGetConversation`)، تُستدعى من `src/context/ChatContext.jsx:46, 213` و`src/pages/Chat.jsx:420`
- **المشكلة:** الفحص `isMinor` موجود في `createGroupConversation` (`:2022-2039`) وفي فرع المجموعات فقط من `getOrCreateInvitationConversation` (`:2128-2135`)، لكن دالة المحادثة الفردية — الأكثر استخداماً — لا تحتوي أي إشارة لـ `ageCategory`. المتابعة المتبادلة بين قاصر وبالغ غير ممنوعة في أي مكان (`firestore.rules:536-540`). قاعدة `conversations` create (`:958`) لا تُنفَّذ لأن الكتابة تتم بـ Admin SDK.
- **الإصلاح:** أضف `if (isMinor(reqData) !== isMinor(othData)) throw failed-precondition` في `createOrGetConversation` وفي الفرع المباشر عند `:2117`؛ وأضف `sameAgeClass(participants[0], participants[1])` على إنشاء `conversations/{id}/messages` للمحادثات القديمة.

### 1.5 الدعوات الخاصة تتجاوز البوابة العمرية عبر المسودّة والرابط
- **الملفات:** `src/utils/persistPrivateInvitationEditorDraft.js:138` (updateDoc على مسودة موجودة)، `firestore.rules:845-853` (قاعدة التحديث لا تحتوي `personalInviteSameAgeClass`)، `functions/index.js:1318-1331` (`publishPrivateInvitationDraft` يفلتر business/guest/blocked فقط)، `claimPrivateInvitationShare` (`:1625+`، لا فحص عمري)، والقاعدة عند الإنشاء تُطبَّق فقط عندما `invitedFriends.size()==1` (`:28`)
- **الإصلاح:** فحص الفئة العمرية لكل مدعوّ في `publishPrivateInvitationDraft` و`claimPrivateInvitationShare`؛ إضافة `personalInviteSameAgeClass` لفرع تحديث المضيف؛ فحص كل المدعوين لا حالة المدعو الواحد.

### 1.6 `ageCategory` يمكن تغييره من العميل بعد التسجيل
- **الملف:** `firestore.rules:541-547` (تحديث المالك يستثني `role`/`accountType` فقط)؛ القفل موجود في الواجهة فقط (`CompleteProfile.jsx:256`)
- **المشكلة:** أي قاصر يكتب `updateDoc(users/uid, {ageCategory:'25-34'})` من أدوات المطور ويتجاوز كل البوابات؛ وأي بالغ يعلن نفسه `16-17` ليصل للقاصرين.
- **الإصلاح:** قاعدة تمنع تغيير `ageCategory`/`gender`/`age` بعد أول تعيين؛ التغيير عبر callable إداري فقط.

### 1.7 صفحة معايير حماية الطفل تقول 18+ بينما الشروط تقول 16+
- **الملف:** `src/pages/ChildSafetyStandards.jsx:59, 111` (المسار `/child-safety` — هو الرابط الذي يطلبه Google Play) مقابل `TermsOfService.jsx:213` و`PrivacyPolicy.jsx:480`
- **الإصلاح:** تحديث النص (ar+en) إلى 16 مع فقرة حماية فئة 16–17.

### 1.8 بقايا "المواعدة" مرئية للمستخدم — الأسئلة الشائعة وتسمية "Private"
- `src/locales/en.json:2633` و`ar.json:2654` (FAQ، تُعرض عبر `HelpSupport.jsx:19`): "Dating: Specially curated romantic encounters…" / "دعوات خاصة (Dating): … التعارف الرومانسي…"
- نفس FAQ في de/es/it/pt/tr (`de.json:2392-2409`, `it.json:2595-2612`, …)
- مفتاح `"Private"` (عنوان نوع الدعوة، يُعرض في `InvitationHeader.jsx:113`) مترجم إلى **Flört / Citas / Appuntamenti / Encontros / Rencontre** في tr/es/it/pt/fr → كل دعوة خاصة عنوانها "مغازلة" لهذه اللغات.
- **الإصلاح:** إعادة صياغة FAQ[2] و[6] في اللغات العشر؛ إعادة ترجمة `"Private"`.

### 1.9 أسرار الإنتاج داخل شجرة المصدر + مفتاح حساب خدمة كان منشوراً
- `functions/.env` يحتوي مفاتيح حية: `STRIPE_SECRET_KEY (sk_live)`, `STRIPE_WEBHOOK_SECRET` (مرتين — dotenv يأخذ الأولى)، `PAYPAL_CLIENT_SECRET`, `APPLE_IAP_PRIVATE_KEY_BASE64`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `YOUTUBE_API_KEY`. الملف **مُتجاهَل في git** (`.gitignore:61`) — جيد — لكنه ينتقل مع كل نسخة من المجلد ومع كل وكيل قرأه.
- `service-account-key.json` (المفتاح `fe17903de003…`، الحساب `firebase-adminsdk-fbsvc@dinebuddies.iam.gserviceaccount.com`) **كان مُلتزَماً في git** وأُزيل في commit `540b2a434` (مارس 2026) — أي أنه ما زال في تاريخ المستودع على GitHub.
- `public/dinebuddies-23b4e21e9b45.json` (مفتاح خدمة، `private_key_id` يبدأ بـ `23b4e21e9b45d2100f9e…`) كان في `public/` و`dist/` أي منشوراً على Vercel؛ حُذف اليوم من القرص.
- **الإصلاح:** إبطال المفتاحين من Google Cloud Console → IAM & Admin → Service Accounts → (الحساب) → تبويب Keys (ابحث عن المفتاح الذي يبدأ بـ `23b4e21e9b45` و`fe17903de003`)؛ إن لم تجد الأول تحت `firebase-adminsdk-fbsvc` فافحص باقي حسابات الخدمة في المشروع؛ تدوير مفاتيح Stripe/PayPal/Apple/OpenAI/Anthropic/Resend؛ نقلها إلى Firebase Secret Manager (`defineSecret`) بدل `.env`.

---

## 2. عالي — خلال الأسبوعين القادمين

### الأمان والقواعد
- **2.1 أي مستخدم مسجّل يقرأ ويعدّد كامل مجموعة `users`** (`firestore.rules:502-506`: `allow get: if isSignedIn()`, `allow list … limit <= 500`). الوثيقة تحوي البريد والهاتف و`fcmTokens` والأرصدة و`stripeCustomerId` وإحداثيات GPS الدقيقة (تُكتب كل 5 دقائق، انظر 2.10). السبب الجذري: 83 ملفاً في `src` يقرأ `users` مباشرة مقابل 16 يقرأ `public_profiles`. الإصلاح بنيوي: مستودع واحد `usersRepo` يقرأ `public_profiles`، ثم `allow get: if isOwner || isAdminOrPanelStaff`.
- **2.2 استيلاء على قوائم Google Business عبر تثبيت جلسة OAuth** (`api/business/google-claim/auth-url.ts:54-81` يثق بـ `body.firebaseUid` بلا مصادقة؛ `_businessPhoneAccount.js:154-166` لا يقارن `session.firebaseUid` بالمستدعي؛ `managed-locations.ts`/`verify-place.ts` بلا مصادقة). الإصلاح: `requireAuth` على الثلاثة، uid من التوكن فقط، رفض عند عدم التطابق، حذف الجلسة بعد الاستخدام + TTL.
- **2.3 الشركة تمنح نفسها شارة "Google-verified" بكتابة عادية** (`firestore.rules:541-547` تسمح بأي تغيير في `businessInfo`؛ الشارة تُقرأ من `businessInfo.google_business_verified` في `BusinessVerifyBadge.jsx:23-26`). الإصلاح: تثبيت حقول `*_verified`, `isPublished`, `emailVerified`, `banned` في قاعدة تحديث المالك.
- **2.4 اشتراكات PayPal وApple للأعمال لا تنتهي أبداً** — `businessPaidUntil` يُكتب (`paypal.js:525-540`, `appStoreBilling.js:244-259`) ولا يقرؤه أحد؛ `expireCompBusinessPlans` يتجاهل غير `admin_comp` (`functions/index.js:3004-3037`). دفعة واحدة = باقة دائمة. الإصلاح: توسيع المهمة اليومية لتخفيض `paypal/appstore` المنتهية + App Store Server Notifications v2.
- **2.5 اشتراك Apple واحد يفعّل حسابات أعمال بلا حدود** (`appStoreBilling.js:240-270`: `{merge:true}` على `apple_business_plan_fulfillments/{originalTransactionId}` بلا فحص أن `userId` مختلف). الإصلاح: `tx.get` ورفض إن كان لمستخدم آخر + `appAccountToken = uid`.
- **2.6 `createCheckoutSession` القديمة تدع العميل يختار السعر والصلاحية** (`functions/stripe.js:72-113`؛ الطبقة تُشتق من `planId` القادم من العميل في `webhook.js:156-173`). لا يستدعيها العميل لكنها مُصدَّرة (`index.js:887`). الإصلاح: حذفها.
- **2.7 الاسترداد/النزاعات لا تسحب الرصيد** — لا معالجة لـ `charge.refunded`/`dispute` في `webhook.js:58-81`، ولا إشعارات Apple ولا Play RTDN. الإصلاح: قيود سالبة في السجل عند الاسترداد.
- **2.8 `login-resolver` يحوّل أي رقم هاتف تجاري إلى بريد الدخول بلا كلمة مرور** (`api/auth/login-resolver.js:25-88`, `_loginResolverCore.js:139-146, 236-246`). الإصلاح: تسجيل الدخول على الخادم وإعادة custom token فقط.
- **2.9 `APPLE_IAP_MODE` غير المضبوط يعني SANDBOX افتراضياً** (`appStoreBilling.js:40-47`) — يقبل إيصالات TestFlight مقابل رصيد حقيقي. الإصلاح: فشل عند الإقلاع إن لم يكن `production`.

### بنية الواجهة والأداء
- **2.10 عاصفة إعادة التصيير كل 5 دقائق** — `AuthContext.jsx:555-570` يكتب `lastSeen` ثم `trackUserLocation()` (`:572-639`) الذي يقارن بنسخة `userProfile` القديمة (closure) فيجلب GPS + BigDataCloud ويكتب الإحداثيات كل مرة؛ الوثيقة نفسها تحت `onSnapshot` (`:517-544`) → `setUserProfile` بكائن جديد → قيمة السياق غير مُذكَّرة (`:1741-1770`، بلا `useMemo`) → 179 ملفاً تستهلك `useAuth` تُعاد؛ 33 effect تعتمد على كائن `currentUser` كاملاً (تعيد الاشتراك في `useStories.js:254` وغيرها)؛ `ChatContext.jsx:191-197` يهدم مستمع المحادثات ويعيده كل مرة. الإصلاح (يوم عمل): refs للمقارنة، كتابة الموقع عند التغير فقط، `useMemo` للقيمة و`useCallback` للدوال، الاعتماد على `currentUser?.uid`.
- **2.11 كل غرفة دردشة تستمع لكامل تاريخ الرسائل** بلا `limit` (`useCommunityChatRoom.js:325`, `useStageChatRoom.js:448`, `useSocialInvitationChatRoom.js:316`, `InvitationChatRoom.jsx:237`, `BusinessThreadRoom.jsx:54`, `Chat.jsx:529` بلا `orderBy` حتى)، وإيصالات القراءة تكتب على **كل رسالة** لكل مشاهد (`utils/chatMessageReceipts.js:57-104`) عبر `writeBatch` محدود بـ 500 → الغرف >500 رسالة يفشل الالتزام صامتاً ويُعاد في كل snapshot. الإصلاح بنيوي: `useMessagesWindow` واحد بـ `limitToLast`+pagination، وإيصال واحد لكل مشاهد (`rooms/{id}/receipts/{uid}`).
- **2.12 `InvitationProvider` يحمّل دليل الأعمال كاملاً + مسح `reviews` لكل زائر على كل مسار** (`InvitationContext.jsx:319-424`: 200 ملف عام + `fetchRatingsForBusinessIds` = 60 استعلاماً حتى 6000 وثيقة، يُعاد عند أي تغيير). الإصلاح: تجميع `averageRating/reviewCount` على `public_profiles` بدالة سحابية، ونقل المستمع إلى hook مرتبط بالمسار.
- **2.13 مستمع لكل مشارك / لكل بطاقة** — `uniqueIds.map(id => onSnapshot(doc(db,'users',id)))` في هووكات الدردشة الثلاثة (300 عضو = 300 مستمع)؛ `BusinessesDirectory.jsx:374-381` حتى 200 مستمع إعجاب في صفحة واحدة. الإصلاح: استعلام `in` مجزّأ على `public_profiles`، واستعلام إعجابات واحد `where userId == uid`.
- **2.14 الإشعارات والروابط العميقة لا تعمل في تطبيقات Capacitor** — المسار الوحيد هو Web Push (`fcmClient.js:22-121`, `notificationService.js:400-470`)؛ لا وجود لـ `@capacitor/push-notifications` في `package.json`؛ `appUrlOpen` صفر نتائج في `src`. على iOS تظهر رسالة "أضف للشاشة الرئيسية" داخل التطبيق الأصلي. الإصلاح: إضافة الإضافة الأصلية مع `platform/push.js` يتفرع على `isNativePlatform()`، و`App.addListener('appUrlOpen')` للتنقل.
- **2.15 قراءات N+1 متسلسلة** — `InvitationDetails.jsx:270-326`, `SocialInvitationDetails.jsx:168-185`, `ChatContext.jsx:115-141` (كاش لا يُبطَل أبداً). يوجد أصلاً `utils/userDirectory.js` مجزّأ — استخدمه.
- **2.16 91 ملفاً / ~13,350 سطراً كود ميت** غير قابل للوصول من `main.jsx` (أكبرها `services/GeminiService.ts` 1351، `CreateBusinessAccount.jsx` 664، `PremiumOfferEditor.jsx` 621، ثلاث صفحات غير مُوجَّهة). الإصلاح: حذف + إضافة سكربت الرسم البياني للاستيراد إلى CI.
- **2.17 هووكات الدردشة الثلاثة نسخ متطابقة بنسبة 69–78%** (1361/1601/1353 سطراً، تعيد 55–63 مفتاحاً كل واحدة) + ثلاث واجهات دردشة أخرى تعيد تنفيذ الرسائل والإيصالات. كل إصلاح يجب تطبيقه ست مرات.

### الترجمة وحماية القاصرين (عالٍ)
- **2.18 نصوص المواعدة في نسخ الرصيد والتنبيهات:** `en.json:2368` "…date invites…" (يُعرض في `PricingPage.jsx:38`)، `ar.json:2389, 2487` "مواعيد/دعوات المواعيد"؛ `business_cannot_create_invitation` في de/es/it/pt/tr ("Dating-Einladungen/citas/appuntamenti/encontros/flört")؛ `user_muted_toast` في de/es/it/pt/tr + خطأ نحوي في en/ar بعد الإصلاح (`en.json:5643` "private or private invites"، `ar.json:5847` "خاصة أو خاصة").
- **2.19 رسالة القبول التلقائية للدعوة الخاصة** (`src/utils/privateInvitationResponseMessages.js:63-68, 90, 101`): `isDating` صحيح لكل دعوة `Private` (`InvitationContext.jsx:1376`) → "I'd love to join you… 💕" وعنوان إشعار "💕 تم قبول موعد الدعوة".
- **2.20 احتفال "المطابقة" بقلب نابض ما زال حياً** (`MatchCelebrationContext.jsx:158-161` → `celebrateMatch({type:'dating'})` → `MatchCelebrationOverlay.jsx:61-67` `FaHeart`)، ويُغذّيه `functions/connectMatchNotifications.js:54` (`'like'`)؛ نص `inbox_activity_match` "You matched with {{name}}" (`InboxScreen.jsx:297`).
- **2.21 الواجهة ما زالت تعرض دعوة خاصة عبر الفئات العمرية:** `UserProfile.jsx:858` (`canPrivateInvite` بلا `canInteractPrivately`)، منتقي المدعوين `SocialInvitationInviteePanel.jsx:74-222` بلا فلتر عمري، `UserDirectoryFilters.jsx:27-30` يعرض `16-17` كفلتر للبالغين.
- **2.22 الأردية تحصل على `dir="ltr"`** — `authGeoLanguage.js:47-63` لا يعرف `ur`/`hi` بينما `i18n.dir()` يعيد `rtl` → تخطيط مختلط. `ur`/`hi` في `supportedLngs` (`i18n.js:8`) ويُكتشفان من المتصفح، لكنهما غير موجودين في `languageOptions.js` فلا يستطيع المستخدم الخروج منهما. قرار مطلوب: إما إكمالهما أو إزالتهما من `supportedLngs`.
- **2.23 حالة اللغات الثماني (de/es/fr/hi/it/pt/tr/ur):** كل واحدة تفتقد **509 مفتاحاً** (416 منها مستخدمة في الكود → تظهر بالإنجليزية: `ai_text_starter_*`, `admin_*`, `pickone.*`, `tastescope.*`)، وفيها 778–981 قيمة مطابقة للإنجليزية (غير مترجمة). الهندية فيها **135** مفتاحاً تُرجمت فيها المتغيرات نفسها (`{{गिनती}}` بدل `{{count}}` → يظهر النص الخام). العربية: `days_ago`/`weeks_ago` (`ar.json:2417, 5937`) بلا `{{count}}` → لا يظهر الرقم. الألمانية: `de.json:3817` يستخدم `${displayName}` (قالب JS لا i18next)، `de.json:4450` `{{wann}}` بدل `{{when}}`.
- **2.24 ميزة الدردشة الجماعية كاملة بلا مفاتيح ترجمة:** 12 مفتاحاً (`group`, `group_add_members`, `group_chat_new`, `group_create`, `group_name`, `group_no_mutual_friends`, `hide_banner`, `show_banner`, `opening`…) غير موجودة في en/ar — المستخدم العربي يرى الإنجليزية.

---

## 3. متوسط

### أمان وقواعد
- 3.1 أدوار اللوحة `support/staff/moderator` تملك صلاحيات مدمّرة: `adminSetUserRole` (`functions/index.js:2888-2905`، يمكن لـ support ترقية أي uid إلى staff)، `adminSetUserSubscriptionTier` (`:2942-2951`)، `adminDeleteUser` (`:3596-3611`)، الحملات البريدية والرسائل الجماعية، التصدير الكامل للمستخدمين. الإصلاح: مصفوفة صلاحيات؛ المدمّر والمالي لـ `superOwner`/`token.admin` فقط.
- 3.2 أي مستهلك يرقّي نفسه لحساب أعمال من العميل (`firestore.rules:349-353, 454-457, 523-533` `isUpgradingStubToBusinessProfile`) بينما `complete-business-signup` موجود ليفعل ذلك على الخادم بفحوصات.
- 3.3 `mirrorEmailVerifiedFromAction` بلا مصادقة = أوراكل لتعداد البريد الإلكتروني (`functions/index.js:1059-1093`).
- 3.4 تحديد المعدل في `api/_rateLimit.js:6` ذاكرة لكل instance في Vercel → يُتجاوز بسهولة؛ `place-autocomplete`/`place-details`/`cover-image?allowRepair` بلا مصادقة → استنزاف رصيد Google Places. الإصلاح: مخزن مشترك (Upstash) أو `enforceCallableRateLimit` الموجود في `functions/index.js:243` + App Check.
- 3.5 `api/cron/ingest-pending-venues.js:27-33` يفشل مفتوحاً إن لم يُضبط `CRON_SECRET` (تحقق من Vercel env). الإصلاح: `if (!secret) return 503`.
- 3.6 `invitation_archives` مقروءة بلا مصادقة (`firestore.rules:759-761`) وتُنسخ إليها الدعوات الخاصة (`functions/invitationArchiveCore.js:355-363, 462-470`) → عنوان ومضيف ومكان وتاريخ الدعوات الفردية مكشوفة.
- 3.7 `invitations` قابلة للتعداد بلا مصادقة (`firestore.rules:678-690` `allow list: if true`).
- 3.8 موظفو اللوحة يستطيعون تعديل حقول الشراكة/الخادم في `users` (`firestore.rules:552-556` بلا `ownerAffiliateWriteGuards()`).
- 3.9 `_businessPhoneAccount.js:46, 84-116` يحوّل أي حساب موجود إلى أعمال ويقبل `businessInfo` كما هو من العميل (بما فيها `*_verified`).
- 3.10 Storage: `feedback_media/{businessId}` قابل للكتابة من أي مستخدم في مجلد أي شركة (`storage.rules:255-260`)؛ `chat_files` يقبل أي نوع محتوى حتى 20MB (`:85-90`)؛ وسائط الدردشة مقروءة لأي مسجّل لا للمشاركين فقط (`:64-90`).
- 3.11 حماية القاصرين (متوسط): هدايا مدفوعة لقاصرين (`functions/giftCredits.js:121-210` بلا فحص)؛ `discovery_likes`/`discovery_greetings` بلا بوابة عمرية (`firestore.rules:1633-1685`)؛ وثائق القاصرين الكاملة مقروءة لأي بالغ (3.1 + 2.1).
- 3.12 `firestore.rules:55-57`, `functions/index.js:135-136`, `api/_adminRequire.js:7-12`: UID وبريد جيميل شخصي مُثبّتان كمالك أعلى — اختراق `y.abohamed@gmail.com` = سيطرة كاملة. الإصلاح: custom claims فقط.

### مدفوعات
- 3.13 العميل يختار فئة تسعير الدعوة (`inviteCategory` في مسودة `social_invitations`، `functions/index.js:114-122` يفوتر `social`=90 بدل `private`=185).
- 3.14 مضيف PayPal (sandbox/live) يختاره العميل عبر `clientMode` (`paypal.js:232-239`) مع override عام قابل للتغيير.
- 3.15 علم التجربة المجانية لاشتراك Stripe يُحرق عند إنشاء الجلسة لا عند اكتمالها (`stripe.js:261, 280-282`).
- 3.16 استرداد رصيد الذكاء الاصطناعي يتجاوز السجل (`api/ai/_runAiWithCredits.js:62-78` `increment` بلا قيد في `credit_transactions`).
- 3.17 تنفيذ اشتراك Stripe غير idempotent (`webhook.js:177-184` `user_subscriptions.add` عند كل إعادة محاولة) ولا فحص لـ `payment_status`.
- 3.18 سباق في "العرض المجاني المضمّن" للمجتمع (`functions/communityOffers.js:~150-215` العدّ خارج المعاملة).
- 3.19 بقايا الشراكة (affiliate) ما زالت تُنفَّذ: `pendingReferral.js`, `AuthContext.jsx:1233-1265` (يكتب `referred_by`), `BusinessSignup.jsx:462-507`, `adminSetUserRole` يقبل `affiliate_agent`, قواعد `:355-400`.
- 3.20 السحب النقدي معطّل بعلم بيئة فقط والدوال منشورة (`functions/cashout.js:15-19`, المسار `/admin/cashouts` مُجمَّع). مع 1.1 يصبح مسار سحب مال فوري عند قلب العلم.

### نشر وبناء
- 3.21 استضافة Firebase تنشر نسخة ثانية من التطبيق على `dinebuddies.web.app` (`firebase.json` hosting + `scripts/deploy-firebase.ps1:34,93`) حيث تفشل كل `/api/*` الخاصة بـ Vercel. الإصلاح: إزالة `hosting` أو تحويل 301 إلى www.
- 3.22 لا رؤوس أمان على Vercel (`vercel.json` يضبط COOP فقط؛ `index.html` بلا CSP؛ لا `X-Content-Type-Options`/`Referrer-Policy`/`frame-ancestors`).
- 3.23 فهارس مركبة ناقصة: `community_offers (partnerId, createdAt desc)` و`(onFeed, createdAt desc)` (`functions/communityOffers.js:324-329, 538-543` — يسقطان صامتاً إلى استعلام غير مرتب)، `reports (status, timestamp desc)` (`functions/adminDashboard.js:1088` يرمي `FAILED_PRECONDITION`).
- 3.24 مجلد `scripts/` (283 ملفاً): 106 سكربت غير مُشار إليه من `package.json`، ~118 ملف دفعات ترجمة قديمة، أربعة مولّدات أيقونات، وسكربتات مدمّرة بلا حارس `--execute` (`deleteAllInvitations.js`, `cleanup_old_offers.js`, `migrate_roles.js`, `fix_firestore_prices.js`). الإصلاح: `scripts/archive/`.
- 3.25 `package.json`: `firebase-admin`, `google-auth-library`, `sharp`, `vercel`, `@faker-js/faker` في `dependencies` (لا تصل للحزمة لكنها تبطّئ التثبيت على Codemagic/Vercel)؛ غير مستخدم: `react-dropzone`, `jspdf-autotable`, `@capacitor/screen-orientation`؛ انحراف إصدارات: `firebase-admin` 13 في الجذر مقابل 12 في functions، `firebase-functions` v4 مع خلط v2، `stripe` 14.
- 3.26 `.env.example` و`functions/.env.example` ناقصان (لا يذكران `CRON_SECRET`, `GOOGLE_OAUTH_*`, `APPLE_IAP_*` ×6, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `ANTHROPIC_*`, `OPENAI_*`…) و`APP_URL` يُقرأ بثلاث تهجئات في functions.

### واجهة
- 3.27 سياقان عملاقان: `InvitationContext.jsx` (2101 سطر) يملك الدعوات العامة والخاصة ودليل الأعمال وكشف الدولة والمتابعة والإدارة والتقارير و`updateProfile` ثانياً؛ الملف الشخصي موجود في ثلاث نسخ (`AuthContext.userProfile`, `AuthContext.currentUser`, `InvitationContext.currentUser`) والصفحات تخلط بينها (`Profile.jsx:149` من `useInvitations`، `CompleteProfile.jsx:30` من `useAuth`).
- 3.28 ترقيم الخلاصة يعيد الاشتراك بنافذة أكبر (`PostsFeed.jsx:238-256`) والفلترة الاجتماعية على العميل.
- 3.29 `React.memo` مرتان فقط في المشروع؛ `PostCard.jsx` (1480 سطر، ~12 hook) يُصيَّر في 3 قوائم بلا تذكير؛ 33 ملفاً >1000 سطر؛ 9 من 222 صورة `loading="lazy"`.
- 3.30 الحزمة الأولية: 235 ملفاً / 34,845 سطراً محمّلة eagerly + `en.json` ~390KB + `framer-motion` عبر overlays الاحتفال؛ `chunkSizeWarningLimit` رُفع إلى 2000 بدل الإصلاح. (الجيد: 96 مساراً lazy وتقسيم manualChunks صحيح.)
- 3.31 اختبارات: 15 ملفاً/915 سطراً كلها رياضيات خالصة؛ لا `npm test`؛ لا اختبار لأي hook/سياق/قاعدة. لا يوجد `@firebase/rules-unit-testing` (كان سيكتشف 1.1 فوراً).
- 3.32 معالجة أخطاء: 257 `catch` فارغة/تعليق فقط + 61 `.catch(()=>{})`؛ 514 `console.error` + 169 warn + 38 log بلا حذف عند البناء (`vite.config.js` بلا `esbuild.drop`)؛ بيانات شخصية في السجلات (`CompleteProfile.jsx:76,125,149` يسجّل الملف كاملاً؛ `generateAIContent.js:295,446`)؛ 21 `alert()` في لوحة الإدارة رغم وجود `ToastContext`.
- 3.33 انحراف المخطط: الصورة تحت 4 مفاتيح (`photo_url` 141 / `photoURL` 118 / `avatar` 79 / `avatarUrl` 63) والاسم تحت 3؛ `getSafeAvatar` يُستدعى 123 مرة للتغطية؛ `updateProfile` يكتب المفاتيح كلها في كل تحديث.
- 3.34 لا مالك واحد لطبقة البيانات: 156 ملفاً يستورد `firebase/firestore` مباشرة؛ 45 callable + ~62 استدعاء `/api/*` = ثلاث واجهات خلفية متوازية بلا مستودع.
- 3.35 بقايا مواعدة متوسطة: `GeminiService.ts:421` (نبرة "Date invitation: romantic ambiance" في برومبت الخادم، `parseAiRequest.js:11` يقبل `'date'`)؛ `relationshipAdviceKnowledge.js` + `relationshipAdviceRetrieval.js` (ميتان لكن يُحزمان: "How do I start a conversation on a dating app?")؛ مجموعة قوالب `PRIVATE_INVITE_DATE_TEMPLATES` (`privateInviteTemplateAssets.js:28-53` "Neon Hearts Date", "Valentine's Evening"…) **مع خطأ وظيفي**: `privateCardBackgrounds.js:293-297` يفلتر على `'dating'` فتحصل فئات `acquaintance/family/work` على **صفر قوالب** ويسقط الافتراضي إلى صورة رومانسية؛ `CommunityGuidelines.jsx:61, 240` "محتوى المواعدة"؛ `invitationDisplayUtils.js:17,25` يعرض "18+" للدعوة بلا فئات عمرية؛ `available_for_dating`/`social_available_desc` (`ar.json:1082, 5026` "موعد غرامي") مفاتيح ميتة لكن قابلة للعثور عليها من مراجع المتجر.
- 3.36 ~190 نصاً إنجليزياً و~351 سطراً عربياً خارج `t()` (الصفحات القانونية تستخدم `isAr ? … : …` فتحصل اللغات الثماني على الإنجليزية)؛ 15 `showToast('English…')` (`ChatContext.jsx:222-228`, `InvitationContext.jsx:820, 877, 2032`).
- 3.37 RTL: 301 خاصية inline فيزيائية (`marginLeft/Right`, `textAlign:'left'`) مقابل 82 منطقية؛ 41 استخداماً لـ `FaArrowLeft` بلا قلب؛ إضافة bidi eslint موجودة لكن `warn` فقط ولا يشغّلها أي CI/build.

---

## 4. منخفض (مختصر)
- `chats` المشاركون يعيدون كتابة العضوية (`firestore.rules:894-895`)؛ مالك المطعم يغيّر `googlePlaceId` (`:1598-1603`)؛ `consumerAccountSearchHttp` بلا مصادقة ويتجاهل `searchable:false`؛ refresh tokens لـ Google لا تُحذف أبداً؛ مرسل إعادة تعيين كلمة المرور بلا حد لكل IP؛ `storage-image.js:43-48` يثق باسم bucket من العميل؛ CORS `*` مع `Allow-Headers` بلا `Authorization`.
- مدفوعات: تعليق `creditsCore.js:5` يقول 50% والقيمة 30%؛ `RECIPIENT_NO_PHOTO` بلا خريطة خطأ؛ `successUrl/cancelUrl` من العميل بلا تحقق (open redirect)؛ Google Play token غير مرتبط بالمستدعي؛ `VITE_GOOGLE_MAPS_API_KEY` يُستخدم كمفتاح خادم احتياطي؛ `vite.config.js:96-517` middleware تطوير يكشف `/__dev/restore-backup` (يشغّل `robocopy` ويكتب فوق `src/`) على `0.0.0.0`؛ `spendCreditsInTransaction` يعيد نجاحاً صامتاً عند `amount<=0`.
- واجهة: تعليقات قديمة مضلّلة في `App.jsx:86,90,153`؛ `AccountShellGate.jsx:18` يعيد `null` أثناء التحميل فيُفرغ الشجرة عند تبديل الحساب؛ مؤقتات 25/45 ثانية في bootstrap المصادقة؛ زر الرجوع في أندرويد `history.back()` أعمى (`nativeBackButton.js:14-20`)؛ 82 استدعاء `localStorage` مباشر، 22 `window.location.reload/replace`، 17 تعطيلاً لـ `exhaustive-deps`.
- ترجمة: `profileGifts.js:77` "A classic romantic gesture 🌹"؛ `zodiacSigns.js:74` "رومانسي"؛ قالب `Romantic Dinner`؛ `please_enter_age` "(minimum 18)" ميت؛ `datingProfile.js` لم يُعد تسميته؛ `demoUsersCore.js:281` ما زال يكتب `openToDating:false` و`demoUsersGemini.js:92` بلا `16-17`؛ 35 مفتاحاً يتيماً في اللغات الثماني (`ai_text_starter_boundaries/rejection`…)؛ `ar.json:4667 private_meetup_spot_title` لا يطابق الإنجليزية.

---

## 5. ما هو مُنجَز جيداً (حتى لا يكون التقرير ظالماً)
- كل تعديل على الرصيد يمرّ عبر `spendCreditsInTransaction`/`grantPaidCreditsInTransaction` داخل `runTransaction` مع قيد في `credit_transactions` المقفول أمام العميل؛ الإنفاق المتزامن محمي بالتفاؤلية.
- الإيصالات تُتحقق على الخادم: Stripe (`constructEvent`)، PayPal (إعادة جلب الطلب)، Apple (`SignedDataVerifier` مع شهادات Apple الجذرية)، Google Play (`androidpublisher`)؛ وكل قناة idempotent بوثيقة تنفيذ لكل معاملة.
- الكتالوجات على الخادم؛ الهدايا ذرية وبلا مراجحة؛ الامتثال لمنع التوجيه الخارجي (anti-steering) مركزي في `commercePlatform.js` ويبدو سليماً.
- قواعد Firestore دقيقة حيث اهتم أحد بها (`creditFieldsUnchanged`, `subscriptionUpdateClientSafe`, مجموعات الألعاب مقفلة)؛ صفحات OG/SEO تهرّب المخرجات؛ لوحة الإدارة فيها نطاق إقليمي وسجل تدقيق.
- الواجهة: **صفر** مستمع `onSnapshot` بلا إلغاء اشتراك؛ 96 مساراً lazy مع حراس مرتبة؛ `manualChunks` صحيح؛ اللغات تُحمَّل عند الطلب؛ `ErrorBoundary` واستعادة ChunkLoadError؛ Toast/Confirm بدل الحوارات الأصلية.
- الأدوات الخاصة الموجودة أصلاً وتحتاج فقط إلى استخدام أوسع: `public_profiles`, `utils/userDirectory.js`, `utils/authorProfileCache.js`, `enforceCallableRateLimit`, `lint:ci`.

---

## 6. خطة الإصلاح التدريجية المقترحة

**المرحلة 0 — اليوم (ساعة واحدة، بلا كود تقريباً):**
إبطال المفتاحين (1.9) وتدوير أسرار `functions/.env`؛ نشر قاعدة الإنشاء (1.1)؛ حذف `api/proxy.js` مؤقتاً أو إضافة `requireAuth` + قائمة نطاقات (1.2)؛ التأكد من `CRON_SECRET` و`APPLE_IAP_MODE=production` في Vercel/Firebase (3.5, 2.9).

**المرحلة 1 — قبل إرسال البناء 16+ للمراجعة (2–4 أيام):**
1.4، 1.5، 1.6 (بوابة القاصرين على الخادم والقواعد) → 1.7 صفحة حماية الطفل → 1.8 + 2.18–2.21 (كل نص مواعدة مرئي في اللغات العشر + رسالة 💕 + احتفال المطابقة) → 2.24 مفاتيح الدردشة الجماعية → 3.35 خطأ القوالب (صفر قوالب لفئات acquaintance/family/work). ثم بناء جديد للمتجرين وإعادة الإجابة على استبيان التصنيف.

**المرحلة 2 — المال (3–5 أيام):**
1.3 عملة PayPal → 2.4 انتهاء الاشتراكات → 2.5 ربط اشتراك Apple بالمستخدم → 2.6 حذف `createCheckoutSession` → 2.7 استرداد → 3.13–3.17 → اختبارات `@firebase/rules-unit-testing` لقواعد `users` و`credit_transactions`.

**المرحلة 3 — القواعد والواجهات الخلفية (أسبوع):**
2.2 جلسات Google claim → 2.3/3.2/3.8/3.9 إعادة كتابة قواعد `users` بقائمة حقول مسموحة للمالك → 2.8 login-resolver → 3.1 مصفوفة صلاحيات اللوحة → 3.3–3.7, 3.10–3.12 → 3.21–3.23 نشر وفهارس.

**المرحلة 4 — إعادة بناء الواجهة تدريجياً (3–5 أسابيع، التطبيق يبقى قابلاً للنشر طوال الوقت):**
1. `AuthContext`: تذكير القيمة + إصلاح حلقة `lastSeen/location` (2.10) — يوم واحد، أكبر أثر.
2. طبقة دردشة واحدة (`useMessagesWindow` + `useParticipants` + إيصال لكل مشاهد) ثم نقل Stage → Social → Chat.jsx → InvitationChatRoom → BusinessThreadRoom (2.11, 2.13, 2.17).
3. دليل الأعمال: تجميع التقييمات على الخادم + hook مرتبط بالمسار + إعجابات دفعة واحدة (2.12, 2.13).
4. `usersRepo` على `public_profiles` ثم تشديد قواعد `users` (2.1, 2.15, 3.33) — هنا تُغلق أكبر ثغرة خصوصية.
5. حذف الكود الميت وربط السكربت بـ CI (2.16).
6. تقسيم السياقين العملاقين ونقل حالة الإدارة إلى نطاق `/admin` (3.27).
7. الإشعارات الأصلية والروابط العميقة (2.14).
8. الخلاصة والتصيير (3.28–3.30)، ثم بوابات الجودة: `npm test`، حذف console في الإنتاج، `lint:ci` في Codemagic (3.31, 3.32, 3.37).

**المرحلة 5 — الترجمة (متوازية):**
قرار بشأن ur/hi (2.22)؛ مزامنة 416 مفتاحاً للغات الثماني أو تقليص `supportedLngs` مؤقتاً إلى اللغات المكتملة (2.23)؛ إصلاح المتغيرات في hi/de/ur/ar؛ لفّ التنبيهات الإنجليزية في `t()` (3.36)؛ تحويل الخصائص الفيزيائية إلى منطقية تدريجياً (3.37).

---
*ملاحظة منهجية:* الأرقام (عدد الملفات، المستمعين، المفاتيح الناقصة…) مقاسة بسكربتات على نسخة الكود بتاريخ التقرير. البنود المعلّمة "تحقق من البيئة" (CRON_SECRET, APPLE_IAP_MODE, إعداد قبول العملات في PayPal) تحتاج فحصاً في لوحات التحكم لا في الكود.
