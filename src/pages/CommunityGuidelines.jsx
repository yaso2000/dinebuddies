import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaUsers, FaArrowLeft, FaHeart, FaIdCard, FaImage, FaUtensils, FaComment, FaStore, FaShieldAlt, FaBan, FaFlag, FaGavel, FaUndo, FaEdit, FaEnvelope } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const listStyle = (i18n) => ({ paddingLeft: i18n.language === 'ar' ? '0' : '1.5rem', paddingRight: i18n.language === 'ar' ? '1.5rem' : '0', marginBottom: '0.5rem' });

const CommunityGuidelines = () => {
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
                <FaUsers size={40} color="var(--primary)" />
                <div>
                    <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '900' }}>DineBuddies Community Guidelines</h1>
                    <p style={{ margin: '0.25rem 0 0', opacity: 0.6 }}>Last Updated: March 8, 2025</p>
                </div>
            </div>

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
                <ul style={listStyle(i18n)}>
                    <li>Treat others with respect</li>
                    <li>Communicate politely</li>
                    <li>Respect personal boundaries</li>
                    <li>Avoid harassment or intimidation</li>
                </ul>
                <p><strong>The following behaviors are not allowed:</strong></p>
                <ul style={listStyle(i18n)}>
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
                <ul style={listStyle(i18n)}>
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
                <ul style={listStyle(i18n)}>
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
                <ul style={listStyle(i18n)}>
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
                <ul style={listStyle(i18n)}>
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
                <ul style={listStyle(i18n)}>
                    <li>Represent a legitimate restaurant or venue</li>
                    <li>Provide accurate descriptions and offers</li>
                    <li>Avoid misleading promotions</li>
                    <li>Respect user interactions</li>
                </ul>
                <p><strong>Businesses must not:</strong></p>
                <ul style={listStyle(i18n)}>
                    <li>Create fake offers</li>
                    <li>Manipulate reviews or invitations</li>
                    <li>Spam users with unsolicited messages</li>
                </ul>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaShieldAlt /> 7. Safety and Real-World Meetings</h2>
                <p>DineBuddies facilitates social connections, but users are responsible for their own safety.</p>
                <p><strong>When meeting others:</strong></p>
                <ul style={listStyle(i18n)}>
                    <li>Meet in public places</li>
                    <li>Inform friends or family of plans</li>
                    <li>Trust your judgment</li>
                </ul>
                <p>DineBuddies cannot guarantee the behavior of other users.</p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaBan /> 8. Prohibited Activities</h2>
                <p><strong>The following activities are strictly prohibited:</strong></p>
                <ul style={listStyle(i18n)}>
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
                <ul style={listStyle(i18n)}>
                    <li>In-app reporting tools</li>
                    <li>Contacting support</li>
                </ul>
                <p>Reports help us maintain a safe and respectful environment.</p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FaGavel /> 10. Enforcement Actions</h2>
                <p>To protect the community, DineBuddies may take actions including:</p>
                <ul style={listStyle(i18n)}>
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
                <p><strong>Email:</strong> support@dinebuddies.com</p>
                <p><strong>Website:</strong> https://dinebuddies.com</p>
            </section>

            <div style={{ marginTop: '2.5rem', padding: '1.5rem', background: 'var(--bg-card)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>Last Updated: March 8, 2025</p>
            </div>
        </div>
    );
};

export default CommunityGuidelines;
