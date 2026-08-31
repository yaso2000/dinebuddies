import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaBriefcase, FaMapMarkerAlt, FaUser } from 'react-icons/fa';
import { AppText } from './base';
import JobApplicationModal from './JobApplicationModal';

function jobTypeLabel(t, jobType) {
    return t(`job_type_${String(jobType || 'full_time')}`, String(jobType || 'full_time').replace(/_/g, ' '));
}

function formatExpiry(ts) {
    const d = ts?.toDate ? ts.toDate() : ts?.seconds ? new Date(ts.seconds * 1000) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    try {
        return d.toLocaleDateString();
    } catch {
        return '';
    }
}

/**
 * Feed card for a business job posting (communityPosts doc `type: 'job_post'`).
 * Lets members view and apply straight from the feed.
 */
export default function JobFeedCard({ post }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [applyOpen, setApplyOpen] = useState(false);

    const snap = post?.jobSnapshot || {};
    const businessName = post?.author?.name || post?.businessName || '';
    const businessAvatar = post?.author?.avatar || null;
    const title = snap.title || post?.content || t('job_post_card_label', 'Hiring');
    const expiry = formatExpiry(snap.expiresAt);

    const job = {
        id: post?.jobId,
        title,
        businessId: post?.businessId,
    };

    return (
        <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '18px',
            padding: '16px', margin: '0 0 14px', display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
            {/* Business header */}
            <button
                type="button"
                onClick={() => post?.businessId && navigate(`/business/${post.businessId}`)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'start' }}>
                <div style={{
                    width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-elevated)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
                }}>
                    {businessAvatar ? <img src={businessAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <FaUser size={18} />}
                </div>
                <div style={{ minWidth: 0 }}>
                    <AppText as="span" style={{ display: 'block', fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem' }}>{businessName}</AppText>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', fontWeight: 800, color: 'var(--brand-primary)' }}>
                        <FaBriefcase size={11} /> {t('job_post_card_label', 'Hiring')}
                    </span>
                </div>
            </button>

            {/* Job body */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <AppText as="h3" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>{title}</AppText>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <span>{jobTypeLabel(t, snap.jobType)}</span>
                    {snap.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><FaMapMarkerAlt size={11} /> {snap.location}</span>}
                    {expiry && <span>{t('job_expires_on', 'Open until {{date}}', { date: expiry })}</span>}
                </div>
                {snap.description && (
                    <AppText as="p" style={{ margin: '2px 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {snap.description.length > 220 ? `${snap.description.slice(0, 220)}…` : snap.description}
                    </AppText>
                )}
            </div>

            <button
                type="button"
                onClick={() => setApplyOpen(true)}
                style={{
                    alignSelf: 'flex-start', background: 'var(--brand-primary)', color: '#fff', border: 'none',
                    padding: '10px 18px', borderRadius: '12px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer',
                }}>
                {t('job_post_view', 'View & apply')}
            </button>

            <JobApplicationModal isOpen={applyOpen} job={job} onClose={() => setApplyOpen(false)} />
        </div>
    );
}
