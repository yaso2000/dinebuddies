import React, { useState } from 'react';
import { FaSave, FaGavel, FaShieldAlt } from 'react-icons/fa';

const AdminLegal = () => {
    const [activeTab, setActiveTab] = useState('terms');

    // Mock Data
    const [termsContent, setTermsContent] = useState(`1. مقدمة
أهلاً بكم في تطبيق DineBuddies. باستخداك لهذا التطبيق، فإنك توافق على الالتزام بهذه الشروط والأحكام.

2. حساب المستخدم
أنت مسؤول عن الحفاظ على سرية معلومات حسابك. يجب أن تكون المعلومات المسجلة دقيقة.`);

    const [privacyContent, setPrivacyContent] = useState(`1. المعلومات التي نجمعها
نجمع المعلومات التي تقدمها لنا عند التسجيل (الاسم، البريد الإلكتروني).

2. كيف نستخدم معلوماتك
لتحسين تجربتك في التطبيق وتخصيص الاقتراحات.`);

    const handleSave = () => {
        alert('تم حفظ التغييرات بنجاح!');
        // In real app: API call to save content
    };

    return (
        <div>
            <div className="admin-header">
                <h1 className="admin-title">الصفحات القانونية</h1>
                <button
                    onClick={handleSave}
                    className="btn-primary-admin"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <FaSave /> <span>حفظ التغييرات</span>
                </button>
            </div>

            <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
                    <button
                        onClick={() => setActiveTab('terms')}
                        style={{
                            flex: 1, padding: '16px', border: 'none', background: activeTab === 'terms' ? 'white' : '#f9fafb',
                            borderBottom: activeTab === 'terms' ? '2px solid #2563eb' : 'none',
                            color: activeTab === 'terms' ? '#2563eb' : '#6b7280', fontWeight: 'bold', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                    >
                        <FaGavel /> <span>شروط الاستخدام (Terms)</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('privacy')}
                        style={{
                            flex: 1, padding: '16px', border: 'none', background: activeTab === 'privacy' ? 'white' : '#f9fafb',
                            borderBottom: activeTab === 'privacy' ? '2px solid #2563eb' : 'none',
                            color: activeTab === 'privacy' ? '#2563eb' : '#6b7280', fontWeight: 'bold', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                    >
                        <FaShieldAlt /> <span>سياسة الخصوصية (Privacy)</span>
                    </button>
                </div>

                {/* Editor Content */}
                <div style={{ padding: '24px' }}>
                    {activeTab === 'terms' ? (
                        <div>
                            <p style={{ marginBottom: '12px', color: '#4b5563' }}>قم بتعديل محتوى صفحة شروط الاستخدام:</p>
                            <textarea
                                value={termsContent}
                                onChange={(e) => setTermsContent(e.target.value)}
                                style={{ width: '100%', minHeight: '400px', padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', lineHeight: '1.6', fontSize: '1rem', fontFamily: 'inherit' }}
                            ></textarea>
                        </div>
                    ) : (
                        <div>
                            <p style={{ marginBottom: '12px', color: '#4b5563' }}>قم بتعديل محتوى صفحة سياسة الخصوصية:</p>
                            <textarea
                                value={privacyContent}
                                onChange={(e) => setPrivacyContent(e.target.value)}
                                style={{ width: '100%', minHeight: '400px', padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', lineHeight: '1.6', fontSize: '1rem', fontFamily: 'inherit' }}
                            ></textarea>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminLegal;
