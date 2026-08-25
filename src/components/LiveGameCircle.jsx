import React from 'react';
import { FaGamepad, FaLock } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { AppText } from './base';

/** TikTok-style circle for a joinable group game in the stories rail. */
export default function LiveGameCircle({ game, isHost, onClick }) {
  const { t } = useTranslation();
  const name = isHost ? t('group_game_your_game', 'Your game') : (game?.hostName || 'Game');
  const avatar = typeof game?.hostAvatar === 'string' && game.hostAvatar.startsWith('http') ? game.hostAvatar : '';
  const count = Array.isArray(game?.playerIds) ? game.playerIds.length : 0;
  const isPrivate = game?.visibility === 'invite_only';
  const initial = (game?.hostName || 'G').trim().charAt(0).toUpperCase();

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: 76 }}
    >
      <div style={{ position: 'relative', width: 68, height: 68, borderRadius: '50%', padding: 3, background: 'conic-gradient(from 210deg, #e86e2e, #f0a24b, #db2777, #e86e2e)' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-card)', display: 'grid', placeItems: 'center' }}>
          {avatar
            ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontWeight: 800, fontSize: 22, color: 'var(--primary)' }}>{initial}</span>}
        </div>
        {/* game badge */}
        <span style={{ position: 'absolute', bottom: -2, insetInlineEnd: -2, width: 24, height: 24, borderRadius: '50%', background: 'var(--primary)', border: '2px solid var(--bg-card)', display: 'grid', placeItems: 'center', color: '#fff' }}>
          {isPrivate ? <FaLock size={10} /> : <FaGamepad size={11} />}
        </span>
        {/* PLAY tag */}
        <span style={{ position: 'absolute', top: -6, insetInlineStart: '50%', transform: 'translateX(-50%)', background: '#16a34a', color: '#fff', fontSize: 8, fontWeight: 900, letterSpacing: 1, padding: '2px 6px', borderRadius: 8, border: '1.5px solid var(--bg-card)' }}>
          PLAY
        </span>
      </div>
      <AppText as="span" style={{ fontSize: '0.72rem', maxWidth: 74, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)', fontWeight: 700 }}>
        {name}
      </AppText>
      <AppText as="span" style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: -2 }} format={false}>
        {count} 👥
      </AppText>
    </button>
  );
}
