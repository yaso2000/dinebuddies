import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaShieldAlt, FaArrowLeft } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const isAr = i18n.language === 'ar';

    return (
        <div
            style={{
                height: '100vh',
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch',
                padding: '20px',
                paddingBottom: '100px',
                color: 'var(--text-main)',
                maxWidth: '900px',
                margin: '0 auto',
                textAlign: isAr ? 'right' : 'left',
                lineHeight: '1.6',
                boxSizing: 'border-box'
            }}
        >
            <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '20px', fontFamily: 'inherit' }}>
                <FaArrowLeft style={{ transform: isAr ? 'rotate(180deg)' : 'none' }} /> {t('back')}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '40px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
                <FaShieldAlt size={40} color="var(--primary)" />
                <div>
                    <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '900' }}>{t('privacy_policy', 'Privacy Policy')}</h1>
                    <p style={{ margin: '0.25rem 0 0', opacity: 0.6 }}>{t('last_updated', 'Last Updated')}: March 8, 2025</p>
                </div>
            </div>

            {isAr ? (
                <>
                    <p style={{ marginBottom: '1.5rem' }}>
                        تشرح سياسة الخصوصية هذه كيف تقوم DineBuddies ("نحن" أو "الخاصة بنا") بجمع واستخدام وحماية المعلومات الشخصية عند استخدامك لتطبيق DineBuddies وموقع الويب والخدمات ذات الصلة (يُشار إليها مجتمعة باسم "الخدمة").
                    </p>
                    <p style={{ marginBottom: '2rem' }}>
                        من خلال الوصول إلى الخدمة أو استخدامها، فإنك توافق على سياسة الخصوصية هذه.
                    </p>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>1. من نحن</h2>
                        <p>
                            DineBuddies هي عبارة عن منصة اجتماعية لتناول الطعام تتيح للمستخدمين إنشاء دعوات لتناول الطعام والانضمام إليها وتسمح للشركات (مثل المطاعم أو أماكن تقديم الطعام) بإنشاء ملفات تعريف والتواصل مع المستخدمين.
                        </p>
                        <p>
                            إذا كانت لديك أسئلة حول سياسة الخصوصية هذه، يمكنك الاتصال بنا على:
                        </p>
                        <p><strong>{t('email', 'Email')}:</strong> support@dinebuddies.com</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>2. المعلومات التي نجمعها</h2>
                        <p>نحن نجمع المعلومات بعدة طرق.</p>

                        <h3 style={{ fontSize: '1.1rem', marginTop: '1.25rem', marginBottom: '0.5rem' }}>2.1 المعلومات التي تقدمها</h3>
                        <p>عند إنشاء حساب أو استخدامه، قد تقدم:</p>
                        <ul style={{ paddingLeft: '0', paddingRight: '1.5rem' }}>
                            <li>الاسم أو اسم العرض</li>
                            <li>عنوان البريد الإلكتروني</li>
                            <li>رقم الهاتف (اختياري)</li>
                            <li>صورة الملف الشخصي</li>
                            <li>دور الحساب (مستخدم أو نشاط تجاري)</li>
                            <li>معلومات المطعم أو النشاط التجاري (لحسابات الأعمال)</li>
                            <li>روابط وسائل التواصل الاجتماعي</li>
                            <li>دعوات تناول الطعام والرسائل</li>
                        </ul>
                        <p>تسمح هذه المعلومات للمنصة بالعمل وتمكين التفاعل الاجتماعي بين المستخدمين.</p>

                        <h3 style={{ fontSize: '1.1rem', marginTop: '1.25rem', marginBottom: '0.5rem' }}>2.2 معلومات الملف الشخصي والأعمال</h3>
                        <p>قد توفر حسابات الأعمال معلومات إضافية بما في ذلك:</p>
                        <ul style={{ paddingLeft: '0', paddingRight: '1.5rem' }}>
                            <li>اسم العمل</li>
                            <li>وصف العمل</li>
                            <li>معلومات المطعم أو المكان</li>
                            <li>ساعات العمل</li>
                            <li>روابط التوصيل</li>
                            <li>القوائم أو الصور</li>
                            <li>العروض الترويجية</li>
                        </ul>
                        <p>قد تكون بعض هذه المعلومات مرئية بشكل عام للمستخدمين الآخرين داخل المنصة.</p>

                        <h3 style={{ fontSize: '1.1rem', marginTop: '1.25rem', marginBottom: '0.5rem' }}>2.3 معلومات الموقع</h3>
                        <p>قد تجمع DineBuddies معلومات تقريبية عن الموقع من أجل:</p>
                        <ul style={{ paddingLeft: '0', paddingRight: '1.5rem' }}>
                            <li>إظهار دعوات تناول الطعام القريبة</li>
                            <li>تحسين اكتشاف المطاعم والأحداث</li>
                            <li>توفير الميزات المستندة إلى الموقع</li>
                        </ul>
                        <p>يمكن تعطيل خدمات الموقع في أي وقت من إعدادات الجهاز.</p>

                        <h3 style={{ fontSize: '1.1rem', marginTop: '1.25rem', marginBottom: '0.5rem' }}>2.4 محتوى المستخدم</h3>
                        <p>قد يقوم المستخدمون بإنشاء ومشاركة المحتوى بما في ذلك:</p>
                        <ul style={{ paddingLeft: '0', paddingRight: '1.5rem' }}>
                            <li>دعوات تناول الطعام</li>
                            <li>الرسائل ومحتوى الدردشة</li>
                            <li>الصور أو تحميلات الوسائط</li>
                            <li>التعليقات أو المراجعات</li>
                        </ul>
                        <p>قد يكون المحتوى مرئيًا للمستخدمين الآخرين وفقًا لإعدادات الخصوصية.</p>

                        <h3 style={{ fontSize: '1.1rem', marginTop: '1.25rem', marginBottom: '0.5rem' }}>2.5 الأجهزة والمعلومات الفنية</h3>
                        <p>قد نقوم تلقائيًا بجمع معلومات تقنية معينة بما في ذلك:</p>
                        <ul style={{ paddingLeft: '0', paddingRight: '1.5rem' }}>
                            <li>نوع الجهاز</li>
                            <li>نظام التشغيل</li>
                            <li>نوع المتصفح</li>
                            <li>عنوان IP</li>
                            <li>إحصائيات الاستخدام</li>
                            <li>سجلات الأعطال وبيانات الأداء</li>
                        </ul>
                        <p>تساعدنا هذه البيانات في الحفاظ على الخدمة وتحسينها.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>3. الخدمات وتقنيات الجهات الخارجية</h2>
                        <p>قد تستخدم الخدمة تقنيات الجهات الخارجية التي تعالج معلومات معينة.</p>

                        <h3 style={{ fontSize: '1.1rem', marginTop: '1.25rem', marginBottom: '0.5rem' }}>3.1 فايربيس (Google)</h3>
                        <p>تستخدم DineBuddies خدمات Firebase، والتي قد تشمل:</p>
                        <ul style={{ paddingLeft: '0', paddingRight: '1.5rem' }}>
                            <li>مصادقة Firebase</li>
                            <li>Cloud Firestore</li>
                            <li>تخزين Firebase</li>
                            <li>المراسلة السحابية عبر Firebase</li>
                            <li>وظائف Firebase</li>
                            <li>استضافة Firebase</li>
                        </ul>
                        <p>تعالج Firebase البيانات وفقًا لسياسات خصوصية Google.</p>
                        <p><a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>https://firebase.google.com/support/privacy</a></p>

                        <h3 style={{ fontSize: '1.1rem', marginTop: '1.25rem', marginBottom: '0.5rem' }}>3.2 منصة خرائط Google</h3>
                        <p>قد تستخدم DineBuddies واجهات برمجة تطبيقات خرائط Google لعرض المواقع أو المطاعم أو الدعوات على الخرائط. يخضع استخدام خرائط Google لسياسة خصوصية Google وشروط خدمة خرائط Google.</p>
                        <p><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>https://policies.google.com/privacy</a></p>

                        <h3 style={{ fontSize: '1.1rem', marginTop: '1.25rem', marginBottom: '0.5rem' }}>3.3 خدمات التحليلات</h3>
                        <p>قد نستخدم خدمات التحليلات مثل تحليلات Google وتحليلات Firebase. تساعدنا هذه الخدمات على فهم كيفية تفاعل المستخدمين مع المنصة. عادة ما يتم تجميع بيانات التحليلات ولا تحدد هوية المستخدمين الفرديين بشكل مباشر.</p>

                        <h3 style={{ fontSize: '1.1rem', marginTop: '1.25rem', marginBottom: '0.5rem' }}>3.4 دفع الإشعارات</h3>
                        <p>قد نرسل إشعارات الدفع المتعلقة بالدعوات والرسائل وتحديثات المنصة ونشاط الحساب. يمكن للمستخدمين تعطيل الإشعارات من خلال إعدادات الجهاز.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>4. كيف نستخدم المعلومات الشخصية</h2>
                        <p>قد نستخدم المعلومات التي تم جمعها في:</p>
                        <ul style={{ paddingLeft: '0', paddingRight: '1.5rem' }}>
                            <li>توفير وتشغيل الخدمة</li>
                            <li>إدارة حسابات المستخدمين</li>
                            <li>تمكين دعوات تناول الطعام والمراسلة</li>
                            <li>عرض ملفات تعريف الأعمال والعروض</li>
                            <li>تحسين وظائف وأداء النظام الأساسي</li>
                            <li>كشف الاحتيال أو سوء الاستخدام أو الانتهاكات</li>
                            <li>توفير دعم العملاء</li>
                            <li>الامتثال للالتزامات القانونية</li>
                        </ul>
                        <p>قد نستخدم أيضاً بيانات مجمعة للتحليل الإحصائي.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>5. الأساس القانوني للمعالجة (GDPR)</h2>
                        <p>بالنسبة للمستخدمين المقيمين في المنطقة الاقتصادية الأوروبية (EEA)، نقوم بمعالجة البيانات الشخصية بموجب الأسس القانونية التالية:</p>
                        <ul style={{ paddingLeft: '0', paddingRight: '1.5rem' }}>
                            <li>الضرورة التعاقدية (لتوفير الخدمة)</li>
                            <li>المصالح المشروعة (لتحسين وتأمين المنصة)</li>
                            <li>موافقة المستخدم (للميزات الاختيارية مثل الوصول إلى الموقع)</li>
                            <li>الالتزامات القانونية</li>
                        </ul>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>6. تبادل المعلومات</h2>
                        <p>نحن لا نبيع البيانات الشخصية.</p>
                        <p>قد يتم مشاركة المعلومات في الحالات التالية:</p>
                        <p><strong>مع مستخدمين آخرين:</strong> قد تكون بعض معلومات الملف الشخصي مرئية للمستخدمين الآخرين بما في ذلك اسم العرض، وصورة الملف الشخصي، والدعوات، وملفات الأنشطة التجارية.</p>
                        <p><strong>مع مزودي الخدمة:</strong> قد نشارك البيانات مع مزودي الخدمة الموثوقين الذين يدعمون المنصة، بما في ذلك الاستضافة السحابية والتحليلات وخدمات المراسلة.</p>
                        <p><strong>الامتثال القانوني:</strong> قد نكشف عن معلومات عندما يُطلب منا الامتثال للقوانين أو الإجراءات القانونية، أو الاستجابة لطلبات إنفاذ القانون، أو لحماية سلامة المستخدم أو سلامة المنصة.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>7. أمان البيانات</h2>
                        <p>نُطبق تدابير فنية وتنظيمية معقولة لحماية البيانات الشخصية، بما في ذلك:</p>
                        <ul style={{ paddingLeft: '0', paddingRight: '1.5rem' }}>
                            <li>بنية تحتية سحابية آمنة</li>
                            <li>ضوابط المصادقة</li>
                            <li>اتصالات مشفرة (HTTPS)</li>
                            <li>ضوابط الوصول الإداري</li>
                        </ul>
                        <p>ومع ذلك، لا يمكن لأي نظام متصل بالإنترنت ضمان الأمن المطلق.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>8. الاحتفاظ بالبيانات</h2>
                        <p>نحن نحتفظ بالمعلومات الشخصية فقط طالما كان ذلك ضروريًا من أجل:</p>
                        <ul style={{ paddingLeft: '0', paddingRight: '1.5rem' }}>
                            <li>تقديم الخدمة</li>
                            <li>الحفاظ على سلامة النظام</li>
                            <li>الامتثال للالتزامات القانونية</li>
                            <li>منع الاحتيال أو سوء الاستخدام</li>
                        </ul>
                        <p>قد تبقى الحسابات المحذوفة في النسخ الاحتياطية لفترة محدودة.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>9. حقوقك (GDPR)</h2>
                        <p>قد يتمتع المستخدمون المقيمون في الاتحاد الأوروبي بالحقوق التالية:</p>
                        <ul style={{ paddingLeft: '0', paddingRight: '1.5rem' }}>
                            <li>الحق في الوصول إلى البيانات الشخصية</li>
                            <li>الحق في تصحيح معلومات غير دقيقة</li>
                            <li>الحق في طلب الحذف</li>
                            <li>الحق في تقييد المعالجة</li>
                            <li>الحق في قابلية نقل البيانات</li>
                            <li>الحق في الاعتراض على معالجة معينة</li>
                        </ul>
                        <p>يمكن إرسال الطلبات إلى بريدنا الإلكتروني الخاص بالاتصال.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>10. حقوق الخصوصية الأسترالية</h2>
                        <p>بالنسبة للمستخدمين المقيمين في أستراليا، يتم التعامل مع المعلومات الشخصية وفقًا لمبادئ الخصوصية الأسترالية (APPs) بموجب قانون الخصوصية لعام 1988. يحق للمستخدمين طلب الوصول إلى المعلومات الشخصية التي تحتفظ بها DineBuddies أو تصحيحها.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>11. خصوصية الأطفال</h2>
                        <p>تطبيق DineBuddies مخصص للمستخدمين الذين يبلغون من العمر 18 عامًا أو أكثر. لا نجمع بيانات شخصية من أطفال دون سن 18 عامًا عن قصد. وإذا تم اكتشاف بيانات من هذا القبيل، سيتم إزالة الحساب.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>12. عمليات نقل البيانات الدولية</h2>
                        <p>نظرًا لأن بنيتنا التحتية قد تستخدم مزودي خدمات سحابية عالميين، فقد يتم معالجة معلومات المستخدم في بلدان خارج بلد إقامة المستخدم. نحن نتخذ ضمانات مناسبة لضمان عمليات النقل القانونية.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>13. التغييرات على سياسة الخصوصية هذه</h2>
                        <p>قد نقوم بتحديث سياسة الخصوصية هذه من وقت لآخر. عند حدوث تغييرات، ستُنشر السياسة المحدثة في هذه الصفحة، وسيتم تحديث تاريخ "آخر تحديث"، ويُعد استمرارك في استخدام الخدمة موافقة على السياسة المنقحة.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>14. اتصل بنا</h2>
                        <p>إذا كانت لديك أسئلة حول سياسة الخصوصية هذه، فاتصل بنا على:</p>
                        <p><strong>{t('email', 'Email')}:</strong> support@dinebuddies.com</p>
                        <p><strong>{t('website', 'Website')}:</strong> https://dinebuddies.com</p>
                    </section>
                </>
            ) : (
                <>
                    <p style={{ marginBottom: '1.5rem' }}>
                        This Privacy Policy explains how DineBuddies ("we", "our", "us") collects, uses, and protects personal information when you use the DineBuddies mobile application, website, and related services (collectively, the "Service").
                    </p>
                    <p style={{ marginBottom: '2rem' }}>
                        By accessing or using the Service, you agree to this Privacy Policy.
                    </p>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>1. Who We Are</h2>
                        <p>
                            DineBuddies is a social dining platform that allows users to create and join dining invitations and allows businesses (such as restaurants or food venues) to create profiles and connect with users.
                        </p>
                        <p>
                            If you have questions about this Privacy Policy, you may contact us at:
                        </p>
                        <p><strong>{t('email', 'Email')}:</strong> support@dinebuddies.com</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>2. Information We Collect</h2>
                        <p>We collect information in several ways.</p>

                        <h3 style={{ fontSize: '1.1rem', marginTop: '1.25rem', marginBottom: '0.5rem' }}>2.1 Information You Provide</h3>
                        <p>When you create or use an account, you may provide:</p>
                        <ul style={{ paddingLeft: '1.5rem', paddingRight: '0' }}>
                            <li>Name or display name</li>
                            <li>Email address</li>
                            <li>Phone number (optional)</li>
                            <li>Profile photo</li>
                            <li>Account role (User or Business)</li>
                            <li>Restaurant or business information (for business accounts)</li>
                            <li>Social media links</li>
                            <li>Dining invitations and messages</li>
                        </ul>
                        <p>This information allows the platform to function and enables social interaction between users.</p>

                        <h3 style={{ fontSize: '1.1rem', marginTop: '1.25rem', marginBottom: '0.5rem' }}>2.2 Profile and Business Information</h3>
                        <p>Business accounts may provide additional information including:</p>
                        <ul style={{ paddingLeft: '1.5rem', paddingRight: '0' }}>
                            <li>Business name</li>
                            <li>Business description</li>
                            <li>Restaurant or venue information</li>
                            <li>Opening hours</li>
                            <li>Delivery links</li>
                            <li>Menus or images</li>
                            <li>Promotional offers</li>
                        </ul>
                        <p>Some of this information may be publicly visible to other users within the platform.</p>

                        <h3 style={{ fontSize: '1.1rem', marginTop: '1.25rem', marginBottom: '0.5rem' }}>2.3 Location Information</h3>
                        <p>DineBuddies may collect approximate location information to:</p>
                        <ul style={{ paddingLeft: '1.5rem', paddingRight: '0' }}>
                            <li>Show nearby dining invitations</li>
                            <li>Improve discovery of restaurants and events</li>
                            <li>Provide location-based features</li>
                        </ul>
                        <p>Location services can be disabled at any time in device settings.</p>

                        <h3 style={{ fontSize: '1.1rem', marginTop: '1.25rem', marginBottom: '0.5rem' }}>2.4 User Content</h3>
                        <p>Users may create and share content including:</p>
                        <ul style={{ paddingLeft: '1.5rem', paddingRight: '0' }}>
                            <li>Dining invitations</li>
                            <li>Messages and chat content</li>
                            <li>Photos or media uploads</li>
                            <li>Comments or reviews</li>
                        </ul>
                        <p>Content may be visible to other users depending on privacy settings.</p>

                        <h3 style={{ fontSize: '1.1rem', marginTop: '1.25rem', marginBottom: '0.5rem' }}>2.5 Device and Technical Information</h3>
                        <p>We may automatically collect certain technical information including:</p>
                        <ul style={{ paddingLeft: '1.5rem', paddingRight: '0' }}>
                            <li>Device type</li>
                            <li>Operating system</li>
                            <li>Browser type</li>
                            <li>IP address</li>
                            <li>Usage statistics</li>
                            <li>Crash logs and performance data</li>
                        </ul>
                        <p>This data helps us maintain and improve the Service.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>3. Services and Third-Party Technologies</h2>
                        <p>The Service may use third-party technologies that process certain information.</p>

                        <h3 style={{ fontSize: '1.1rem', marginTop: '1.25rem', marginBottom: '0.5rem' }}>3.1 Firebase (Google)</h3>
                        <p>DineBuddies uses Firebase services, which may include:</p>
                        <ul style={{ paddingLeft: '1.5rem', paddingRight: '0' }}>
                            <li>Firebase Authentication</li>
                            <li>Cloud Firestore</li>
                            <li>Firebase Storage</li>
                            <li>Firebase Cloud Messaging</li>
                            <li>Firebase Functions</li>
                            <li>Firebase Hosting</li>
                        </ul>
                        <p>Firebase processes data according to Google's privacy policies.</p>
                        <p><a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>https://firebase.google.com/support/privacy</a></p>

                        <h3 style={{ fontSize: '1.1rem', marginTop: '1.25rem', marginBottom: '0.5rem' }}>3.2 Google Maps Platform</h3>
                        <p>DineBuddies may use Google Maps APIs to display locations, restaurants, or invitations on maps. Use of Google Maps is subject to Google Privacy Policy and Google Maps Terms of Service.</p>
                        <p><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>https://policies.google.com/privacy</a></p>

                        <h3 style={{ fontSize: '1.1rem', marginTop: '1.25rem', marginBottom: '0.5rem' }}>3.3 Analytics Services</h3>
                        <p>We may use analytics services such as Google Analytics and Firebase Analytics. These services help us understand how users interact with the platform. Analytics data is typically aggregated and does not directly identify individual users.</p>

                        <h3 style={{ fontSize: '1.1rem', marginTop: '1.25rem', marginBottom: '0.5rem' }}>3.4 Push Notifications</h3>
                        <p>We may send push notifications related to invitations, messages, platform updates, and account activity. Users may disable notifications through device settings.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>4. How We Use Personal Information</h2>
                        <p>We may use collected information to:</p>
                        <ul style={{ paddingLeft: '1.5rem', paddingRight: '0' }}>
                            <li>Provide and operate the Service</li>
                            <li>Manage user accounts</li>
                            <li>Enable dining invitations and messaging</li>
                            <li>Display business profiles and offers</li>
                            <li>Improve the functionality and performance of the platform</li>
                            <li>Detect fraud, abuse, or violations</li>
                            <li>Provide customer support</li>
                            <li>Comply with legal obligations</li>
                        </ul>
                        <p>We may also use aggregated data for statistical analysis.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>5. Legal Basis for Processing (GDPR)</h2>
                        <p>For users located in the European Economic Area (EEA), we process personal data under the following legal bases:</p>
                        <ul style={{ paddingLeft: '1.5rem', paddingRight: '0' }}>
                            <li>Contractual necessity (to provide the Service)</li>
                            <li>Legitimate interests (to improve and secure the platform)</li>
                            <li>User consent (for optional features such as location access)</li>
                            <li>Legal obligations</li>
                        </ul>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>6. Sharing of Information</h2>
                        <p>We do not sell personal data.</p>
                        <p>Information may be shared in the following situations:</p>
                        <p><strong>With Other Users:</strong> Certain profile information may be visible to other users including display name, profile photo, invitations, and business profiles.</p>
                        <p><strong>With Service Providers:</strong> We may share data with trusted service providers that support the platform, including cloud hosting, analytics, and messaging services.</p>
                        <p><strong>Legal Compliance:</strong> We may disclose information when required to comply with laws or legal processes, respond to law enforcement requests, or protect user safety or platform integrity.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>7. Data Security</h2>
                        <p>We implement reasonable technical and organizational measures to protect personal data, including:</p>
                        <ul style={{ paddingLeft: '1.5rem', paddingRight: '0' }}>
                            <li>Secure cloud infrastructure</li>
                            <li>Authentication controls</li>
                            <li>Encrypted communications (HTTPS)</li>
                            <li>Administrative access controls</li>
                        </ul>
                        <p>However, no online system can guarantee absolute security.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>8. Data Retention</h2>
                        <p>We retain personal information only as long as necessary to:</p>
                        <ul style={{ paddingLeft: '1.5rem', paddingRight: '0' }}>
                            <li>Provide the Service</li>
                            <li>Maintain system integrity</li>
                            <li>Comply with legal obligations</li>
                            <li>Prevent fraud or abuse</li>
                        </ul>
                        <p>Deleted accounts may remain in backups for a limited period.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>9. Your Rights (GDPR)</h2>
                        <p>Users located in the European Union may have the following rights:</p>
                        <ul style={{ paddingLeft: '1.5rem', paddingRight: '0' }}>
                            <li>Right to access personal data</li>
                            <li>Right to correct inaccurate information</li>
                            <li>Right to request deletion</li>
                            <li>Right to restrict processing</li>
                            <li>Right to data portability</li>
                            <li>Right to object to certain processing</li>
                        </ul>
                        <p>Requests can be sent to our contact email.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>10. Australian Privacy Rights</h2>
                        <p>For users located in Australia, personal information is handled in accordance with the Australian Privacy Principles (APPs) under the Privacy Act 1988. Users may request access to or correction of personal information held by DineBuddies.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>11. Children's Privacy</h2>
                        <p>DineBuddies is intended for users 18 years or older. We do not knowingly collect personal data from children under 18. If such data is discovered, the account may be removed.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>12. International Data Transfers</h2>
                        <p>Because our infrastructure may use global cloud providers, user information may be processed in countries outside the user's country of residence. We take appropriate safeguards to ensure lawful transfers.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>13. Changes to This Privacy Policy</h2>
                        <p>We may update this Privacy Policy from time to time. When changes occur, the updated policy will be posted on this page, the "Last Updated" date will be updated, and continued use of the Service indicates acceptance of the revised policy.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>14. Contact Us</h2>
                        <p>If you have questions about this Privacy Policy, contact us at:</p>
                        <p><strong>{t('email', 'Email')}:</strong> support@dinebuddies.com</p>
                        <p><strong>{t('website', 'Website')}:</strong> https://dinebuddies.com</p>
                    </section>
                </>
            )}

            <div style={{ marginTop: '2.5rem', padding: '1.5rem', background: 'var(--bg-card)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>{t('last_updated', 'Last Updated')}: March 8, 2025</p>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
