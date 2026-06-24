import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaFileContract, FaArrowLeft, FaGavel, FaUserCheck, FaShieldAlt, FaUsers, FaStore, FaBan, FaHandshake, FaCopyright, FaLock, FaPlug, FaCog, FaTimes, FaExclamationTriangle, FaBalanceScale, FaGlobe, FaEdit, FaEnvelope } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { AppText } from "../components/base";

const listStyle = (isAr) => ({ paddingLeft: isAr ? '0' : '1.5rem', paddingRight: isAr ? '1.5rem' : '0', marginBottom: '0.5rem' });

const TermsOfService = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isAr = i18n.language?.startsWith('ar');

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
      }}>
      
            <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '20px', fontFamily: 'inherit' }}>
                <FaArrowLeft style={{ transform: isAr ? 'rotate(180deg)' : 'none' }} /> {t('back', 'Back')}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '40px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
                <FaFileContract size={40} color="var(--primary)" />
                <div>
                    <AppText as="h1" style={{ margin: 0, fontSize: '2rem', fontWeight: '900' }}>{t('terms_of_service', 'Terms of Service')}</AppText>
                    <AppText as="p" style={{ margin: '0.25rem 0 0', opacity: 0.6 }}>{t('last_updated', 'Last Updated')}: March 8, 2025</AppText>
                </div>
            </div>

            {isAr ?
      <>
                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaGavel /> 1. القبول</AppText>
                        <AppText as="p">باستخدام منصة DineBuddies، تقر بأنك قد قرأت هذه الشروط وفهمتها ووافقت على الالتزام بها. تسري هذه الاتفاقية منذ اللحظة التي تدخل فيها إلى الخدمة لأول مرة.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaUserCheck /> 2. الأهلية</AppText>
                        <AppText as="p">يجب أن يكون عمرك 18 عامًا أو أكثر لاستخدام خدماتنا. باستخدامك للتطبيق، فإنك تضمن أن جميع المعلومات التي تقدمها دقيقة وأنك لا تنتهك أي قوانين معمول بها.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaShieldAlt /> 3. مسؤوليات الحساب</AppText>
                        <AppText as="p">أنت توافق على:</AppText>
                        <ul style={listStyle(isAr)}>
                            <li>تقديم معلومات دقيقة وصادقة</li>
                            <li>الحفاظ على أمان بيانات اعتماد حسابك</li>
                            <li>إبلاغنا فورًا بأي وصول غير مصرح به</li>
                            <li>تحمل المسؤولية عن جميع الأنشطة التي تتم بموجب حسابك</li>
                        </ul>
                        <AppText as="p">نحتفظ بالحق في تعليق أو إنهاء الحسابات التي تنتهك هذه الشروط.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaUsers /> 4. أدوار المستخدمين</AppText>
                        <AppText as="p">قد تقدم DineBuddies أنواعًا مختلفة من الحسابات بما في ذلك:</AppText>
                        <ul style={listStyle(isAr)}>
                            <li><strong>المستخدمون</strong> – الأفراد الذين ينشئون أو ينضمون إلى دعوات لتناول الطعام</li>
                            <li><strong>الشركات</strong> – المطاعم أو الأماكن التي تنشئ ملفات تعريف وعروضًا</li>
                            <li><strong>المسؤولون أو موظفو الدعم</strong> – أدوار إدارة المنصة</li>
                        </ul>
                        <AppText as="p">قد تنطبق ميزات مختلفة على أدوار مختلفة.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>5. محتوى المستخدم</AppText>
                        <AppText as="p">قد ينشئ المستخدمون محتوى ويشاركونه مثل:</AppText>
                        <ul style={listStyle(isAr)}>
                            <li>دعوات تناول الطعام</li>
                            <li>الرسائل والمحادثات</li>
                            <li>الصور أو الوسائط</li>
                            <li>التعليقات أو المراجعات</li>
                            <li>ملفات تعريف الأنشطة التجارية والعروض</li>
                        </ul>
                        <AppText as="p">من خلال نشر المحتوى، فإنك تمنح DineBuddies ترخيصًا عالميًا وغير حصري وخاليًا من حقوق الملكية لاستضافة المحتوى وعرضه وتوزيعه داخل الخدمة. تظل أنت مسؤولاً عن المحتوى الذي تنشره.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaBan /> 6. السلوك المحظور</AppText>
                        <AppText as="p">أنت توافق على عدم استخدام الخدمة من أجل:</AppText>
                        <ul style={listStyle(isAr)}>
                            <li>مضايقة المستخدمين الآخرين أو تهديدهم أو الإساءة إليهم</li>
                            <li>نشر محتوى غير قانوني أو مضلل أو ضار</li>
                            <li>مشاركة مواد مسيئة أو صريحة</li>
                            <li>انتحال شخصية شخص آخر أو شركة أخرى</li>
                            <li>إرسال بريد عشوائي إلى المستخدمين أو توزيع محتوى ضار</li>
                            <li>محاولة اختراق المنصة أو استغلالها أو تعطيلها</li>
                            <li>انتهاك حقوق الملكية الفكرية</li>
                        </ul>
                        <AppText as="p">قد تقوم DineBuddies بإزالة المحتوى أو تعليق الحسابات التي تنتهك هذه القواعد.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaStore /> 7. حسابات الأعمال</AppText>
                        <AppText as="p">الشركات التي تستخدم الخدمة توافق على:</AppText>
                        <ul style={listStyle(isAr)}>
                            <li>تقديم معلومات دقيقة عن مكانها</li>
                            <li>التأكد من أن المحتوى الترويجي صادق</li>
                            <li>الالتزام بالقوانين المحلية المتعلقة بالإعلانات وخدمات الطعام</li>
                            <li>احترام تفاعلات المستخدمين على المنصة</li>
                        </ul>
                        <AppText as="p">لا تضمن DineBuddies جودة أو توفر أو دقة خدمات الأعمال.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaHandshake /> 8. الدعوات والأحداث</AppText>
                        <AppText as="p">تُسهل DineBuddies دعوات تناول الطعام الاجتماعية بين المستخدمين. المنصة:</AppText>
                        <ul style={listStyle(isAr)}>
                            <li>لا تنظم الأحداث مباشرة</li>
                            <li>لا تتحقق من جميع المشاركين</li>
                            <li>ليست مسؤولة عن السلوك أثناء الاجتماعات في العالم الحقيقي</li>
                        </ul>
                        <AppText as="p">يشارك المستخدمون في الأحداث وفقًا لتقديرهم الخاص وعلى مسؤوليتهم.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaCopyright /> 9. الملكية الفكرية</AppText>
                        <AppText as="p">جميع الحقوق في منصة DineBuddies بما في ذلك البرامج والتصميم والشعارات والمحتوى والميزات مملوكة لشركة DineBuddies أو المرخصين لها. لا يجوز لك استخدام علاماتنا التجارية أو ملكيتنا الفكرية دون إذن.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaLock /> 10. الخصوصية</AppText>
                        <AppText as="p">يخضع استخدامك للخدمة أيضًا لسياسة الخصوصية الخاصة بنا، والتي تشرح كيف نجمع ونستخدم المعلومات. يرجى مراجعتها هنا: <a href="https://dinebuddies.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>https://dinebuddies.com/privacy</a></AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaPlug /> 11. خدمات الجهات الخارجية</AppText>
                        <AppText as="p">قد تدمج الخدمة خدمات جهات خارجية مثل خرائط Google وFirebase وخدمات التحليلات وروابط وسائل التواصل الاجتماعي. لا تتحمل DineBuddies مسؤولية خدمات الجهات الخارجية أو ممارسات الخصوصية الخاصة بها.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaCog /> 12. توافر المنصة</AppText>
                        <AppText as="p">نهدف إلى إبقاء الخدمة متاحة لكننا لا نضمن التوافر المستمر أو التشغيل الخالي من الأخطاء أو التوافق مع جميع الأجهزة. قد نقوم بتعديل أو إيقاف الميزات في أي وقت.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaTimes /> 13. الإنهاء</AppText>
                        <AppText as="p">يجوز لنا تعليق الحسابات أو إنهائها إذا خالف المستخدمون هذه الشروط، أو شاركوا في سلوك مسيء، أو حاولوا استغلال المنصة، أو نشروا محتوى ضارًا أو غير قانوني. يجوز للمستخدمين أيضًا التوقف عن استخدام الخدمة في أي وقت.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaExclamationTriangle /> 14. إخلاء المسؤولية عن الضمانات</AppText>
                        <AppText as="p">تُقدم الخدمة "كما هي" و"كما تتوفر". لا تقدم DineBuddies أي ضمانات بشأن دقة المعلومات، أو موثوقية المستخدمين أو الشركات، أو سلامة الاجتماعات في العالم الحقيقي، أو توافر الخدمة المستمر.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaBalanceScale /> 15. تحديد المسؤولية</AppText>
                        <AppText as="p">إلى أقصى حد يسمح به القانون، لن تتحمل DineBuddies المسؤولية عن الأضرار غير المباشرة أو التبعية، أو فقدان البيانات، أو النزاعات الشخصية بين المستخدمين، أو الأضرار الناشئة عن التفاعلات في العالم الحقيقي. استخدام الخدمة يكون على مسؤوليتك الخاصة.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>16. التعويض</AppText>
                        <AppText as="p">أنت توافق على تعويض DineBuddies وإبراء ذمتها من أي مطالبات أو أضرار أو نزاعات قانونية تنشأ عن استخدامك للخدمة، أو المحتوى الذي تنشره، أو انتهاكات هذه الشروط، أو انتهاكات القوانين المعمول بها.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaGlobe /> 17. القانون المطبق</AppText>
                        <AppText as="p">تخضع هذه الشروط للقوانين المعمول بها في أستراليا، ما لم تقتضِ قوانين حماية المستهلك المعمول بها خلاف ذلك.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaEdit /> 18. التغييرات على هذه الشروط</AppText>
                        <AppText as="p">قد نقوم بتحديث هذه الشروط من وقت لآخر. عند حدوث تغييرات، سيتم نشر الشروط المحدثة في هذه الصفحة، وستتم مراجعة تاريخ "آخر تحديث"، ويُعد الاستمرار في استخدام الخدمة قبولًا للشروط المحدثة.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaEnvelope /> 19. اتصل بنا</AppText>
                        <AppText as="p">للأسئلة المتعلقة بهذه الشروط:</AppText>
                        <AppText as="p"><strong>{t('email', 'Email')}:</strong> support@dinebuddies.com</AppText>
                        <AppText as="p"><strong>{t('website', 'Website')}:</strong> https://dinebuddies.com</AppText>
                    </section>
                </> :

      <>
                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaGavel /> 1. Acceptance</AppText>
                        <AppText as="p">By using the DineBuddies platform, you acknowledge that you have read, understood, and agreed to be bound by these Terms. This agreement is effective from the moment you first access the Service.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaUserCheck /> 2. Eligibility</AppText>
                        <AppText as="p">You must be 18 years or older to use our services. By using the app, you warrant that all information you provide is accurate and that you are not violating any applicable laws.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaShieldAlt /> 3. Account Responsibilities</AppText>
                        <AppText as="p">You agree to:</AppText>
                        <ul style={listStyle(isAr)}>
                            <li>Provide accurate and truthful information</li>
                            <li>Maintain the security of your account credentials</li>
                            <li>Notify us immediately of unauthorized access</li>
                            <li>Be responsible for all activities under your account</li>
                        </ul>
                        <AppText as="p">We reserve the right to suspend or terminate accounts that violate these Terms.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaUsers /> 4. User Roles</AppText>
                        <AppText as="p">DineBuddies may offer different account types including:</AppText>
                        <ul style={listStyle(isAr)}>
                            <li><strong>Users</strong> – individuals who create or join dining invitations</li>
                            <li><strong>Businesses</strong> – restaurants or venues that create profiles and offers</li>
                            <li><strong>Administrators or support staff</strong> – platform management roles</li>
                        </ul>
                        <AppText as="p">Different features may apply to different roles.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>5. User Content</AppText>
                        <AppText as="p">Users may create and share content such as:</AppText>
                        <ul style={listStyle(isAr)}>
                            <li>Dining invitations</li>
                            <li>Messages and chats</li>
                            <li>Photos or media</li>
                            <li>Reviews or comments</li>
                            <li>Business profiles and offers</li>
                        </ul>
                        <AppText as="p">By posting content, you grant DineBuddies a worldwide, non-exclusive, royalty-free license to host, display, and distribute the content within the Service. You remain responsible for the content you post.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaBan /> 6. Prohibited Conduct</AppText>
                        <AppText as="p">You agree not to use the Service to:</AppText>
                        <ul style={listStyle(isAr)}>
                            <li>Harass, threaten, or abuse other users</li>
                            <li>Post illegal, misleading, or harmful content</li>
                            <li>Share offensive or explicit material</li>
                            <li>Impersonate another person or business</li>
                            <li>Spam users or distribute malicious content</li>
                            <li>Attempt to hack, exploit, or disrupt the platform</li>
                            <li>Violate intellectual property rights</li>
                        </ul>
                        <AppText as="p">DineBuddies may remove content or suspend accounts that violate these rules.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaStore /> 7. Business Accounts</AppText>
                        <AppText as="p">Businesses using the Service agree to:</AppText>
                        <ul style={listStyle(isAr)}>
                            <li>Provide accurate information about their venue</li>
                            <li>Ensure promotional content is truthful</li>
                            <li>Comply with local laws regarding advertising and food services</li>
                            <li>Respect user interactions on the platform</li>
                        </ul>
                        <AppText as="p">DineBuddies does not guarantee the quality, availability, or accuracy of business services.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaHandshake /> 8. Invitations and Events</AppText>
                        <AppText as="p">DineBuddies facilitates social dining invitations between users. The platform:</AppText>
                        <ul style={listStyle(isAr)}>
                            <li>Does not organize events directly</li>
                            <li>Does not verify all participants</li>
                            <li>Is not responsible for conduct during real-world meetings</li>
                        </ul>
                        <AppText as="p">Users participate in events at their own discretion and risk.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaCopyright /> 9. Intellectual Property</AppText>
                        <AppText as="p">All rights in the DineBuddies platform including software, design, logos, content, and features are owned by DineBuddies or its licensors. You may not use our trademarks or intellectual property without permission.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaLock /> 10. Privacy</AppText>
                        <AppText as="p">Your use of the Service is also governed by our Privacy Policy, which explains how we collect and use information. Please review it here: <a href="https://dinebuddies.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>https://dinebuddies.com/privacy</a></AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaPlug /> 11. Third-Party Services</AppText>
                        <AppText as="p">The Service may integrate third-party services such as Google Maps, Firebase, analytics services, and social media links. DineBuddies is not responsible for third-party services or their privacy practices.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaCog /> 12. Platform Availability</AppText>
                        <AppText as="p">We aim to keep the Service available but do not guarantee continuous availability, error-free operation, or compatibility with all devices. We may modify or discontinue features at any time.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaTimes /> 13. Termination</AppText>
                        <AppText as="p">We may suspend or terminate accounts if users violate these Terms, engage in abusive behavior, attempt to exploit the platform, or post harmful or illegal content. Users may also stop using the Service at any time.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaExclamationTriangle /> 14. Disclaimer of Warranties</AppText>
                        <AppText as="p">The Service is provided "as is" and "as available." DineBuddies makes no warranties regarding accuracy of information, reliability of users or businesses, safety of real-world meetings, or continuous service availability.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaBalanceScale /> 15. Limitation of Liability</AppText>
                        <AppText as="p">To the fullest extent permitted by law, DineBuddies shall not be liable for indirect or consequential damages, loss of data, personal disputes between users, or damages arising from real-world interactions. Use of the Service is at your own risk.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>16. Indemnification</AppText>
                        <AppText as="p">You agree to indemnify and hold harmless DineBuddies from any claims, damages, or legal disputes arising from your use of the Service, content you post, violations of these Terms, or violations of applicable laws.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaGlobe /> 17. Governing Law</AppText>
                        <AppText as="p">These Terms are governed by the laws applicable in Australia, unless otherwise required by applicable consumer protection laws.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaEdit /> 18. Changes to These Terms</AppText>
                        <AppText as="p">We may update these Terms from time to time. When changes occur, the updated Terms will be posted on this page, the "Last Updated" date will be revised, and continued use of the Service indicates acceptance of the updated Terms.</AppText>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <AppText as="h2" style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaEnvelope /> 19. Contact</AppText>
                        <AppText as="p">For questions regarding these Terms:</AppText>
                        <AppText as="p"><strong>{t('email', 'Email')}:</strong> support@dinebuddies.com</AppText>
                        <AppText as="p"><strong>{t('website', 'Website')}:</strong> https://dinebuddies.com</AppText>
                    </section>
                </>
      }

            <div style={{ marginTop: '2.5rem', padding: '1.5rem', background: 'var(--bg-card)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                <AppText as="p" style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>{t('last_updated', 'Last Updated')}: March 8, 2025</AppText>
            </div>
        </div>);

};

export default TermsOfService;