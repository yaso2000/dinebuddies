import React from 'react';
import { FaQuestion } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { AppText } from './base';

/** Prominent circle for a live "Who suits you?" (مَن يناسبك؟) poll in the rail. */
export default function SuitabilityCircle({ post, onClick }) {
  const { t } = useTranslation();
  const name = post?.ownerName || t('suitability_title', 'Who suits you?');
  const avatar = typeof post?.ownerAvatar === 'string' && post.ownerAvatar.startsWith('http') ? post.ownerAvatar : '';
  const initial = (post?.ownerName || '?').trim().charAt(0).toUpperCase();
  const count = Number(post?.voteCount) || 0;

  return (
    <button type="button" onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: 82 }}>
      <div style={{ position: 'relative', width: 74, height: 74, borderRadius: '50%', padding: 3,
        background: 'conic-gradient(from 210deg, #7c3aed, #a78bfa, #22d3ee, #7c3aed)', animation: 'dbSuitPulse 1.8s ease-in-out infinite' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-card)', display: 'grid', placeItems: 'center' }}>
          {avatar
            ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontWeight: 800, fontSize: 24, color: '#7c3aed' }}>{initial}</span>}
        </div>
        <span style={{ position: 'absolute', bottom: -2, insetInlineEnd: -2, width: 26, height: 26, borderRadius: '50%', background: '#7c3aed', border: '2px solid var(--bg-card)', display: 'grid', placeItems: 'center', color: '#fff' }}>
          <FaQuestion size={11} />
        </span>
      </div>
      <AppText as="span" style={{ fontSize: '0.72rem', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)', fontWeight: 700 }} format={false}>
        {name}
      </AppText>
      {count ? <AppText as="span" style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginTop: -2 }} format={false}>{count} 🗳️</AppText> : null}
      <style>{'@keyframes dbSuitPulse{0%,100%{filter:drop-shadow(0 0 0 rgba(124,58,237,0))}50%{filter:drop-shadow(0 0 6px rgba(124,58,237,0.6))}}'}</style>
    </button>
  );
}
