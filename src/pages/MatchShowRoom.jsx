import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaHeart, FaHeartBroken, FaMicrophone, FaStop, FaPlay, FaSignOutAlt, FaCopy, FaShareAlt, FaTimes } from 'react-icons/fa';
import { useMatchShow } from '../hooks/useMatchShow';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { goToLogin } from '../utils/goToLogin';
import { startRecording, uploadVoiceMessage, formatDuration } from '../utils/mediaUtils';
import { AppText } from '../components/base';
import '../styles/gameUI.css';

const MAX_WORDS = 40;
const MAX_SEC = 60;

function Photo({ src, name, size = 120 }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  return src
    ? <img src={src} alt="" style={{ width: size, height: size, borderRadius: 18, objectFit: 'cover' }} />
    : <div style={{ width: size, height: size, borderRadius: 18, background: 'linear-gradient(135deg,var(--primary),#f0a24b)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: size * 0.4 }}>{initial}</div>;
}

function Intro({ intro, t }) {
  if (!intro) return null;
  if (intro.type === 'voice' && intro.voiceUrl) {
    return <audio src={intro.voiceUrl} controls style={{ width: '100%', height: 34, marginTop: 6 }} />;
  }
  if (intro.type === 'text' && intro.text) {
    return <AppText as="p" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.4 }}>“{intro.text}”</AppText>;
  }
  return null;
}

export default function MatchShowRoom() {
  const { showId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { currentUser, isGuest } = useAuth();
  const { showToast } = useToast();
  const { show, queue, loading, uid, isHost, myApplication, pair, onStage, apply, withdraw, selectPair, vote, reveal, nextPair, end } = useMatchShow(showId);

  const [busy, setBusy] = useState('');
  const [myVote, setMyVote] = useState(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [tab, setTab] = useState('voice');
  const [introText, setIntroText] = useState('');
  const [voice, setVoice] = useState(null); // { blob, seconds }
  const [recording, setRecording] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const [pickA, setPickA] = useState(null);
  const recRef = useRef(null);
  const recTimer = useRef(null);

  const pairId = pair?.pairId;
  useEffect(() => { setMyVote(null); }, [pairId]);

  const requireAuth = () => { if (isGuest || !currentUser) { goToLogin(); return false; } return true; };
  const wrap = (key, fn) => async (...a) => {
    setBusy(key);
    try { await fn(...a); }
    catch (e) { showToast(e?.message || t('admin_failed', 'Something went wrong.'), 'error'); }
    finally { setBusy(''); }
  };

  const doVote = async (v) => {
    if (!requireAuth() || onStage) return;
    setMyVote(v);
    try { await vote(v); }
    catch (e) { showToast(e?.message || t('admin_failed', 'Something went wrong.'), 'error'); setMyVote(null); }
  };

  // ---- Voice recording ----
  const startRec = async () => {
    try {
      const rec = await startRecording();
      recRef.current = rec;
      setRecording(true); setRecSec(0);
      recTimer.current = setInterval(() => setRecSec((s) => {
        if (s + 1 >= MAX_SEC) { stopRec(); return MAX_SEC; }
        return s + 1;
      }), 1000);
    } catch { showToast(t('match_mic_denied', 'Microphone access is needed.'), 'error'); }
  };
  const stopRec = async () => {
    if (recTimer.current) { clearInterval(recTimer.current); recTimer.current = null; }
    setRecording(false);
    try {
      const blob = await recRef.current?.stop();
      if (blob) setVoice({ blob, seconds: recSec || 1 });
    } catch { /* ignore */ }
  };

  const submitApply = async () => {
    if (!requireAuth()) return;
    setBusy('apply');
    try {
      if (tab === 'voice') {
        if (!voice) { showToast(t('match_record_first', 'Record your intro first.'), 'info'); setBusy(''); return; }
        const url = await uploadVoiceMessage(voice.blob, uid);
        await apply({ introType: 'voice', introVoiceUrl: url, introVoiceDuration: voice.seconds });
      } else {
        const words = introText.trim().split(/\s+/).filter(Boolean);
        if (!words.length) { showToast(t('match_write_first', 'Write a short intro.'), 'info'); setBusy(''); return; }
        if (words.length > MAX_WORDS) { showToast(t('match_too_long', { defaultValue: 'Keep it under {{n}} words.', n: MAX_WORDS }), 'info'); setBusy(''); return; }
        await apply({ introType: 'text', introText: introText.trim() });
      }
      showToast(t('match_applied', "You're in the queue!"), 'success');
      setApplyOpen(false); setVoice(null); setIntroText('');
    } catch (e) { showToast(e?.message || t('admin_failed', 'Something went wrong.'), 'error'); }
    finally { setBusy(''); }
  };

  const copyCode = async () => { try { await navigator.clipboard.writeText(show?.joinCode || ''); showToast(t('group_game_code_copied', 'Code copied.'), 'success'); } catch { /* ignore */ } };
  const doShare = async () => {
    const url = `${window.location.origin}/match-show/${showId}`;
    try { if (navigator.share) { await navigator.share({ title: 'DineBuddies', url }); return; } await navigator.clipboard.writeText(url); showToast(t('group_game_link_copied', 'Link copied.'), 'success'); } catch { /* ignore */ }
  };

  const pickForSelect = (aUid) => {
    if (pickA === aUid) { setPickA(null); return; }
    if (!pickA) { setPickA(aUid); return; }
    wrap('select', () => selectPair(pickA, aUid))();
    setPickA(null);
  };

  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: 'var(--bg-main)' }}><div className="db-spin" /></div>;
  if (!show) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: 'var(--bg-main)', padding: 24, textAlign: 'center' }} dir={i18n.dir()}>
        <div><div style={{ fontSize: '2.4rem' }}>💔</div>
          <AppText as="p" style={{ color: 'var(--text-muted)', margin: '10px 0 16px' }}>{t('match_not_found', 'This show is not available.')}</AppText>
          <button className="gg-btn gg-btn--soft" onClick={() => navigate('/posts-feed')}>{t('close', 'Close')}</button>
        </div>
      </div>
    );
  }

  const ended = show.status === 'ended';
  const revealData = show.pairStatus === 'revealed' ? show.reveal : null;

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(1000px 500px at 50% -10%, rgba(232,110,46,0.16), transparent 60%), var(--bg-main)', paddingBottom: 24 }} dir={i18n.dir()}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--border-color)', background: 'color-mix(in srgb, var(--bg-card) 88%, transparent)', position: 'sticky', top: 0, zIndex: 10 }}>
        <AppText as="div" style={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>💘 {t('match_title', 'Match or Not?')}</AppText>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button type="button" onClick={copyCode} className="gg-code" title={t('group_game_code', 'Join code')}>{show.joinCode}<FaCopy size={12} style={{ opacity: 0.6 }} /></button>
          <button type="button" onClick={doShare} className="gg-icon" aria-label="share"><FaShareAlt /></button>
          <button type="button" onClick={() => navigate('/posts-feed')} className="gg-icon" aria-label="leave"><FaSignOutAlt /></button>
        </div>
      </div>

      <div style={{ maxWidth: 620, margin: '0 auto', padding: 16 }}>
        {ended ? (
          <div className="gg-card" style={{ padding: 20, textAlign: 'center' }}>🎬 {t('match_ended', 'The show has ended.')}</div>
        ) : (
          <>
            {/* ---------------- STAGE ---------------- */}
            {pair ? (
              <div className="gg-card" style={{ padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'start' }}>
                  {[pair.a, pair.b].map((c, i) => (
                    <React.Fragment key={c.uid}>
                      {i === 1 ? <div style={{ alignSelf: 'center', fontSize: '1.6rem' }}>❤️</div> : null}
                      <div style={{ textAlign: 'center', minWidth: 0 }}>
                        <Photo src={c.avatar} name={c.name} />
                        <AppText as="div" style={{ fontWeight: 800, marginTop: 6 }}>{c.name}</AppText>
                        <Intro intro={c.intro} t={t} />
                      </div>
                    </React.Fragment>
                  ))}
                </div>

                {revealData ? (
                  <div style={{ textAlign: 'center', marginTop: 14 }}>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: revealData.isMatch ? '#16a34a' : '#ef4444' }}>{revealData.pct}%</div>
                    <AppText as="div" style={{ fontWeight: 800, color: revealData.isMatch ? '#16a34a' : '#ef4444' }}>
                      {revealData.isMatch ? `💚 ${t('match_yes', "It's a match!")}` : `💔 ${t('match_no', 'Not a match')}`}
                    </AppText>
                    <AppText as="div" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>❤️ {revealData.yes} · 💔 {revealData.no}</AppText>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="gg-card" style={{ padding: 18, textAlign: 'center', marginBottom: 16, color: 'var(--text-muted)' }}>
                🎤 {isHost ? t('match_host_pick_hint', 'Pick two applicants below to bring them on stage.') : t('match_wait_hint', 'Waiting for the host to bring up a pair…')}
              </div>
            )}

            {/* ---------------- VOTING (viewers) ---------------- */}
            {pair && show.pairStatus === 'voting' && !onStage ? (
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <button type="button" onClick={() => doVote('match')} className="gg-btn gg-btn--block" style={{ background: myVote === 'match' ? '#16a34a' : 'var(--bg-elevated)', color: myVote === 'match' ? '#fff' : 'var(--text-main)', border: '2px solid #16a34a' }}>
                  <FaHeart /> {t('match_vote_yes', 'Match')}
                </button>
                <button type="button" onClick={() => doVote('no')} className="gg-btn gg-btn--block" style={{ background: myVote === 'no' ? '#ef4444' : 'var(--bg-elevated)', color: myVote === 'no' ? '#fff' : 'var(--text-main)', border: '2px solid #ef4444' }}>
                  <FaHeartBroken /> {t('match_vote_no', 'Not')}
                </button>
              </div>
            ) : null}
            {onStage && show.pairStatus === 'voting' ? (
              <div className="gg-card" style={{ padding: 12, textAlign: 'center', marginBottom: 16, color: 'var(--primary)', fontWeight: 700 }}>✨ {t('match_you_on_stage', "You're on stage — the room is voting!")}</div>
            ) : null}

            {/* ---------------- HOST CONTROLS ---------------- */}
            {isHost ? (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {show.pairStatus === 'voting' ? (
                  <button type="button" className="gg-btn gg-btn--primary gg-btn--block" disabled={busy === 'reveal'} onClick={wrap('reveal', reveal)}>👁️ {t('match_reveal', 'Reveal result')}</button>
                ) : show.pairStatus === 'revealed' ? (
                  <button type="button" className="gg-btn gg-btn--primary gg-btn--block" disabled={busy === 'next'} onClick={wrap('next', nextPair)}>➡️ {t('match_next', 'Next pair')}</button>
                ) : null}
                <button type="button" className="gg-btn gg-btn--soft" disabled={busy === 'end'} onClick={wrap('end', end)}>{t('match_end', 'End')}</button>
              </div>
            ) : null}

            {/* ---------------- APPLY (viewers) ---------------- */}
            {!isHost ? (
              myApplication ? (
                myApplication.status === 'queued' ? (
                  <div className="gg-card" style={{ padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <AppText as="span" style={{ color: '#16a34a', fontWeight: 700 }}>✅ {t('match_in_queue', "You're in the queue.")}</AppText>
                    <button type="button" className="gg-textbtn gg-textbtn--danger" style={{ width: 'auto', margin: 0 }} onClick={wrap('withdraw', withdraw)}>{t('match_withdraw', 'Withdraw')}</button>
                  </div>
                ) : null
              ) : (
                <button type="button" className="gg-btn gg-btn--primary gg-btn--block" style={{ marginBottom: 16 }} onClick={() => (requireAuth() && setApplyOpen(true))}>
                  🙋 {t('match_apply', 'Apply to appear')}
                </button>
              )
            ) : null}

            {/* ---------------- QUEUE (host picks) ---------------- */}
            {isHost && !pair ? (
              <>
                <AppText as="div" style={{ fontWeight: 800, marginBottom: 8 }}>{t('match_queue', 'Applicants')} · {queue.length}</AppText>
                {queue.length === 0 ? <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t('match_queue_empty', 'No applicants yet — share the show.')}</AppText> : null}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {queue.map((a) => (
                    <button key={a.uid} type="button" onClick={() => pickForSelect(a.uid)} disabled={busy === 'select'}
                      className="gg-card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', textAlign: 'start', border: pickA === a.uid ? '2px solid var(--primary)' : '1px solid var(--border-color)' }}>
                      <Photo src={a.avatar} name={a.name} size={44} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <AppText as="div" style={{ fontWeight: 700 }}>{a.name} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>· {a.gender === 'male' ? '♂' : '♀'}</span></AppText>
                        <Intro intro={a.intro} t={t} />
                      </span>
                      {pickA === a.uid ? <span style={{ color: 'var(--primary)', fontWeight: 800 }}>1️⃣</span> : null}
                    </button>
                  ))}
                </div>
                {pickA ? <AppText as="p" style={{ color: 'var(--primary)', fontSize: '0.82rem', marginTop: 8 }}>{t('match_pick_second', 'Now pick the second person.')}</AppText> : null}
              </>
            ) : null}
          </>
        )}
      </div>

      {/* ---------------- APPLY MODAL ---------------- */}
      {applyOpen ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 16 }} onClick={() => setApplyOpen(false)}>
          <div className="gg-card" style={{ width: '100%', maxWidth: 440, padding: 18 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <AppText as="div" style={{ fontWeight: 900 }}>🙋 {t('match_apply', 'Apply to appear')}</AppText>
              <button type="button" className="gg-icon" onClick={() => setApplyOpen(false)}><FaTimes /></button>
            </div>
            <AppText as="p" style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: 12 }}>{t('match_apply_hint', 'Introduce yourself — a voice clip (under a minute) or a short note.')}</AppText>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button type="button" onClick={() => setTab('voice')} className="gg-btn" style={{ flex: 1, background: tab === 'voice' ? 'var(--primary)' : 'var(--bg-elevated)', color: tab === 'voice' ? '#fff' : 'var(--text-main)' }}>🎙️ {t('match_voice', 'Voice')}</button>
              <button type="button" onClick={() => setTab('text')} className="gg-btn" style={{ flex: 1, background: tab === 'text' ? 'var(--primary)' : 'var(--bg-elevated)', color: tab === 'text' ? '#fff' : 'var(--text-main)' }}>✍️ {t('match_text', 'Text')}</button>
            </div>

            {tab === 'voice' ? (
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                {voice ? (
                  <div>
                    <div style={{ color: '#16a34a', fontWeight: 700, marginBottom: 8 }}>✅ {formatDuration ? formatDuration(voice.seconds) : `${voice.seconds}s`}</div>
                    <button type="button" className="gg-btn gg-btn--soft" onClick={() => setVoice(null)}>{t('match_rerecord', 'Re-record')}</button>
                  </div>
                ) : recording ? (
                  <button type="button" className="gg-btn" style={{ background: '#ef4444', color: '#fff' }} onClick={stopRec}><FaStop /> {t('match_stop', 'Stop')} · {recSec}s / {MAX_SEC}s</button>
                ) : (
                  <button type="button" className="gg-btn gg-btn--primary" onClick={startRec}><FaMicrophone /> {t('match_record', 'Record intro')}</button>
                )}
              </div>
            ) : (
              <div style={{ marginBottom: 12 }}>
                <textarea value={introText} onChange={(e) => setIntroText(e.target.value)} rows={3}
                  placeholder={t('match_text_ph', 'A few words about you…')}
                  style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-main)', fontFamily: 'inherit' }} />
                <div style={{ fontSize: '0.75rem', color: introText.trim().split(/\s+/).filter(Boolean).length > MAX_WORDS ? '#ef4444' : 'var(--text-muted)', textAlign: 'end' }}>
                  {introText.trim().split(/\s+/).filter(Boolean).length} / {MAX_WORDS} {t('match_words', 'words')}
                </div>
              </div>
            )}

            <button type="button" className="gg-btn gg-btn--primary gg-btn--block" disabled={busy === 'apply'} onClick={submitApply}>
              {busy === 'apply' ? '…' : `🙋 ${t('match_submit', 'Join the queue')}`}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
