import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaUtensils, FaCheck, FaTimes, FaCrown } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useStageTrivia } from '../../hooks/useStageTrivia';
import { AppText } from '../base';
import './StageTriviaPanel.css';

const OPT_COLORS = ['#6366f1', '#e11d48', '#0ea5e9', '#f59e0b'];

/** Business Food Trivia on the Stage top panel. Chat stays live below. */
export default function StageTriviaPanel({ stageId, isHost, onGameActiveChange, launcherOpen = false, onCloseLauncher }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'ar').split('-')[0];
  const { userProfile, isBusiness } = useAuth();
  const { showToast } = useToast();
  const { game, start, submit, advance, end, close, generate } = useStageTrivia(stageId);

  // Tell the Stage layout when a game is running so it can replace the banner.
  useEffect(() => { onGameActiveChange?.(!!game); }, [game, onGameActiveChange]);
  // Close the launcher once a game actually starts.
  useEffect(() => { if (game && launcherOpen) onCloseLauncher?.(); }, [game, launcherOpen, onCloseLauncher]);

  const [busy, setBusy] = useState('');
  const [myPick, setMyPick] = useState(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [genOpen, setGenOpen] = useState(false);
  const [genTopic, setGenTopic] = useState('');
  const [genCount, setGenCount] = useState(5);
  const autoRef = useRef(-1);

  const canHost = isHost && isBusiness && String(userProfile?.subscriptionTier || 'free').toLowerCase() === 'paid';
  const round = game?.currentRound ?? -1;
  const roundStatus = game?.roundStatus;
  const status = game?.status;
  const question = round >= 0 && game?.questions ? game.questions[round] : null;
  const qText = (q) => q?.text?.[lang] || q?.text?.en || q?.text?.ar || '';
  const qOpts = (q) => q?.options?.[lang] || q?.options?.en || q?.options?.ar || [];

  useEffect(() => { setMyPick(null); }, [round, game?.id]);

  const endsMs = game?.roundEndsAt?.toMillis ? game.roundEndsAt.toMillis() : null;
  const durMs = game?.roundDurationMs || 15000;
  useEffect(() => {
    if (status !== 'active' || roundStatus !== 'answering' || !endsMs) return undefined;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, [status, roundStatus, endsMs]);
  const remainingMs = endsMs ? Math.max(0, endsMs - nowMs) : null;
  const remainingSec = remainingMs != null ? Math.ceil(remainingMs / 1000) : null;
  const timeUp = remainingMs != null && remainingMs <= 0;

  // Host auto-reveals at zero.
  useEffect(() => {
    if (canHost && status === 'active' && roundStatus === 'answering' && timeUp && autoRef.current !== round) {
      autoRef.current = round;
      advance().catch(() => {});
    }
  }, [canHost, status, roundStatus, timeUp, round, advance]);

  const wrap = (key, fn) => async (...a) => {
    setBusy(key);
    try { await fn(...a); }
    catch (e) { showToast(e?.message || t('admin_failed', 'Something went wrong.'), 'error'); }
    finally { setBusy(''); }
  };

  const pick = async (idx) => {
    if (timeUp || myPick !== null) return;
    setMyPick(idx);
    try { await submit(round, idx); }
    catch (e) { showToast(e?.message || t('trivia_answer_error', 'Could not submit.'), 'error'); setMyPick(null); }
  };

  const ranking = useMemo(() => {
    const p = game?.players || {};
    return Object.entries(p).map(([uid, v]) => ({ uid, ...v })).sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [game]);

  const doGenerate = async () => {
    setBusy('generate');
    try {
      const res = await generate(genTopic.trim(), genCount);
      showToast(t('trivia_generated', { defaultValue: 'Added {{n}} questions about your menu.', n: res?.created || 0 }), 'success');
      setGenOpen(false); setGenTopic('');
    } catch (e) { showToast(e?.message || t('admin_failed', 'Something went wrong.'), 'error'); }
    finally { setBusy(''); }
  };

  // --------- Idle: nothing takes space. A small launcher modal opens from the
  // host tools icon (non-hosts and closed launcher render nothing). ------------
  if (!game) {
    if (!canHost || !launcherOpen) return null;
    return (
      <div className="stage-trivia-launcher__overlay" onClick={() => onCloseLauncher?.()} dir={i18n.dir()}>
        <div className="stage-trivia-launcher" onClick={(e) => e.stopPropagation()}>
          <div className="stage-trivia-launcher__head">
            <span className="stage-trivia__badge"><FaUtensils /> {t('trivia_title', 'Food Trivia')}</span>
            <button type="button" className="stage-trivia-launcher__close" aria-label="close" onClick={() => onCloseLauncher?.()}><FaTimes /></button>
          </div>
          <button type="button" className="stage-trivia__start" disabled={busy === 'start'} onClick={wrap('start', () => start(8))}>
            <FaUtensils /> {t('trivia_start', 'Start Food Trivia')}
          </button>
          <button type="button" className="stage-trivia__genlink" onClick={() => setGenOpen((v) => !v)}>
            ✨ {t('trivia_generate_link', 'Generate questions about your menu (AI)')}
          </button>
          {genOpen ? (
            <div className="stage-trivia__gen">
              <textarea value={genTopic} onChange={(e) => setGenTopic(e.target.value)} rows={2}
                placeholder={t('trivia_generate_ph', 'Your cuisine / signature dishes, e.g. Lebanese grill: shish tawook, kibbeh, tabbouleh…')}
                className="stage-trivia__gen-input" />
              <div className="stage-trivia__gen-row">
                <select value={genCount} onChange={(e) => setGenCount(Number(e.target.value))} className="stage-trivia__gen-count">
                  {[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <button type="button" className="stage-trivia__gen-btn" disabled={busy === 'generate'} onClick={doGenerate}>
                  {busy === 'generate' ? t('trivia_generating', 'Generating…') : t('trivia_generate_do', 'Generate')}
                </button>
              </div>
            </div>
          ) : (
            <AppText as="span" className="stage-trivia__idle-hint">{t('trivia_idle_hint', 'A live food quiz for everyone in your Stage — included in your plan.')}</AppText>
          )}
        </div>
      </div>
    );
  }

  const reveal = game.reveal?.[round];
  const correctIndex = reveal?.correctIndex;

  return (
    <div className="stage-trivia" dir={i18n.dir()}>
      <div className="stage-trivia__head">
        <span className="stage-trivia__badge"><FaUtensils /> {t('trivia_title', 'Food Trivia')}</span>
        {status === 'active' ? <span className="stage-trivia__round">{round + 1}/{game.roundCount}</span> : null}
        {status === 'active' && roundStatus === 'answering' && remainingSec != null
          ? <span className={`stage-trivia__timer${remainingSec <= 3 ? ' danger' : ''}`}>⏱️ {remainingSec}</span> : null}
      </div>

      {status === 'finished' ? (
        <div className="stage-trivia__result">
          <div style={{ fontSize: '1.8rem' }}>🏆</div>
          <AppText as="div" className="stage-trivia__winner">{game.result?.winnerName || '—'}</AppText>
          <AppText as="div" className="stage-trivia__winner-score">{game.result?.winnerScore || 0} {t('trivia_points', 'pts')}</AppText>
          <div className="stage-trivia__board">
            {(game.result?.ranking || []).slice(0, 5).map((p, i) => (
              <div key={p.uid} className="stage-trivia__row">
                <span>{i === 0 ? <FaCrown color="#f59e0b" /> : i + 1}</span>
                <span className="stage-trivia__row-name">{p.name}</span>
                <b>{p.score}</b>
              </div>
            ))}
          </div>
          {canHost ? (
            <div className="stage-trivia__host">
              <button type="button" className="stage-trivia__hostbtn" disabled={busy === 'start'} onClick={wrap('start', () => start(8))}>{t('trivia_play_again', 'New game')}</button>
              <button type="button" className="stage-trivia__hostbtn stage-trivia__hostbtn--ghost" disabled={busy === 'close'} onClick={wrap('close', close)}>{t('trivia_close', 'Close')}</button>
            </div>
          ) : null}
        </div>
      ) : question ? (
        <>
          <AppText as="div" className="stage-trivia__q">{qText(question)}</AppText>
          <div className="stage-trivia__opts">
            {qOpts(question).map((opt, idx) => {
              const isCorrect = roundStatus === 'revealed' && idx === correctIndex;
              const isMineWrong = roundStatus === 'revealed' && myPick === idx && idx !== correctIndex;
              const selected = myPick === idx;
              const base = OPT_COLORS[idx % OPT_COLORS.length];
              let bg = 'var(--bg-elevated)';
              let col = 'var(--text-main)';
              if (roundStatus === 'revealed') {
                if (isCorrect) { bg = '#16a34a'; col = '#fff'; }
                else if (isMineWrong) { bg = '#ef4444'; col = '#fff'; }
              } else if (selected) { bg = base; col = '#fff'; }
              return (
                <button key={idx} type="button" className="stage-trivia__opt"
                  disabled={roundStatus === 'revealed' || timeUp || myPick !== null}
                  onClick={() => pick(idx)} style={{ background: bg, color: col, borderColor: selected ? base : 'var(--border-color)' }}>
                  <span className="stage-trivia__opt-badge" style={{ background: roundStatus === 'revealed' || selected ? 'rgba(255,255,255,0.25)' : base, color: '#fff' }}>
                    {isCorrect ? <FaCheck /> : isMineWrong ? <FaTimes /> : String.fromCharCode(65 + idx)}
                  </span>
                  <span className="stage-trivia__opt-text">{opt}</span>
                  {roundStatus === 'revealed' && reveal?.counts ? <span className="stage-trivia__opt-count">{reveal.counts[idx] || 0}</span> : null}
                </button>
              );
            })}
          </div>

          {roundStatus === 'answering' && remainingMs != null ? (
            <div className="stage-trivia__bar"><div style={{ width: `${(remainingMs / durMs) * 100}%`, background: remainingSec <= 3 ? '#ef4444' : 'linear-gradient(90deg,var(--primary),#f0a24b)' }} /></div>
          ) : null}

          {roundStatus === 'revealed' ? (
            <div className="stage-trivia__board stage-trivia__board--mini">
              {ranking.slice(0, 3).map((p, i) => (
                <div key={p.uid} className="stage-trivia__row"><span>{['🥇', '🥈', '🥉'][i]}</span><span className="stage-trivia__row-name">{p.name}</span><b>{p.score}</b></div>
              ))}
            </div>
          ) : null}

          {canHost ? (
            <div className="stage-trivia__host">
              {roundStatus === 'answering' ? (
                <button type="button" className="stage-trivia__hostbtn" disabled={busy === 'advance'} onClick={wrap('advance', advance)}>{t('trivia_reveal', 'Reveal')}</button>
              ) : (
                <button type="button" className="stage-trivia__hostbtn" disabled={busy === 'advance'} onClick={wrap('advance', advance)}>{round + 1 < game.roundCount ? t('trivia_next', 'Next') : t('trivia_finish', 'Results')}</button>
              )}
              <button type="button" className="stage-trivia__hostbtn stage-trivia__hostbtn--ghost" disabled={busy === 'end'} onClick={wrap('end', end)}>{t('trivia_end', 'End')}</button>
            </div>
          ) : (
            <AppText as="div" className="stage-trivia__hint">
              {roundStatus === 'revealed' ? '' : myPick !== null ? `✅ ${t('trivia_locked', 'Answer locked')}` : timeUp ? `⏱️ ${t('group_game_time_up', "Time's up!")}` : t('trivia_pick', 'Tap your answer!')}
            </AppText>
          )}
        </>
      ) : null}
    </div>
  );
}
