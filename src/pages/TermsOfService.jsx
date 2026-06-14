import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaFileContract, FaArrowLeft, FaGavel, FaUserCheck, FaShieldAlt, FaUsers, FaStore, FaBan, FaHandshake, FaCopyright, FaLock, FaPlug, FaCog, FaTimes, FaExclamationTriangle, FaBalanceScale, FaGlobe, FaEdit, FaEnvelope } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

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
            }}
        >
            <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '20px', fontFamily: 'inherit' }}>
                <FaArrowLeft style={{ transform: isAr ? 'rotate(180deg)' : 'none' }} /> {t('back', 'Back')}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '40px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
                <FaFileContract size={40} color="var(--primary)" />
                <div>
                    <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '900' }}>{t('terms_of_service', 'Terms of Service')}</h1>
                    <p style={{ margin: '0.25rem 0 0', opacity: 0.6 }}>{t('last_updated', 'Last Updated')}: March 8, 2025</p>
                </div>
            </div>

            {isAr ? (
                <>
                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaGavel /> 1. القبول</h2>
                        <p>باستخدام منصة DineBuddies، تقر بأنك قد قرأت هذه الشروط وفهمتها ووافقت على الالتزام بها. تسري هذه الاتفاقية منذ اللحظة التي تدخل فيها إلى الخدمة لأول مرة.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaUserCheck /> 2. الأهلية</h2>
                        <p>يجب أن يكون عمرك 18 عامًا أو أكثر لاستخدام خدماتنا. باستخدامك للتطبيق، فإنك تضمن أن جميع المعلومات التي تقدمها دقيقة وأنك لا تنتهك أي قوانين معمول بها.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaShieldAlt /> 3. مسؤوليات الحساب</h2>
                        <p>أنت توافق على:</p>
                        <ul style={listStyle(isAr)}>
                            <li>تقديم معلومات دقيقة وصادقة</li>
                            <li>الحفاظ على أمان بيانات اعتماد حسابك</li>
                            <li>إبلاغنا فورًا بأي وصول غير مصرح به</li>
                            <li>تحمل المسؤولية عن جميع الأنشطة التي تتم بموجب حسابك</li>
                        </ul>
                        <p>نحتفظ بالحق في تعليق أو إنهاء الحسابات التي تنتهك هذه الشروط.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaUsers /> 4. أدوار المستخدمين</h2>
                        <p>قد تقدم DineBuddies أنواعًا مختلفة من الحسابات بما في ذلك:</p>
                        <ul style={listStyle(isAr)}>
                            <li><strong>المستخدمون</strong> – الأفراد الذين ينشئون أو ينضمون إلى دعوات لتناول الطعام</li>
                            <li><strong>الشركات</strong> – المطاعم أو الأماكن التي تنشئ ملفات تعريف وعروضًا</li>
                            <li><strong>المسؤولون أو موظفو الدعم</strong> – أدوار إدارة المنصة</li>
                        </ul>
                        <p>قد تنطبق ميزات مختلفة على أدوار مختلفة.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>5. محتوى المستخدم</h2>
                        <p>قد ينشئ المستخدمون محتوى ويشاركونه مثل:</p>
                        <ul style={listStyle(isAr)}>
                            <li>دعوات تناول الطعام</li>
                            <li>الرسائل والمحادثات</li>
                            <li>الصور أو الوسائط</li>
                            <li>التعليقات أو المراجعات</li>
                            <li>ملفات تعريف الأنشطة التجارية والعروض</li>
                        </ul>
                        <p>من خلال نشر المحتوى، فإنك تمنح DineBuddies ترخيصًا عالميًا وغير حصري وخاليًا من حقوق الملكية لاستضافة المحتوى وعرضه وتوزيعه داخل الخدمة. تظل أنت مسؤولاً عن المحتوى الذي تنشره.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaBan /> 6. السلوك المحظور</h2>
                        <p>أنت توافق على عدم استخدام الخدمة من أجل:</p>
                        <ul style={listStyle(isAr)}>
                            <li>مضايقة المستخدمين الآخرين أو تهديدهم أو الإساءة إليهم</li>
                            <li>نشر محتوى غير قانوني أو مضلل أو ضار</li>
                            <li>مشاركة مواد مسيئة أو صريحة</li>
                            <li>انتحال شخصية شخص آخر أو شركة أخرى</li>
                            <li>إرسال بريد عشوائي إلى المستخدمين أو توزيع محتوى ضار</li>
                            <li>محاولة اختراق المنصة أو استغلالها أو تعطيلها</li>
                            <li>انتهاك حقوق الملكية الفكرية</li>
                        </ul>
                        <p>قد تقوم DineBuddies بإزالة المحتوى أو تعليق الحسابات التي تنتهك هذه القواعد.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaStore /> 7. حسابات الأعمال</h2>
                        <p>الشركات التي تستخدم الخدمة توافق على:</p>
                        <ul style={listStyle(isAr)}>
                            <li>تقديم معلومات دقيقة عن مكانها</li>
                            <li>التأكد من أن المحتوى الترويجي صادق</li>
                            <li>الالتزام بالقوانين المحلية المتعلقة بالإعلانات وخدمات الطعام</li>
                            <li>احترام تفاعلات المستخدمين على المنصة</li>
                        </ul>
                        <p>لا تضمن DineBuddies جودة أو توفر أو دقة خدمات الأعمال.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaHandshake /> 8. الدعوات والأحداث</h2>
                        <p>تُسهل DineBuddies دعوات تناول الطعام الاجتماعية بين المستخدمين. المنصة:</p>
                        <ul style={listStyle(isAr)}>
                            <li>لا تنظم الأحداث مباشرة</li>
                            <li>لا تتحقق من جميع المشاركين</li>
                            <li>ليست مسؤولة عن السلوك أثناء الاجتماعات في العالم الحقيقي</li>
                        </ul>
                        <p>يشارك المستخدمون في الأحداث وفقًا لتقديرهم الخاص وعلى مسؤوليتهم.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaCopyright /> 9. الملكية الفكرية</h2>
                        <p>جميع الحقوق في منصة DineBuddies بما في ذلك البرامج والتصميم والشعارات والمحتوى والميزات مملوكة لشركة DineBuddies أو المرخصين لها. لا يجوز لك استخدام علاماتنا التجارية أو ملكيتنا الفكرية دون إذن.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaLock /> 10. الخصوصية</h2>
                        <p>يخضع استخدامك للخدمة أيضًا لسياسة الخصوصية الخاصة بنا، والتي تشرح كيف نجمع ونستخدم المعلومات. يرجى مراجعتها هنا: <a href="https://dinebuddies.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>https://dinebuddies.com/privacy</a></p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaPlug /> 11. خدمات الجهات الخارجية</h2>
                        <p>قد تدمج الخدمة خدمات جهات خارجية مثل خرائط Google وFirebase وخدمات التحليلات وروابط وسائل التواصل الاجتماعي. لا تتحمل DineBuddies مسؤولية خدمات الجهات الخارجية أو ممارسات الخصوصية الخاصة بها.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaCog /> 12. توافر المنصة</h2>
                        <p>نهدف إلى إبقاء الخدمة متاحة لكننا لا نضمن التوافر المستمر أو التشغيل الخالي من الأخطاء أو التوافق مع جميع الأجهزة. قد نقوم بتعديل أو إيقاف الميزات في أي وقت.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaTimes /> 13. الإنهاء</h2>
                        <p>يجوز لنا تعليق الحسابات أو إنهائها إذا خالف المستخدمون هذه الشروط، أو شاركوا في سلوك مسيء، أو حاولوا استغلال المنصة، أو نشروا محتوى ضارًا أو غير قانوني. يجوز للمستخدمين أيضًا التوقف عن استخدام الخدمة في أي وقت.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaExclamationTriangle /> 14. إخلاء المسؤولية عن الضمانات</h2>
                        <p>تُقدم الخدمة "كما هي" و"كما تتوفر". لا تقدم DineBuddies أي ضمانات بشأن دقة المعلومات، أو موثوقية المستخدمين أو الشركات، أو سلامة الاجتماعات في العالم الحقيقي، أو توافر الخدمة المستمر.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaBalanceScale /> 15. تحديد المسؤولية</h2>
                        <p>إلى أقصى حد يسمح به القانون، لن تتحمل DineBuddies المسؤولية عن الأضرار غير المباشرة أو التبعية، أو فقدان البيانات، أو النزاعات الشخصية بين المستخدمين، أو الأضرار الناشئة عن التفاعلات في العالم الحقيقي. استخدام الخدمة يكون على مسؤوليتك الخاصة.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>16. التعويض</h2>
                        <p>أنت توافق على تعويض DineBuddies وإبراء ذمتها من أي مطالبات أو أضرار أو نزاعات قانونية تنشأ عن استخدامك للخدمة، أو المحتوى الذي تنشره، أو انتهاكات هذه الشروط، أو انتهاكات القوانين المعمول بها.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaGlobe /> 17. القانون المطبق</h2>
                        <p>تخضع هذه الشروط للقوانين المعمول بها في أستراليا، ما لم تقتضِ قوانين حماية المستهلك المعمول بها خلاف ذلك.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaEdit /> 18. التغييرات على هذه الشروط</h2>
                        <p>قد نقوم بتحديث هذه الشروط من وقت لآخر. عند حدوث تغييرات، سيتم نشر الشروط المحدثة في هذه الصفحة، وستتم مراجعة تاريخ "آخر تحديث"، ويُعد الاستمرار في استخدام الخدمة قبولًا للشروط المحدثة.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaEnvelope /> 19. اتصل بنا</h2>
                        <p>للأسئلة المتعلقة بهذه الشروط:</p>
                        <p><strong>{t('email', 'Email')}:</strong> support@dinebuddies.com</p>
                        <p><strong>{t('website', 'Website')}:</strong> https://dinebuddies.com</p>
                    </section>
                </>
            ) : (
                <>
                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaGavel /> 1. Acceptance</h2>
                        <p>By using the DineBuddies platform, you acknowledge that you have read, understood, and agreed to be bound by these Terms. This agreement is effective from the moment you first access the Service.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaUserCheck /> 2. Eligibility</h2>
                        <p>You must be 18 years or older to use our services. By using the app, you warrant that all information you provide is accurate and that you are not violating any applicable laws.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaShieldAlt /> 3. Account Responsibilities</h2>
                        <p>You agree to:</p>
                        <ul style={listStyle(isAr)}>
                            <li>Provide accurate and truthful information</li>
                            <li>Maintain the security of your account credentials</li>
                            <li>Notify us immediately of unauthorized access</li>
                            <li>Be responsible for all activities under your account</li>
                        </ul>
                        <p>We reserve the right to suspend or terminate accounts that violate these Terms.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaUsers /> 4. User Roles</h2>
                        <p>DineBuddies may offer different account types including:</p>
                        <ul style={listStyle(isAr)}>
                            <li><strong>Users</strong> – individuals who create or join dining invitations</li>
                            <li><strong>Businesses</strong> – restaurants or venues that create profiles and offers</li>
                            <li><strong>Administrators or support staff</strong> – platform management roles</li>
                        </ul>
                        <p>Different features may apply to different roles.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>5. User Content</h2>
                        <p>Users may create and share content such as:</p>
                        <ul style={listStyle(isAr)}>
                            <li>Dining invitations</li>
                            <li>Messages and chats</li>
                            <li>Photos or media</li>
                            <li>Reviews or comments</li>
                            <li>Business profiles and offers</li>
                        </ul>
                        <p>By posting content, you grant DineBuddies a worldwide, non-exclusive, royalty-free license to host, display, and distribute the content within the Service. You remain responsible for the content you post.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaBan /> 6. Prohibited Conduct</h2>
                        <p>You agree not to use the Service to:</p>
                        <ul style={listStyle(isAr)}>
                            <li>Harass, threaten, or abuse other users</li>
                            <li>Post illegal, misleading, or harmful content</li>
                            <li>Share offensive or explicit material</li>
                            <li>Impersonate another person or business</li>
                            <li>Spam users or distribute malicious content</li>
                            <li>Attempt to hack, exploit, or disrupt the platform</li>
                            <li>Violate intellectual property rights</li>
                        </ul>
                        <p>DineBuddies may remove content or suspend accounts that violate these rules.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaStore /> 7. Business Accounts</h2>
                        <p>Businesses using the Service agree to:</p>
                        <ul style={listStyle(isAr)}>
                            <li>Provide accurate information about their venue</li>
                            <li>Ensure promotional content is truthful</li>
                            <li>Comply with local laws regarding advertising and food services</li>
                            <li>Respect user interactions on the platform</li>
                        </ul>
                        <p>DineBuddies does not guarantee the quality, availability, or accuracy of business services.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaHandshake /> 8. Invitations and Events</h2>
                        <p>DineBuddies facilitates social dining invitations between users. The platform:</p>
                        <ul style={listStyle(isAr)}>
                            <li>Does not organize events directly</li>
                            <li>Does not verify all participants</li>
                            <li>Is not responsible for conduct during real-world meetings</li>
                        </ul>
                        <p>Users participate in events at their own discretion and risk.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaCopyright /> 9. Intellectual Property</h2>
                        <p>All rights in the DineBuddies platform including software, design, logos, content, and features are owned by DineBuddies or its licensors. You may not use our trademarks or intellectual property without permission.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaLock /> 10. Privacy</h2>
                        <p>Your use of the Service is also governed by our Privacy Policy, which explains how we collect and use information. Please review it here: <a href="https://dinebuddies.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>https://dinebuddies.com/privacy</a></p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaPlug /> 11. Third-Party Services</h2>
                        <p>The Service may integrate third-party services such as Google Maps, Firebase, analytics services, and social media links. DineBuddies is not responsible for third-party services or their privacy practices.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaCog /> 12. Platform Availability</h2>
                        <p>We aim to keep the Service available but do not guarantee continuous availability, error-free operation, or compatibility with all devices. We may modify or discontinue features at any time.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaTimes /> 13. Termination</h2>
                        <p>We may suspend or terminate accounts if users violate these Terms, engage in abusive behavior, attempt to exploit the platform, or post harmful or illegal content. Users may also stop using the Service at any time.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaExclamationTriangle /> 14. Disclaimer of Warranties</h2>
                        <p>The Service is provided "as is" and "as available." DineBuddies makes no warranties regarding accuracy of information, reliability of users or businesses, safety of real-world meetings, or continuous service availability.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaBalanceScale /> 15. Limitation of Liability</h2>
                        <p>To the fullest extent permitted by law, DineBuddies shall not be liable for indirect or consequential damages, loss of data, personal disputes between users, or damages arising from real-world interactions. Use of the Service is at your own risk.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>16. Indemnification</h2>
                        <p>You agree to indemnify and hold harmless DineBuddies from any claims, damages, or legal disputes arising from your use of the Service, content you post, violations of these Terms, or violations of applicable laws.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaGlobe /> 17. Governing Law</h2>
                        <p>These Terms are governed by the laws applicable in Australia, unless otherwise required by applicable consumer protection laws.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaEdit /> 18. Changes to These Terms</h2>
                        <p>We may update these Terms from time to time. When changes occur, the updated Terms will be posted on this page, the "Last Updated" date will be revised, and continued use of the Service indicates acceptance of the updated Terms.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaEnvelope /> 19. Contact</h2>
                        <p>For questions regarding these Terms:</p>
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

export default TermsOfService;
