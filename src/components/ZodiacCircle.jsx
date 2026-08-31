import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppText } from './base';

/** Prominent circle for a live "Guess my sign?" card in the stories rail.
 *  Pass `label` to override the caption (e.g. the owner's own "Your card"). */
export default function ZodiacCircle({ post, onClick, label }) {
  const { t } = useTranslation();
  const name = label || post?.ownerName || t('zodiac_title', 'Guess my sign?');
  const img = typeof post?.ownerAvatar === 'string' && post.ownerAvatar.startsWith('http') ? post.ownerAvatar : '';
  const count = Number(post?.voteCount) || 0;

  return (
    <button type="button" onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: 82 }}>
      <div style={{ position: 'relative', width: 74, height: 74, borderRadius: '50%', padding: 3,
        background: 'conic-gradient(from 210deg, #7c3aed, #4f46e5, #7c3aed)', animation: 'dbZodPulse 1.8s ease-in-out infinite' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-card)', display: 'grid', placeItems: 'center' }}>
          {img
            ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 26 }} aria-hidden>🔮</span>}
        </div>
        <span style={{ position: 'absolute', bottom: -2, insetInlineEnd: -2, minWidth: 22, height: 22, padding: '0 4px', borderRadius: 11, background: '#7c3aed', border: '2px solid var(--bg-card)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 12 }} aria-hidden>
          🔮
        </span>
      </div>
      <AppText as="span" style={{ fontSize: '0.72rem', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)', fontWeight: 700 }} format={false}>
        {name}
      </AppText>
      {count ? <AppText as="span" style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginTop: -2 }} format={false}>{count} 🗳️</AppText> : null}
      <style>{'@keyframes dbZodPulse{0%,100%{filter:drop-shadow(0 0 0 rgba(124,58,237,0))}50%{filter:drop-shadow(0 0 6px rgba(79,70,229,0.6))}}'}</style>
    </button>
  );
}
