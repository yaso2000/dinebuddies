import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/** Own-profile entry card → /pickone. Always shown (the game is replayable). */
export default function PickOneCtaCard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
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
      <span style={{ fontSize: '1.1rem', color: 'var(--text-tertiary, #9ca3af)', transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' }}>›</span>
    </button>
  );
}
