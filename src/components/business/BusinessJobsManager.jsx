import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useTranslation } from 'react-i18next';
import {
    FaPlus, FaBriefcase, FaEdit, FaTrash, FaFilePdf, FaChevronDown, FaChevronUp,
    FaPhone, FaUser, FaLock, FaToggleOn, FaToggleOff, FaSpinner,
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getBusinessPlanAccess } from '../../config/businessPlanFeatures';
import { deleteJobPosting, updateJobPosting, setJobApplicationStatus } from '../../services/jobPostings';
import { downloadJobApplicationPdf } from '../../utils/jobApplicationPdf';
import { AppText } from '../base';
import BusinessJobEditor from './BusinessJobEditor';

function jobTypeLabel(t, jobType) {
    return t(`job_type_${String(jobType || 'full_time')}`, String(jobType || 'full_time').replace(/_/g, ' '));
}

function ApplicationRow({ app, t, rtl }) {
    const { showToast } = useToast();
    const [busy, setBusy] = useState(false);

    const onDownload = async () => {
        try {
            setBusy(true);
            await downloadJobApplicationPdf(app, { t, rtl });
            if (app.unreadForBusiness || app.status === 'new') {
                setJobApplicationStatus(app.id, 'reviewed').catch(() => {});
            }
        } catch (e) {
            console.error('PDF error', e);
            showToast(t('job_pdf_error', 'Could not generate the PDF.'), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{
            border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px',
            background: 'var(--bg-card)', display: 'flex', gap: '12px', alignItems: 'flex-start',
        }}>
            <div style={{
                width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
            }}>
                {app.applicantPhotoUrl || app.applicantAvatar
                    ? <img src={app.applicantPhotoUrl || app.applicantAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <FaUser size={20} />}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <AppText as="span" style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem' }}>{app.applicantName}</AppText>
                    {app.status === 'new' && (
                        <span style={{ fontSize: '0.66rem', fontWeight: 800, padding: '2px 8px', borderRadius: '999px', background: 'rgba(34,197,94,0.14)', color: '#16a34a' }}>
                            {t('job_app_new', 'New')}
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                    <FaPhone size={11} /> <span dir="ltr">{app.applicantPhone}</span>
                </div>
                {app.applicantContact && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{app.applicantContact}</div>
                )}
                {app.applicantBio && (
                    <AppText as="p" style={{ margin: '6px 0 0', fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{app.applicantBio}</AppText>
                )}
                <button onClick={onDownload} disabled={busy} style={{
                    marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 13px',
                    borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)',
                    color: 'var(--text-main)', fontWeight: 700, fontSize: '0.85rem', cursor: busy ? 'not-allowed' : 'pointer',
                }}>
                    {busy ? <FaSpinner className="spin" /> : <FaFilePdf style={{ color: '#dc2626' }} />}
                    {t('job_download_pdf', 'Download PDF')}
                </button>
            </div>
        </div>
    );
}

/**
 * Business-owner console for job postings: create/edit/close/delete jobs and
 * review applications (each downloadable as a PDF). Business Pro only.
 */
export default function BusinessJobsManager() {
    const { t, i18n } = useTranslation();
    const { currentUser, userProfile } = useAuth();
    const { showToast } = useToast();
    const rtl = typeof i18n.dir === 'function' && i18n.dir(i18n.language) === 'rtl';
    const uid = currentUser?.uid;

    const access = getBusinessPlanAccess(userProfile?.subscriptionTier);
    const isPaid = access.isPaid;

    const [jobs, setJobs] = useState([]);
    const [apps, setApps] = useState([]);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingJob, setEditingJob] = useState(null);
    const [expanded, setExpanded] = useState({});
    const [pendingJob, setPendingJob] = useState(null);

    useEffect(() => {
        if (!uid || !isPaid) return undefined;
        const jq = query(collection(db, 'business_jobs'), where('businessId', '==', uid));
        const unsub = onSnapshot(jq, (snap) => {
            const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setJobs(rows);
        });
        return () => unsub();
    }, [uid, isPaid]);

    useEffect(() => {
        if (!uid || !isPaid) return undefined;
        const aq = query(collection(db, 'job_applications'), where('businessId', '==', uid));
        const unsub = onSnapshot(aq, (snap) => {
            const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setApps(rows);
        });
        return () => unsub();
    }, [uid, isPaid]);

    const appsByJob = useMemo(() => {
        const map = {};
        apps.forEach((a) => {
            (map[a.jobId] = map[a.jobId] || []).push(a);
        });
        return map;
    }, [apps]);

    const toggleStatus = async (job) => {
        try {
            setPendingJob(job.id);
            await updateJobPosting({ jobId: job.id, status: job.status === 'open' ? 'closed' : 'open' });
        } catch (e) {
            showToast(t('job_edit_error', 'Could not update the job.'), 'error');
        } finally {
            setPendingJob(null);
        }
    };

    const removeJob = async (job) => {
        if (typeof window !== 'undefined' && !window.confirm(t('job_delete_confirm', 'Delete this job and all its applications?'))) return;
        try {
            setPendingJob(job.id);
            await deleteJobPosting(job.id);
            showToast(t('job_deleted', 'Job deleted.'), 'success');
        } catch (e) {
            showToast(t('job_edit_error', 'Could not delete the job.'), 'error');
        } finally {
            setPendingJob(null);
        }
    };

    if (!uid) return null;

    if (!isPaid) {
        return (
            <div style={{ textAlign: 'center', padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)' }}>
                    <FaLock size={22} />
                </div>
                <AppText as="h3" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>{t('job_pro_gate_title', 'Job posting is a Pro feature')}</AppText>
                <AppText as="p" style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: 360 }}>
                    {t('job_pro_gate_desc', 'Upgrade to Business Pro to post jobs and receive applications from members.')}
                </AppText>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                    <FaBriefcase style={{ color: 'var(--brand-primary)' }} />
                    <AppText as="h3" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>{t('jobs_manage_title', 'Jobs')}</AppText>
                </div>
                <button onClick={() => { setEditingJob(null); setEditorOpen(true); }} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 15px', borderRadius: '12px',
                    background: 'var(--brand-primary)', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '0.9rem',
                }}>
                    <FaPlus /> {t('job_post_cta', 'Post job')}
                </button>
            </div>

            {jobs.length === 0 ? (
                <AppText as="p" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0', fontSize: '0.92rem' }}>
                    {t('jobs_none_yet', 'You have not posted any jobs yet.')}
                </AppText>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {jobs.map((job) => {
                        const jobApps = appsByJob[job.id] || [];
                        const isOpen = expanded[job.id];
                        const newCount = jobApps.filter((a) => a.status === 'new').length;
                        return (
                            <div key={job.id} style={{ border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden', background: 'var(--bg-elevated)' }}>
                                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <AppText as="h4" style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>{job.title}</AppText>
                                                <span style={{
                                                    fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '999px',
                                                    background: job.status === 'open' ? 'rgba(34,197,94,0.14)' : 'rgba(148,163,184,0.18)',
                                                    color: job.status === 'open' ? '#16a34a' : 'var(--text-muted)',
                                                }}>{job.status === 'open' ? t('job_status_open', 'Open') : t('job_status_closed', 'Closed')}</span>
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                {jobTypeLabel(t, job.jobType)}{job.location ? ` · ${job.location}` : ''}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <button onClick={() => setExpanded((s) => ({ ...s, [job.id]: !s[job.id] }))} style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '10px',
                                            border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)',
                                            fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer',
                                        }}>
                                            {isOpen ? <FaChevronUp size={11} /> : <FaChevronDown size={11} />}
                                            {t('job_applications_count', '{{count}} applications', { count: jobApps.length })}
                                            {newCount > 0 && (
                                                <span style={{ fontSize: '0.66rem', fontWeight: 800, padding: '1px 7px', borderRadius: '999px', background: '#16a34a', color: '#fff' }}>{newCount}</span>
                                            )}
                                        </button>
                                        <button onClick={() => { setEditingJob(job); setEditorOpen(true); }} title={t('edit', 'Edit')} style={iconBtn}>
                                            <FaEdit size={13} />
                                        </button>
                                        <button onClick={() => toggleStatus(job)} disabled={pendingJob === job.id} title={job.status === 'open' ? t('job_close', 'Close') : t('job_reopen', 'Reopen')} style={iconBtn}>
                                            {job.status === 'open' ? <FaToggleOn size={15} style={{ color: '#16a34a' }} /> : <FaToggleOff size={15} />}
                                        </button>
                                        <button onClick={() => removeJob(job)} disabled={pendingJob === job.id} title={t('delete', 'Delete')} style={{ ...iconBtn, color: '#dc2626' }}>
                                            <FaTrash size={12} />
                                        </button>
                                    </div>
                                </div>

                                {isOpen && (
                                    <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {jobApps.length === 0 ? (
                                            <AppText as="p" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('job_no_applications', 'No applications yet.')}</AppText>
                                        ) : (
                                            jobApps.map((a) => <ApplicationRow key={a.id} app={a} t={t} rtl={rtl} />)
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <BusinessJobEditor isOpen={editorOpen} job={editingJob} onClose={() => setEditorOpen(false)} />
        </div>
    );
}

const iconBtn = {
    width: 36, height: 36, borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-card)',
    color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};
