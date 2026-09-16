import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { getEntry, entryName, listTitle, getList } from './pickoneData';

/**
 * Own-profile entry card → /pickone. When the user has played, it shows their
 * latest "favorite dish" (champion) with its image; otherwise a plain CTA.
 */
export default function PickOneCtaCard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [broken, setBroken] = useState(false);

  // Most recently played result across all lists (by playedAt).
  const latest = useMemo(() => {
    const results = userProfile?.pickOne;
    if (!results || typeof results !== 'object') return null;
    let best = null;
    for (const [listId, r] of Object.entries(results)) {
      if (!r?.championId) continue;
      const ts = r.playedAt?.seconds ?? r.playedAt?._seconds ?? 0;
      if (!best || ts >= best.ts) best = { listId, championId: r.championId, ts };
    }
    if (!best) return null;
    const entry = getEntry(best.listId, best.championId);
    if (!entry) return null;
    return { entry, list: getList(best.listId) };
  }, [userProfile?.pickOne]);

  const rtlArrow = i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none';

  if (latest) {
    const name = entryName(latest.entry, i18n.language);
    return (
      <button
        type="button"
        onClick={() => navigate('/pickone')}
        dir={i18n.dir()}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'start',
          padding: '10px 12px', borderRadius: 16, border: '1px solid var(--border-color, #e5e7eb)',
          background: 'var(--bg-card, #fff)', cursor: 'pointer',
        }}
      >
        <span style={{ width: 54, height: 54, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: latest.entry.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {latest.entry.image && !broken
            ? <img src={latest.entry.image} alt="" onError={() => setBroken(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ color: '#fff', fontWeight: 900, fontSize: '1.3rem' }}>{name.trim().charAt(0)}</span>}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-secondary, #6b7280)' }}>
            {t('pickone.profile.favorite', 'My favorite dish')}
          </span>
          <span style={{ display: 'block', fontSize: '1.02rem', fontWeight: 900, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
          <span style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-tertiary, #9ca3af)' }}>
            {t('pickone.profile.playAgain', 'Tap to play again')}
          </span>
        </span>
        <span style={{ fontSize: '1.1rem', color: 'var(--text-tertiary, #9ca3af)', transform: rtlArrow }}>›</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => navigate('/pickone')}
      dir={i18n.dir()}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'start',
        padding: '14px 16px', borderRadius: 16, border: '1px solid var(--border-color, #e5e7eb)',
        background: 'var(--bg-card, #fff)', cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 28, lineHeight: 1 }}>🍽️</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-main)' }}>
          {t('pickone.profile.ctaFood', 'Pick One: what is your favorite dish?')}
        </span>
        <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)' }}>
          {t('pickone.profile.ctaSub', '19 taps, one winner, share it to your story')}
        </span>
      </span>
      <span style={{ fontSize: '1.1rem', color: 'var(--text-tertiary, #9ca3af)', transform: rtlArrow }}>›</span>
    </button>
  );
}
