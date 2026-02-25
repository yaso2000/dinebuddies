import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaShieldAlt, FaArrowLeft, FaEye, FaUserLock, FaDatabase, FaTrashAlt } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();

    return (
        <div style={{ padding: '20px', paddingBottom: '100px', color: 'var(--text-main)', maxWidth: '900px', margin: '0 auto', textAlign: i18n.language === 'ar' ? 'right' : 'left', lineHeight: '1.6' }}>
            <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '20px', fontFamily: 'inherit' }}>
                <FaArrowLeft style={{ transform: i18n.language === 'ar' ? 'rotate(180deg)' : 'none' }} /> {t('back')}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '40px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
                <FaShieldAlt size={40} color="var(--primary)" />
                <div>
                    <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '900' }}>{t('privacy_policy', { defaultValue: 'Privacy Policy' })}</h1>
                    <p style={{ margin: 0, opacity: 0.6 }}>{i18n.language === 'ar' ? 'نحن نهتم بخصوصيتك وحماية بياناتك' : 'We care about your privacy and data protection'}</p>
                </div>
            </div>

            <section style={{ marginBottom: '40px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                    <FaEye /> {i18n.language === 'ar' ? '1. المعلومات التي نجمعها' : '1. Information We Collect'}
                </h3>
                <div style={{ padding: '0 10px' }}>
                    <p><strong>{i18n.language === 'ar' ? 'المعلومات الشخصية:' : 'Personal Information:'}</strong></p>
                    <p>
                        {i18n.language === 'ar'
                            ? 'عند التسجيل، نجمع اسمك، بريدك الإلكتروني، وصورتك الشخصية. هذه البيانات ضرورية لإنشاء هويتك داخل مجتمع DineBuddies.'
                            : 'When registering, we collect your name, email address, and profile picture. This data is essential for creating your identity within the DineBuddies community.'}
                    </p>
                    <p><strong>{i18n.language === 'ar' ? 'بيانات الموقع الجغرافي:' : 'Location Data:'}</strong></p>
                    <p>
                        {i18n.language === 'ar'
                            ? 'نطلب الوصول إلى موقعك الجغرافي لتمكين ميزة الخريطة والعثور على شركاء الطعام من حولك. يمكنك تعطيل هذا الوصول من إعدادات هاتفك، ولكن قد تتوقف بعض ميزات التطبيق الأساسية.'
                            : 'We request access to your geographic location to enable the map feature and find dining partners around you. You can disable this in your phone settings, but some core app features may stop working.'}
                    </p>
                </div>
            </section>

            <section style={{ marginBottom: '40px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                    <FaUserLock /> {i18n.language === 'ar' ? '2. كيف نستخدم معلوماتك' : '2. How We Use Your Information'}
                </h3>
                <div style={{ padding: '0 10px' }}>
                    <p>{i18n.language === 'ar' ? 'نستخدم بياناتك للأغراض التالية:' : 'We use your data for the following purposes:'}</p>
                    <ul>
                        <li>{i18n.language === 'ar' ? 'تسهيل تواصلك مع مستخدمين آخرين بناءً على الاهتمامات المشتركة.' : 'Facilitating your communication with other users based on shared interests.'}</li>
                        <li>{i18n.language === 'ar' ? 'تحسين جودة الخدمات وتخصيص تجربة المستخدم.' : 'Improving service quality and personalizing the user experience.'}</li>
                        <li>{i18n.language === 'ar' ? 'إرسال إشعارات متعلقة بطلبات الانضمام وتحديثات المحادثات.' : 'Sending notifications related to join requests and chat updates.'}</li>
                        <li>{i18n.language === 'ar' ? 'حماية الحسابات من الأنشطة الاحتيالية والاختراقات.' : 'Protecting accounts from fraudulent activities and breaches.'}</li>
                    </ul>
                </div>
            </section>

            <section style={{ marginBottom: '40px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                    <FaDatabase /> {i18n.language === 'ar' ? '3. مشاركة البيانات مع أطراف ثالثة' : '3. Sharing Data with Third Parties'}
                </h3>
                <div style={{ padding: '0 10px' }}>
                    <p>
                        {i18n.language === 'ar'
                            ? 'نحن لا نبيع أو نؤجر أو نشارك بياناتك الشخصية مع شركات ترويجية. يتم مشاركة معلومات محدودة فقط مع مزودي الخدمات الفنية (مثل Firebase لإدارة قاعدة البيانات أو Stripe لمعالجة المدفوعات) لضمان عمل التطبيق.'
                            : 'We do not sell, rent, or share your personal data with promotional companies. Only limited information is shared with technical service providers (such as Firebase for database management or Stripe for payment processing) to ensure the app functions.'}
                    </p>
                </div>
            </section>

            <section style={{ marginBottom: '40px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                    <FaTrashAlt /> {i18n.language === 'ar' ? '4. حقوقك وحذف البيانات' : '4. Your Rights and Data Deletion'}
                </h3>
                <div style={{ padding: '0 10px' }}>
                    <p>
                        {i18n.language === 'ar'
                            ? 'لديك الحق الكامل في الوصول إلى بياناتك، تعديلها، أو طلب حذفها نهائياً. يمكنك حذف حسابك مباشرة من إعدادات الملف الشخصي، وسيتم مسح كافة سجلاتك من خوادمنا فوراً.'
                            : 'You have the full right to access, modify, or request permanent deletion of your data. You can delete your account directly from profile settings, and all your records will be cleared from our servers immediately.'}
                    </p>
                </div>
            </section>

            <div style={{ marginTop: '50px', padding: '25px', background: 'var(--bg-card)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                <h4 style={{ margin: '0 0 10px 0', color: 'var(--primary)' }}>{i18n.language === 'ar' ? 'تواصل معنا' : 'Contact Us'}</h4>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                    {i18n.language === 'ar'
                        ? 'إذا كان لديك أي استفسار حول سياسة الخصوصية، يرجى مراسلتنا على: privacy@dinebuddies.com'
                        : 'If you have any questions about the privacy policy, please contact us at: privacy@dinebuddies.com'}
                </p>
                <p style={{ marginTop: '15px', fontSize: '0.8rem', opacity: 0.6 }}>
                    {i18n.language === 'ar' ? 'آخر تحديث: 21 فبراير 2026' : 'Last Updated: February 21, 2026'}
                </p>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
