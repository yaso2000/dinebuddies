import React, { useEffect, useRef, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useTranslation } from 'react-i18next';
import { FaPaperPlane, FaRobot, FaHeadset, FaSpinner } from 'react-icons/fa';
import app from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { goToLogin } from '../../utils/goToLogin';
import { AppText } from '../base';

const functions = getFunctions(app, 'us-central1');

/**
 * AI customer-service chat. Free for the consumer (rate-limited server-side).
 * Answers grounded in the DineBuddies knowledge base; a "Talk to a human"
 * button opens a support ticket with the transcript attached.
 */
export default function SupportAgentChat() {
  const { t, i18n } = useTranslation();
  const { currentUser, isGuest } = useAuth();
  const { showToast } = useToast();
  const locale = (i18n.language || 'en').slice(0, 5);

  const [messages, setMessages] = useState([]); // {role:'user'|'assistant', text}
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const requireAuth = () => {
    if (isGuest || !currentUser) {
      goToLogin();
      return false;
    }
    return true;
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    if (!requireAuth()) return;

    const history = messages.slice(-10);
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setSending(true);
    try {
      const call = httpsCallable(functions, 'askSupportAgent');
      const res = await call({ message: text, history, locale });
      const reply = res?.data?.reply || '';
      setMessages((prev) => [...prev, { role: 'assistant', text: reply || t('support_ai_empty', 'Sorry, please try again.') }]);
    } catch (e) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        text: t('support_ai_error', 'I could not answer right now. You can tap "Talk to a human" below.'),
      }]);
    } finally {
      setSending(false);
    }
  };

  const talkToHuman = async () => {
    if (!requireAuth()) return;
    if (escalating || escalated) return;
    // Use the whole conversation; require at least one message.
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) {
      showToast(t('support_ask_first', 'Type your question first, then talk to a human.'), 'info');
      return;
    }
    setEscalating(true);
    try {
      const call = httpsCallable(functions, 'escalateSupport');
      await call({ message: lastUser.text, transcript: messages.slice(-20), locale });
      setEscalated(true);
      setMessages((prev) => [...prev, {
        role: 'assistant',
        system: true,
        text: t('support_escalated', 'Your request was sent to our team. We\'ll reply here and by notification.'),
      }]);
      showToast(t('support_escalated_toast', 'Sent to our support team.'), 'success');
    } catch (e) {
      showToast(e?.message || t('support_escalate_error', 'Could not send. Please try again.'), 'error');
    } finally {
      setEscalating(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16,
      overflow: 'hidden', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column',
    }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.9rem 1.1rem', background: 'var(--primary)' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FaRobot color="#fff" size={18} />
        </div>
        <div>
          <AppText as="div" style={{ color: '#fff', fontWeight: 800, fontSize: '0.98rem' }}>
            {t('support_ai_title', 'Ask DineBuddies Assistant')}
          </AppText>
          <AppText as="div" style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.75rem' }}>
            {t('support_ai_subtitle', 'Instant answers · free · in your language')}
          </AppText>
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} style={{ padding: '1rem', minHeight: 120, maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 ? (
          <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', margin: 'auto 0' }}>
            {t('support_ai_placeholder', 'Ask me anything about DineBuddies — invitations, the feed, communities, credits, your account…')}
          </AppText>
        ) : messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            background: m.system ? 'var(--hover-overlay)' : m.role === 'user' ? 'var(--primary)' : 'var(--bg-elevated)',
            color: m.role === 'user' ? '#fff' : 'var(--text-main)',
            border: m.role === 'user' ? 'none' : '1px solid var(--border-color)',
            borderRadius: 14, padding: '0.6rem 0.85rem', fontSize: '0.92rem', lineHeight: 1.5, whiteSpace: 'pre-wrap',
          }}>
            {m.text}
          </div>
        ))}
        {sending ? (
          <div style={{ alignSelf: 'flex-start', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
            <FaSpinner className="fa-spin" /> {t('support_ai_thinking', 'Thinking…')}
          </div>
        ) : null}
      </div>

      {/* input */}
      <div style={{ display: 'flex', gap: 8, padding: '0.75rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-elevated)' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={t('support_ai_input', 'Type your question…')}
          style={{ flex: 1, resize: 'none', border: '1px solid var(--border-color)', borderRadius: 12, padding: '0.6rem 0.8rem', background: 'var(--bg-card)', color: 'var(--text-main)', fontFamily: 'inherit', fontSize: '0.92rem', maxHeight: 120 }}
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !input.trim()}
          aria-label={t('send', 'Send')}
          style={{ background: 'var(--primary)', border: 'none', borderRadius: 12, width: 46, color: '#fff', cursor: sending || !input.trim() ? 'default' : 'pointer', opacity: sending || !input.trim() ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <FaPaperPlane />
        </button>
      </div>

      {/* escalate */}
      <button
        type="button"
        onClick={talkToHuman}
        disabled={escalating || escalated}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '0.7rem', background: 'transparent', border: 'none', borderTop: '1px solid var(--border-color)', color: escalated ? 'var(--text-muted)' : 'var(--primary)', fontWeight: 700, fontSize: '0.88rem', cursor: escalated ? 'default' : 'pointer' }}
      >
        <FaHeadset />
        {escalated
          ? t('support_human_sent', 'Sent to our team')
          : escalating
            ? t('support_human_sending', 'Sending…')
            : t('support_human', 'Talk to a human')}
      </button>
    </div>
  );
}
