import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { FaTimes, FaSpinner, FaPaperPlane, FaCamera, FaUser } from 'react-icons/fa';
import { goToLogin } from '../utils/goToLogin';
import { uploadImage } from '../utils/imageUpload';
import { submitJobApplication } from '../services/jobPostings';
import { AppText, AppTextInput } from './base';

/**
 * Member-facing application form for a single job posting.
 * Collects name, phone, an optional other-contact, an optional photo, and a short
 * bio, then submits via the submitJobApplication callable. The photo is uploaded
 * to job_application_photos/{uid}/ first; its download URL is passed to the server.
 */
export default function JobApplicationModal({ isOpen, onClose, job }) {
    const { t, i18n } = useTranslation();
    const { currentUser, userProfile, isGuest } = useAuth();
    const { showToast } = useToast();
    const isRtl = typeof i18n.dir === 'function' && i18n.dir(i18n.language) === 'rtl';

    const [name, setName] = useState(userProfile?.displayName || userProfile?.display_name || '');
    const [phone, setPhone] = useState(userProfile?.phoneNumber || '');
    const [contact, setContact] = useState('');
    const [bio, setBio] = useState('');
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen || !job) return null;

    const onPickPhoto = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!/^image\//.test(file.type)) {
            showToast(t('job_app_photo_invalid', 'Please choose an image file.'), 'error');
            return;
        }
        if (file.size > 8 * 1024 * 1024) {
            showToast(t('job_app_photo_too_big', 'Image must be under 8 MB.'), 'error');
            return;
        }
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const uid = currentUser?.uid;
        if (!uid || isGuest) {
            showToast(t('job_app_login_required', 'Please sign in to apply.'), 'info');
            goToLogin({ returnPath: typeof window !== 'undefined' ? window.location.pathname : undefined });
            onClose();
            return;
        }
        if (uid === job.businessId) {
            showToast(t('job_app_owner_blocked', 'You cannot apply to your own job.'), 'error');
            return;
        }
        if (!name.trim()) {
            showToast(t('job_app_req_name', 'Please enter your name.'), 'error');
            return;
        }
        if (!phone.trim()) {
            showToast(t('job_app_req_phone', 'Please enter a phone number.'), 'error');
            return;
        }

        try {
            setSubmitting(true);

            let photoUrl = null;
            if (photoFile) {
                const ext = (photoFile.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
                const path = `job_application_photos/${uid}/${uid}_${Date.now()}.${ext}`;
                photoUrl = await uploadImage(photoFile, path);
            }

            const res = await submitJobApplication({
                jobId: job.id,
                name: name.trim(),
                phone: phone.trim(),
                contact: contact.trim() || null,
                bio: bio.trim() || null,
                photoUrl: photoUrl || null,
            });

            showToast(
                res?.reapplied
                    ? t('job_app_updated', 'Your application was updated.')
                    : t('job_app_sent', 'Your application has been sent.'),
                'success'
            );
            onClose();
        } catch (error) {
            console.error('Error submitting job application:', error);
            const code = String(error?.code || '');
            if (code === 'functions/resource-exhausted') {
                showToast(t('job_app_rate_limited', 'You are applying too fast. Please wait a moment.'), 'error');
            } else if (code === 'functions/failed-precondition') {
                showToast(t('job_app_closed', 'This job is no longer accepting applications.'), 'error');
            } else if (code === 'functions/unauthenticated') {
                showToast(t('job_app_login_required', 'Please sign in to apply.'), 'info');
                goToLogin({ returnPath: typeof window !== 'undefined' ? window.location.pathname : undefined });
                onClose();
            } else {
                showToast(t('job_app_error', 'Could not send your application. Please try again.'), 'error');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const fieldStyle = {
        width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid var(--border-color)',
        background: 'var(--bg-elevated)', color: 'var(--text-main)', fontSize: '0.95rem', boxSizing: 'border-box',
        fontFamily: 'inherit',
    };
    const labelStyle = { fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)' };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', padding: '16px',
        }} dir={isRtl ? 'rtl' : 'ltr'}>
            <div style={{
                background: 'var(--bg-card)', borderRadius: '24px', width: '100%', maxWidth: '500px', maxHeight: '92vh',
                display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            }}>
                {/* Header */}
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-main)' }}>
                    <div style={{ minWidth: 0 }}>
                        <AppText as="h3" style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)' }}>{t('job_app_title', 'Apply for this job')}</AppText>
                        {job.title && <AppText as="p" style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.title}</AppText>}
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer', padding: '4px' }}>
                        <FaTimes />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                    {/* Photo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                            width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                            background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
                        }}>
                            {photoPreview
                                ? <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <FaUser size={28} />}
                        </div>
                        <label style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                            padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)',
                            background: 'var(--bg-elevated)', color: 'var(--text-main)', fontWeight: 700, fontSize: '0.9rem',
                        }}>
                            <FaCamera />
                            {photoPreview ? t('job_app_change_photo', 'Change photo') : t('job_app_add_photo', 'Add photo')}
                            <input type="file" accept="image/*" onChange={onPickPhoto} style={{ display: 'none' }} />
                        </label>
                    </div>

                    {/* Name */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={labelStyle}>{t('job_app_name', 'Name')} <AppText as="span" style={{ color: '#ef4444' }}>*</AppText></label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} style={fieldStyle} required />
                    </div>

                    {/* Phone */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={labelStyle}>{t('job_app_phone', 'Phone')} <AppText as="span" style={{ color: '#ef4444' }}>*</AppText></label>
                        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} placeholder={t('feedback_phone_ph', '+971 50 123 4567')} style={fieldStyle} required />
                    </div>

                    {/* Other contact */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={labelStyle}>{t('job_app_contact', 'Other contact')} <AppText as="span" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({t('optional', 'optional')})</AppText></label>
                        <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={140} placeholder={t('job_app_contact_ph', 'Email, WhatsApp, etc.')} style={fieldStyle} />
                    </div>

                    {/* Bio */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={labelStyle}>{t('job_app_bio', 'About you')} <AppText as="span" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({t('optional', 'optional')})</AppText></label>
                        <AppTextInput as="textarea" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={900}
                            placeholder={t('job_app_bio_ph', 'A short note about your experience...')}
                            style={{ ...fieldStyle, height: '96px', resize: 'none' }} />
                    </div>

                    <button type="submit" disabled={submitting} style={{
                        width: '100%', padding: '15px', borderRadius: '14px', background: 'var(--brand-primary)',
                        color: 'white', fontWeight: '800', fontSize: '1.02rem', border: 'none',
                        cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: '8px', marginTop: '4px',
                    }}>
                        {submitting ? <FaSpinner className="spin" /> : <FaPaperPlane />}
                        {submitting ? t('sending', 'Sending...') : t('job_app_submit', 'Send application')}
                    </button>
                </form>
            </div>
        </div>
    );
}
