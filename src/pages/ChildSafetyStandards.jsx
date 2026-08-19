import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaShieldAlt, FaArrowLeft } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { AppText } from "../components/base";

const ChildSafetyStandards = () => {
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
        <FaArrowLeft style={{ transform: isAr ? 'rotate(180deg)' : 'none' }} /> {t('back')}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '40px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
        <FaShieldAlt size={40} color="var(--primary)" />
        <div>
          <AppText as="h1" style={{ margin: 0, fontSize: '2rem', fontWeight: '900' }}>
            {isAr ? 'معايير سلامة الأطفال' : 'Child Safety Standards'}
          </AppText>
          <AppText as="p" style={{ margin: '0.25rem 0 0', opacity: 0.6 }}>{t('last_updated', 'Last Updated')}: August 2026</AppText>
        </div>
      </div>

      {isAr ? (
        <>
          <AppText as="p" style={{ marginBottom: '2rem' }}>
            هذه الصفحة تحدد التزام DineBuddies بحماية الأطفال والقُصّر من الاستغلال والإساءة الجنسية (CSAE)، وتشرح كيفية الإبلاغ عن أي مخاوف تتعلق بسلامة الأطفال.
          </AppText>

          <section style={{ marginBottom: '2rem' }}>
            <AppText as="h2" style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>1. سياسة عدم التسامح المطلق</AppText>
            <AppText as="p">
              تحظر DineBuddies منعًا باتًا أي محتوى أو سلوك يتعلق باستغلال أو إساءة الأطفال جنسيًا (CSAE)، بما في ذلك على سبيل المثال لا الحصر: نشر أو مشاركة أو طلب مواد استغلال جنسي للأطفال (CSAM)، أو محاولة استدراج قاصر (grooming)، أو التواصل غير اللائق مع من يُعتقد أنه قاصر. أي حساب يُثبت انتهاكه لهذه السياسة يُحذف فورًا ونهائيًا.
            </AppText>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <AppText as="h2" style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>2. الحد الأدنى للعمر</AppText>
            <AppText as="p">
              التطبيق مخصص حصريًا للمستخدمين البالغين 18 عامًا فما فوق. لا يُسمح لمن هم دون هذا العمر بإنشاء حساب أو استخدام الخدمة. أي حساب يتبيّن أن صاحبه دون 18 عامًا يُحذف فور اكتشافه.
            </AppText>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <AppText as="h2" style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>3. كيفية الإبلاغ</AppText>
            <AppText as="p">
              يمكن لأي مستخدم الإبلاغ عن حساب أو محتوى مباشرة من داخل التطبيق عبر زر "الإبلاغ" (Report) المتاح على البروفايلات والدعوات والمحادثات. تصل هذه البلاغات فورًا إلى فريق المراجعة لدينا.
            </AppText>
            <AppText as="p">
              يمكن أيضًا التواصل معنا مباشرة بخصوص أي مخاوف تتعلق بسلامة الأطفال عبر البريد الإلكتروني:
            </AppText>
            <AppText as="p"><strong>{t('email', 'Email')}:</strong> support@dinebuddies.com</AppText>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <AppText as="h2" style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>4. آليات الحماية المطبَّقة</AppText>
            <AppText as="p">
              تخضع كل صورة يتم رفعها إلى التطبيق لفحص آلي عبر خدمة تحليل المحتوى من Google Cloud Vision قبل نشرها، ويُمنع نشر أي صورة لم تجتز هذا الفحص. كما يخضع كل بلاغ يصل عبر نظام الإبلاغ الداخلي لمراجعة من فريقنا، مع إمكانية حذف الحساب أو تعليقه فورًا عند ثبوت المخالفة.
            </AppText>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <AppText as="h2" style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>5. التعاون مع الجهات الرسمية</AppText>
            <AppText as="p">
              عند اكتشاف أو تلقي بلاغ موثوق بشأن محتوى أو سلوك يتعلق باستغلال الأطفال، تلتزم DineBuddies بالتعاون مع جهات إنفاذ القانون والسلطات المختصة في الدولة ذات الصلة، والإبلاغ عن الحالة وفق ما تقتضيه القوانين المعمول بها.
            </AppText>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <AppText as="h2" style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>6. تواصل معنا</AppText>
            <AppText as="p">لأي استفسار يتعلق بهذه المعايير أو للإبلاغ عن حالة عاجلة:</AppText>
            <AppText as="p"><strong>{t('email', 'Email')}:</strong> support@dinebuddies.com</AppText>
            <AppText as="p"><strong>{t('website', 'Website')}:</strong> https://www.dinebuddies.com</AppText>
          </section>
        </>
      ) : (
        <>
          <AppText as="p" style={{ marginBottom: '2rem' }}>
            This page describes DineBuddies' commitment to protecting children and minors from sexual abuse and exploitation (CSAE), and explains how to report any child safety concerns.
          </AppText>

          <section style={{ marginBottom: '2rem' }}>
            <AppText as="h2" style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>1. Zero-Tolerance Policy</AppText>
            <AppText as="p">
              DineBuddies strictly prohibits any content or behavior related to the sexual exploitation or abuse of children, including but not limited to: posting, sharing, or soliciting child sexual abuse material (CSAM), attempting to groom a minor, or engaging in inappropriate communication with anyone believed to be a minor. Any account found to violate this policy is removed immediately and permanently.
            </AppText>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <AppText as="h2" style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>2. Minimum Age</AppText>
            <AppText as="p">
              The Service is intended exclusively for users aged 18 and older. Anyone under this age is not permitted to create an account or use the Service. Any account found to belong to a user under 18 is removed as soon as it is discovered.
            </AppText>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <AppText as="h2" style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>3. How to Report</AppText>
            <AppText as="p">
              Any user can report an account or content directly within the app via the "Report" button available on profiles, invitations, and chats. Reports reach our review team immediately.
            </AppText>
            <AppText as="p">
              You can also contact us directly about any child safety concern by email:
            </AppText>
            <AppText as="p"><strong>{t('email', 'Email')}:</strong> support@dinebuddies.com</AppText>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <AppText as="h2" style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>4. Safeguards in Place</AppText>
            <AppText as="p">
              Every image uploaded to the app is automatically screened through Google Cloud Vision's content-analysis service before it is published, and any image that fails this check is blocked from publication. Every report submitted through our in-app reporting system is reviewed by our team, with accounts removed or suspended immediately where a violation is confirmed.
            </AppText>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <AppText as="h2" style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>5. Cooperation with Authorities</AppText>
            <AppText as="p">
              When we discover or receive a credible report involving child exploitation, DineBuddies is committed to cooperating with law enforcement and the relevant authorities, and reporting the matter as required under applicable law.
            </AppText>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <AppText as="h2" style={{ fontSize: '1.35rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>6. Contact Us</AppText>
            <AppText as="p">For any question about these standards, or to report an urgent concern:</AppText>
            <AppText as="p"><strong>{t('email', 'Email')}:</strong> support@dinebuddies.com</AppText>
            <AppText as="p"><strong>{t('website', 'Website')}:</strong> https://www.dinebuddies.com</AppText>
          </section>
        </>
      )}
    </div>
  );
};

export default ChildSafetyStandards;
