import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useTasteScope from './useTasteScope';

/**
 * Own-profile entry card shown only when the current user has NOT taken the quiz
 * yet: "اكتشف لقب ذوقك" → /tastescope. Hides itself once a title exists (the
 * inline badge takes over). See TASTESCOPE_SPEC.md §7.
 */
export default function TasteScopeCtaCard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { hasTitle } = useTasteScope();

  if (hasTitle) return null;

  return (
    <button
      type="button"
      onClick={() => navigate('/tastescope')}
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
          {t('tastescope.profile.cta', 'اكتشف لقب ذوقك')}
        </span>
        <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)' }}>
          {t('tastescope.profile.ctaSub', 'عشر صور، أقل من دقيقة')}
        </span>
      </span>
      <span style={{ fontSize: '1.1rem', color: 'var(--text-tertiary, #9ca3af)', transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' }}>›</span>
    </button>
  );
}
