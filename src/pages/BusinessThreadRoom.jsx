import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection, query, orderBy } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { db } from '../firebase/config';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { FaArrowLeft, FaArrowRight, FaPaperPlane, FaSpinner, FaExclamationCircle, FaLightbulb, FaTag, FaBullhorn } from 'react-icons/fa';
import UserAvatar from '../components/UserAvatar';
import { attachChatShellToVisualViewport, preventComposerControlBlur } from '../utils/chatVisualViewportLock';

const STATUS_COLOR = { open: '#f59e0b', in_progress: '#3b82f6', resolved: '#22c55e', archived: '#94a3b8' };
const statusOf = (tk) => (tk?.status && STATUS_COLOR[tk.status] ? tk.status : (tk?.isResolved ? 'resolved' : 'open'));

export default function BusinessThreadRoom() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [ticket, setTicket] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const containerRef = useRef(null);
  const isRtl = i18n.dir() === 'rtl';

  const functions = useMemo(() => getFunctions(app, 'us-central1'), []);

  // Pin the shell above the on-screen keyboard — same mechanism the normal chat
  // uses; relies on the chat-root/chat-container/message-input class names below.
  useEffect(() => {
    const { detach } = attachChatShellToVisualViewport(() => containerRef.current, {
      onViewportChange: () => endRef.current?.scrollIntoView({ block: 'end' }),
    });
    return detach;
  }, []);

  useEffect(() => {
    if (!ticketId) return;
    const unsub = onSnapshot(doc(db, 'business_feedback', ticketId), (snap) => {
      if (!snap.exists()) { setNotFound(true); return; }
      setTicket({ id: snap.id, ...snap.data() });
    }, (err) => { console.error('thread', err); setNotFound(true); });
    return () => unsub();
  }, [ticketId]);

  useEffect(() => {
    if (!ticketId) return;
    const q = query(collection(db, 'business_feedback', ticketId, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), (err) => console.error('msgs', err));
    return () => unsub();
  }, [ticketId]);

  // Clear the user's unread flag on open.
  useEffect(() => {
    if (ticket?.id && ticket.unreadForUser && ticket.userId === currentUser?.uid) {
      updateDoc(doc(db, 'business_feedback', ticket.id), { unreadForUser: false }).catch(() => {});
    }
  }, [ticket?.id, ticket?.unreadForUser, ticket?.userId, currentUser?.uid]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const send = async () => {
    const text = reply.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await httpsCallable(functions, 'replyToFeedback')({ ticketId, text });
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

  const fmt = (ts) => {
    if (!ts?.toDate) return '';
    try { return ts.toDate().toLocaleString(i18n.language || undefined, { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const BackIcon = isRtl ? FaArrowRight : FaArrowLeft;
  const s = statusOf(ticket);
  const isSuggestion = ticket?.type === 'suggestion';
  const kind = ticket?.kind || 'support';
  const meta = kind === 'offer'
    ? { Icon: FaTag, color: '#f59e0b', label: t('broadcast_kind_offer', 'Offer') }
    : kind === 'announcement'
      ? { Icon: FaBullhorn, color: '#3b82f6', label: t('broadcast_kind_announcement', 'Announcement') }
      : { Icon: isSuggestion ? FaLightbulb : FaExclamationCircle, color: isSuggestion ? '#22c55e' : '#ef4444', label: isSuggestion ? t('suggestion', 'Suggestion') : t('complaint', 'Complaint') };
  const isSupport = kind === 'support';

  return (
    <div ref={containerRef} className="chat-root chat-container" dir={i18n.dir()} style={{ background: 'var(--bg-main)' }}>
      {/* Header */}
      <header className="chat-header" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
        <button onClick={() => navigate(-1)} aria-label={t('back', 'Back')} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '1.1rem', cursor: 'pointer', padding: 4 }}>
          <BackIcon />
        </button>
        <UserAvatar user={{ photo_url: ticket?.businessAvatar, display_name: ticket?.businessName }} alt={ticket?.businessName} style={{ width: 40, height: 40, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {ticket?.businessName || t('business', 'Business')}
          </div>
          <div style={{ fontSize: '0.75rem', color: meta.color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
            <meta.Icon />
            {meta.label}
            {ticket && isSupport && <span style={{ color: STATUS_COLOR[s], marginInlineStart: 6 }}>· {t(`feedback_status_${s}`, s)}</span>}
          </div>
        </div>
      </header>

      <div className="chat-body-column">
        {/* Thread */}
        <div className="messages-area" style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ticket?.image && !notFound && (
            <img src={ticket.image} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 14, marginBottom: 4 }} />
          )}
          {notFound ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>{t('feedback_thread_gone', 'This conversation is no longer available.')}</div>
          ) : (
            messages.map((m) => {
              const mine = m.senderRole === 'user';
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '78%', padding: '10px 14px', borderRadius: 16,
                    background: mine ? 'var(--brand-primary)' : 'var(--bg-elevated)',
                    color: mine ? '#fff' : 'var(--text-main)',
                    fontSize: '0.94rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                  }}>
                    {m.text}
                    <div style={{ fontSize: '0.62rem', opacity: 0.7, marginTop: 4, textAlign: 'end' }}>{fmt(m.createdAt)}</div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        {/* Reply box */}
        {!notFound && (
          <div className="input-area" style={{ flexShrink: 0, display: 'flex', gap: 8, alignItems: 'flex-end', paddingInline: 12, paddingTop: 12, paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
            <textarea
              className="message-input"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={t('feedback_reply_ph', 'Write a reply…')}
              rows={1}
              style={{
                flex: 1, resize: 'none', maxHeight: 120, padding: '11px 14px', borderRadius: 14, border: '1px solid var(--border-color)',
                background: 'var(--bg-elevated)', color: 'var(--text-main)', fontSize: '0.94rem', fontFamily: 'inherit', boxSizing: 'border-box'
              }} />
            <button onClick={send} onMouseDown={preventComposerControlBlur} disabled={sending || !reply.trim()} aria-label={t('send', 'Send')} style={{
              width: 46, height: 46, borderRadius: '50%', border: 'none', flexShrink: 0,
              background: reply.trim() ? 'var(--brand-primary)' : 'var(--border-color)', color: '#fff',
              cursor: sending || !reply.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {sending ? <FaSpinner className="spin" /> : <FaPaperPlane />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
