import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaUsers, FaArrowLeft, FaHeart, FaIdCard, FaImage, FaUtensils, FaComment, FaStore, FaShieldAlt, FaBan, FaFlag, FaGavel, FaUndo, FaEdit, FaEnvelope } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const listStyle = (isAr) => ({ paddingLeft: isAr ? '0' : '1.5rem', paddingRight: isAr ? '1.5rem' : '0', marginBottom: '0.5rem' });

const CommunityGuidelines = () => {
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
                <FaArrowLeft style={{ transform: isAr ? 'rotate(180deg)' : 'none' }} /> {t('back', 'Back')}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '40px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
                <FaUsers size={40} color="var(--primary)" />
                <div>
                    <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '900' }}>{t('community_guidelines', 'Community Guidelines')}</h1>
                    <p style={{ margin: '0.25rem 0 0', opacity: 0.6 }}>{t('last_updated', 'Last Updated')}: March 8, 2025</p>
                </div>
            </div>

            {isAr ? (
                <>
                    <p style={{ marginBottom: '1rem' }}>
                        مرحبًا بك في DineBuddies، وهي منصة مخصصة لمساعدة الأشخاص على التواصل من خلال تجارب تناول الطعام المشتركة، ولمساعدة الشركات على عرض مطاعمها وعروضها.
                    </p>
                    <p style={{ marginBottom: '1rem' }}>
                        للحفاظ على أمان وسلامة واحترام مجتمعنا وجعله ممتعًا للجميع، يجب على جميع المستخدمين اتباع إرشادات المجتمع هذه.
                    </p>
                    <p style={{ marginBottom: '2rem', fontWeight: '600' }}>
                        قد يؤدي عدم اتباع هذه الإرشادات إلى إزالة المحتوى أو تقييد الحساب أو الإيقاف الدائم.
                    </p>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaHeart /> 1. احترام المستخدمين الآخرين</h2>
                        <p>تم بناء DineBuddies على التفاعل الاجتماعي الإيجابي.</p>
                        <p><strong>يجب على المستخدمين:</strong></p>
                        <ul style={listStyle(isAr)}>
                            <li>معاملة الآخرين باحترام</li>
                            <li>التواصل بأدب</li>
                            <li>احترام الحدود الشخصية</li>
                            <li>تجنب المضايقة أو التخويف</li>
                        </ul>
                        <p><strong>السلوكيات التالية غير مسموح بها:</strong></p>
                        <ul style={listStyle(isAr)}>
                            <li>خطابات الكراهية</li>
                            <li>البلطجة أو المضايقة</li>
                            <li>التهديدات أو التخويف</li>
                            <li>الهجمات الشخصية</li>
                        </ul>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaIdCard /> 2. ملفات تعريف صادقة</h2>
                        <p>يجب على المستخدمين والشركات تقديم معلومات دقيقة وصادقة.</p>
                        <p><strong>يجب ألا تقوم بـ:</strong></p>
                        <ul style={listStyle(isAr)}>
                            <li>انتحال شخصية شخص آخر أو شركة أخرى</li>
                            <li>استخدام هويات مزيفة</li>
                            <li>تحريف المعلومات الخاصة بمطعم أو خدمة</li>
                            <li>استخدام صور أو أوصاف مضللة</li>
                        </ul>
                        <p>المصداقية تساعد في بناء الثقة داخل مجتمعنا.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaImage /> 3. المحتوى المناسب</h2>
                        <p>يجب أن يكون المحتوى الذي تتم مشاركته على DineBuddies مناسبًا لمنصة اجتماعية عامة.</p>
                        <p><strong>المحتوى التالي غير مسموح به:</strong></p>
                        <ul style={listStyle(isAr)}>
                            <li>المحتوى الجنسي الصريح</li>
                            <li>المواد الإباحية</li>
                            <li>المحتوى العنيف أو المصور</li>
                            <li>الأنشطة غير القانونية</li>
                            <li>المحتوى الذي يروج للمخدرات أو السلوك الإجرامي</li>
                            <li>المحتوى المسيء أو التمييزي</li>
                        </ul>
                        <p>نحتفظ بالحق في إزالة المحتوى الذي ينتهك هذه القواعد.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaUtensils /> 4. دعوات تناول طعام مسؤولة</h2>
                        <p>تسمح منصة DineBuddies للمستخدمين بإنشاء دعوات لتجارب تناول الطعام الاجتماعية.</p>
                        <p><strong>عند إنشاء دعوات:</strong></p>
                        <ul style={listStyle(isAr)}>
                            <li>قدم تفاصيل دقيقة</li>
                            <li>كن محترمًا للمستخدمين المدعوين</li>
                            <li>تجنب تقديم معلومات مضللة</li>
                            <li>لا تقم بإنشاء دعوات تهدف إلى خداع المستخدمين أو استغلالهم</li>
                        </ul>
                        <p>يشارك المستخدمون في فعاليات تناول الطعام طواعية على المنصة.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaComment /> 5. المراسلة والتواصل</h2>
                        <p>يجب استخدام ميزات المراسلة بمسؤولية.</p>
                        <p><strong>يجب ألا تقوم بـ:</strong></p>
                        <ul style={listStyle(isAr)}>
                            <li>إرسال رسائل غير مرغوب فيها أو ترويجية</li>
                            <li>إرسال رسائل مسيئة</li>
                            <li>مضايقة المستخدمين الآخرين من خلال الرسائل المتكررة</li>
                            <li>مشاركة روابط ضارة أو برامج خبيثة</li>
                        </ul>
                        <p>قد يفقد المستخدمون الذين يسيئون استخدام ميزات المراسلة الوصول إليها.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaStore /> 6. مسؤوليات حساب الأعمال</h2>
                        <p><strong>يجب على حسابات الشركات:</strong></p>
                        <ul style={listStyle(isAr)}>
                            <li>أن تُمثل مطعمًا أو مكانًا شرعيًا</li>
                            <li>تقديم أوصاف وعروض دقيقة</li>
                            <li>تجنب العروض الترويجية المضللة</li>
                            <li>احترام تفاعلات المستخدمين</li>
                        </ul>
                        <p><strong>يجب ألا تقوم الشركات بـ:</strong></p>
                        <ul style={listStyle(isAr)}>
                            <li>إنشاء عروض وهمية</li>
                            <li>التلاعب بالمراجعات أو الدعوات</li>
                            <li>إرسال رسائل غير مرغوب فيها إلى المستخدمين</li>
                        </ul>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaShieldAlt /> 7. السلامة والاجتماعات في العالم الحقيقي</h2>
                        <p>تسهل DineBuddies الروابط الاجتماعية، ولكن المستخدمون مسؤولون عن سلامتهم الخاصة.</p>
                        <p><strong>عند مقابلة الآخرين:</strong></p>
                        <ul style={listStyle(isAr)}>
                            <li>اجتمعوا في الأماكن العامة</li>
                            <li>أخبر الأصدقاء أو العائلة بخططك</li>
                            <li>ثق بحدسك</li>
                        </ul>
                        <p>لا تستطيع DineBuddies ضمان سلوك المستخدمين الآخرين.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaBan /> 8. الأنشطة المحظورة</h2>
                        <p><strong>تُحظر الأنشطة التالية حظرًا تامًا:</strong></p>
                        <ul style={listStyle(isAr)}>
                            <li>الاحتيال أو الخداع</li>
                            <li>محاولة اختراق أو استغلال المنصة</li>
                            <li>بيع سلع أو خدمات غير قانونية</li>
                            <li>الاستخدام الآلي للحصول على البيانات (Bots)</li>
                            <li>التحايل على قيود النظام الأساسي</li>
                        </ul>
                        <p>قد يتم حظر الحسابات المتورطة في هذه الأنشطة نهائيًا.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaFlag /> 9. الإبلاغ عن الانتهاكات</h2>
                        <p>إذا واجهت سلوكًا ينتهك هذه الإرشادات، يرجى الإبلاغ عنه من خلال:</p>
                        <ul style={listStyle(isAr)}>
                            <li>أدوات الإبلاغ داخل التطبيق</li>
                            <li>التواصل مع قسم الدعم</li>
                        </ul>
                        <p>تساعدنا التقارير في الحفاظ على بيئة آمنة ومحترمة.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaGavel /> 10. إجراءات التنفيذ</h2>
                        <p>لحماية المجتمع، قد تتخذ DineBuddies إجراءات بما في ذلك:</p>
                        <ul style={listStyle(isAr)}>
                            <li>إزالة المحتوى</li>
                            <li>إصدار إنذارات</li>
                            <li>تقييد الميزات</li>
                            <li>تعليق الحسابات مؤقتًا</li>
                            <li>حظر المستخدمين نهائيًا</li>
                        </ul>
                        <p>يتم اتخاذ الإجراءات وفقًا لتقدير مسؤولي المنصة.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaUndo /> 11. الاعتراضات</h2>
                        <p>إذا كنت تعتقد أنه تم تقييد المحتوى الخاص بك أو حسابك بشكل غير صحيح، يمكنك التواصل مع الدعم لطلب المراجعة.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaEdit /> 12. تحديثات الإرشادات</h2>
                        <p>قد يتم تحديث إرشادات المجتمع هذه بشكل دوري لتحسين سلامة המجمتع. سيُتوقع من المستخدمين الامتثال للإصدار الأحدث.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaEnvelope /> 13. اتصل بنا</h2>
                        <p>إذا كانت لديك أسئلة حول هذه الإرشادات، اتصل بنا على:</p>
                        <p><strong>{t('email', 'Email')}:</strong> support@dinebuddies.com</p>
                        <p><strong>{t('website', 'Website')}:</strong> https://dinebuddies.com</p>
                    </section>
                </>
            ) : (
                <>
                    <p style={{ marginBottom: '1rem' }}>
                        Welcome to DineBuddies, a platform designed to help people connect through shared dining experiences and to help businesses showcase their restaurants and offers.
                    </p>
                    <p style={{ marginBottom: '1rem' }}>
                        To keep the community safe, respectful, and enjoyable for everyone, all users must follow these Community Guidelines.
                    </p>
                    <p style={{ marginBottom: '2rem', fontWeight: '600' }}>
                        Failure to follow these guidelines may result in content removal, account restrictions, or permanent suspension.
                    </p>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaHeart /> 1. Respect Other Users</h2>
                        <p>DineBuddies is built around positive social interaction.</p>
                        <p><strong>Users must:</strong></p>
                        <ul style={listStyle(isAr)}>
                            <li>Treat others with respect</li>
                            <li>Communicate politely</li>
                            <li>Respect personal boundaries</li>
                            <li>Avoid harassment or intimidation</li>
                        </ul>
                        <p><strong>The following behaviors are not allowed:</strong></p>
                        <ul style={listStyle(isAr)}>
                            <li>Hate speech</li>
                            <li>Bullying or harassment</li>
                            <li>Threats or intimidation</li>
                            <li>Personal attacks</li>
                        </ul>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaIdCard /> 2. Honest Profiles</h2>
                        <p>Users and businesses must provide accurate and truthful information.</p>
                        <p><strong>You must not:</strong></p>
                        <ul style={listStyle(isAr)}>
                            <li>Impersonate another person or business</li>
                            <li>Use fake identities</li>
                            <li>Misrepresent a restaurant or service</li>
                            <li>Use misleading photos or descriptions</li>
                        </ul>
                        <p>Authenticity helps build trust within the community.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaImage /> 3. Appropriate Content</h2>
                        <p>Content shared on DineBuddies must be appropriate for a public social platform.</p>
                        <p><strong>The following content is not allowed:</strong></p>
                        <ul style={listStyle(isAr)}>
                            <li>Explicit sexual content</li>
                            <li>Pornographic material</li>
                            <li>Violent or graphic content</li>
                            <li>Illegal activities</li>
                            <li>Content promoting drugs or criminal behavior</li>
                            <li>Offensive or discriminatory content</li>
                        </ul>
                        <p>We reserve the right to remove content that violates these rules.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaUtensils /> 4. Responsible Dining Invitations</h2>
                        <p>DineBuddies allows users to create invitations for social dining experiences.</p>
                        <p><strong>When creating invitations:</strong></p>
                        <ul style={listStyle(isAr)}>
                            <li>Provide accurate details</li>
                            <li>Be respectful to invited users</li>
                            <li>Avoid misleading information</li>
                            <li>Do not create invitations intended to deceive or exploit users</li>
                        </ul>
                        <p>Users participate in dining events voluntarily.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaComment /> 5. Messaging and Communication</h2>
                        <p>Messaging features should be used responsibly.</p>
                        <p><strong>You must not:</strong></p>
                        <ul style={listStyle(isAr)}>
                            <li>Send spam or unwanted promotions</li>
                            <li>Send abusive messages</li>
                            <li>Harass other users through repeated messages</li>
                            <li>Share harmful links or malware</li>
                        </ul>
                        <p>Users who misuse messaging features may lose access to them.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaStore /> 6. Business Account Responsibilities</h2>
                        <p><strong>Business accounts must:</strong></p>
                        <ul style={listStyle(isAr)}>
                            <li>Represent a legitimate restaurant or venue</li>
                            <li>Provide accurate descriptions and offers</li>
                            <li>Avoid misleading promotions</li>
                            <li>Respect user interactions</li>
                        </ul>
                        <p><strong>Businesses must not:</strong></p>
                        <ul style={listStyle(isAr)}>
                            <li>Create fake offers</li>
                            <li>Manipulate reviews or invitations</li>
                            <li>Spam users with unsolicited messages</li>
                        </ul>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaShieldAlt /> 7. Safety and Real-World Meetings</h2>
                        <p>DineBuddies facilitates social connections, but users are responsible for their own safety.</p>
                        <p><strong>When meeting others:</strong></p>
                        <ul style={listStyle(isAr)}>
                            <li>Meet in public places</li>
                            <li>Inform friends or family of plans</li>
                            <li>Trust your judgment</li>
                        </ul>
                        <p>DineBuddies cannot guarantee the behavior of other users.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaBan /> 8. Prohibited Activities</h2>
                        <p><strong>The following activities are strictly prohibited:</strong></p>
                        <ul style={listStyle(isAr)}>
                            <li>Fraud or scams</li>
                            <li>Attempting to hack or exploit the platform</li>
                            <li>Selling illegal goods or services</li>
                            <li>Automated scraping or bot usage</li>
                            <li>Circumventing platform restrictions</li>
                        </ul>
                        <p>Accounts involved in these activities may be permanently banned.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaFlag /> 9. Reporting Violations</h2>
                        <p>If you encounter behavior that violates these guidelines, please report it through:</p>
                        <ul style={listStyle(isAr)}>
                            <li>In-app reporting tools</li>
                            <li>Contacting support</li>
                        </ul>
                        <p>Reports help us maintain a safe and respectful environment.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaGavel /> 10. Enforcement Actions</h2>
                        <p>To protect the community, DineBuddies may take actions including:</p>
                        <ul style={listStyle(isAr)}>
                            <li>Removing content</li>
                            <li>Issuing warnings</li>
                            <li>Restricting features</li>
                            <li>Temporarily suspending accounts</li>
                            <li>Permanently banning users</li>
                        </ul>
                        <p>Actions are taken at the discretion of the platform administrators.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaUndo /> 11. Appeals</h2>
                        <p>If you believe your content or account was restricted incorrectly, you may contact support to request a review.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaEdit /> 12. Updates to Guidelines</h2>
                        <p>These Community Guidelines may be updated periodically to improve community safety. Users will be expected to comply with the latest version.</p>
                    </section>

                    <section style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaEnvelope /> 13. Contact</h2>
                        <p>If you have questions about these guidelines, contact us at:</p>
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

export default CommunityGuidelines;
