import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
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
  const confirm = useConfirm();
  const { uid, journey, journeyLoading, questionsById, start, submit, reset } = useCompatJourney(otherUserId);

  const [other, setOther] = useState(null);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [picks, setPicks] = useState({}); // qid -> option index (draft for current level)
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
      try { const s = await getDoc(doc(db, 'users', otherUserId)); if (alive && s.exists()) setOther({ id: s.id, ...s.data() }); }
      catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [otherUserId]);

  const currentLevel = journey?.currentLevel || 1;
  const perLevel = journey?.perLevel || {};

  // Reset the answer draft whenever the level changes.
  useEffect(() => { setPicks({}); setRetrying(false); }, [currentLevel]);

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

  const handleReset = async () => {
    if (!(await confirm({ message: t('compat_reset_confirm', 'Restart from level 1? You both start over.'), tone: 'danger' }))) return;
    try { await reset(); setSeenReveals(new Set()); setPicks({}); setRetrying(false); }
    catch (e) { console.error(e); showToast(t('compat_submit_error', 'Could not submit. Try again.'), 'error'); }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const answered = levelQuestions.filter((q) => Number.isInteger(picks[q.id]));
    if (answered.length < levelQuestions.length) { showToast(t('compat_answer_all', 'Answer all questions first.'), 'error'); return; }
    setSubmitting(true);
    try { await submit(currentLevel, picks); setRetrying(false); }
    catch (e) { console.error(e); showToast(t('compat_submit_error', 'Could not submit. Try again.'), 'error'); }
    finally { setSubmitting(false); }
  };

  // ---------- header + reusable bits ----------
  const Header = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)', flexShrink: 0 }}>
      <button onClick={() => navigate(-1)} aria-label={t('back', 'Back')} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '1.1rem', cursor: 'pointer', padding: 4 }}>
        <BackIcon />
      </button>
      <AppText as="h2" style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', flex: 1 }}>{t('compat_title', 'Compatibility Journey')}</AppText>
      {journey ? (
        <button onClick={handleReset} aria-label={t('compat_restart', 'Restart')} title={t('compat_restart', 'Restart')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1rem', cursor: 'pointer', padding: 4 }}>
          <FaRedo />
        </button>
      ) : null}
    </div>
  );

  const Panel = ({ compat }) => (
    <div dir="ltr" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px 2px', flexShrink: 0 }}>
      <div style={{ textAlign: 'center', width: 80 }}>
        <UserAvatar user={{ photo_url: otherAvatar, display_name: otherName }} alt={otherName} style={{ width: 50, height: 50 }} />
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{otherName}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 84, padding: '0 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#ec4899' }}>
          <div style={{ height: 2, width: 18, background: 'linear-gradient(90deg, transparent, #ec4899)' }} />
          <FaHeart style={{ fontSize: compat != null ? 20 : 15, transition: 'font-size .3s', filter: compat != null ? 'drop-shadow(0 0 6px rgba(236,72,153,.6))' : 'none' }} />
          <div style={{ height: 2, width: 18, background: 'linear-gradient(90deg, #ec4899, transparent)' }} />
        </div>
        <div style={{ fontSize: compat != null ? '1.15rem' : '0.78rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
          {compat != null ? `${compat}%` : t('compat_lvl_of', 'Lvl {{n}}/5', { n: currentLevel })}
        </div>
      </div>
      <div style={{ textAlign: 'center', width: 80 }}>
        <UserAvatar user={{ photo_url: meAvatar, display_name: userProfile?.display_name }} alt={userProfile?.display_name || ''} style={{ width: 50, height: 50 }} />
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2 }}>{t('you', 'You')}</div>
      </div>
    </div>
  );

  const Ladder = () => (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 7, padding: '2px 0 8px', flexShrink: 0 }}>
      {[1, 2, 3, 4, 5].map((l) => {
        const done = perLevel[l]?.passed;
        const active = l === currentLevel;
        const unlocked = l <= (journey?.unlockedLevel || 1);
        return (
          <div key={l} title={t(LEVEL_TITLES[l - 1][0], LEVEL_TITLES[l - 1][1])} style={{
            width: active ? 22 : 18, height: active ? 22 : 18, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800,
            background: done ? '#22c55e' : active ? '#ec4899' : 'var(--bg-elevated)',
            color: done || active ? '#fff' : 'var(--text-muted)',
            border: active ? '2px solid #ec4899' : '1px solid var(--border-color)',
          }}>
            {done ? <FaCheck style={{ fontSize: 9 }} /> : unlocked ? l : <FaLock style={{ fontSize: 8 }} />}
          </div>
        );
      })}
    </div>
  );

  if (journeyLoading) {
    return (<div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)' }}><FaSpinner className="spin" size={28} /></div>);
  }

  const shell = (body) => (
    <div style={{ height: '100%', minHeight: 0, background: 'var(--bg-main)', display: 'flex', flexDirection: 'column' }} dir={i18n.dir()}>
      <Header />
      {body}
    </div>
  );

  // Intro.
  if (!journey) {
    return shell(
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, textAlign: 'center', maxWidth: 460, margin: '0 auto' }}>
        <Panel compat={null} />
        <div style={{ fontSize: '2.6rem', margin: '8px 0' }}>💗</div>
        <AppText as="h3" style={{ margin: '0 0 8px', color: 'var(--text-main)' }}>{t('compat_intro_title', 'How compatible are you?')}</AppText>
        <AppText as="p" style={{ color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 18px', fontSize: '0.9rem' }}>
          {t('compat_intro_body', '5 levels of questions, each deeper than the last. Answer together, reveal your answers, and unlock the next level as your compatibility grows.')}
        </AppText>
        <button onClick={handleStart} disabled={starting} style={{ padding: '12px 26px', borderRadius: 14, background: 'var(--brand-primary)', color: '#fff', border: 'none', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {starting ? <FaSpinner className="spin" /> : <FaHeart />} {t('compat_start', 'Start the journey')}
        </button>
      </div>
    );
  }

  // Completed.
  if (journey.status === 'completed') {
    return shell(
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, textAlign: 'center', maxWidth: 460, margin: '0 auto' }}>
        <Panel compat={journey.overallCompat} />
        <div style={{ fontSize: '3rem', margin: '8px 0' }}>🎉</div>
        <AppText as="h3" style={{ margin: '0 0 8px', color: 'var(--text-main)' }}>{t('compat_done_title', 'You reached the top together!')}</AppText>
        <AppText as="p" style={{ color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 8px', fontSize: '0.9rem' }}>
          {t('compat_done_body', 'Overall compatibility: {{n}}%. That is a strong signal — maybe it is time to meet.', { n: journey.overallCompat ?? 0 })}
        </AppText>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(34,197,94,0.12)', color: '#22c55e', borderRadius: 20, padding: '6px 14px', fontWeight: 800, marginTop: 6 }}>
          <FaCheck /> {t('compat_badge_deep_match', 'Deep Match')}
        </div>
        <div style={{ marginTop: 14, fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('compat_invite_soon', 'Meeting invitation — coming next.')}</div>
        <button onClick={handleReset} style={{ marginTop: 18, padding: '11px 22px', borderRadius: 14, background: 'var(--bg-elevated)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <FaRedo /> {t('compat_play_again', 'Play again')}
        </button>
      </div>
    );
  }

  // ---------- snapshot-driven phase detection (no fetched local answer state) ----------
  const partnerUid = otherUserId;
  const lvlData = perLevel[currentLevel] || {};
  const hasRevealCurrent = !!lvlData.reveal;
  const iAmWaiting = lvlData.pendingFor === partnerUid && !hasRevealCurrent; // I submitted, partner hasn't
  const failed = journey.status === 'level_failed';
  const failedReveal = failed && !!perLevel[currentLevel]?.reveal;
  const prevLevel = currentLevel - 1;
  const passedRevealPending = !failed && prevLevel >= 1 && perLevel[prevLevel]?.reveal && !seenReveals.has(prevLevel);

  const RevealView = ({ level, onNext, nextLabel, nextColor }) => {
    const data = perLevel[level] || {};
    const rv = data.reveal || {};
    const ids = journey?.questionsByLevel?.[level] || [];
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 20px', maxWidth: 520, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <Panel compat={data.compatPct} />
        <Ladder />
        <div style={{ textAlign: 'center', margin: '2px 0 10px', fontWeight: 800, fontSize: '0.9rem', color: data.passed ? '#22c55e' : '#ec4899' }}>
          {data.passed ? t('compat_passed', 'Compatible enough — level unlocked! ({{n}}%)', { n: data.compatPct })
            : t('compat_not_passed', 'You matched {{n}}% this round.', { n: data.compatPct })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ids.map((qid) => {
            const q = questionsById[qid]; if (!q) return null;
            const opts = qOpts(q);
            const mineIdx = rv[qid]?.[uid];
            const otherIdx = rv[qid]?.[otherUserId];
            const match = mineIdx != null && mineIdx === otherIdx;
            return (
              <div key={qid} style={{ background: 'var(--bg-card)', border: `1px solid ${match ? 'rgba(34,197,94,0.4)' : 'var(--border-color)'}`, borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 6, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span>{qText(q)}</span><span>{match ? '🔥' : '🙂'}</span>
                </div>
                <div dir="ltr" style={{ display: 'flex', gap: 6, fontSize: '0.78rem' }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: '5px 4px', borderRadius: 7, background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>{otherName}: <b style={{ color: 'var(--text-main)' }}>{opts[otherIdx] ?? '—'}</b></div>
                  <div style={{ flex: 1, textAlign: 'center', padding: '5px 4px', borderRadius: 7, background: match ? 'rgba(34,197,94,0.12)' : 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>{t('you', 'You')}: <b style={{ color: 'var(--text-main)' }}>{opts[mineIdx] ?? '—'}</b></div>
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={onNext} style={{ width: '100%', marginTop: 14, padding: 13, borderRadius: 14, background: nextColor, color: '#fff', border: 'none', fontWeight: 800, fontSize: '0.98rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>{nextLabel}</button>
      </div>
    );
  };

  if (failedReveal && !retrying) {
    return shell(<RevealView level={currentLevel} onNext={() => setRetrying(true)} nextLabel={<><FaRedo /> {t('compat_try_again', 'Try this level again')}</>} nextColor="#ec4899" />);
  }
  if (passedRevealPending) {
    return shell(<RevealView level={prevLevel} onNext={() => setSeenReveals((s) => new Set(s).add(prevLevel))} nextLabel={<>{t('compat_continue', 'Continue to level {{n}}', { n: currentLevel })} →</>} nextColor="#22c55e" />);
  }

  if (iAmWaiting && !retrying) {
    return shell(
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, textAlign: 'center', maxWidth: 460, margin: '0 auto' }}>
        <Panel compat={null} />
        <Ladder />
        <div style={{ fontSize: '2.4rem', margin: '8px 0' }}>⏳</div>
        <AppText as="h3" style={{ margin: '0 0 6px', color: 'var(--text-main)' }}>{t('compat_waiting_title', 'Answers locked in!')}</AppText>
        <AppText as="p" style={{ color: 'var(--text-secondary)', lineHeight: 1.55, fontSize: '0.9rem' }}>
          {t('compat_waiting_body', 'Waiting for {{name}} to finish this level. You will both see the results together.', { name: otherName })}
        </AppText>
      </div>
    );
  }

  // Answer the current level.
  const levelTitle = t(LEVEL_TITLES[currentLevel - 1][0], LEVEL_TITLES[currentLevel - 1][1]);
  const answeredCount = levelQuestions.filter((q) => Number.isInteger(picks[q.id])).length;
  const allAnswered = answeredCount >= levelQuestions.length && levelQuestions.length > 0;
  return shell(
    <>
      <Panel compat={null} />
      <Ladder />
      <div style={{ textAlign: 'center', margin: '0 0 8px', flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)' }}>{t('compat_level_n', 'Level {{n}}', { n: currentLevel })} · {levelTitle}</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px', maxWidth: 520, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {levelQuestions.map((q) => {
            const opts = qOpts(q);
            return (
              <div key={q.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '9px 10px' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 7 }}>{qText(q)}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {opts.map((opt, idx) => {
                    const selected = picks[q.id] === idx;
                    return (
                      <button key={idx} type="button" onClick={() => setPicks((p) => ({ ...p, [q.id]: idx }))} style={{
                        flex: 1, padding: '8px 8px', borderRadius: 10, fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer',
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
      </div>
      <div style={{ padding: '8px 14px', flexShrink: 0, maxWidth: 520, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <button onClick={handleSubmit} disabled={submitting || !allAnswered} style={{
          width: '100%', padding: 12, borderRadius: 14, border: 'none', fontWeight: 800, fontSize: '1rem',
          background: allAnswered ? 'var(--brand-primary)' : 'var(--border-color)', color: '#fff',
          cursor: submitting || !allAnswered ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {submitting ? <FaSpinner className="spin" /> : <FaCheck />} {t('compat_lock_in', 'Lock in my answers')} ({answeredCount}/{levelQuestions.length})
        </button>
      </div>
    </>
  );
}
