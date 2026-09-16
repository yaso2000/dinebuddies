import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import { LISTS, getEntry, entryName, listShort } from './pickoneData';
import usePickOne from './usePickOne';

/** One slot per category — the saved favorite dish, or an empty placeholder. */
function Slot({ list, champ, onClick, onDelete, language, emptyLabel, deleteLabel }) {
  const [broken, setBroken] = useState(false);
  const category = listShort(list, language);
  const dish = champ ? entryName(champ, language) : '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0, position: 'relative' }}>
      <button
        type="button"
        onClick={onClick}
        title={category}
        style={{ width: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
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
      </button>

      {champ && onDelete ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label={deleteLabel}
          title={deleteLabel}
          style={{
            position: 'absolute', top: -6, insetInlineEnd: -6, width: 22, height: 22, borderRadius: '50%',
            border: '1.5px solid #fff', background: 'rgba(0,0,0,0.62)', color: '#fff', fontSize: 13, lineHeight: 1,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, padding: 0,
          }}
        >×</button>
      ) : null}

      <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-secondary, #6b7280)', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
        {category}
      </span>
      <span style={{ fontSize: '0.68rem', fontWeight: 900, color: champ ? 'var(--text-main)' : 'var(--text-tertiary, #9ca3af)', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
        {dish || emptyLabel}
      </span>
    </div>
  );
}

/**
 * Own-profile section: a "play" CTA on top, and one slot per food category
 * below. Each slot shows that category's champion dish (replaced on replay), or
 * an empty placeholder. Tapping a slot plays that category; the × removes the
 * favorite from display without resetting the weekly cooldown (anti-cheat).
 */
export default function PickOneCtaCard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const { userProfile } = useAuth();
  const { deleteFavorite } = usePickOne();
  const results = userProfile?.pickOne || {};
  const language = i18n.language;
  const rtlArrow = i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none';
  const emptyLabel = t('pickone.profile.empty', 'Not played');
  const deleteLabel = t('pickone.profile.delete', 'Remove');

  const handleDelete = async (list) => {
    const ok = await confirm({
      title: t('pickone.profile.deleteTitle', 'Remove this favorite?'),
      message: t('pickone.profile.deleteBody', 'It disappears from your profile, but you still can’t replay this category until a week has passed.'),
      confirmLabel: t('pickone.profile.delete', 'Remove'),
      cancelLabel: t('cancel', 'Cancel'),
      tone: 'danger',
    });
    if (!ok) return;
    const r = await deleteFavorite(list.id);
    if (!r?.ok) showToast(t('pickone.profile.deleteFailed', 'Could not remove, try again'), 'error');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
              deleteLabel={deleteLabel}
              onClick={() => navigate(`/pickone?list=${list.id}`)}
              onDelete={() => handleDelete(list)}
            />
          );
        })}
      </div>
    </div>
  );
}
