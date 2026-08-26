import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft, FaHeart, FaGlobe, FaLock, FaCheck } from 'react-icons/fa';
import { matchShowApi } from '../hooks/useMatchShow';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { goToLogin } from '../utils/goToLogin';
import { getMutualFollowers } from '../utils/followHelpers';
import { getSafeAvatar } from '../utils/avatarUtils';
import { AppText } from '../components/base';
import '../styles/gameUI.css';

const SLOT_OPTS = [
  { key: 'male', label: '♂' },
  { key: 'female', label: '♀' },
  { key: 'any', label: '★' },
];

export default function CreateMatchShow() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { currentUser, userProfile, isGuest } = useAuth();
  const { showToast } = useToast();
  const uid = currentUser?.uid || null;

  const [slotA, setSlotA] = useState('male');
  const [slotB, setSlotB] = useState('female');
  const [visibility, setVisibility] = useState('public');
  const [mutuals, setMutuals] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!uid) return undefined;
    let cancelled = false;
    getMutualFollowers(uid, Array.isArray(userProfile?.following) ? userProfile.following : [])
      .then((rows) => { if (!cancelled) setMutuals((rows || []).map((u) => ({ id: u.id, name: u.display_name || u.displayName || 'User', avatar: getSafeAvatar(u) }))); })
      .catch(() => { if (!cancelled) setMutuals([]); });
    return () => { cancelled = true; };
  }, [uid, userProfile?.following]);

  const toggle = useCallback((id) => setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);

  const create = async () => {
    if (isGuest || !currentUser) { goToLogin(); return; }
    if (visibility === 'invite_only' && selectedIds.size === 0) { showToast(t('group_game_need_invitee', 'Invite at least one person.'), 'info'); return; }
    setCreating(true);
    try {
      const res = await matchShowApi.create({ slotGenders: [slotA, slotB], visibility, inviteeIds: [...selectedIds] });
      navigate(`/match-show/${res.showId}`);
    } catch (e) { showToast(e?.message || t('match_create_error', 'Could not create the show.'), 'error'); }
    finally { setCreating(false); }
  };

  const SlotPicker = ({ value, onChange, label }) => (
    <div style={{ flex: 1 }}>
      <AppText as="div" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6, textAlign: 'center' }}>{label}</AppText>
      <div style={{ display: 'flex', gap: 6 }}>
        {SLOT_OPTS.map((o) => (
          <button key={o.key} type="button" onClick={() => onChange(o.key)}
            style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: '1.2rem', fontWeight: 800, cursor: 'pointer',
              border: `2px solid ${value === o.key ? 'var(--primary)' : 'var(--border-color)'}`,
              background: value === o.key ? 'var(--primary)' : 'var(--bg-card)', color: value === o.key ? '#fff' : 'var(--text-main)' }}>{o.label}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-body)' }} dir={i18n.dir()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '1.2rem', cursor: 'pointer' }}><FaChevronLeft style={{ transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' }} /></button>
        <AppText as="h2" style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{t('match_create_title', 'Match or Not?')}</AppText>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: '2.4rem' }}>💘</div>
          <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: 400, margin: '8px auto 0' }}>
            {t('match_create_desc', 'Host a live show. People apply to appear, you bring two on stage, and the room votes: match or not!')}
          </AppText>
        </div>

        <div className="gg-card" style={{ padding: 16, marginBottom: 16 }}>
          <AppText as="div" style={{ fontWeight: 700, marginBottom: 10, textAlign: 'center' }}>{t('match_slots', 'The two slots')}</AppText>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <SlotPicker value={slotA} onChange={setSlotA} label={t('match_slot_a', 'Slot 1')} />
            <div style={{ fontSize: '1.4rem', paddingBottom: 8 }}>❤️</div>
            <SlotPicker value={slotB} onChange={setSlotB} label={t('match_slot_b', 'Slot 2')} />
          </div>
          <AppText as="div" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>♂ {t('match_male', 'Male')} · ♀ {t('match_female', 'Female')} · ★ {t('match_any', 'Any')}</AppText>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { key: 'public', icon: FaGlobe, title: t('group_game_vis_public', 'Everyone'), hint: t('group_game_vis_public_hint', 'Anyone can join') },
            { key: 'invite_only', icon: FaLock, title: t('group_game_vis_private', 'Private'), hint: t('group_game_vis_private_hint', 'Invite specific people') },
          ].map(({ key, icon: Icon, title, hint }) => (
            <button key={key} type="button" onClick={() => setVisibility(key)}
              style={{ padding: '14px 10px', borderRadius: 14, cursor: 'pointer', textAlign: 'center', border: `2px solid ${visibility === key ? 'var(--primary)' : 'var(--border-color)'}`, background: visibility === key ? 'rgba(232,110,46,0.08)' : 'var(--bg-card)', color: 'var(--text-main)' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
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

        <button type="button" className="gg-btn gg-btn--primary gg-btn--block" disabled={creating} onClick={create}>
          <FaHeart /> {creating ? t('group_game_creating', 'Creating…') : t('match_create_cta', 'Go live')}
        </button>
      </div>
    </div>
  );
}
