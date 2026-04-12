import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { FaExclamationCircle, FaTimes } from 'react-icons/fa';

const UnpublishedBusinessReminder = () => {
    const { currentUser, userProfile, isBusiness } = useAuth();
    const { isDark } = useTheme();
    const { t } = useTranslation();
    const { showToast } = useToast();
    const opaqueSurface = isDark ? '#1e1e2e' : '#ffffff';
    const [isVisible, setIsVisible] = useState(true);
    const [publishing, setPublishing] = useState(false);
    /** Hides the banner immediately after Firestore write; profile snapshot usually follows within ms. */
    const [publishSucceeded, setPublishSucceeded] = useState(false);

    const storageKey = currentUser?.uid ? `hide_unpublished_reminder_${currentUser.uid}` : null;

    useEffect(() => {
        if (storageKey && localStorage.getItem(storageKey) === 'true') {
            setIsVisible(false);
        }
    }, [storageKey]);

    useEffect(() => {
        setPublishSucceeded(false);
    }, [currentUser?.uid]);

    if (!currentUser || !userProfile || !isBusiness) return null;
    // Manual publish/hide — only after email is verified (banner above covers unverified).
    if (!currentUser.emailVerified) return null;

    const businessInfo = userProfile.businessInfo || {};
    if (businessInfo.isPublished || publishSucceeded) return null;

    if (!isVisible) return null;

    const handlePublishNow = async () => {
        if (!currentUser?.uid || publishing) return;
        if (!currentUser.emailVerified) {
            showToast(
                t('business_publish_verify_email_first', 'Verify your email before publishing to the Partners page.'),
                'error'
            );
            return;
        }
        try {
            setPublishing(true);
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, { 'businessInfo.isPublished': true });
            setPublishSucceeded(true);
            showToast(
                t('business_publish_success', 'Your business is now visible on the Partners page.'),
                'success'
            );
        } catch (e) {
            console.error('UnpublishedBusinessReminder publish:', e);
            showToast(t('business_publish_error', 'Failed to publish profile: ') + (e?.message || String(e)), 'error');
        } finally {
            setPublishing(false);
        }
    };

    const handleHideForever = () => {
        if (storageKey) {
            localStorage.setItem(storageKey, 'true');
        }
        setIsVisible(false);
    };

    return (
        <div
            className="unpublished-business-reminder"
            style={{
            /* Opaque base (theme tokens in CSS often use rgba — avoids “see-through” banners) */
            backgroundColor: opaqueSurface,
            backgroundImage: 'linear-gradient(135deg, rgba(245, 158, 11, 0.22), rgba(239, 68, 68, 0.1))',
            border: '1px solid rgba(245, 158, 11, 0.45)',
            borderLeft: '4px solid #f59e0b',
            margin: '16px 16px 0 16px',
            padding: '16px',
            borderRadius: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            position: 'sticky',
            top: 0,
            /* Above feed layers (stories, map, filters); below full-screen modals */
            zIndex: 100050,
            isolation: 'isolate',
            pointerEvents: 'auto',
            overflow: 'hidden',
            boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
            backdropFilter: 'saturate(1.1)',
            WebkitBackdropFilter: 'saturate(1.1)',
        }}
        >
            {/* Top row: Icon, text, and Dismiss button */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={{ 
                        background: 'rgba(245, 158, 11, 0.15)', 
                        padding: '10px', 
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: '2px'
                    }}>
                        <FaExclamationCircle style={{ color: '#f59e0b', fontSize: '1.4rem' }} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>
                            {t('unpublished_business_reminder_title', 'Your business is currently unpublished or hidden')}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            {t('unpublished_business_reminder_desc', 'Please publish it from your dashboard so customers can find you.')}
                        </div>
                    </div>
                </div>
                
                {/* Dismiss Button */}
                <button
                    type="button"
                    onClick={() => setIsVisible(false)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        transition: 'background 0.2s',
                        marginTop: '-4px',
                        marginRight: '-4px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-overlay)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    title={t('dismiss', 'Dismiss temporarily')}
                >
                    <FaTimes size={16} />
                </button>
            </div>
            
            {/* Bottom Row: Publish Button and Don't Show Again */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                    type="button"
                    onClick={handlePublishNow}
                    disabled={publishing}
                    style={{
                        position: 'relative',
                        zIndex: 2,
                        width: '100%',
                        padding: '12px',
                        background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '0.95rem',
                        fontWeight: '800',
                        cursor: publishing ? 'wait' : 'pointer',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        boxSizing: 'border-box',
                        opacity: publishing ? 0.85 : 1,
                    }}
                    onMouseEnter={(e) => {
                        if (publishing) return;
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(245, 158, 11, 0.35)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.25)';
                    }}
                >
                    {publishing ? t('publishing', 'Publishing...') : t('publish_now', 'Publish Now')}
                </button>
                <button
                    type="button"
                    onClick={handleHideForever}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        padding: '4px',
                        alignSelf: 'center',
                        textDecoration: 'underline'
                    }}
                >
                    {t('dont_show_again', "Don't show this again")}
                </button>
            </div>
        </div>
    );
};

export default UnpublishedBusinessReminder;
