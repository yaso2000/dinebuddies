import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { LISTS, getEntry, entryName, listShort } from './pickoneData';

/** One fixed slot per category — the saved favorite dish, or an empty placeholder. */
function Slot({ list, champ, onClick, language, emptyLabel }) {
  const [broken, setBroken] = useState(false);
  const category = listShort(list, language);
  const dish = champ ? entryName(champ, language) : '';
  return (
    <button
      type="button"
      onClick={onClick}
      title={category}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', minWidth: 0,
      }}
    >
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
      <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-secondary, #6b7280)', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {category}
      </span>
      <span style={{ fontSize: '0.68rem', fontWeight: 900, color: champ ? 'var(--text-main)' : 'var(--text-tertiary, #9ca3af)', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {dish || emptyLabel}
      </span>
    </button>
  );
}

/**
 * Own-profile section: a "play" CTA on top, and one fixed slot per food
 * category below it. Each slot shows that category's champion dish (replaced
 * when the category is replayed); tapping a slot plays that category directly.
 */
export default function PickOneCtaCard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const results = userProfile?.pickOne || {};
  const language = i18n.language;
  const rtlArrow = i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none';
  const emptyLabel = t('pickone.profile.empty', 'Not played');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Play CTA on top. */}
      <button
        type="button"
        onClick={() => navigate('/pickone')}
        dir={i18n.dir()}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'start',
          padding: '13px 15px', borderRadius: 16, border: '1px solid var(--border-color, #e5e7eb)',
          background: 'var(--bg-card, #fff)', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 26, lineHeight: 1 }}>🍽️</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {t('pickone.profile.ctaFood', 'Pick One: what is your favorite dish?')}
          </span>
          <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary, #6b7280)' }}>
            {t('pickone.profile.myFavorites', 'Your favorites by category')}
          </span>
        </span>
        <span style={{ fontSize: '1.1rem', color: 'var(--text-tertiary, #9ca3af)', transform: rtlArrow }}>›</span>
      </button>

      {/* One fixed slot per category. */}
      <div dir={i18n.dir()} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {LISTS.map((list) => {
          const r = results[list.id];
          const champ = r?.championId ? getEntry(list.id, r.championId) : null;
          return (
            <Slot
              key={list.id}
              list={list}
              champ={champ}
              language={language}
              emptyLabel={emptyLabel}
              onClick={() => navigate(`/pickone?list=${list.id}`)}
            />
          );
        })}
      </div>
    </div>
  );
}
