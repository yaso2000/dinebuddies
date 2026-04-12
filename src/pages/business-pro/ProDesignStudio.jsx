import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import ProOfferTemplates from './ProOfferTemplates';
import ProFeaturedPost from './ProFeaturedPost';
import ProEventPost from './ProEventPost';
import BrandKit from './BrandKit';
import { FaMagic, FaDownload, FaArrowLeft, FaNewspaper, FaFilePdf, FaCalendarAlt } from 'react-icons/fa';
import { fetchReportData, generateReportPdf, PERIODS } from '../../services/eliteReportService';
import { useInvitations } from '../../context/InvitationContext';

// ─── Tool definitions ────────────────────────────────────────────────────────

const tools = [
    {
        key: 'offer-editor',
        icon: <FaMagic />,
        name: 'Premium Offer Editor',
        desc: 'Design and publish stunning exclusive offers with live preview',
        color: 'orange',
        comingSoon: false,
        isNew: true
    },
    {
        key: 'featured-post',
        icon: <FaNewspaper />,
        name: 'Featured Post (Elite)',
        desc: 'Create a slide for the main feed and profile with title, description, and entrance animation',
        color: 'gold',
        comingSoon: false,
        isNew: true
    },
    {
        key: 'event',
        icon: <FaCalendarAlt />,
        name: 'New Event Post',
        desc: 'Promote an upcoming event, party, or special occasion to your community',
        color: 'blue',
        comingSoon: false,
        isNew: true
    },
];

// ─── Main Component ──────────────────────────────────────────────────────────

const ProDesignStudio = ({ editOffer = null, defaultTool = null }) => {
    const { currentUser, userProfile } = useAuth();
    const { getCommunityMembers } = useInvitations();
    const isElite = (userProfile?.subscriptionTier || 'free').toLowerCase() === 'elite';
    const businessName = userProfile?.businessInfo?.businessName || userProfile?.display_name || 'Business';
    // Auto-open a specific tool if arrived via deep-link (defaultTool) or edit offer
    const [activeTool, setActiveTool] = useState(editOffer ? 'offer-editor' : (defaultTool || null));
    const [currentEditOffer, setCurrentEditOffer] = useState(editOffer);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [reportPeriodDays, setReportPeriodDays] = useState(7);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [reportFetching, setReportFetching] = useState(false);

    const handleDownloadReport = async () => {
        if (!currentUser?.uid || !isElite) return;
        setReportLoading(true);
        try {
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - reportPeriodDays);
            const data = await fetchReportData(currentUser.uid, start, end, businessName, getCommunityMembers);
            generateReportPdf(data);
        } catch (e) {
            console.error('Report generation failed:', e);
        } finally {
            setReportLoading(false);
        }
    };

    const fetchReport = async (days) => {
        if (!currentUser?.uid) return;
        setReportFetching(true);
        try {
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - days);
            const data = await fetchReportData(currentUser.uid, start, end, businessName, getCommunityMembers);
            setReportData(data);
        } catch (e) {
            console.error('Report fetch failed:', e);
        } finally {
            setReportFetching(false);
        }
    };

    const handlePeriodChange = (days) => {
        setReportPeriodDays(days);
        fetchReport(days);
    };

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (activeTool === 'offer-editor') {
        return (
            <div>
                {/* Breadcrumb */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <button
                        type="button"
                        className="ui-btn ui-btn--secondary"
                        onClick={() => { setActiveTool(null); setCurrentEditOffer(null); }}
                        style={{ padding: '6px 12px', gap: 7, fontSize: '0.85rem' }}
                    >
                        <FaArrowLeft /> Design Studio
                    </button>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9' }}>
                        {currentEditOffer ? `Editing: ${currentEditOffer.title}` : 'Premium Offer Editor'}
                    </span>
                </div>

                <ProOfferTemplates
                    onBack={() => { setActiveTool(null); setCurrentEditOffer(null); }}
                    editOffer={currentEditOffer}
                />
            </div>
        );
    }

    if (activeTool === 'activity-report') {
        const REPORT_PERIODS = [
            { value: 7, label: 'Weekly', sub: 'Last 7 days' },
            { value: 30, label: 'Monthly', sub: 'Last 30 days' },
            { value: 365, label: 'Yearly', sub: 'Last 12 months' },
        ];
        return (
            <div>
                {/* Breadcrumb */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <button type="button" className="ui-btn ui-btn--secondary"
                        onClick={() => { setActiveTool(null); setReportData(null); }}
                        style={{ padding: '6px 12px', gap: 7, fontSize: '0.85rem' }}>
                        <FaArrowLeft /> Design Studio
                    </button>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9' }}>Activity Report</span>
                </div>

                {/* Period selector */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
                    {REPORT_PERIODS.map(p => (
                        <button key={p.value} type="button"
                            onClick={() => handlePeriodChange(p.value)}
                            style={{
                                flex: '1 1 120px', padding: '14px 20px', borderRadius: 14,
                                border: reportPeriodDays === p.value ? '2px solid #f59e0b' : '1px solid var(--border-color)',
                                background: reportPeriodDays === p.value ? 'rgba(245,158,11,0.15)' : 'var(--bg-card)',
                                color: reportPeriodDays === p.value ? '#f59e0b' : 'var(--text-main)',
                                cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                            }}>
                            <div style={{ fontSize: '1rem', fontWeight: 700 }}>{p.label}</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: 2 }}>{p.sub}</div>
                        </button>
                    ))}
                </div>

                {/* Generate prompt if no data yet */}
                {!reportData && !reportFetching && (
                    <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📊</div>
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f1f5f9', marginBottom: 6 }}>Select a period above to load your report</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Weekly, Monthly, or Yearly stats will appear here</div>
                    </div>
                )}

                {reportFetching && (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <div className="bpro-spinner" />
                        <div style={{ marginTop: 16, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading report…</div>
                    </div>
                )}

                {/* On-screen report */}
                {reportData && !reportFetching && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Period: {reportData.periodLabel}</div>
                            <button type="button" className="ui-btn ui-btn--primary"
                                onClick={handleDownloadReport} disabled={reportLoading}
                                style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {reportLoading ? '⏳ Generating PDF…' : <><FaFilePdf /> Download PDF</>}
                            </button>
                        </div>

                        {/* Metric Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                            {[
                                { label: 'Community Members', value: reportData.memberCount, color: '#6366f1' },
                                { label: 'Active Invitations', value: reportData.activeInvitations, color: '#f97316' },
                                { label: 'Total Invitations', value: reportData.totalInvitations, color: '#3b82f6' },
                                { label: 'In-Period Invitations', value: reportData.invitationsInPeriod, color: '#06b6d4' },
                                { label: 'Avg Rating', value: reportData.rating, color: '#22c55e' },
                                { label: 'Total Reviews', value: reportData.reviewCount, color: '#a855f7' },
                                { label: 'New Reviews', value: reportData.reviewsInPeriod, color: '#ec4899' },
                            ].map(m => (
                                <div key={m.label} className="bpro-stat-card" style={{ padding: '14px 16px', gap: 4 }}>
                                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: m.color }}>{m.value}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>{m.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Recent Invitations */}
                        {reportData.recentInvitations.length > 0 && (
                            <div className="bpro-stat-card" style={{ padding: 20 }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#a78bfa', marginBottom: 10, letterSpacing: '0.05em' }}>RECENT INVITATIONS</div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Title</th>
                                            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Date</th>
                                            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.recentInvitations.map((inv, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                <td style={{ padding: '8px 8px' }}>{inv.title}</td>
                                                <td style={{ padding: '8px 8px', color: 'var(--text-muted)' }}>{inv.date}</td>
                                                <td style={{ padding: '8px 8px' }}>
                                                    <span style={{ background: inv.active ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)', color: inv.active ? '#22c55e' : 'var(--text-muted)', borderRadius: 6, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600 }}>
                                                        {inv.active ? 'Active' : 'Past'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Recent Reviews */}
                        {reportData.recentReviews.length > 0 && (
                            <div className="bpro-stat-card" style={{ padding: 20 }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#a78bfa', marginBottom: 10, letterSpacing: '0.05em' }}>RECENT REVIEWS</div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Rating</th>
                                            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Comment</th>
                                            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.recentReviews.map((rev, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                <td style={{ padding: '8px 8px' }}>
                                                    <span style={{ color: '#f59e0b', fontWeight: 700 }}>{'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}</span>
                                                </td>
                                                <td style={{ padding: '8px 8px', color: 'var(--text-muted)' }}>{rev.comment || '—'}</td>
                                                <td style={{ padding: '8px 8px', color: 'var(--text-muted)' }}>{rev.date}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    if (activeTool === 'featured-post') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: 400 }}>
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <button type="button" className="ui-btn ui-btn--secondary" onClick={() => setActiveTool(null)} style={{ padding: '6px 12px', gap: 7, fontSize: '0.85rem' }}>
                        <FaArrowLeft /> Design Studio
                    </button>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9' }}>Featured Post</span>
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                    <ProFeaturedPost onBack={() => setActiveTool(null)} />
                </div>
            </div>
        );
    }

    if (activeTool === 'event') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: 400 }}>
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <button type="button" className="ui-btn ui-btn--secondary" onClick={() => setActiveTool(null)} style={{ padding: '6px 12px', gap: 7, fontSize: '0.85rem' }}>
                        <FaArrowLeft /> Design Studio
                    </button>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9' }}>Event Post</span>
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                     <ProEventPost 
                         onBack={() => setActiveTool(null)}
                         onSuccess={() => setTimeout(() => setActiveTool(null), 1000)}
                     />
                </div>
            </div>
        );
    }

    // ── Tools grid view ──────────────────────────────────────────────────────
    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9' }}>Design Studio</div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                    Create stunning visuals for your invitations and community
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {/* Elite: Activity Report — inline tool card */}
                {isElite && (
                    <div className="bpro-stat-card" style={{ position: 'relative', cursor: 'default' }}>
                        <span style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(16,185,129,0.3)' }}>✓ Active</span>
                        <div className="bpro-stat-icon orange" style={{ fontSize: '1.3rem' }}><FaFilePdf /></div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9' }}>Activity Report</div>
                        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>Download a PDF activity report for a selected period</div>
                        {/* Activity Report card */}
                        <button type="button" className="ui-btn ui-btn--secondary" style={{ marginTop: 4, width: '100%', justifyContent: 'center' }}
                            onClick={() => { setActiveTool('activity-report'); fetchReport(reportPeriodDays); }}>
                            Open Tool
                        </button>
                    </div>
                )}
                {tools.map(tool => (
                    <div
                        key={tool.key}
                        className="bpro-stat-card"
                        onClick={() => !tool.comingSoon && setActiveTool(tool.key)}
                        style={{ cursor: tool.comingSoon ? 'not-allowed' : 'pointer', opacity: tool.comingSoon ? 0.6 : 1, position: 'relative', transition: 'transform 0.15s, box-shadow 0.15s' }}
                        onMouseEnter={e => { if (!tool.comingSoon) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(124,58,237,0.2)'; } }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                    >
                        {/* Coming Soon / New badges */}
                        {tool.comingSoon && (
                            <span style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(249,115,22,0.15)', color: '#f97316', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(249,115,22,0.3)' }}>
                                Coming Soon
                            </span>
                        )}
                        {tool.isNew && (
                            <span style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(16,185,129,0.3)' }}>
                                ✓ Active
                            </span>
                        )}

                        <div className={`bpro-stat-icon ${tool.color}`} style={{ fontSize: '1.3rem' }}>{tool.icon}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9' }}>{tool.name}</div>
                        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>{tool.desc}</div>

                        {!tool.comingSoon && (
                            <button
                                type="button"
                                className="ui-btn ui-btn--secondary"
                                style={{ marginTop: 4, width: '100%', justifyContent: 'center' }}
                                onClick={e => { e.stopPropagation(); setActiveTool(tool.key); }}
                            >
                                Open Tool
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProDesignStudio;
