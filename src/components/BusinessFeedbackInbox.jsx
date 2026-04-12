import React, { useState, useEffect } from 'react';
import { collection, query, where, updateDoc, doc, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { FaCheckCircle, FaPhoneAlt, FaClock, FaExclamationCircle, FaLightbulb, FaSpinner, FaTimes, FaChevronDown } from 'react-icons/fa';
import { getSafeAvatar } from '../utils/avatarUtils';

export default function BusinessFeedbackInbox() {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const { showToast } = useToast();
    
    const [feedbacks, setFeedbacks] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // UI State
    const [selectedFeedback, setSelectedFeedback] = useState(null);
    const [resolvingId, setResolvingId] = useState(null);
    const [visibleCount, setVisibleCount] = useState(5);

    useEffect(() => {
        if (!currentUser?.uid) return;

        const q = query(
            collection(db, 'business_feedback'),
            where('businessId', '==', currentUser.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Client-side sort to bypass strict composite index requirements
            data.sort((a, b) => {
                const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return timeB - timeA;
            });

            setFeedbacks(data);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching feedbacks:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const handleMarkResolved = async (feedbackId) => {
        if (!window.confirm(t('feedback_resolve_confirm', 'Are you sure you want to mark this issue as resolved?'))) return;
        
        try {
            setResolvingId(feedbackId);
            await updateDoc(doc(db, 'business_feedback', feedbackId), {
                isResolved: true
            });
            showToast(t('feedback_resolved_success', 'Message marked as resolved ✅'), 'success');
            setSelectedFeedback(null); // Close modal on resolve
        } catch (error) {
            console.error('Error resolving feedback:', error);
            showToast(t('feedback_resolved_error', 'An error occurred, please try again later.'), 'error');
        } finally {
            setResolvingId(null);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '40px', display: 'flex', justifyContent: 'center', color: 'var(--brand-primary)' }}>
                <FaSpinner className="spin" size={30} />
            </div>
        );
    }

    // Filter to ONLY unresolved
    const unresolvedFeedbacks = feedbacks.filter(f => !f.isResolved);
    const visibleItems = unresolvedFeedbacks.slice(0, visibleCount);
    const hasMore = unresolvedFeedbacks.length > visibleCount;

    if (unresolvedFeedbacks.length === 0) {
        return (
            <div style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.5 }}>📥</div>
                <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-main)' }}>{t('feedback_empty_title', 'Inbox is Empty')}</h3>
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('feedback_empty_desc', 'You haven\'t received any new open complaints or suggestions.')}</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', color: 'var(--text-main)' }}>
                {t('open_tickets', 'Open Tickets')} ({unresolvedFeedbacks.length})
            </h3>

            {/* List View */}
            {visibleItems.map(item => {
                const isSuggestion = item.type === 'suggestion';
                let dateStr = '';
                if (item.createdAt?.toDate) {
                    dateStr = item.createdAt.toDate().toLocaleString('default', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                }

                // Short snippet for the list
                const snippet = item.content.length > 60 ? item.content.substring(0, 60) + '...' : item.content;

                return (
                    <div 
                        key={item.id} 
                        onClick={() => setSelectedFeedback(item)}
                        style={{
                            background: 'var(--bg-card)', borderRadius: '12px', border: `1px solid ${isSuggestion ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                            padding: '16px', display: 'flex', gap: '14px', alignItems: 'center', cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.02)', transition: 'transform 0.2s', position: 'relative'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
                    >
                        <img src={getSafeAvatar(item.userAvatar)} alt={item.userName} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {item.userName || t('guest', 'Guest')}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                    {dateStr}
                                </span>
                            </div>
                            
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                <span style={{ marginRight: '6px', color: isSuggestion ? '#22c55e' : '#ef4444' }}>
                                    {isSuggestion ? <FaLightbulb /> : <FaExclamationCircle />}
                                </span>
                                {snippet}
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* View More Button */}
            {hasMore && (
                <button 
                    onClick={() => setVisibleCount(prev => prev + 5)}
                    style={{
                        background: 'transparent', border: '1px dashed var(--border-color)', borderRadius: '12px',
                        padding: '12px', color: 'var(--brand-primary)', fontWeight: '700', fontSize: '0.9rem',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        marginTop: '8px'
                    }}
                >
                    {t('view_more', 'View More')} <FaChevronDown />
                </button>
            )}

            {/* Reading Modal */}
            {selectedFeedback && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', padding: '16px'
                }}>
                    <div style={{
                        background: 'var(--bg-main)', borderRadius: '24px', width: '100%', maxWidth: '500px',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
                    }}>
                        {/* Modal Header */}
                        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: selectedFeedback.type === 'suggestion' ? '#22c55e' : '#ef4444' }}>
                                    {selectedFeedback.type === 'suggestion' ? <FaLightbulb /> : <FaExclamationCircle />}
                                </span>
                                {selectedFeedback.type === 'suggestion' ? t('suggestion', 'Suggestion') : t('complaint', 'Complaint')}
                            </h3>
                            <button onClick={() => setSelectedFeedback(null)} style={{ background: 'var(--bg-elevated)', border: 'none', borderRadius: '50%', color: 'var(--text-main)', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                <FaTimes />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
                            
                            {/* User Profile Info */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <img src={getSafeAvatar(selectedFeedback.userAvatar)} alt={selectedFeedback.userName} style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover' }} />
                                <div>
                                    <div style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)' }}>{selectedFeedback.userName || t('guest', 'Guest')}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        <FaClock style={{ marginRight: '4px' }} />
                                        {selectedFeedback.createdAt?.toDate ? selectedFeedback.createdAt.toDate().toLocaleString() : ''}
                                    </div>
                                </div>
                            </div>

                            {/* Full Message Text */}
                            <div style={{ background: 'var(--bg-elevated)', padding: '20px', borderRadius: '16px', color: 'var(--text-main)', fontSize: '1rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                {selectedFeedback.content}
                            </div>

                            {/* Phone Number Contact Card */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: 'rgba(56, 189, 248, 0.08)', borderRadius: '16px' }}>
                                <div style={{ width: 40, height: 40, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                                    <FaPhoneAlt />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('contact_phone', 'Contact Number')}</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '0.5px' }}>{selectedFeedback.phoneNumber}</div>
                                </div>
                            </div>

                        </div>

                        {/* Modal Footer / Resolve Button */}
                        <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-elevated)' }}>
                            <button 
                                onClick={() => handleMarkResolved(selectedFeedback.id)} 
                                disabled={resolvingId === selectedFeedback.id}
                                style={{
                                    width: '100%', padding: '16px', borderRadius: '16px', background: '#22c55e', color: 'white',
                                    border: 'none', fontWeight: '800', fontSize: '1.05rem', cursor: 'pointer', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.2s'
                                }}
                            >
                                {resolvingId === selectedFeedback.id ? <FaSpinner className="spin" /> : <FaCheckCircle />}
                                {t('feedback_mark_resolved', 'Mark as Resolved')}
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
