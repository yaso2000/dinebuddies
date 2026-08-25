import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCompatJourney } from '../hooks/useCompatJourney';
import { getSafeAvatar } from '../utils/avatarUtils';
import UserAvatar from '../components/UserAvatar';
import { AppText } from '../components/base';
import { FaArrowLeft, FaArrowRight, FaHeart, FaSpinner, FaLock, FaCheck, FaRedo } from 'react-icons/fa';

const LEVEL_TITLES = [
  ['compat_level_1', 'Icebreakers'],
  ['compat_level_2', 'Lifestyle'],
  ['compat_level_3', 'Values'],
  ['compat_level_4', 'Feelings'],
  ['compat_level_5', 'Depth & future'],
];

export default function CompatJourneyRoom() {
  const { otherUserId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { userProfile } = useAuth();
  const { showToast } = useToast();
  const { uid, journey, journeyLoading, questionsById, start, submit, fetchMyAnswers } = useCompatJourney(otherUserId);

  const [other, setOther] = useState(null);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [picks, setPicks] = useState({}); // qid -> option index (current level draft)
  const [myAnswers, setMyAnswers] = useState(null); // my submitted answers for currentLevel
  const [seenReveals, setSeenReveals] = useState(() => new Set());
  const [retrying, setRetrying] = useState(false);

  const lang = (i18n.language || 'ar').split('-')[0];
  const isRtl = i18n.dir() === 'rtl';
  const BackIcon = isRtl ? FaArrowRight : FaArrowLeft;

  const qText = (q) => q?.text?.[lang] || q?.text?.en || q?.text?.ar || '';
  const qOpts = (q) => q?.options?.[lang] || q?.options?.en || q?.options?.ar || [];

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getDoc(doc(db, 'users', otherUserId));
        if (alive && s.exists()) setOther({ id: s.id, ...s.data() });
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [otherUserId]);

  const currentLevel = journey?.currentLevel || 1;
  const perLevel = journey?.perLevel || {};

  // Re-read my answers whenever the active level changes.
  useEffect(() => {
    let alive = true;
    if (!journey) { setMyAnswers(null); return; }
    (async () => {
      const a = await fetchMyAnswers(currentLevel);
      if (alive) { setMyAnswers(a); setPicks(a || {}); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey?.id, currentLevel, journey?.status]);

  const levelQuestions = useMemo(() => {
    const ids = journey?.questionsByLevel?.[currentLevel] || [];
    return ids.map((id) => questionsById[id]).filter(Boolean);
  }, [journey, currentLevel, questionsById]);

  const meAvatar = getSafeAvatar(userProfile);
  const otherAvatar = getSafeAvatar(other || {});
  const otherName = other?.display_name || other?.displayName || t('member', 'Member');

  const handleStart = async () => {
    setStarting(true);
    try { await start(); } catch (e) { console.error(e); showToast(t('compat_start_error', 'Could not start. Try again.'), 'error'); }
    finally { setStarting(false); }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const answered = levelQuestions.filter((q) => Number.isInteger(picks[q.id]));
    if (answered.length < levelQuestions.length) {
      showToast(t('compat_answer_all', 'Answer all questions first.'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      await submit(currentLevel, picks);
      setRetrying(false);
      const a = await fetchMyAnswers(currentLevel);
      setMyAnswers(a);
    } catch (e) {
      console.error(e);
      showToast(t('compat_submit_error', 'Could not submit. Try again.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- render helpers ----------
  const Header = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
      <button onClick={() => navigate(-1)} aria-label={t('back', 'Back')} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '1.1rem', cursor: 'pointer', padding: 4 }}>
        <BackIcon />
      </button>
      <AppText as="h2" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
        {t('compat_title', 'Compatibility Journey')}
      </AppText>
    </div>
  );

  // Two avatars + central meter (the "panel" the chat already uses).
  const Panel = ({ compat }) => (
    <div dir="ltr" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, padding: '18px 12px 8px' }}>
      <div style={{ textAlign: 'center', width: 92 }}>
        <UserAvatar user={{ photo_url: otherAvatar, display_name: otherName }} alt={otherName} style={{ width: 64, height: 64 }} />
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{otherName}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 96, padding: '0 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ec4899' }}>
          <div style={{ height: 2, width: 22, background: 'linear-gradient(90deg, transparent, #ec4899)' }} />
          <FaHeart style={{ fontSize: compat != null ? 22 : 16, transition: 'font-size .3s', filter: compat != null ? 'drop-shadow(0 0 6px rgba(236,72,153,.6))' : 'none' }} />
          <div style={{ height: 2, width: 22, background: 'linear-gradient(90deg, #ec4899, transparent)' }} />
        </div>
        <div style={{ fontSize: compat != null ? '1.25rem' : '0.8rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
          {compat != null ? `${compat}%` : t('compat_lvl_of', 'Lvl {{n}}/5', { n: currentLevel })}
        </div>
      </div>
      <div style={{ textAlign: 'center', width: 92 }}>
        <UserAvatar user={{ photo_url: meAvatar, display_name: userProfile?.display_name }} alt={userProfile?.display_name || ''} style={{ width: 64, height: 64 }} />
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>{t('you', 'You')}</div>
      </div>
    </div>
  );

  const Ladder = () => (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '4px 0 14px' }}>
      {[1, 2, 3, 4, 5].map((l) => {
        const done = perLevel[l]?.passed;
        const active = l === currentLevel;
        const unlocked = l <= (journey?.unlockedLevel || 1);
        return (
          <div key={l} title={t(LEVEL_TITLES[l - 1][0], LEVEL_TITLES[l - 1][1])} style={{
            width: active ? 26 : 22, height: active ? 26 : 22, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800,
            background: done ? '#22c55e' : active ? '#ec4899' : unlocked ? 'var(--bg-elevated)' : 'var(--bg-elevated)',
            color: done || active ? '#fff' : 'var(--text-muted)',
            border: active ? '2px solid #ec4899' : '1px solid var(--border-color)',
          }}>
            {done ? <FaCheck style={{ fontSize: 10 }} /> : unlocked ? l : <FaLock style={{ fontSize: 9 }} />}
          </div>
        );
      })}
    </div>
  );

  // ---------- states ----------
  if (journeyLoading) {
    return (<div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)' }}><FaSpinner className="spin" size={28} /></div>);
  }

  const shell = (body) => (
    <div style={{ height: '100%', minHeight: 0, background: 'var(--bg-main)', display: 'flex', flexDirection: 'column' }} dir={i18n.dir()}>
      <Header />
      <div style={{ flex: 1, overflowY: 'auto' }}>{body}</div>
    </div>
  );

  // No journey yet → intro.
  if (!journey) {
    return shell(
      <div style={{ padding: 24, textAlign: 'center', maxWidth: 460, margin: '0 auto' }}>
        <Panel compat={null} />
        <div style={{ fontSize: '3rem', margin: '10px 0' }}>💗</div>
        <AppText as="h3" style={{ margin: '0 0 10px', color: 'var(--text-main)' }}>{t('compat_intro_title', 'How compatible are you?')}</AppText>
        <AppText as="p" style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px' }}>
          {t('compat_intro_body', '5 levels of questions, each deeper than the last. Answer together, reveal your answers, and unlock the next level as your compatibility grows.')}
        </AppText>
        <button onClick={handleStart} disabled={starting} style={{ padding: '14px 28px', borderRadius: 16, background: 'var(--brand-primary)', color: '#fff', border: 'none', fontWeight: 800, fontSize: '1.05rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {starting ? <FaSpinner className="spin" /> : <FaHeart />} {t('compat_start', 'Start the journey')}
        </button>
      </div>
    );
  }

  // Completed.
  if (journey.status === 'completed') {
    return shell(
      <div style={{ padding: 24, textAlign: 'center', maxWidth: 460, margin: '0 auto' }}>
        <Panel compat={journey.overallCompat} />
        <div style={{ fontSize: '3.4rem', margin: '10px 0' }}>🎉</div>
        <AppText as="h3" style={{ margin: '0 0 8px', color: 'var(--text-main)' }}>{t('compat_done_title', 'You reached the top together!')}</AppText>
        <AppText as="p" style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 8px' }}>
          {t('compat_done_body', 'Overall compatibility: {{n}}%. That is a strong signal — maybe it is time to meet.', { n: journey.overallCompat ?? 0 })}
        </AppText>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(34,197,94,0.12)', color: '#22c55e', borderRadius: 20, padding: '6px 14px', fontWeight: 800, marginTop: 8 }}>
          <FaCheck /> {t('compat_badge_deep_match', 'Deep Match')}
        </div>
        <div style={{ marginTop: 16, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {t('compat_invite_soon', 'Meeting invitation — coming next.')}
        </div>
      </div>
    );
  }

  // Determine what to show for the active flow.
  const failed = journey.status === 'level_failed';
  const failedReveal = failed && perLevel[currentLevel]?.reveal;
  const prevLevel = currentLevel - 1;
  const passedRevealPending = !failed && prevLevel >= 1 && perLevel[prevLevel]?.reveal && !seenReveals.has(prevLevel);

  const RevealView = ({ level, onNext, nextLabel, nextColor }) => {
    const data = perLevel[level] || {};
    const rv = data.reveal || {};
    const ids = journey?.questionsByLevel?.[level] || [];
    return (
      <div style={{ padding: '0 16px 24px', maxWidth: 520, margin: '0 auto' }}>
        <Panel compat={data.compatPct} />
        <Ladder />
        <div style={{ textAlign: 'center', marginBottom: 12, fontWeight: 800, color: data.passed ? '#22c55e' : '#ec4899' }}>
          {data.passed ? t('compat_passed', 'Compatible enough — level unlocked! ({{n}}%)', { n: data.compatPct })
            : t('compat_not_passed', 'You matched {{n}}% this round.', { n: data.compatPct })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ids.map((qid) => {
            const q = questionsById[qid];
            if (!q) return null;
            const opts = qOpts(q);
            const mineIdx = rv[qid]?.[uid];
            const otherIdx = rv[qid]?.[otherUserId];
            const match = mineIdx != null && mineIdx === otherIdx;
            return (
              <div key={qid} style={{ background: 'var(--bg-card)', border: `1px solid ${match ? 'rgba(34,197,94,0.4)' : 'var(--border-color)'}`, borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span>{qText(q)}</span>
                  <span>{match ? '🔥' : '🙂'}</span>
                </div>
                <div dir="ltr" style={{ display: 'flex', gap: 8, fontSize: '0.82rem' }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: '6px 4px', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                    {otherName}: <b style={{ color: 'var(--text-main)' }}>{opts[otherIdx] ?? '—'}</b>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', padding: '6px 4px', borderRadius: 8, background: match ? 'rgba(34,197,94,0.12)' : 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                    {t('you', 'You')}: <b style={{ color: 'var(--text-main)' }}>{opts[mineIdx] ?? '—'}</b>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={onNext} style={{ width: '100%', marginTop: 16, padding: 14, borderRadius: 16, background: nextColor, color: '#fff', border: 'none', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {nextLabel}
        </button>
      </div>
    );
  };

  if (failedReveal && !retrying) {
    return shell(<RevealView level={currentLevel} onNext={() => setRetrying(true)} nextLabel={<><FaRedo /> {t('compat_try_again', 'Try this level again')}</>} nextColor="#ec4899" />);
  }
  if (passedRevealPending) {
    return shell(<RevealView level={prevLevel} onNext={() => setSeenReveals((s) => new Set(s).add(prevLevel))} nextLabel={<>{t('compat_continue', 'Continue to level {{n}}', { n: currentLevel })} →</>} nextColor="#22c55e" />);
  }

  // Waiting for partner (I submitted, no reveal yet).
  if (myAnswers && !perLevel[currentLevel]?.reveal && !retrying) {
    return shell(
      <div style={{ padding: 24, textAlign: 'center', maxWidth: 460, margin: '0 auto' }}>
        <Panel compat={null} />
        <Ladder />
        <div style={{ fontSize: '2.6rem', margin: '10px 0' }}>⏳</div>
        <AppText as="h3" style={{ margin: '0 0 8px', color: 'var(--text-main)' }}>{t('compat_waiting_title', 'Answers locked in!')}</AppText>
        <AppText as="p" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t('compat_waiting_body', 'Waiting for {{name}} to finish this level. You will both see the results together.', { name: otherName })}
        </AppText>
      </div>
    );
  }

  // Answer the current level.
  const levelTitle = t(LEVEL_TITLES[currentLevel - 1][0], LEVEL_TITLES[currentLevel - 1][1]);
  const answeredCount = levelQuestions.filter((q) => Number.isInteger(picks[q.id])).length;
  return shell(
    <div style={{ padding: '0 16px 24px', maxWidth: 520, margin: '0 auto' }}>
      <Panel compat={null} />
      <Ladder />
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{t('compat_level_n', 'Level {{n}}', { n: currentLevel })} · {levelTitle}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('compat_pick_hint', 'Pick your answer for each')}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {levelQuestions.map((q) => {
          const opts = qOpts(q);
          return (
            <div key={q.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 10 }}>{qText(q)}</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {opts.map((opt, idx) => {
                  const selected = picks[q.id] === idx;
                  return (
                    <button key={idx} type="button" onClick={() => setPicks((p) => ({ ...p, [q.id]: idx }))} style={{
                      flex: 1, padding: '12px 10px', borderRadius: 12, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                      background: selected ? 'var(--brand-primary)' : 'var(--bg-elevated)',
                      color: selected ? '#fff' : 'var(--text-secondary)',
                      border: selected ? '2px solid var(--brand-primary)' : '2px solid transparent',
                    }}>{opt}</button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={handleSubmit} disabled={submitting || answeredCount < levelQuestions.length} style={{
        width: '100%', marginTop: 16, padding: 14, borderRadius: 16, border: 'none', fontWeight: 800, fontSize: '1.05rem',
        background: answeredCount >= levelQuestions.length ? 'var(--brand-primary)' : 'var(--border-color)', color: '#fff',
        cursor: submitting || answeredCount < levelQuestions.length ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        {submitting ? <FaSpinner className="spin" /> : <FaCheck />} {t('compat_lock_in', 'Lock in my answers')} ({answeredCount}/{levelQuestions.length})
      </button>
    </div>
  );
}
