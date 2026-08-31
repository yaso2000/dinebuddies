import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppText } from './base';

/** Prominent circle for a live "Camera or AI?" round in the stories rail.
 *  Pass `label` to override the caption (e.g. the owner's own "Your card"). */
export default function RealOrAiCircle({ post, onClick, label }) {
  const { t } = useTranslation();
  const name = label || post?.ownerName || t('roa_title', 'Camera or AI?');
  const img = typeof post?.imageUrl === 'string' && post.imageUrl.startsWith('http') ? post.imageUrl : '';
  const count = Number(post?.voteCount) || 0;

  return (
    <button type="button" onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: 82 }}>
      <div style={{ position: 'relative', width: 74, height: 74, borderRadius: '50%', padding: 3,
        background: 'conic-gradient(from 210deg, #0ea5e9, #a855f7, #0ea5e9)', animation: 'dbRoaPulse 1.8s ease-in-out infinite' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-card)', display: 'grid', placeItems: 'center' }}>
          {img
            ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 26 }} aria-hidden>🎭</span>}
        </div>
        <span style={{ position: 'absolute', bottom: -2, insetInlineEnd: -2, minWidth: 26, height: 22, padding: '0 6px', borderRadius: 11, background: '#0ea5e9', border: '2px solid var(--bg-card)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 9, fontWeight: 900 }}>
          AI?
        </span>
      </div>
      <AppText as="span" style={{ fontSize: '0.72rem', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)', fontWeight: 700 }} format={false}>
        {name}
      </AppText>
      {count ? <AppText as="span" style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginTop: -2 }} format={false}>{count} 🗳️</AppText> : null}
      <style>{'@keyframes dbRoaPulse{0%,100%{filter:drop-shadow(0 0 0 rgba(14,165,233,0))}50%{filter:drop-shadow(0 0 6px rgba(168,85,247,0.6))}}'}</style>
    </button>
  );
}
