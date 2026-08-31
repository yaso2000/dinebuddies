import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft, FaHeart, FaGlobe, FaLock, FaCheck } from 'react-icons/fa';
import { groupGameApi } from '../hooks/useGroupGame';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { goToLogin } from '../utils/goToLogin';
import { getMutualFollowers } from '../utils/followHelpers';
import { getSafeAvatar } from '../utils/avatarUtils';
import { AppText } from '../components/base';

const MAX_INVITEES = 30;

// Per-game identity + its OWN settings (no global settings): question options
// (`rounds`, null = no question count), default round count, and player bounds.
const GAME_META = [
  { key: 'taste_match', emoji: '💞', a: '#ec4899', b: '#e11d48',
    titleKey: 'group_game_taste_title', titleDefault: 'Group Compatibility',
    descKey: 'group_game_desc_taste', descDefault: 'Everyone answers fun this-or-that questions — discover who is most in sync.',
    rounds: [4, 6, 8, 10], defaultRounds: 6, minPlayers: 3, maxPlayers: 16 },
  { key: 'most_likely', emoji: '🕵️', a: '#0d9488', b: '#0891b2',
    titleKey: 'most_likely_title', titleDefault: 'Most Likely To',
    descKey: 'group_game_desc_most_likely', descDefault: '“Who is most likely to…” — vote on the people in the room.',
    rounds: [4, 6, 8, 10], defaultRounds: 6, minPlayers: 3, maxPlayers: 16 },
  { key: 'two_truths', emoji: '🤥', a: '#f59e0b', b: '#ea580c',
    titleKey: 'two_truths_title', titleDefault: 'Two Truths & a Lie',
    descKey: 'group_game_desc_two_truths', descDefault: 'Write two truths and a lie — everyone else guesses the lie.',
    rounds: null, defaultRounds: 0, minPlayers: 3, maxPlayers: 16 },
  { key: 'who_said_it', emoji: '🗣️', a: '#8b5cf6', b: '#6d28d9',
    titleKey: 'whosaid_title', titleDefault: 'Who said it?',
    descKey: 'group_game_desc_whosaid', descDefault: 'Everyone answers one question secretly — then guess who wrote each answer.',
    rounds: null, defaultRounds: 0, minPlayers: 3, maxPlayers: 16 },
];

const metaFor = (key) => GAME_META.find((g) => g.key === key) || GAME_META[0];

export default function CreateGroupGame() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { currentUser, userProfile, isGuest } = useAuth();
  const { showToast } = useToast();
  const uid = currentUser?.uid || null;

  const [gameType, setGameType] = useState('taste_match');
  const [rounds, setRounds] = useState(6);
  const [visibility, setVisibility] = useState('public');
  const [mutuals, setMutuals] = useState([]);
  const [loadingMutuals, setLoadingMutuals] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!uid) return undefined;
    let cancelled = false;
    setLoadingMutuals(true);
    const followingIds = Array.isArray(userProfile?.following) ? userProfile.following : [];
    getMutualFollowers(uid, followingIds)
      .then((rows) => {
        if (cancelled) return;
        setMutuals((rows || []).map((u) => ({ id: u.id, name: u.display_name || u.displayName || u.name || 'User', avatar: getSafeAvatar(u) })));
      })
      .catch(() => { if (!cancelled) setMutuals([]); })
      .finally(() => { if (!cancelled) setLoadingMutuals(false); });
    return () => { cancelled = true; };
  }, [uid, userProfile?.following]);

  const toggleInvitee = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_INVITEES) next.add(id);
      return next;
    });
  }, []);

  const requireAuth = () => {
    if (isGuest || !currentUser) { goToLogin(); return false; }
    return true;
  };

  const create = async () => {
    if (!requireAuth()) return;
    if (visibility === 'invite_only' && selectedIds.size === 0) {
      showToast(t('group_game_need_invitee', 'Invite at least one person for a private game.'), 'info');
      return;
    }
    setCreating(true);
    try {
      const res = await groupGameApi.create({ type: gameType, roundCount: rounds, visibility, inviteeIds: [...selectedIds] });
      if (res.existing) showToast(t('group_game_already_active', 'You already have an active game — opening it.'), 'info');
      navigate(`/group-game/${res.gameId}`);
    } catch (e) {
      showToast(e?.message || t('group_game_create_error', 'Could not create the game.'), 'error');
    } finally { setCreating(false); }
  };

  const join = async () => {
    if (!requireAuth()) return;
    const c = code.trim().toUpperCase();
    if (!c) return;
    setJoining(true);
    try {
      const res = await groupGameApi.join({ joinCode: c });
      navigate(`/group-game/${res.gameId}`);
    } catch (e) {
      showToast(e?.message || t('group_game_join_error', 'Could not join.'), 'error');
    } finally { setJoining(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-body)' }} dir={i18n.dir()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '1.2rem', cursor: 'pointer' }}><FaChevronLeft style={{ transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' }} /></button>
        <AppText as="h2" style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{t('group_game_create_title', 'Group game')}</AppText>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: 20 }}>
        {/* Visibility — compact segmented pill at the top (inline styles for cross-platform parity) */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <div role="tablist" style={{ display: 'inline-flex', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 999, padding: 3, gap: 3 }}>
            {[
              { key: 'public', icon: FaGlobe, label: t('group_game_vis_public', 'Everyone') },
              { key: 'invite_only', icon: FaLock, label: t('group_game_vis_private', 'Private') },
            ].map(({ key, icon: Icon, label }) => {
              const on = visibility === key;
              return (
                <button key={key} type="button" role="tab" onClick={() => setVisibility(key)}
                  style={{ border: 'none', borderRadius: 999, padding: '7px 16px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                    background: on ? 'linear-gradient(135deg, var(--primary), #f0a24b)' : 'transparent',
                    color: on ? '#fff' : 'var(--text-muted)', boxShadow: on ? '0 2px 8px rgba(232,110,46,0.35)' : 'none' }}>
                  <Icon size={12} /> {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic hero — reflects the selected game */}
        {(() => {
          const g = GAME_META.find((x) => x.key === gameType) || GAME_META[0];
          return (
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 74, height: 74, borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto 12px',
                fontSize: '2.2rem', background: `linear-gradient(140deg, ${g.a}, ${g.b})`, color: '#fff',
                boxShadow: `0 10px 26px ${g.b}55, inset 0 1px 8px rgba(255,255,255,0.35)`, border: '1.5px solid rgba(255,255,255,0.35)' }}>
                {g.emoji}
              </div>
              <AppText as="h1" style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: 6 }}>{t(g.titleKey, g.titleDefault)}</AppText>
              <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: 420, margin: '0 auto' }}>{t(g.descKey, g.descDefault)}</AppText>
            </div>
          );
        })()}

        {/* Game type — glassy gradient cards (inline styles for cross-platform parity) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
          {GAME_META.map((g) => {
            const sel = gameType === g.key;
            return (
              <button key={g.key} type="button" onClick={() => { setGameType(g.key); setRounds(metaFor(g.key).defaultRounds || 0); }}
                style={{ position: 'relative', borderRadius: 18, padding: '16px 10px', cursor: 'pointer', textAlign: 'center',
                  color: '#fff', overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.22)',
                  background: `linear-gradient(140deg, ${g.a}, ${g.b})`,
                  transform: sel ? 'translateY(-3px)' : 'none', transition: 'transform .16s ease, box-shadow .2s ease',
                  boxShadow: sel ? '0 12px 30px rgba(0,0,0,0.30), 0 0 0 3px rgba(255,255,255,0.9)' : '0 8px 22px rgba(0,0,0,0.18)' }}>
                <span aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
                  background: 'linear-gradient(160deg, rgba(255,255,255,0.30), rgba(255,255,255,0) 46%)' }} />
                <div style={{ position: 'relative', width: 54, height: 54, borderRadius: '50%', display: 'grid', placeItems: 'center',
                  margin: '0 auto 8px', fontSize: '1.7rem', background: 'rgba(255,255,255,0.22)',
                  border: '1px solid rgba(255,255,255,0.35)', boxShadow: 'inset 0 1px 6px rgba(255,255,255,0.25)' }}>{g.emoji}</div>
                <AppText as="div" style={{ position: 'relative', fontWeight: 900, fontSize: '0.95rem', color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.18)' }}>{t(g.titleKey, g.titleDefault)}</AppText>
              </button>
            );
          })}
        </div>

        {/* Invitee picker (private only) */}
        {visibility === 'invite_only' ? (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 14, marginBottom: 16 }}>
            <AppText as="div" style={{ fontWeight: 700, marginBottom: 10 }}>{t('group_game_invite_people', 'Invite people')} {selectedIds.size ? `(${selectedIds.size})` : ''}</AppText>
            {loadingMutuals ? (
              <div className="db-spin" style={{ margin: '10px auto' }} />
            ) : mutuals.length === 0 ? (
              <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('group_game_no_mutuals', 'No mutual follows yet — follow people back to invite them, or make the game public.')}</AppText>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                {mutuals.map((m) => {
                  const sel = selectedIds.has(m.id);
                  return (
                    <button key={m.id} type="button" onClick={() => toggleInvitee(m.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, cursor: 'pointer',
                        border: `1px solid ${sel ? 'var(--primary)' : 'var(--border-color)'}`, background: sel ? 'rgba(232,110,46,0.08)' : 'transparent' }}>
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

        {/* Per-game settings: question count (only for games that have one) + the
            game's own player bounds. No global settings — each game differs. */}
        {(() => {
          const g = metaFor(gameType);
          return (
            <div style={{ background: 'var(--bg-card)', border: `1.5px solid ${g.b}`, borderRadius: 16, padding: 18, marginBottom: 18 }}>
              <AppText as="div" style={{ fontWeight: 800, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden style={{ fontSize: '1.1rem' }}>{g.emoji}</span>
                {t('group_game_settings_for', { defaultValue: '{{game}} — settings', game: t(g.titleKey, g.titleDefault) })}
              </AppText>
              {Array.isArray(g.rounds) && g.rounds.length ? (
                <>
                  <AppText as="div" style={{ fontWeight: 700, marginBottom: 10, fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t('group_game_rounds', 'Number of questions')}</AppText>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                    {g.rounds.map((n) => (
                      <button key={n} type="button" onClick={() => setRounds(n)}
                        style={{ flex: 1, minWidth: 60, padding: '10px', borderRadius: 12, fontWeight: 800, cursor: 'pointer',
                          border: `2px solid ${rounds === n ? 'var(--primary)' : 'var(--border-color)'}`,
                          background: rounds === n ? 'var(--primary)' : 'var(--bg-card)', color: rounds === n ? '#fff' : 'var(--text-main)' }}>{n}</button>
                    ))}
                  </div>
                </>
              ) : (
                <AppText as="div" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                  {t('group_game_rounds_auto', 'One round per player — no question count to set.')}
                </AppText>
              )}
              <AppText as="div" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                👥 {t('group_game_player_range', { defaultValue: '{{min}}–{{max}} players', min: g.minPlayers, max: g.maxPlayers })}
              </AppText>
            </div>
          );
        })()}

        {(() => {
          const g = GAME_META.find((x) => x.key === gameType) || GAME_META[0];
          return (
            <button type="button" style={{ width: '100%', padding: 16, fontSize: '1.05rem', fontWeight: 900, borderRadius: 16, border: '1.5px solid rgba(255,255,255,0.25)',
              cursor: creating ? 'default' : 'pointer', opacity: creating ? 0.7 : 1, color: '#fff',
              background: `linear-gradient(140deg, ${g.a}, ${g.b})`, boxShadow: `0 10px 26px ${g.b}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} disabled={creating} onClick={create}>
              <FaHeart /> {creating ? t('group_game_creating', 'Creating…') : t('group_game_create_cta', 'Create game')}
            </button>
          );
        })()}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '22px 0', color: 'var(--text-muted)' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
          <span style={{ fontSize: '0.85rem' }}>{t('group_game_or_join', 'or join with a code')}</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} placeholder={t('group_game_code_ph', 'ABCDE')}
            style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 800, letterSpacing: 4, textAlign: 'center', textTransform: 'uppercase' }} />
          <button type="button" className="db-btn db-btn--ghost" style={{ padding: '0 20px', fontWeight: 800 }} disabled={joining || !code.trim()} onClick={join}>
            {joining ? t('group_game_joining', 'Joining…') : t('group_game_join', 'Join')}
          </button>
        </div>
      </div>
    </div>
  );
}
