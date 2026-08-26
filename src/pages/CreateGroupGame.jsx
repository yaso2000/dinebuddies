import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft, FaHeart, FaUsers, FaGlobe, FaLock, FaCheck } from 'react-icons/fa';
import { groupGameApi } from '../hooks/useGroupGame';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { goToLogin } from '../utils/goToLogin';
import { getMutualFollowers } from '../utils/followHelpers';
import { getSafeAvatar } from '../utils/avatarUtils';
import { AppText } from '../components/base';

const MAX_INVITEES = 30;

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
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <FaUsers size={30} color="#fff" />
          </div>
          <AppText as="h1" style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: 6 }}>{t('group_game_taste_title', 'Group Compatibility')}</AppText>
          <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: 420, margin: '0 auto' }}>
            {t('group_game_taste_desc', 'Everyone answers fun this-or-that questions. See who is most in sync — and the couple of the night.')}
          </AppText>
        </div>

        {/* Game type */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { key: 'taste_match', emoji: '💞', title: t('group_game_taste_title', 'Group Compatibility') },
            { key: 'zodiac_guess', emoji: '⭐', title: t('zodiac_game_title', 'Guess the Sign') },
          ].map(({ key, emoji, title }) => (
            <button key={key} type="button" onClick={() => setGameType(key)}
              style={{ padding: '14px 10px', borderRadius: 14, cursor: 'pointer', textAlign: 'center',
                border: `2px solid ${gameType === key ? 'var(--primary)' : 'var(--border-color)'}`,
                background: gameType === key ? 'rgba(232,110,46,0.08)' : 'var(--bg-card)', color: 'var(--text-main)' }}>
              <div style={{ fontSize: '1.5rem' }}>{emoji}</div>
              <AppText as="div" style={{ fontWeight: 800, marginTop: 4, fontSize: '0.9rem' }}>{title}</AppText>
            </button>
          ))}
        </div>

        {/* Visibility */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { key: 'public', icon: FaGlobe, title: t('group_game_vis_public', 'Everyone'), hint: t('group_game_vis_public_hint', 'Anyone can join') },
            { key: 'invite_only', icon: FaLock, title: t('group_game_vis_private', 'Private'), hint: t('group_game_vis_private_hint', 'Invite specific people') },
          ].map(({ key, icon: Icon, title, hint }) => (
            <button key={key} type="button" onClick={() => setVisibility(key)}
              style={{ padding: '14px 10px', borderRadius: 14, cursor: 'pointer', textAlign: 'center',
                border: `2px solid ${visibility === key ? 'var(--primary)' : 'var(--border-color)'}`,
                background: visibility === key ? 'rgba(232,110,46,0.08)' : 'var(--bg-card)', color: 'var(--text-main)' }}>
              <Icon color={visibility === key ? 'var(--primary)' : 'var(--text-muted)'} size={18} />
              <AppText as="div" style={{ fontWeight: 800, marginTop: 6 }}>{title}</AppText>
              <AppText as="div" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{hint}</AppText>
            </button>
          ))}
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

        {/* Rounds */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 18, marginBottom: 18 }}>
          <AppText as="div" style={{ fontWeight: 700, marginBottom: 10 }}>{t('group_game_rounds', 'Number of questions')}</AppText>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[4, 6, 8, 10].map((n) => (
              <button key={n} type="button" onClick={() => setRounds(n)}
                style={{ flex: 1, minWidth: 60, padding: '10px', borderRadius: 12, fontWeight: 800, cursor: 'pointer',
                  border: `2px solid ${rounds === n ? 'var(--primary)' : 'var(--border-color)'}`,
                  background: rounds === n ? 'var(--primary)' : 'var(--bg-card)', color: rounds === n ? '#fff' : 'var(--text-main)' }}>{n}</button>
            ))}
          </div>
        </div>

        <button type="button" className="db-btn db-btn--lime" style={{ width: '100%', padding: 16, fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} disabled={creating} onClick={create}>
          <FaHeart /> {creating ? t('group_game_creating', 'Creating…') : t('group_game_create_cta', 'Create game')}
        </button>

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
