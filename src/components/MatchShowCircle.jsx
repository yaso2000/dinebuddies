import React from 'react';
import { FaHeart } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { AppText } from './base';

/** Prominent circle for a live "Match or Not" show in the stories rail. */
export default function MatchShowCircle({ show, onClick }) {
  const { t } = useTranslation();
  const name = show?.hostName || t('match_title', 'Match or Not?');
  const avatar = typeof show?.hostAvatar === 'string' && show.hostAvatar.startsWith('http') ? show.hostAvatar : '';
  const initial = (show?.hostName || 'M').trim().charAt(0).toUpperCase();
  const count = Number(show?.applicantCount) || 0;

  return (
    <button type="button" onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: 82 }}>
      <div style={{ position: 'relative', width: 74, height: 74, borderRadius: '50%', padding: 3,
        background: 'conic-gradient(from 210deg, #e11d48, #fb7185, #e86e2e, #e11d48)', animation: 'dbMatchPulse 1.8s ease-in-out infinite' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-card)', display: 'grid', placeItems: 'center' }}>
          {avatar
            ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontWeight: 800, fontSize: 24, color: '#e11d48' }}>{initial}</span>}
        </div>
        <span style={{ position: 'absolute', bottom: -2, insetInlineEnd: -2, width: 26, height: 26, borderRadius: '50%', background: '#e11d48', border: '2px solid var(--bg-card)', display: 'grid', placeItems: 'center', color: '#fff' }}>
          <FaHeart size={12} />
        </span>
        <span style={{ position: 'absolute', top: -7, insetInlineStart: '50%', transform: 'translateX(-50%)', background: '#e11d48', color: '#fff', fontSize: 8, fontWeight: 900, letterSpacing: 1, padding: '2px 7px', borderRadius: 8, border: '1.5px solid var(--bg-card)', whiteSpace: 'nowrap' }}>
          MATCH
        </span>
      </div>
      <AppText as="span" style={{ fontSize: '0.72rem', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)', fontWeight: 700 }} format={false}>
        {name}
      </AppText>
      {count ? <AppText as="span" style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginTop: -2 }} format={false}>{count} 🙋</AppText> : null}
      <style>{'@keyframes dbMatchPulse{0%,100%{filter:drop-shadow(0 0 0 rgba(225,29,72,0))}50%{filter:drop-shadow(0 0 6px rgba(225,29,72,0.6))}}'}</style>
    </button>
  );
}
