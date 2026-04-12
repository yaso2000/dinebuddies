import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { FaChevronLeft, FaChevronDown, FaChevronUp, FaQuestionCircle } from 'react-icons/fa';

const HelpSupport = ({ isDashboard = false }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    
    // Determine the user role to fetch correct questions
    const isBusiness = userProfile?.role === 'business' || userProfile?.isBusiness;
    const questionsType = isBusiness ? 'business_questions' : 'user_questions';
    
    // Fetch array of { q, a } from translations
    const faqData = t(`faq.${questionsType}`, { returnObjects: true }) || [];

    const [openIndex, setOpenIndex] = useState(null);

    const toggleAccordion = (index) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <div className={!isDashboard ? "page-container" : ""} style={{ 
            height: !isDashboard ? '100vh' : 'auto', 
            overflowY: !isDashboard ? 'auto' : 'visible', 
            background: 'var(--bg-body)', 
            paddingBottom: '3rem' 
        }}>
            {!isDashboard && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 50 }}>
                    <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '1.2rem', padding: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%' }}>
                        <FaChevronLeft />
                    </button>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', textAlign: 'center', flex: 1 }}>{t('faq.title', { defaultValue: 'Help & Support' })}</h2>
                    <div style={{ width: '40px' }} />
                </div>
            )}

            <div style={{ padding: isDashboard ? '1rem 0' : '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ width: 64, height: 64, background: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: '0 4px 15px rgba(232, 110, 46, 0.3)' }}>
                        <FaQuestionCircle size={32} color="#fff" />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                        {t('faq.title', { defaultValue: 'Help & Support' })}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto' }}>
                        {t('faq.subtitle', { defaultValue: 'Find answers to your questions and learn how to get the most out of DineBuddies.' })}
                    </p>
                </div>

                {Array.isArray(faqData) && faqData.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {faqData.map((item, index) => {
                            // Some translation fallbacks return string keys if not found, we ensure they are objects.
                            if (!item || typeof item !== 'object' || !item.q) return null;
                            const isOpen = openIndex === index;

                            return (
                                <div key={index} style={{
                                    background: 'var(--bg-card)',
                                    borderRadius: '16px',
                                    border: `1px solid ${isOpen ? 'var(--primary)' : 'var(--border-color)'}`,
                                    overflow: 'hidden',
                                    transition: 'all 0.3s ease'
                                }}>
                                    <button 
                                        onClick={() => toggleAccordion(index)}
                                        style={{
                                            width: '100%',
                                            padding: '1rem 1.25rem',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            background: 'transparent',
                                            border: 'none',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            color: 'var(--text-main)'
                                        }}
                                    >
                                        <span style={{ fontSize: '1rem', fontWeight: '700', paddingRight: '1rem' }}>
                                            {item.q}
                                        </span>
                                        <span style={{ color: isOpen ? 'var(--primary)' : 'var(--text-muted)', transition: 'transform 0.3s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                                            <FaChevronDown />
                                        </span>
                                    </button>
                                    
                                    <div style={{
                                        maxHeight: isOpen ? '500px' : '0',
                                        opacity: isOpen ? 1 : 0,
                                        overflow: 'hidden',
                                        transition: 'all 0.4s ease-in-out',
                                        background: 'var(--hover-overlay)'
                                    }}>
                                        <div style={{ padding: '0 1.25rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                                            {item.a}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                        <FaQuestionCircle size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                        <p>{t('faq.empty', { defaultValue: 'No questions currently available.' })}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HelpSupport;
