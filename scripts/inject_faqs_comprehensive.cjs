const fs = require('fs');
const path = require('path');

const arPath = path.join(__dirname, '../src/locales/ar.json');
const enPath = path.join(__dirname, '../src/locales/en.json');

const arQuestions = {
    user_questions: [
        { q: "ما هو تطبيق داين باديز (DineBuddies)؟", a: "المحطة الأولى لعشاق المطاعم! داين باديز هي منصة اجتماعية مبتكرة تجمع بين اكتشاف المطاعم الفاخرة، والتعرف على أشخاص جدد عبر دعوات طعام مميزة، وبناء مجتمعات حقيقية حول المائدة." },
        { q: "كيف أقوم بإنشاء دعوة وتحديد من سيدفع الفاتورة؟", a: "انقر على زر (+) في الأسفل، ثم اختر المطعم وحدد وقت وتاريخ الدعوة. يمكنك من خلال الإعدادات تحديد إذا كانت الفاتورة (على المضيف) أو (تقسيم الحساب بالتساوي) أو (كل شخص يدفع حسابه الخاص)." },
        { q: "ما الفرق بين الدعوة العامة والخاصة ودعوات المواعدة؟", a: "• الدعوة العامة: تظهر للجميع على الخريطة الرئيسية ويمكن لأي شخص طلب الانضمام.\n• الدعوة الخاصة: دعوة مخفية لا تظهر للعامة، بل ترسلها أنت كبطاقة إلكترونية لأشخاص محددين حصراً.\n• دعوات المواعدة (Dating): دعوات مخصصة للارتباط، تتطلب باقة Premium وتشمل تقييمات موثوقة وفلاتر متقدمة." },
        { q: "كيف أقبل طلبات الانضمام لدعوتي؟", a: "عندما يطلب شخص الانضمام، سيصلك إشعار فوري. من صفحة تفاصيل الدعوة يمكنك استعراض ملفه الشخصي وثم (قبول) أو (رفض) الانضمام. فور القبول سيُفتح الشات بينكم تلقائياً." },
        { q: "ما هو شات المجتمع (Community Chat)؟", a: "لكل مطعم في التطبيق 'مجتمع' خاص به. عند انضمامك لمجتمع المطعم، ستدخل في غرفة دردشة عامة مع إدارة المطعم وبقية الزبائن للاستفسار عن الأطباق، تبادل التوصيات، ورؤية العروض الحصرية." },
        { q: "كيف يمكنني رفع مستوى حسابي وتجميع نقاط السمعة؟", a: "نقاط السمعة تُظهر مدى موثوقيتك! ترتفع نقاط السمعة عندما تحضر الدعوات في وقتها وتتلقى تقييمات إيجابية 5 نجوم من المنظمين أو الضيوف. بينما تنخفض عند الغياب أو تلقي شكاوى." },
        { q: "كيف أقوم بالترقية لباقة Premium (VIP)؟", a: "في صفحة الحساب، اذهب إلى (الاشتراكات/Subscriptions). باقة VIP تمنحك فلاتر بحث استثنائية، الوصول الكامل لدعوات المواعدة، القدرة على معرفة من زار حسابك، ودعوات خاصة لامحدودة." },
        { q: "كيف أقوم بحذف حسابي بشكل نهائي؟", a: "من صفحة (بروفايل)، اذهب إلى (الإعدادات > الحساب > حذف الحساب). يُرجى العلم أن هذا الإجراء نهائي ولا يمكن التراجع عنه أو استعادة البيانات بعد 30 يوماً." },
        { q: "ما هو تصنيف المقاهي والمطاعم؟ وكيف أبحث؟", a: "يمكنك من شريط البحث فلترة النتائج سواء للمطاعم أو المقاهي، وتخصيص البحث ليظهر الأماكن المفتوحة حالياً، أو ترتيبها حسب التقييم العالي والمسافة." },
        { q: "كيف تعمل بطاقات الدعوة المباشرة لمعارفي؟", a: "بدلاً من استخدام التطبيق للبحث عن ضيوف، يمكنك إنشاء دعوة (خاصة)، ثم نسخ رابط بطاقة الدعوة الفاخرة وإرسالها عبر الواتساب! أي شخص يضغط الرابط سيتم توجيهه لتأكيد حضوره معك فوراً."}
    ],
    business_questions: [
        { q: "ما هي ميزة Business Pro Dashboard؟", a: "لوحة تحكم احترافية مصممة لشركاء ومطاعم داين باديز. تمنحك وصولاً لإدارة المنيو، ساعات العمل، المحادثات، ونشر العروض الإعلانية التي تظهر لكل مستخدمي التطبيق عبر المنصة." },
        { q: "كيف أقوم بنشر بوست إعلاني ليظهر لكل المستخدمين (Featured Post)؟", a: "من لوحة التحكم (Pro Dashboard)، اختر تبويب 'Featured Posts'، ارفع صورتك الإعلانية، واكتب نبذة لكي يظهر البوست الإعلاني للمستخدمين فوراً في قائمة الرئيسية وتلقي التفاعل." },
        { q: "كيف أرسل إشعارات وعروض لجميع أعضاء مجتمعي؟", a: "كل مستخدم ينضم لـ 'الكميونتي' الخاص بك سيظهر في تبويب (الأعضاء). يمكنك إرسال التنبيهات أو طرح عروض في الـ(Community Chat) لتنشيط المبيعات في أوقات فراغ المطعم." },
        { q: "كيف أدير قائمة طعامي (المنيو)؟", a: "من لوحة التحكم ضمن (Menu & Services)، يمكنك إضافة أصناف الطعام مع صورها وأسعارها. ستظهر القائمة بأناقة في صفحتك لجميع الزوار مع إمكانية تحديثها في أي وقت." },
        { q: "ما الفرق بين باقات الشركاء (Professional و Elite)؟", a: "باقة الـ Pro تمنحك أساسيات الوصول للوحة التحكم الظهور في أدلة البحث. الباقة الخارقة (Elite) تمنحك ظهوراً أعلى (تفضيل في الخوارزمية الخاصة بالتطبيق) وقدرة على نشر بوستات إعلانية (Featured Slides) لامحدودة وحملات مخصصة." },
        { q: "كيف أتعامل مع تقييمات الزوار (Reviews)؟", a: "في تبويب (Reviews)، ستتمكن من رؤية إحصائيات تقييمات الزبائن وتفصيلها. يمكنك أيضاً الرد رسمياً على التقييمات باسم المطعم للحفاظ على ولاء عملائك واهتمامك برأيهم." }
    ]
};

const enQuestions = {
    user_questions: [
        { q: "What is DineBuddies?", a: "The ultimate platform for food lovers! DineBuddies is an innovative social app blending fine dining discovery, meeting new people through curated food invitations, and building genuine tabletop communities." },
        { q: "How do I create an invitation and split the bill?", a: "Tap the (+) button, select a restaurant, and set your date & time. In the settings, you can choose if the bill is 'On the Host', 'Split Equally', or 'Everyone pays for themselves'." },
        { q: "What's the difference between Public, Private, and Dating invitations?", a: "• Public: Visible on the main map for anyone to request joining.\n• Private: A hidden invitation sent exclusively via an elegant e-invite link to specific people.\n• Dating: Specially curated romantic encounters requiring a Premium subscription, featuring advanced filters and trusted reviews." },
        { q: "How do I accept join requests for my invitation?", a: "When someone requests to join, you receive an instant notification. Open the invitation details, review their profile, and tap 'Accept' or 'Decline'. Once accepted, a private group chat automatically unlocks." },
        { q: "What is the Community Chat?", a: "Every restaurant on the app has its own 'Community'. By joining a restaurant's community, you enter a public chat room with the staff and other patrons to ask about dishes, share recommendations, and catch exclusive offers." },
        { q: "How do I level up my account and earn Reputation Points?", a: "Reputation Points show your reliability! They increase when you attend events on time and receive 5-star ratings from hosts or guests. Points drop if you no-show or receive complaints." },
        { q: "How do I upgrade to Premium (VIP)?", a: "Navigate to your Profile > Settings > Subscriptions. The VIP tier grants you exceptional search filters, full access to Dating invitations, profile visitor insights, and unlimited private invites." },
        { q: "How do I permanently delete my account?", a: "Go to Profile > Settings > Account > Delete Account. Please note that this action is permanent and data cannot be restored after 30 days." },
        { q: "How do I filter restaurants and cafes?", a: "Use the search bar and filter toggles to sort by Restaurants, Cafes, currently Open venues, or rank them by Highest Rating and closest Distance." },
        { q: "How do direct e-invites work?", a: "Instead of waiting for app users, create a 'Private' invitation, copy its elegant electronic card link, and share it via WhatsApp! Anyone clicking the link is seamlessly guided to RSVP with you." }
    ],
    business_questions: [
        { q: "What is the Business Pro Dashboard?", a: "A tailored, professional control center for DineBuddies restaurant partners. It gives you full control over your Menu, operating hours, direct chats, and broadcasting marketing posts across the platform." },
        { q: "How do I publish a Featured promotional post?", a: "From the Pro Dashboard, navigate to 'Featured Posts', upload your promotional image, and write a caption. Your post will instantly appear to all users in the main app feed." },
        { q: "How do I broadcast offers to my community?", a: "Every user who joins your 'Community' shows up in your Members tab. You can drop massive discounts directly into the 'Community Chat' to instantly drive traffic during off-peak hours." },
        { q: "How do I manage my digital Menu?", a: "Under 'Menu & Services' in your dashboard, upload dishes with mouth-watering photos and pricing. The sleek digital menu updates instantly for all profile visitors." },
        { q: "What is the difference between Professional and Elite Partner tiers?", a: "The 'Pro' tier sets up your storefront and directory listing. The 'Elite' tier is our powerhouse package, supercharging your algorithm ranking and granting unlimited, priority Featured Slides for maximum visibility." },
        { q: "How do I handle Customer Reviews?", a: "The 'Reviews' tab provides deep analytical breakdowns of your ratings. You also have the power to officially reply to reviews under your restaurant’s verified name to build lasting customer loyalty." }
    ]
};

const arData = JSON.parse(fs.readFileSync(arPath, 'utf8'));
arData.faq.user_questions = arQuestions.user_questions;
arData.faq.business_questions = arQuestions.business_questions;
fs.writeFileSync(arPath, JSON.stringify(arData, null, 4));

const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));
enData.faq.user_questions = enQuestions.user_questions;
enData.faq.business_questions = enQuestions.business_questions;
fs.writeFileSync(enPath, JSON.stringify(enData, null, 4));

console.log('Successfully injected comprehensive FAQs into both locales: AR & EN');
