import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaFileContract, FaArrowLeft, FaGavel, FaUserCheck, FaExclamationTriangle, FaBan, FaBuilding } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const TermsOfService = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();

    return (
        <div style={{ padding: '20px', paddingBottom: '100px', color: 'var(--text-main)', maxWidth: '900px', margin: '0 auto', textAlign: i18n.language === 'ar' ? 'right' : 'left', lineHeight: '1.6' }}>
            <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '20px', fontFamily: 'inherit' }}>
                <FaArrowLeft style={{ transform: i18n.language === 'ar' ? 'rotate(180deg)' : 'none' }} /> {t('back')}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '40px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
                <FaFileContract size={40} color="var(--primary)" />
                <div>
                    <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '900' }}>{t('terms_of_service', { defaultValue: 'Terms of Service' })}</h1>
                    <p style={{ margin: 0, opacity: 0.6 }}>Rules and regulations for using the DineBuddies platform</p>
                </div>
            </div>

            <section style={{ marginBottom: '40px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                    <FaGavel /> 1. Acceptance of Agreement
                </h3>
                <div style={{ padding: '0 10px' }}>
                    <p>
                        By using the DineBuddies platform, you acknowledge that you have read, understood, and agreed to be bound by these terms. This agreement is effective from the moment you first access the platform.
                    </p>
                </div>
            </section>

            <section style={{ marginBottom: '40px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                    <FaUserCheck /> 2. User Eligibility
                </h3>
                <div style={{ padding: '0 10px' }}>
                    <p>
                        You must be of legal age (18 years or older) to use our services. By using the app, you warrant that all data provided is accurate and that you are not violating any local laws in your country.
                    </p>
                </div>
            </section>

            <section style={{ marginBottom: '40px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                    <FaBan /> 3. Prohibited Conduct
                </h3>
                <div style={{ padding: '0 10px' }}>
                    <p>The following is strictly prohibited:</p>
                    <ul>
                        <li>Posting content that incites hatred, violence, or racial discrimination.</li>
                        <li>Impersonating another user or business partner.</li>
                        <li>Using the platform for harassment or stalking purposes.</li>
                        <li>Sending spam messages or engaging in financial fraud attempts.</li>
                    </ul>
                </div>
            </section>

            <section style={{ marginBottom: '40px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                    <FaExclamationTriangle /> 4. Disclaimer: Real-World Interaction
                </h3>
                <div style={{ padding: '0 10px' }}>
                    <p>
                        DineBuddies is a technology platform to facilitate communication and positive networking only. We assume no legal or security responsibility for what happens between users in real-world meetings outside the app. The responsibility for your personal safety and verifying the identity of those you meet lies entirely with you.
                    </p>
                </div>
            </section>

            <section style={{ marginBottom: '40px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                    <FaBuilding /> 5. Terms for Business Partners
                </h3>
                <div style={{ padding: '0 10px' }}>
                    <p>
                        Business partners are responsible for the validity of offers provided and the quality of services in their establishments. DineBuddies reserves the right to terminate a partner account in case of repeated complaints or providing misleading information to users.
                    </p>
                </div>
            </section>

            <div style={{ marginTop: '50px', padding: '25px', background: 'var(--bg-card)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                <h4 style={{ margin: '0 0 10px 0', color: 'var(--primary)' }}>Updates to Terms</h4>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                    We reserve the right to modify these terms at any time. You will be notified of material changes via the app or email.
                </p>
                <p style={{ marginTop: '15px', fontSize: '0.8rem', opacity: 0.6 }}>
                    Last Updated: February 21, 2026
                </p>
            </div>
        </div>
    );
};

export default TermsOfService;
