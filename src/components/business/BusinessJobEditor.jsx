import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaTimes, FaSpinner } from 'react-icons/fa';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../../firebase/config';
import { useToast } from '../../context/ToastContext';
import { createJobPosting, updateJobPosting, JOB_TYPES } from '../../services/jobPostings';
import { AppText, AppTextInput } from '../base';

function jobExpiryToInputDate(ts) {
    const d = ts?.toDate ? ts.toDate() : ts?.seconds ? new Date(ts.seconds * 1000) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    // Local YYYY-MM-DD for the <input type="date">.
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

/**
 * Create / edit a job posting (business owner, Pro). When `job` is provided the
 * form edits it; otherwise it creates a new posting.
 */
export default function BusinessJobEditor({ isOpen, onClose, job = null, onSaved }) {
    const { t, i18n } = useTranslation();
    const { showToast } = useToast();
    const isRtl = typeof i18n.dir === 'function' && i18n.dir(i18n.language) === 'rtl';
    const isEdit = !!job;

    const [title, setTitle] = useState(job?.title || '');
    const [description, setDescription] = useState(job?.description || '');
    const [jobType, setJobType] = useState(job?.jobType || 'full_time');
    const [location, setLocation] = useState(job?.location || '');
    const [expiresAt, setExpiresAt] = useState(jobExpiryToInputDate(job?.expiresAt));
    // Distribution options — new postings only (like the special offer).
    const [publishToFeed, setPublishToFeed] = useState(true);
    const [notifyMembers, setNotifyMembers] = useState(false);
    const [showOnSwipe, setShowOnSwipe] = useState(false);
    const [saving, setSaving] = useState(false);

    if (!isOpen) return null;

    const handleSave = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            showToast(t('job_edit_req_title', 'Please enter a job title.'), 'error');
            return;
        }
        if (!description.trim()) {
            showToast(t('job_edit_req_desc', 'Please enter a job description.'), 'error');
            return;
        }
        try {
            setSaving(true);
            const payload = {
                title: title.trim(),
                description: description.trim(),
                jobType,
                location: location.trim() || null,
                expiresAt: expiresAt || null,
            };
            if (isEdit) {
                await updateJobPosting({ jobId: job.id, ...payload });
            } else {
                await createJobPosting({ ...payload, publishToFeed, showOnSwipe });
                // Optionally announce to every community member (lands in their inbox).
                if (notifyMembers) {
                    try {
                        const functions = getFunctions(app, 'us-central1');
                        await httpsCallable(functions, 'sendBusinessBroadcast')({
                            kind: 'announcement',
                            title: t('job_broadcast_title', 'New job: {{title}}', { title: title.trim() }),
                            body: description.trim().slice(0, 1500),
                        });
                    } catch (be) {
                        console.warn('job member broadcast failed:', be);
                        showToast(t('job_broadcast_partial', 'Job posted, but the member announcement could not be sent.'), 'info');
                    }
                }
            }
            showToast(isEdit ? t('job_edit_updated', 'Job updated.') : t('job_edit_created', 'Job posted.'), 'success');
            onSaved?.();
            onClose();
        } catch (error) {
            console.error('Error saving job:', error);
            const code = String(error?.code || '');
            if (code === 'functions/permission-denied') {
                showToast(t('job_edit_pro_required', 'Job posting is a Business Pro feature.'), 'error');
            } else if (code === 'functions/resource-exhausted') {
                showToast(t('job_edit_limit', 'You have reached the maximum number of open jobs.'), 'error');
            } else {
                showToast(t('job_edit_error', 'Could not save the job. Please try again.'), 'error');
            }
        } finally {
            setSaving(false);
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
                background: 'var(--bg-card)', borderRadius: '24px', width: '100%', maxWidth: '520px', maxHeight: '92vh',
                display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-main)' }}>
                    <AppText as="h3" style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)' }}>
                        {isEdit ? t('job_edit_title', 'Edit job') : t('job_new_title', 'Post a job')}
                    </AppText>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer', padding: '4px' }}>
                        <FaTimes />
                    </button>
                </div>

                <form onSubmit={handleSave} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={labelStyle}>{t('job_field_title', 'Job title')} <AppText as="span" style={{ color: '#ef4444' }}>*</AppText></label>
                        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} style={fieldStyle} required
                            placeholder={t('job_field_title_ph', 'e.g. Waiter, Barista, Receptionist')} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={labelStyle}>{t('job_field_type', 'Job type')}</label>
                        <select value={jobType} onChange={(e) => setJobType(e.target.value)} style={fieldStyle}>
                            {JOB_TYPES.map((jt) => (
                                <option key={jt} value={jt}>{t(`job_type_${jt}`, jt.replace(/_/g, ' '))}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={labelStyle}>{t('job_field_location', 'Location')} <AppText as="span" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({t('optional', 'optional')})</AppText></label>
                        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} style={fieldStyle}
                            placeholder={t('job_field_location_ph', 'City / area')} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={labelStyle}>{t('job_field_desc', 'Description')} <AppText as="span" style={{ color: '#ef4444' }}>*</AppText></label>
                        <AppTextInput as="textarea" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000}
                            placeholder={t('job_field_desc_ph', 'Responsibilities, requirements, hours, pay...')}
                            style={{ ...fieldStyle, height: '140px', resize: 'vertical' }} />
                    </div>

                    {/* Expiry date — the posting auto-closes after this day */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={labelStyle}>{t('job_field_expiry', 'Open until')} <AppText as="span" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({t('optional', 'optional')})</AppText></label>
                        <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} style={fieldStyle} />
                        <AppText as="span" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('job_field_expiry_hint', 'The job automatically closes after this date.')}</AppText>
                    </div>

                    {/* Distribution options — new postings only */}
                    {!isEdit && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', borderRadius: '14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
                            <AppText as="span" style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>{t('job_distribute_title', 'Where to show this job')}</AppText>
                            {[
                                { k: 'feed', on: publishToFeed, set: setPublishToFeed, label: t('job_distribute_feed', 'Post to the community feed') },
                                { k: 'members', on: notifyMembers, set: setNotifyMembers, label: t('job_distribute_members', 'Send to all my community members') },
                                { k: 'swipe', on: showOnSwipe, set: setShowOnSwipe, label: t('job_distribute_swipe', 'Feature on my business swipe card') },
                            ].map((opt) => (
                                <label key={opt.k} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    <input type="checkbox" checked={opt.on} onChange={(e) => opt.set(e.target.checked)} style={{ width: 18, height: 18 }} />
                                    {opt.label}
                                </label>
                            ))}
                            <AppText as="span" style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{t('job_distribute_hint', 'Your job always appears on your business profile.')}</AppText>
                        </div>
                    )}

                    <button type="submit" disabled={saving} style={{
                        width: '100%', padding: '15px', borderRadius: '14px', background: 'var(--brand-primary)',
                        color: 'white', fontWeight: '800', fontSize: '1.02rem', border: 'none',
                        cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: '8px',
                    }}>
                        {saving && <FaSpinner className="spin" />}
                        {isEdit ? t('save', 'Save') : t('job_post_cta', 'Post job')}
                    </button>
                </form>
            </div>
        </div>
    );
}
