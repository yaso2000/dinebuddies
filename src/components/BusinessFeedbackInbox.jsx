import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';
import {
  FaPhoneAlt, FaExclamationCircle, FaLightbulb, FaSpinner, FaTimes,
  FaStar, FaPaperPlane, FaInbox, FaCheckCircle, FaHourglassHalf, FaArchive, FaCircle,
  FaMagic, FaChartPie
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import UserAvatar from './UserAvatar';
import { AppText } from './base';

const SENTIMENT = {
  negative: { color: '#ef4444', label: 'sentiment_negative', def: 'Negative' },
  neutral: { color: '#94a3b8', label: 'sentiment_neutral', def: 'Neutral' },
  positive: { color: '#22c55e', label: 'sentiment_positive', def: 'Positive' },
};
const SEVERITY_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#94a3b8' };

const STATUSES = {
  open: { color: '#f59e0b', icon: FaInbox, labelKey: 'feedback_status_open', labelDefault: 'Open' },
  in_progress: { color: '#3b82f6', icon: FaHourglassHalf, labelKey: 'feedback_status_in_progress', labelDefault: 'In progress' },
  resolved: { color: '#22c55e', icon: FaCheckCircle, labelKey: 'feedback_status_resolved', labelDefault: 'Resolved' },
  archived: { color: '#94a3b8', icon: FaArchive, labelKey: 'feedback_status_archived', labelDefault: 'Archived' },
};
const normalizeStatus = (f) => {
  if (f.status && STATUSES[f.status]) return f.status;
  return f.isResolved ? 'resolved' : 'open'; // legacy docs
};

function StatBox({ value, label, color }) {
  return (
    <div style={{ flex: 1, minWidth: 78, background: 'var(--bg-card)', borderRadius: 14, padding: '12px 10px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: color || 'var(--text-main)', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

export default function BusinessFeedbackInbox() {
  const { t, i18n } = useTranslation();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('open');
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const functions = useMemo(() => getFunctions(app, 'us-central1'), []);

  const runInsights = async () => {
    if (insightsLoading) return;
    setInsightsLoading(true);
    try {
      const res = await httpsCallable(functions, 'generateFeedbackInsights')();
      const data = res?.data || {};
      if (!data.insights) {
        showToast(t('ai_insights_none', 'No open feedback to analyze yet.'), 'info');
      } else {
        setInsights(data.insights);
      }
    } catch (err) {
      console.error('insights', err);
      const code = String(err?.code || '');
      const msg = String(err?.message || '');
      if (code === 'functions/failed-precondition' && /INSUFFICIENT_CREDITS/.test(msg)) {
        showToast(t('ai_insufficient_credits', 'Not enough Dine Credits. Buy more in Settings.'), 'info');
        navigate('/settings/credits');
      } else {
        showToast(t('ai_error', 'AI analysis failed. Try again.'), 'error');
      }
    } finally {
      setInsightsLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(collection(db, 'business_feedback'), where('businessId', '==', currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => {
        const ta = (a.lastMessageAt || a.createdAt)?.toMillis?.() || 0;
        const tb = (b.lastMessageAt || b.createdAt)?.toMillis?.() || 0;
        return tb - ta;
      });
      setTickets(data);
      setLoading(false);
    }, (err) => { console.error('feedback load', err); setLoading(false); });
    return () => unsub();
  }, [currentUser?.uid]);

  // The dashboard inbox is the support desk — broadcast copies (offer/announcement)
  // the business sent to members are excluded here.
  const supportTickets = useMemo(
    () => tickets.filter((tk) => (tk.kind || 'support') === 'support'),
    [tickets]
  );

  const stats = useMemo(() => {
    let open = 0, inProgress = 0, resolved = 0, archived = 0, complaints = 0, suggestions = 0;
    let ratingSum = 0, ratingCount = 0;
    for (const f of supportTickets) {
      const s = normalizeStatus(f);
      if (s === 'open') open++;
      else if (s === 'in_progress') inProgress++;
      else if (s === 'resolved') resolved++;
      else if (s === 'archived') archived++;
      if (f.type === 'suggestion') suggestions++; else complaints++;
      if (Number.isFinite(f.rating) && f.rating > 0) { ratingSum += f.rating; ratingCount++; }
    }
    const total = supportTickets.length;
    const closed = resolved + archived;
    const resolutionRate = total ? Math.round((closed / total) * 100) : 0;
    const avgRating = ratingCount ? (ratingSum / ratingCount) : 0;
    return { total, open, inProgress, resolved, archived, complaints, suggestions, resolutionRate, avgRating, ratingCount };
  }, [supportTickets]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return supportTickets.filter((f) => {
      if (filterStatus !== 'all' && normalizeStatus(f) !== filterStatus) return false;
      if (filterType !== 'all' && (f.type || 'complaint') !== filterType) return false;
      if (term) {
        const hay = `${f.content || ''} ${f.userName || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [supportTickets, filterStatus, filterType, search]);

  const fmtDate = (ts) => {
    if (!ts?.toDate) return '';
    try { return ts.toDate().toLocaleString(i18n.language || undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch { return ts.toDate().toLocaleString(); }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, display: 'flex', justifyContent: 'center', color: 'var(--brand-primary)' }}>
        <FaSpinner className="spin" size={30} />
      </div>
    );
  }

  const statusFilters = ['open', 'in_progress', 'resolved', 'archived', 'all'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Analytics header */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <StatBox value={stats.open} label={t('feedback_status_open', 'Open')} color={STATUSES.open.color} />
        <StatBox value={stats.inProgress} label={t('feedback_status_in_progress', 'In progress')} color={STATUSES.in_progress.color} />
        <StatBox value={stats.resolved} label={t('feedback_status_resolved', 'Resolved')} color={STATUSES.resolved.color} />
        <StatBox value={`${stats.resolutionRate}%`} label={t('feedback_resolution_rate', 'Resolution')} color="var(--text-main)" />
        <StatBox
          value={stats.avgRating ? stats.avgRating.toFixed(1) : '—'}
          label={t('feedback_avg_rating', 'Avg rating')}
          color="var(--luxury-gold, #f5c518)"
        />
      </div>
      <div style={{ display: 'flex', gap: 10, fontSize: '0.8rem', color: 'var(--text-muted)', paddingInlineStart: 2 }}>
        <span><FaExclamationCircle style={{ color: '#ef4444' }} /> {stats.complaints} {t('complaints', 'Complaints')}</span>
        <span><FaLightbulb style={{ color: '#22c55e' }} /> {stats.suggestions} {t('suggestions', 'Suggestions')}</span>
      </div>

      {/* AI aggregate insights */}
      <button type="button" onClick={runInsights} disabled={insightsLoading} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 14px', borderRadius: 12,
        border: '1px solid var(--brand-primary)', background: 'transparent', color: 'var(--brand-primary)',
        fontWeight: 700, fontSize: '0.9rem', cursor: insightsLoading ? 'wait' : 'pointer'
      }}>
        {insightsLoading ? <FaSpinner className="spin" /> : <FaChartPie />}
        {t('ai_analyze_all', 'Analyze all feedback')} · {t('ai_credits_n', '{{n}} credits', { n: 15 })}
      </button>

      {insights && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText as="h4" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FaMagic style={{ color: 'var(--brand-primary)' }} /> {t('ai_insights_title', 'AI insights')}
            </AppText>
            <button type="button" onClick={() => setInsights(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><FaTimes /></button>
          </div>
          {insights.summary && <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{insights.summary}</div>}
          {Array.isArray(insights.topIssues) && insights.topIssues.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <AppText as="span" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>{t('ai_top_issues', 'Top issues')}</AppText>
              {insights.topIssues.map((it, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 10, borderRadius: 10, background: 'var(--bg-elevated)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: SEVERITY_COLOR[it.severity] || '#94a3b8', marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>{it.title}{Number.isFinite(it.count) ? ` · ${it.count}` : ''}</div>
                    {it.suggestion && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>{it.suggestion}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {Array.isArray(insights.positives) && insights.positives.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {insights.positives.map((p, i) => (
                <span key={i} style={{ fontSize: '0.76rem', color: '#22c55e', background: 'rgba(34,197,94,0.1)', borderRadius: 8, padding: '3px 8px' }}>👍 {p}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {statusFilters.map((s) => {
          const active = filterStatus === s;
          const label = s === 'all' ? t('all', 'All') : t(STATUSES[s].labelKey, STATUSES[s].labelDefault);
          return (
            <button key={s} type="button" onClick={() => setFilterStatus(s)} style={{
              padding: '7px 12px', borderRadius: 20, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${active ? (s === 'all' ? 'var(--brand-primary)' : STATUSES[s].color) : 'var(--border-color)'}`,
              background: active ? (s === 'all' ? 'var(--brand-primary)' : STATUSES[s].color) : 'transparent',
              color: active ? '#fff' : 'var(--text-secondary)',
            }}>{label}</button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{
          padding: '9px 12px', borderRadius: 12, border: '1px solid var(--border-color)',
          background: 'var(--bg-elevated)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600
        }}>
          <option value="all">{t('feedback_all_types', 'All types')}</option>
          <option value="complaint">{t('complaint', 'Complaint')}</option>
          <option value="suggestion">{t('suggestion', 'Suggestion')}</option>
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('feedback_search_ph', 'Search feedback…')}
          style={{
            flex: 1, padding: '9px 14px', borderRadius: 12, border: '1px solid var(--border-color)',
            background: 'var(--bg-elevated)', color: 'var(--text-main)', fontSize: '0.85rem', boxSizing: 'border-box'
          }} />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 16, border: '1px dashed var(--border-color)' }}>
          <div style={{ fontSize: '2.6rem', marginBottom: 12, opacity: 0.5 }}>📥</div>
          <AppText as="p" style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('feedback_empty_filtered', 'No feedback matches this filter.')}</AppText>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((item) => {
            const isSuggestion = item.type === 'suggestion';
            const s = normalizeStatus(item);
            const StatusIcon = STATUSES[s].icon;
            const snippet = (item.content || '').length > 64 ? item.content.slice(0, 64) + '…' : (item.content || '');
            return (
              <div key={item.id} onClick={() => setSelected(item)} style={{
                background: 'var(--bg-card)', borderRadius: 12,
                border: `1px solid ${isSuggestion ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                padding: 14, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', position: 'relative'
              }}>
                {item.unreadForBusiness && (
                  <FaCircle style={{ position: 'absolute', top: 10, insetInlineEnd: 10, fontSize: 8, color: 'var(--brand-primary)' }} />
                )}
                <UserAvatar user={{ photo_url: item.userAvatar, display_name: item.userName }} alt={item.userName} style={{ width: 44, height: 44, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <AppText as="span" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.userName || t('member', 'Member')}
                    </AppText>
                    <AppText as="span" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtDate(item.lastMessageAt || item.createdAt)}</AppText>
                  </div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ color: isSuggestion ? '#22c55e' : '#ef4444', marginInlineEnd: 6 }}>
                      {isSuggestion ? <FaLightbulb /> : <FaExclamationCircle />}
                    </span>
                    {snippet}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: STATUSES[s].color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <StatusIcon style={{ fontSize: 9 }} /> {t(STATUSES[s].labelKey, STATUSES[s].labelDefault)}
                    </span>
                    {Number.isFinite(item.rating) && item.rating > 0 && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--luxury-gold, #f5c518)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        <FaStar style={{ fontSize: 9 }} /> {item.rating}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <FeedbackDetailModal
          ticket={selected}
          functions={functions}
          onClose={() => setSelected(null)}
          showToast={showToast}
          t={t}
          i18n={i18n}
          currentUserId={currentUser?.uid}
        />
      )}
    </div>
  );
}

function FeedbackDetailModal({ ticket, functions, onClose, showToast, t, i18n, currentUserId }) {
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [status, setStatus] = useState(normalizeStatus(ticket));
  const threadEndRef = useRef(null);
  const navigate = useNavigate();
  const [ai, setAi] = useState({
    aiProcessed: !!ticket.aiProcessed,
    category: ticket.category || null,
    sentiment: ticket.sentiment || null,
    aiSummary: ticket.aiSummary || null,
    aiSuggestedReply: ticket.aiSuggestedReply || null,
  });
  const [analyzing, setAnalyzing] = useState(false);

  const analyze = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    try {
      const res = await httpsCallable(functions, 'analyzeFeedbackTicket')({ ticketId: ticket.id });
      const d = res?.data || {};
      setAi({ aiProcessed: true, category: d.category, sentiment: d.sentiment, aiSummary: d.aiSummary, aiSuggestedReply: d.aiSuggestedReply });
    } catch (err) {
      console.error('analyze', err);
      const code = String(err?.code || '');
      const msg = String(err?.message || '');
      if (code === 'functions/failed-precondition' && /INSUFFICIENT_CREDITS/.test(msg)) {
        showToast(t('ai_insufficient_credits', 'Not enough Dine Credits. Buy more in Settings.'), 'info');
        navigate('/settings/credits');
      } else {
        showToast(t('ai_error', 'AI analysis failed. Try again.'), 'error');
      }
    } finally {
      setAnalyzing(false);
    }
  };

  // Clear the business unread flag on open.
  useEffect(() => {
    if (ticket.unreadForBusiness) {
      updateDoc(doc(db, 'business_feedback', ticket.id), { unreadForBusiness: false }).catch(() => {});
    }
  }, [ticket.id, ticket.unreadForBusiness]);

  // Live thread.
  useEffect(() => {
    const q = query(collection(db, 'business_feedback', ticket.id, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('thread load', err));
    return () => unsub();
  }, [ticket.id]);

  useEffect(() => { threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const sendReply = async () => {
    const text = reply.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await httpsCallable(functions, 'replyToFeedback')({ ticketId: ticket.id, text });
      setReply('');
    } catch (err) {
      console.error('reply', err);
      const code = String(err?.code || '');
      showToast(code === 'functions/resource-exhausted'
        ? t('feedback_rate_limited', 'You are replying too fast. Please wait a moment.')
        : t('feedback_reply_error', 'Could not send the reply. Try again.'), 'error');
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (next) => {
    if (statusBusy || next === status) return;
    setStatusBusy(true);
    try {
      await httpsCallable(functions, 'setFeedbackStatus')({ ticketId: ticket.id, status: next });
      setStatus(next);
      showToast(t('feedback_status_updated', 'Status updated.'), 'success');
    } catch (err) {
      console.error('status', err);
      showToast(t('feedback_status_error', 'Could not update status.'), 'error');
    } finally {
      setStatusBusy(false);
    }
  };

  const isSuggestion = ticket.type === 'suggestion';
  const fmt = (ts) => {
    if (!ts?.toDate) return '';
    try { return ts.toDate().toLocaleString(i18n.language || undefined, { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', padding: 16 }} dir={i18n.dir()}>
      <div style={{ background: 'var(--bg-main)', borderRadius: 24, width: '100%', maxWidth: 520, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div style={{ padding: 16, borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <UserAvatar user={{ photo_url: ticket.userAvatar, display_name: ticket.userName }} alt={ticket.userName} style={{ width: 40, height: 40, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ticket.userName || t('member', 'Member')}</div>
              <div style={{ fontSize: '0.75rem', color: isSuggestion ? '#22c55e' : '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                {isSuggestion ? <FaLightbulb /> : <FaExclamationCircle />}
                {isSuggestion ? t('suggestion', 'Suggestion') : t('complaint', 'Complaint')}
                {Number.isFinite(ticket.rating) && ticket.rating > 0 && (
                  <span style={{ color: 'var(--luxury-gold, #f5c518)', marginInlineStart: 4 }}><FaStar style={{ fontSize: 10 }} /> {ticket.rating}</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg-elevated)', border: 'none', borderRadius: '50%', color: 'var(--text-main)', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <FaTimes />
          </button>
        </div>

        {/* Status workflow */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 6, flexWrap: 'wrap', background: 'var(--bg-elevated)' }}>
          {Object.keys(STATUSES).map((s) => {
            const active = status === s;
            const Icon = STATUSES[s].icon;
            return (
              <button key={s} type="button" disabled={statusBusy} onClick={() => changeStatus(s)} style={{
                padding: '6px 10px', borderRadius: 10, fontSize: '0.76rem', fontWeight: 700, cursor: statusBusy ? 'wait' : 'pointer',
                border: `1px solid ${active ? STATUSES[s].color : 'var(--border-color)'}`,
                background: active ? STATUSES[s].color : 'transparent',
                color: active ? '#fff' : 'var(--text-secondary)',
                display: 'inline-flex', alignItems: 'center', gap: 5
              }}>
                <Icon style={{ fontSize: 10 }} /> {t(STATUSES[s].labelKey, STATUSES[s].labelDefault)}
              </button>
            );
          })}
        </div>

        {/* AI analysis */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)' }}>
          {ai.aiProcessed ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--brand-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <FaMagic style={{ fontSize: 10 }} /> {t('ai_label', 'AI')}
                </span>
                {ai.category && (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', borderRadius: 8, padding: '2px 8px' }}>
                    {t(`feedback_cat_${ai.category}`, ai.category)}
                  </span>
                )}
                {ai.sentiment && SENTIMENT[ai.sentiment] && (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#fff', background: SENTIMENT[ai.sentiment].color, borderRadius: 8, padding: '2px 8px' }}>
                    {t(SENTIMENT[ai.sentiment].label, SENTIMENT[ai.sentiment].def)}
                  </span>
                )}
                <button type="button" onClick={analyze} disabled={analyzing} style={{ marginInlineStart: 'auto', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer' }}>
                  {analyzing ? <FaSpinner className="spin" /> : t('ai_reanalyze', 'Re-analyze')}
                </button>
              </div>
              {ai.aiSummary && <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{ai.aiSummary}</div>}
              {ai.aiSuggestedReply && (
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>{t('ai_suggested_reply', 'Suggested reply')}</div>
                  <div style={{ fontSize: '0.86rem', color: 'var(--text-main)', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{ai.aiSuggestedReply}</div>
                  <button type="button" onClick={() => setReply(ai.aiSuggestedReply)} style={{ marginTop: 8, background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                    {t('ai_use_reply', 'Use this reply')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button type="button" onClick={analyze} disabled={analyzing} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 14px', borderRadius: 12,
              border: '1px solid var(--brand-primary)', background: 'transparent', color: 'var(--brand-primary)', fontWeight: 700, fontSize: '0.86rem',
              cursor: analyzing ? 'wait' : 'pointer'
            }}>
              {analyzing ? <FaSpinner className="spin" /> : <FaMagic />}
              {t('ai_analyze_ticket', 'Analyze with AI')} · {t('ai_credits_n', '{{n}} credits', { n: 3 })}
            </button>
          )}
        </div>

        {/* Thread */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', flex: 1 }}>
          {ticket.phoneNumber && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'rgba(56,189,248,0.08)', borderRadius: 14 }}>
              <div style={{ width: 34, height: 34, background: 'rgba(56,189,248,0.15)', color: '#38bdf8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaPhoneAlt /></div>
              <a href={`tel:${ticket.phoneNumber}`} style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', textDecoration: 'none', letterSpacing: '0.5px' }}>{ticket.phoneNumber}</a>
            </div>
          )}
          {messages.map((m) => {
            const mine = m.senderRole === 'business';
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '78%', padding: '10px 14px', borderRadius: 16,
                  background: mine ? 'var(--brand-primary)' : 'var(--bg-elevated)',
                  color: mine ? '#fff' : 'var(--text-main)',
                  borderEndEndRadius: mine ? 4 : 16, borderEndStartRadius: mine ? 16 : 4,
                  fontSize: '0.92rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                }}>
                  {m.text}
                  <div style={{ fontSize: '0.62rem', opacity: 0.7, marginTop: 4, textAlign: 'end' }}>{fmt(m.createdAt)}</div>
                </div>
              </div>
            );
          })}
          <div ref={threadEndRef} />
        </div>

        {/* Reply box */}
        <div style={{ padding: 12, borderTop: '1px solid var(--border-color)', display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--bg-elevated)' }}>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
            placeholder={t('feedback_reply_ph', 'Write a reply…')}
            rows={1}
            style={{
              flex: 1, resize: 'none', maxHeight: 120, padding: '11px 14px', borderRadius: 14, border: '1px solid var(--border-color)',
              background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.92rem', fontFamily: 'inherit', boxSizing: 'border-box'
            }} />
          <button onClick={sendReply} disabled={sending || !reply.trim()} style={{
            width: 46, height: 46, borderRadius: '50%', border: 'none', flexShrink: 0,
            background: reply.trim() ? 'var(--brand-primary)' : 'var(--border-color)', color: '#fff',
            cursor: sending || !reply.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {sending ? <FaSpinner className="spin" /> : <FaPaperPlane />}
          </button>
        </div>
      </div>
    </div>
  );
}
