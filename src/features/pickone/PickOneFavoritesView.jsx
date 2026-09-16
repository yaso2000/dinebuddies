import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LISTS, getEntry, entryName, listShort } from './pickoneData';

/** One read-only favorite slot (image + category + dish name). */
function Slot({ list, champ, language }) {
  const [broken, setBroken] = useState(false);
  const category = listShort(list, language);
  const dish = champ ? entryName(champ, language) : '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
      <span style={{
        width: '100%', aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden',
        background: champ ? champ.color : 'var(--bg-elevated, #f1f5f9)',
        border: `1.5px solid ${champ ? 'transparent' : 'var(--border-color, #e5e7eb)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {champ && champ.image && !broken
          ? <img src={champ.image} alt="" onError={() => setBroken(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 20, opacity: 0.45 }}>🍽️</span>}
      </span>
      <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-secondary, #6b7280)', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
        {category}
      </span>
      <span style={{ fontSize: '0.68rem', fontWeight: 900, color: champ ? 'var(--text-main)' : 'var(--text-tertiary, #9ca3af)', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
        {dish || '—'}
      </span>
    </div>
  );
}

/**
 * Read-only Pick One favorites for ANOTHER user's public profile.
 * @param {{ [listId: string]: { championId: string } }} pickOne  from public_profiles.userPublic.pickOne
 * Renders nothing if the user has no favorites yet.
 */
export default function PickOneFavoritesView({ pickOne }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  const slots = LISTS.map((list) => {
    const championId = pickOne?.[list.id]?.championId;
    const champ = championId ? getEntry(list.id, championId) : null;
    return { list, champ };
  });
  if (!slots.some((s) => s.champ)) return null;

  return (
    <div dir={i18n.dir()} style={{ width: '100%', maxWidth: 360, margin: '0 auto' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, textAlign: 'center' }}>
        {t('pickone.profile.theirFavorites', 'Favorite dishes')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {slots.map(({ list, champ }) => (
          <Slot key={list.id} list={list} champ={champ} language={language} />
        ))}
      </div>
    </div>
  );
}
