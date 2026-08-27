import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft, FaHeart, FaGlobe, FaLock, FaCheck, FaMagic } from 'react-icons/fa';
import { matchShowApi } from '../hooks/useMatchShow';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { goToLogin } from '../utils/goToLogin';
import { getMutualFollowers } from '../utils/followHelpers';
import { getSafeAvatar } from '../utils/avatarUtils';
import { AppText } from '../components/base';
import '../styles/gameUI.css';

const GOALS = ['marriage', 'longterm', 'shortterm', 'undecided'];
const WANT = [{ key: 'female', label: '♀' }, { key: 'male', label: '♂' }, { key: 'any', label: '★' }];
const MAX_WORDS = 40;
const labelStyle = { fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 };
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-main)', fontFamily: 'inherit', fontSize: '0.9rem' };

export default function CreateMatchShow() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { currentUser, userProfile, isGuest } = useAuth();
  const { showToast } = useToast();
  const uid = currentUser?.uid || null;

  const [age, setAge] = useState('');
  const [goal, setGoal] = useState('marriage');
  const [interests, setInterests] = useState('');
  const [lookingFor, setLookingFor] = useState('');
  const [about, setAbout] = useState('');
  const [wantGender, setWantGender] = useState('female');
  const [visibility, setVisibility] = useState('public');
  const [mutuals, setMutuals] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [busy, setBusy] = useState('');

  useEffect(() => {
    setAge(String(userProfile?.age || userProfile?.dob_age || ''));
    const it = userProfile?.interests || userProfile?.hobbies;
    setInterests(Array.isArray(it) ? it.slice(0, 3).join('، ') : (typeof it === 'string' ? it : ''));
    // Default the wanted gender to the opposite of the host's, when known.
    const g = String(userProfile?.gender || '').toLowerCase();
    if (g === 'male') setWantGender('female'); else if (g === 'female') setWantGender('male');
  }, [userProfile]);

  useEffect(() => {
    if (!uid) return undefined;
    let cancelled = false;
    getMutualFollowers(uid, Array.isArray(userProfile?.following) ? userProfile.following : [])
      .then((rows) => { if (!cancelled) setMutuals((rows || []).map((u) => ({ id: u.id, name: u.display_name || u.displayName || 'User', avatar: getSafeAvatar(u) }))); })
      .catch(() => { if (!cancelled) setMutuals([]); });
    return () => { cancelled = true; };
  }, [uid, userProfile?.following]);

  const toggle = useCallback((id) => setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  const interestsArr = () => interests.split(/[،,]/).map((s) => s.trim()).filter(Boolean).slice(0, 3);

  const doAI = async () => {
    setBusy('ai');
    try {
      const res = await matchShowApi.generateIntro({ age: Number(age) || 0, goal, interests: interestsArr(), lookingFor: lookingFor.trim(), locale: (i18n.language || 'ar').slice(0, 2) });
      if (res?.about) setAbout(res.about);
    } catch (e) { showToast(e?.message || t('match_ai_failed', 'Could not generate — write your own.'), 'error'); }
    finally { setBusy(''); }
  };

  const create = async () => {
    if (isGuest || !currentUser) { goToLogin(); return; }
    const a = Math.round(Number(age) || 0);
    if (a < 18) { showToast(t('match_age_invalid', 'Enter a valid age (18+).'), 'info'); return; }
    if (!lookingFor.trim()) { showToast(t('match_need_looking', 'Add what you are looking for.'), 'info'); return; }
    const words = about.trim().split(/\s+/).filter(Boolean);
    if (!words.length) { showToast(t('match_write_first', 'Write a short intro (or use AI).'), 'info'); return; }
    if (words.length > MAX_WORDS) { showToast(t('match_too_long', { defaultValue: 'Keep it under {{n}} words.', n: MAX_WORDS }), 'info'); return; }
    if (visibility === 'invite_only' && selectedIds.size === 0) { showToast(t('group_game_need_invitee', 'Invite at least one person.'), 'info'); return; }
    setBusy('create');
    try {
      const res = await matchShowApi.create({ age: a, goal, interests: interestsArr(), lookingFor: lookingFor.trim(), about: about.trim(), wantGender, visibility, inviteeIds: [...selectedIds] });
      navigate(`/match-show/${res.showId}`);
    } catch (e) { showToast(e?.message || t('match_create_error', 'Could not create the show.'), 'error'); }
    finally { setBusy(''); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-body)' }} dir={i18n.dir()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '1.2rem', cursor: 'pointer' }}><FaChevronLeft style={{ transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' }} /></button>
        <AppText as="h2" style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{t('match_create_title', 'Match or Not?')}</AppText>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: '2.4rem' }}>💘</div>
          <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 400, margin: '8px auto 0' }}>
            {t('match_create_desc2', 'You are on stage. Fill your mini-profile — people will apply to be your match and the room votes.')}
          </AppText>
        </div>

        {/* Host mini-profile */}
        <div className="gg-card" style={{ padding: 16, marginBottom: 16 }}>
          <AppText as="div" style={{ fontWeight: 800, marginBottom: 12 }}>👤 {t('match_your_profile', 'Your mini-profile')}</AppText>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: '0 0 90px' }}>
              <AppText as="div" style={labelStyle}>{t('match_age', 'Age')}</AppText>
              <input type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} min={18} max={99} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <AppText as="div" style={labelStyle}>{t('match_goal', 'Looking for')}</AppText>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {GOALS.map((g) => (
                  <button key={g} type="button" onClick={() => setGoal(g)} style={{ padding: '7px 10px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${goal === g ? 'var(--primary)' : 'var(--border-color)'}`, background: goal === g ? 'var(--primary)' : 'var(--bg-elevated)', color: goal === g ? '#fff' : 'var(--text-main)' }}>{t(`match_goal_${g}`, g)}</button>
                ))}
              </div>
            </div>
          </div>

          <AppText as="div" style={labelStyle}>{t('match_interests', 'Interests (up to 3)')}</AppText>
          <input value={interests} onChange={(e) => setInterests(e.target.value)} placeholder={t('match_interests_ph', 'e.g. travel، coffee، football')} style={{ ...inputStyle, marginBottom: 12 }} />

          <AppText as="div" style={labelStyle}>{t('match_lookingfor', 'What I want in a partner')}</AppText>
          <input value={lookingFor} onChange={(e) => setLookingFor(e.target.value)} maxLength={160} placeholder={t('match_lookingfor_ph', 'A short line…')} style={{ ...inputStyle, marginBottom: 12 }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText as="div" style={labelStyle}>{t('match_about', 'About me')}</AppText>
            <button type="button" onClick={doAI} disabled={busy === 'ai'} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <FaMagic /> {busy === 'ai' ? t('match_ai_wait', 'Writing…') : t('match_ai', 'Help me write')}
            </button>
          </div>
          <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={3} placeholder={t('match_about_ph', 'A few words about you…')} style={{ ...inputStyle, resize: 'none' }} />
          <div style={{ fontSize: '0.72rem', color: about.trim().split(/\s+/).filter(Boolean).length > MAX_WORDS ? '#ef4444' : 'var(--text-muted)', textAlign: 'end' }}>
            {about.trim().split(/\s+/).filter(Boolean).length} / {MAX_WORDS} {t('match_words', 'words')}
          </div>
        </div>

        {/* Who I'm looking for (gender) */}
        <div className="gg-card" style={{ padding: 16, marginBottom: 16 }}>
          <AppText as="div" style={{ fontWeight: 800, marginBottom: 10 }}>❤️ {t('match_want_gender', 'Who can apply')}</AppText>
          <div style={{ display: 'flex', gap: 8 }}>
            {WANT.map((o) => (
              <button key={o.key} type="button" onClick={() => setWantGender(o.key)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: '1.2rem', fontWeight: 800, cursor: 'pointer', border: `2px solid ${wantGender === o.key ? 'var(--primary)' : 'var(--border-color)'}`, background: wantGender === o.key ? 'var(--primary)' : 'var(--bg-elevated)', color: wantGender === o.key ? '#fff' : 'var(--text-main)' }}>{o.label}</button>
            ))}
          </div>
          <AppText as="div" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>♀ {t('match_female', 'Female')} · ♂ {t('match_male', 'Male')} · ★ {t('match_any', 'Any')}</AppText>
        </div>

        {/* Visibility */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[{ key: 'public', icon: FaGlobe, title: t('group_game_vis_public', 'Everyone'), hint: t('group_game_vis_public_hint', 'Anyone can join') },
            { key: 'invite_only', icon: FaLock, title: t('group_game_vis_private', 'Private'), hint: t('group_game_vis_private_hint', 'Invite specific people') }].map(({ key, icon: Icon, title, hint }) => (
            <button key={key} type="button" onClick={() => setVisibility(key)} style={{ padding: '14px 10px', borderRadius: 14, cursor: 'pointer', textAlign: 'center', border: `2px solid ${visibility === key ? 'var(--primary)' : 'var(--border-color)'}`, background: visibility === key ? 'rgba(232,110,46,0.08)' : 'var(--bg-card)', color: 'var(--text-main)' }}>
              <Icon color={visibility === key ? 'var(--primary)' : 'var(--text-muted)'} size={18} />
              <AppText as="div" style={{ fontWeight: 800, marginTop: 6 }}>{title}</AppText>
              <AppText as="div" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{hint}</AppText>
            </button>
          ))}
        </div>

        {visibility === 'invite_only' ? (
          <div className="gg-card" style={{ padding: 14, marginBottom: 16 }}>
            <AppText as="div" style={{ fontWeight: 700, marginBottom: 10 }}>{t('group_game_invite_people', 'Invite people')} {selectedIds.size ? `(${selectedIds.size})` : ''}</AppText>
            {mutuals.length === 0 ? <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('group_game_no_mutuals', 'No mutual follows yet.')}</AppText> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                {mutuals.map((m) => {
                  const sel = selectedIds.has(m.id);
                  return (
                    <button key={m.id} type="button" onClick={() => toggle(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, cursor: 'pointer', border: `1px solid ${sel ? 'var(--primary)' : 'var(--border-color)'}`, background: sel ? 'rgba(232,110,46,0.08)' : 'transparent' }}>
                      {m.avatar ? <img src={m.avatar} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{m.name.charAt(0)}</div>}
                      <AppText as="span" style={{ flex: 1, textAlign: 'start', fontWeight: 600 }}>{m.name}</AppText>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', background: sel ? 'var(--primary)' : 'transparent', border: sel ? 'none' : '1px solid var(--border-color)', color: '#fff' }}>{sel ? <FaCheck size={11} /> : null}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        <button type="button" className="gg-btn gg-btn--primary gg-btn--block" disabled={busy === 'create'} onClick={create}>
          <FaHeart /> {busy === 'create' ? t('group_game_creating', 'Creating…') : t('match_create_cta', 'Go live')}
        </button>
      </div>
    </div>
  );
}
