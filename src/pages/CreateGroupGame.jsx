import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft, FaHeart, FaUsers } from 'react-icons/fa';
import { groupGameApi } from '../hooks/useGroupGame';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { goToLogin } from '../utils/goToLogin';
import { AppText } from '../components/base';

export default function CreateGroupGame() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { currentUser, isGuest } = useAuth();
  const { showToast } = useToast();

  const [rounds, setRounds] = useState(6);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const requireAuth = () => {
    if (isGuest || !currentUser) { goToLogin(); return false; }
    return true;
  };

  const create = async () => {
    if (!requireAuth()) return;
    setCreating(true);
    try {
      const res = await groupGameApi.create({ type: 'taste_match', roundCount: rounds });
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
            {t('group_game_taste_desc', 'Everyone answers fun this-or-that questions. See who is most in sync — and the couple of the night. Open to everyone.')}
          </AppText>
        </div>

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
