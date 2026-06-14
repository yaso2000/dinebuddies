import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { FaTimes, FaSpinner, FaPaperPlane } from 'react-icons/fa';

export default function FeedbackSubmissionModal({ isOpen, onClose, businessId }) {
    const { t } = useTranslation();
    const { currentUser, userProfile } = useAuth();
    const { showToast } = useToast();

    const [type, setType] = useState('complaint');
    const [phoneNumber, setPhoneNumber] = useState(userProfile?.phoneNumber || '');
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (currentUser?.uid && businessId && currentUser.uid === businessId) {
            showToast(t('feedback_owner_blocked', 'Business owners cannot send feedback to their own profile.'), 'error');
            return;
        }
        
        if (!content.trim()) {
            showToast(t('feedback_req_message', 'Please write your message details'), 'error');
            return;
        }

        if (!phoneNumber.trim()) {
            showToast(t('feedback_req_phone', 'Please enter a phone number to contact you'), 'error');
            return;
        }

        try {
            setIsSubmitting(true);
            
            await addDoc(collection(db, 'business_feedback'), {
                businessId,
                userId: currentUser?.uid || null,
                userName: userProfile?.displayName || userProfile?.firstName || 'Guest',
                userAvatar: userProfile?.photoURL || null,
                type,
                content: content.trim(),
                phoneNumber: phoneNumber.trim(),
                isResolved: false,
                createdAt: serverTimestamp()
            });
            // Dispatch notification to the business safely
            try {
                await addDoc(collection(db, 'partner_notifications'), {
                    restaurantId: businessId,
                    type: 'business_feedback',
                    title: type === 'complaint' ? 'New Complaint 😠' : 'New Suggestion 💡',
                    message: `From: ${phoneNumber.trim()}`,
                    actionUrl: '/business-dashboard?tab=feedback_inbox',
                    read: false,
                    createdAt: serverTimestamp(),
                    senderId: currentUser?.uid || 'guest',
                    fromUserName: userProfile?.displayName || userProfile?.firstName || 'Guest',
                    fromUserAvatar: userProfile?.photoURL || null
                });
            } catch (notifError) {
                console.warn('Failed to dispatch partner notification (likely rules propagation delay):', notifError);
            }

            showToast(t('feedback_success', 'Your message has been sent successfully. We will contact you soon.'), 'success');
            setContent('');
            onClose();
            
        } catch (error) {
            console.error('Error submitting feedback:', error);
            showToast(t('feedback_error', 'An error occurred while sending, please try again later.'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', padding: '16px'
        }}>
            <div style={{
                background: 'var(--bg-card)', borderRadius: '24px', width: '100%', maxWidth: '500px',
                display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
            }}>
                {/* Header */}
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-main)' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-main)' }}>{t('feedback_title', 'Feedback & Complaints')}</h3>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer', padding: '4px' }}>
                        <FaTimes />
                    </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Intro text */}
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {t('feedback_intro', 'Your opinion matters! If you faced an issue, share it with us so we can resolve it. This message is private and goes directly to management.')}
                    </div>

                    {/* Type Selector */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)' }}>{t('feedback_type', 'Message Type')}</label>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button type="button" onClick={() => setType('complaint')} style={{
                                flex: 1, padding: '12px', borderRadius: '12px', fontWeight: '700', cursor: 'pointer',
                                background: type === 'complaint' ? 'rgba(239,68,68,0.1)' : 'var(--bg-elevated)',
                                border: type === 'complaint' ? '2px solid #ef4444' : '2px solid transparent',
                                color: type === 'complaint' ? '#ef4444' : 'var(--text-secondary)',
                                transition: 'all 0.2s'
                            }}>
                                😠 {t('complaint', 'Complaint')}
                            </button>
                            <button type="button" onClick={() => setType('suggestion')} style={{
                                flex: 1, padding: '12px', borderRadius: '12px', fontWeight: '700', cursor: 'pointer',
                                background: type === 'suggestion' ? 'rgba(34,197,94,0.1)' : 'var(--bg-elevated)',
                                border: type === 'suggestion' ? '2px solid #22c55e' : '2px solid transparent',
                                color: type === 'suggestion' ? '#22c55e' : 'var(--text-secondary)',
                                transition: 'all 0.2s'
                            }}>
                                💡 {t('suggestion', 'Suggestion')}
                            </button>
                        </div>
                    </div>

                    {/* Message Area */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)' }}>{t('feedback_content', 'Message Details')} <span style={{ color: '#ef4444' }}>*</span></label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder={type === 'complaint' ? t('feedback_ph_complaint', 'Tell us about the issue you faced...') : t('feedback_ph_suggestion', 'Share your idea to improve the place...')}
                            style={{
                                width: '100%', height: '120px', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-color)',
                                background: 'var(--bg-elevated)', color: 'var(--text-main)', fontSize: '0.95rem', resize: 'none',
                                boxSizing: 'border-box', fontFamily: 'inherit'
                            }}
                        />
                    </div>

                    {/* Phone Number (Required) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)' }}>{t('feedback_phone', 'Contact Phone Number')} <span style={{ color: '#ef4444' }}>*</span></label>
                        <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder={t('feedback_phone_ph', '+971 50 123 4567')}
                            style={{
                                width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-color)',
                                background: 'var(--bg-elevated)', color: 'var(--text-main)', fontSize: '0.95rem',
                                boxSizing: 'border-box'
                            }}
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('feedback_phone_hint', 'Management will contact you soon.')}</span>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        style={{
                            width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--brand-primary)',
                            color: 'white', fontWeight: '800', fontSize: '1.05rem', border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px'
                        }}
                    >
                        {isSubmitting ? <FaSpinner className="spin" /> : <FaPaperPlane />}
                        {isSubmitting ? t('sending', 'Sending...') : t('send_feedback', 'Send')}
                    </button>

                </form>
            </div>
        </div>
    );
}
