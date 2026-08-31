import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useTranslation } from 'react-i18next';
import { FaBriefcase, FaMapMarkerAlt } from 'react-icons/fa';
import { AppText } from '../base';
import { BusinessSectionCard } from './BusinessProfileCardParts';
import JobApplicationModal from '../JobApplicationModal';

function jobTypeLabel(t, jobType) {
    const key = `job_type_${String(jobType || 'full_time')}`;
    const fallback = String(jobType || 'full_time').replace(/_/g, ' ');
    return t(key, fallback);
}

/**
 * Public "Open positions" section shown on a business profile. Lists the
 * business's open job postings; each opens the application form. Renders nothing
 * when the business has no open jobs (keeps the profile clean).
 */
export default function BusinessJobsPanel({ profileId, isOwner }) {
    const { t } = useTranslation();
    const [jobs, setJobs] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [activeJob, setActiveJob] = useState(null);

    useEffect(() => {
        if (!profileId) return undefined;
        // Equality-only query (no composite index needed); sorted client-side.
        const q = query(
            collection(db, 'business_jobs'),
            where('businessId', '==', profileId),
            where('status', '==', 'open')
        );
        const unsub = onSnapshot(
            q,
            (snap) => {
                const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setJobs(rows);
                setLoaded(true);
            },
            () => setLoaded(true)
        );
        return () => unsub();
    }, [profileId]);

    const hasJobs = jobs.length > 0;
    const title = useMemo(() => t('jobs_open_positions', 'Open positions'), [t]);

    // Nothing to show for visitors when there are no open jobs.
    if (!hasJobs && !isOwner) return null;
    if (!loaded && !hasJobs) return null;

    return (
        <>
            <BusinessSectionCard title={title} icon={<FaBriefcase />}>
                {hasJobs ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {jobs.map((job) => (
                            <div key={job.id} style={{
                                border: '1px solid var(--border-color)', borderRadius: '14px', padding: '14px',
                                background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: '8px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                                    <AppText as="h4" style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>{job.title}</AppText>
                                    <span style={{
                                        flexShrink: 0, fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: '999px',
                                        background: 'var(--brand-primary-soft, rgba(99,102,241,0.12))', color: 'var(--brand-primary)',
                                    }}>{jobTypeLabel(t, job.jobType)}</span>
                                </div>
                                {job.location && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                        <FaMapMarkerAlt size={12} /> {job.location}
                                    </div>
                                )}
                                {job.description && (
                                    <AppText as="p" style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                        {job.description.length > 240 ? `${job.description.slice(0, 240)}…` : job.description}
                                    </AppText>
                                )}
                                {!isOwner && (
                                    <button onClick={() => setActiveJob(job)} style={{
                                        alignSelf: 'flex-start', marginTop: '2px', background: 'var(--brand-primary)', color: 'white',
                                        border: 'none', padding: '9px 16px', borderRadius: '11px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem',
                                    }}>
                                        {t('job_apply', 'Apply')}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <AppText as="p" style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        {t('jobs_owner_empty_hint', 'No open positions yet. Post jobs from your business dashboard.')}
                    </AppText>
                )}
            </BusinessSectionCard>

            <JobApplicationModal isOpen={!!activeJob} job={activeJob} onClose={() => setActiveJob(null)} />
        </>
    );
}
