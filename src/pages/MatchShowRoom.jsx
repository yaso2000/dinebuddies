import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaHeart, FaHeartBroken, FaSignOutAlt, FaCopy, FaShareAlt, FaTimes, FaMagic } from 'react-icons/fa';
import { useMatchShow } from '../hooks/useMatchShow';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { goToLogin } from '../utils/goToLogin';
import { AppText } from '../components/base';
import '../styles/gameUI.css';

const MAX_WORDS = 40;
const GOALS = ['marriage', 'longterm', 'shortterm', 'undecided'];
const labelStyle = { fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 };
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-main)', fontFamily: 'inherit', fontSize: '0.9rem' };

function Photo({ src, name, size = 120 }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  return src
    ? <img src={src} alt="" style={{ width: size, height: size, borderRadius: 18, objectFit: 'cover' }} />
    : <div style={{ width: size, height: size, borderRadius: 18, background: 'linear-gradient(135deg,var(--primary),#f0a24b)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: size * 0.4 }}>{initial}</div>;
}

function ProfileView({ profile, t, compact }) {
  if (!profile) return null;
  const goalLabel = profile.goal ? t(`match_goal_${profile.goal}`, profile.goal) : '';
  const just = compact ? 'flex-start' : 'center';
  return (
    <div style={{ marginTop: 6, textAlign: compact ? 'start' : 'center' }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: just }}>
        {profile.age ? <span>🎂 {profile.age}</span> : null}
        {goalLabel ? <span>💍 {goalLabel}</span> : null}
      </div>
      {profile.interests?.length ? (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4, justifyContent: just }}>
          {profile.interests.map((it, i) => <span key={i} style={{ fontSize: '0.72rem', background: 'var(--bg-elevated)', borderRadius: 8, padding: '2px 8px' }}>{it}</span>)}
        </div>
      ) : null}
      {profile.lookingFor ? <AppText as="div" style={{ fontSize: '0.8rem', marginTop: 4 }}>🔎 {profile.lookingFor}</AppText> : null}
      {profile.about ? <AppText as="p" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>“{profile.about}”</AppText> : null}
    </div>
  );
}

export default function MatchShowRoom() {
  const { showId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { currentUser, userProfile, isGuest } = useAuth();
  const { showToast } = useToast();
  const { show, queue, loading, isHost, myApplication, current, amCurrent, onStage, apply, generateIntro, withdraw, bringUp, vote, reveal, nextApplicant, end } = useMatchShow(showId);

  const [busy, setBusy] = useState('');
  const [myVote, setMyVote] = useState(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [age, setAge] = useState('');
  const [goal, setGoal] = useState('marriage');
  const [interests, setInterests] = useState('');
  const [lookingFor, setLookingFor] = useState('');
  const [about, setAbout] = useState('');

  const pairId = current?.pairId;
  useEffect(() => { setMyVote(null); }, [pairId]);

  // Prefill from the user's profile when opening the apply form.
  const openApply = () => {
    if (!requireAuth()) return;
    if (!age) setAge(String(userProfile?.age || userProfile?.dob_age || ''));
    if (!interests) {
      const it = userProfile?.interests || userProfile?.hobbies;
      setInterests(Array.isArray(it) ? it.slice(0, 3).join('، ') : (typeof it === 'string' ? it : ''));
    }
    setApplyOpen(true);
  };

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

  const interestsArr = () => interests.split(/[،,]/).map((s) => s.trim()).filter(Boolean).slice(0, 3);

  const doGenerateIntro = async () => {
    setBusy('ai');
    try {
      const res = await generateIntro({ age: Number(age) || 0, goal, interests: interestsArr(), lookingFor: lookingFor.trim(), locale: (i18n.language || 'ar').slice(0, 2) });
      if (res?.about) setAbout(res.about);
    } catch (e) { showToast(e?.message || t('match_ai_failed', 'Could not generate — write your own.'), 'error'); }
    finally { setBusy(''); }
  };

  const submitApply = async () => {
    if (!requireAuth()) return;
    const a = Math.round(Number(age) || 0);
    if (a < 18) { showToast(t('match_age_invalid', 'Enter a valid age (18+).'), 'info'); return; }
    if (!lookingFor.trim()) { showToast(t('match_need_looking', 'Add what you are looking for.'), 'info'); return; }
    const words = about.trim().split(/\s+/).filter(Boolean);
    if (!words.length) { showToast(t('match_write_first', 'Write a short intro (or use AI).'), 'info'); return; }
    if (words.length > MAX_WORDS) { showToast(t('match_too_long', { defaultValue: 'Keep it under {{n}} words.', n: MAX_WORDS }), 'info'); return; }
    setBusy('apply');
    try {
      await apply({ age: a, goal, interests: interestsArr(), lookingFor: lookingFor.trim(), about: about.trim() });
      showToast(t('match_applied', "You're in the queue!"), 'success');
      setApplyOpen(false);
    } catch (e) { showToast(e?.message || t('admin_failed', 'Something went wrong.'), 'error'); }
    finally { setBusy(''); }
  };

  const copyCode = async () => { try { await navigator.clipboard.writeText(show?.joinCode || ''); showToast(t('group_game_code_copied', 'Code copied.'), 'success'); } catch { /* ignore */ } };
  const doShare = async () => {
    const url = `${window.location.origin}/match-show/${showId}`;
    try { if (navigator.share) { await navigator.share({ title: 'DineBuddies', url }); return; } await navigator.clipboard.writeText(url); showToast(t('group_game_link_copied', 'Link copied.'), 'success'); } catch { /* ignore */ }
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
  const hostCard = { uid: show.hostId, name: show.hostName, avatar: show.hostAvatar, profile: show.hostProfile };

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
            {/* ---------------- STAGE: host (fixed) + current applicant ---------------- */}
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[{ ...hostCard, host: true }, current].map((c, idx) => (
                  <div key={idx} className="match-card" style={{ ['--mc-accent']: idx === 0 ? '#6366f1' : '#e11d48', opacity: c ? 1 : 0.6 }}>
                    <div className="match-card__photo">
                      {c && c.avatar
                        ? <img src={c.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: c ? 'linear-gradient(135deg,var(--primary),#f0a24b)' : 'var(--bg-elevated)', color: '#fff', fontWeight: 900, fontSize: '2rem' }}>{c ? (c.name || '?').charAt(0).toUpperCase() : '❔'}</div>}
                    </div>
                    <AppText as="div" className="match-card__name">{c ? c.name : t('match_empty_slot', 'Waiting…')}{c && c.host ? <span style={{ color: 'var(--primary)', fontSize: '0.7rem' }}> · {t('match_host_tag', 'Host')}</span> : null}</AppText>
                    {c ? <ProfileView profile={c.profile} t={t} compact /> : null}
                  </div>
                ))}
              </div>
              <div className="match-heart">{revealData ? (revealData.isMatch ? '💖' : '💔') : '❤️'}</div>

              {revealData ? (
                <div className="gg-card" style={{ padding: 14, marginTop: 12, textAlign: 'center', border: `2px solid ${revealData.isMatch ? '#16a34a' : '#ef4444'}` }}>
                  <div style={{ fontSize: '2.4rem', fontWeight: 900, color: revealData.isMatch ? '#16a34a' : '#ef4444', lineHeight: 1 }}>{revealData.pct}%</div>
                  <AppText as="div" style={{ fontWeight: 900, color: revealData.isMatch ? '#16a34a' : '#ef4444', marginTop: 2 }}>
                    {revealData.isMatch ? `💚 ${t('match_yes', "It's a match!")}` : `💔 ${t('match_no', 'Not a match')}`}
                  </AppText>
                  <AppText as="div" style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>❤️ {revealData.yes} · 💔 {revealData.no}</AppText>
                </div>
              ) : !current ? (
                <AppText as="div" style={{ textAlign: 'center', marginTop: 10, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  🎤 {isHost ? t('match_host_pick_hint2', 'Bring an applicant up beside you from the queue below.') : t('match_wait_hint2', 'Waiting for the host to bring someone up…')}
                </AppText>
              ) : null}
            </div>

            {/* ---------------- VOTING (viewers) ---------------- */}
            {current && show.pairStatus === 'voting' && !onStage ? (
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
                  <button type="button" className="gg-btn gg-btn--primary gg-btn--block" disabled={busy === 'next'} onClick={wrap('next', nextApplicant)}>➡️ {t('match_next2', 'Next applicant')}</button>
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
                <button type="button" className="gg-btn gg-btn--primary gg-btn--block" style={{ marginBottom: 16 }} onClick={openApply}>
                  🙋 {t('match_apply', 'Apply to appear')}
                </button>
              )
            ) : null}

            {/* ---------------- QUEUE (host brings one up) ---------------- */}
            {isHost && !current ? (
              <>
                <AppText as="div" style={{ fontWeight: 800, marginBottom: 8 }}>{t('match_queue', 'Applicants')} · {queue.length}</AppText>
                {queue.length === 0 ? <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t('match_queue_empty', 'No applicants yet — share the show.')}</AppText> : null}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {queue.map((a) => (
                    <div key={a.uid} className="gg-card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px' }}>
                      <Photo src={a.avatar} name={a.name} size={44} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <AppText as="div" style={{ fontWeight: 700 }}>{a.name} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>· {a.gender === 'male' ? '♂' : '♀'}</span></AppText>
                        <ProfileView profile={a.profile} t={t} compact />
                      </span>
                      <button type="button" className="gg-btn gg-btn--primary" style={{ padding: '8px 14px', flexShrink: 0 }} disabled={busy === 'bring'} onClick={wrap('bring', () => bringUp(a.uid))}>⬆️ {t('match_bring_up', 'Bring up')}</button>
                    </div>
                  ))}
                </div>
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
            <AppText as="p" style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: 14 }}>{t('match_apply_hint2', 'Fill your mini-profile — a good photo is required to appear.')}</AppText>

            {/* Age + relationship goal */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: '0 0 90px' }}>
                <AppText as="div" style={labelStyle}>{t('match_age', 'Age')}</AppText>
                <input type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} min={18} max={99} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <AppText as="div" style={labelStyle}>{t('match_goal', 'Looking for')}</AppText>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {GOALS.map((g) => (
                    <button key={g} type="button" onClick={() => setGoal(g)} style={{ padding: '7px 10px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${goal === g ? 'var(--primary)' : 'var(--border-color)'}`, background: goal === g ? 'var(--primary)' : 'var(--bg-elevated)', color: goal === g ? '#fff' : 'var(--text-main)' }}>
                      {t(`match_goal_${g}`, g)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Interests */}
            <AppText as="div" style={labelStyle}>{t('match_interests', 'Interests (up to 3)')}</AppText>
            <input value={interests} onChange={(e) => setInterests(e.target.value)} placeholder={t('match_interests_ph', 'e.g. travel، coffee، football')} style={{ ...inputStyle, marginBottom: 12 }} />

            {/* Looking for */}
            <AppText as="div" style={labelStyle}>{t('match_lookingfor', 'What I want in a partner')}</AppText>
            <input value={lookingFor} onChange={(e) => setLookingFor(e.target.value)} maxLength={160} placeholder={t('match_lookingfor_ph', 'A short line…')} style={{ ...inputStyle, marginBottom: 12 }} />

            {/* About + AI */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText as="div" style={labelStyle}>{t('match_about', 'About me')}</AppText>
              <button type="button" onClick={doGenerateIntro} disabled={busy === 'ai'} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <FaMagic /> {busy === 'ai' ? t('match_ai_wait', 'Writing…') : t('match_ai', 'Help me write')}
              </button>
            </div>
            <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={3} placeholder={t('match_about_ph', 'A few words about you…')}
              style={{ ...inputStyle, resize: 'none' }} />
            <div style={{ fontSize: '0.72rem', color: about.trim().split(/\s+/).filter(Boolean).length > MAX_WORDS ? '#ef4444' : 'var(--text-muted)', textAlign: 'end', marginBottom: 12 }}>
              {about.trim().split(/\s+/).filter(Boolean).length} / {MAX_WORDS} {t('match_words', 'words')}
            </div>

            <button type="button" className="gg-btn gg-btn--primary gg-btn--block" disabled={busy === 'apply'} onClick={submitApply}>
              {busy === 'apply' ? '…' : `🙋 ${t('match_submit', 'Join the queue')}`}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
