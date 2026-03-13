import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaFileContract, FaArrowLeft, FaGavel, FaUserCheck, FaShieldAlt, FaUsers, FaStore, FaBan, FaHandshake, FaCopyright, FaLock, FaPlug, FaCog, FaTimes, FaExclamationTriangle, FaBalanceScale, FaGlobe, FaEdit, FaEnvelope } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const listStyle = (i18n) => ({ paddingLeft: i18n.language === 'ar' ? '0' : '1.5rem', paddingRight: i18n.language === 'ar' ? '1.5rem' : '0', marginBottom: '0.5rem' });

const TermsOfService = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();

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
                textAlign: i18n.language === 'ar' ? 'right' : 'left',
                lineHeight: '1.6',
                boxSizing: 'border-box'
            }}
        >
            <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '20px', fontFamily: 'inherit' }}>
                <FaArrowLeft style={{ transform: i18n.language === 'ar' ? 'rotate(180deg)' : 'none' }} /> {t('back')}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '40px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
                <FaFileContract size={40} color="var(--primary)" />
                <div>
                    <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '900' }}>{t('terms_of_service', { defaultValue: 'Terms of Service' })}</h1>
                    <p style={{ margin: '0.25rem 0 0', opacity: 0.6 }}>Last Updated: March 8, 2025</p>
                </div>
            </div>

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
                <ul style={listStyle(i18n)}>
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
                <ul style={listStyle(i18n)}>
                    <li><strong>Users</strong> – individuals who create or join dining invitations</li>
                    <li><strong>Businesses</strong> – restaurants or venues that create profiles and offers</li>
                    <li><strong>Administrators or support staff</strong> – platform management roles</li>
                </ul>
                <p>Different features may apply to different roles.</p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>5. User Content</h2>
                <p>Users may create and share content such as:</p>
                <ul style={listStyle(i18n)}>
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
                <ul style={listStyle(i18n)}>
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
                <ul style={listStyle(i18n)}>
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
                <ul style={listStyle(i18n)}>
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
                <p>The Service is provided &quot;as is&quot; and &quot;as available.&quot; DineBuddies makes no warranties regarding accuracy of information, reliability of users or businesses, safety of real-world meetings, or continuous service availability.</p>
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
                <p>We may update these Terms from time to time. When changes occur, the updated Terms will be posted on this page, the &quot;Last Updated&quot; date will be revised, and continued use of the Service indicates acceptance of the updated Terms.</p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaEnvelope /> 19. Contact</h2>
                <p>For questions regarding these Terms:</p>
                <p><strong>Email:</strong> support@dinebuddies.com</p>
                <p><strong>Website:</strong> https://dinebuddies.com</p>
            </section>

            <div style={{ marginTop: '2.5rem', padding: '1.5rem', background: 'var(--bg-card)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>Last Updated: March 8, 2025</p>
            </div>
        </div>
    );
};

export default TermsOfService;
