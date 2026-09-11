import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { titleName, titleDesc, titleVisuals } from './titleDisplay';

/**
 * TasteScope title badge. Two variants (TASTESCOPE_SPEC.md §7):
 *   - `full`: emoji + gendered title, tappable → bottom sheet with the
 *     description and (own profile only) a quiz/retake CTA.
 *   - `icon`: emoji only (~20px), title exposed via aria-label/tooltip; purely
 *     visual so it can sit inside an already-clickable user card.
 *
 * @param {string}  titleId          required — nothing renders without it
 * @param {'male'|'female'} gender    picks the Arabic masculine/feminine form
 * @param {'full'|'icon'} variant     default 'full'
 * @param {boolean} showCta           show the quiz/retake CTA in the sheet (own profile)
 * @param {boolean} canRetake         gates the CTA label/action
 * @param {number}  daysUntilRetake   used in the locked CTA label
 */
export default function TasteScopeBadge({
  titleId, gender, variant = 'full', showCta = false, canRetake = true, daysUntilRetake = 0,
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isArabic = (i18n.language || 'ar').startsWith('ar');

  if (!titleId) return null;

  const name = titleName(t, titleId, gender, isArabic);
  const desc = titleDesc(t, titleId, gender, isArabic);
  const { emoji, accent } = titleVisuals(titleId);

  if (variant === 'icon') {
    return (
      <span
        role="img"
        aria-label={name}
        title={name}
        style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}
      >
        {emoji}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={name}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px 3px 8px',
          borderRadius: 999, border: `1px solid ${accent}`, background: 'transparent',
          color: accent, fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer', maxWidth: '100%',
        }}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>{emoji}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            dir={i18n.dir()}
            style={{ width: '100%', maxWidth: 520, background: 'var(--bg-card, #fff)', borderRadius: '20px 20px 0 0', padding: '20px 22px calc(26px + env(safe-area-inset-bottom, 0px))', textAlign: 'center' }}
          >
            <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--border-color, #e5e7eb)', margin: '0 auto 16px' }} />
            <div style={{ fontSize: '2.6rem', lineHeight: 1, marginBottom: 8 }}>{emoji}</div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 900, margin: '0 0 8px', color: accent }}>{name}</h3>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: 1.7, margin: '0 0 18px' }}>{desc}</p>

            {showCta && (
              <button
                type="button"
                onClick={() => { if (canRetake) navigate('/tastescope'); }}
                disabled={!canRetake}
                style={{
                  display: 'block', width: '100%', padding: '13px 16px', borderRadius: 14, border: 'none',
                  background: canRetake ? 'var(--primary, #ef4444)' : 'var(--bg-body, #f3f4f6)',
                  color: canRetake ? '#fff' : 'var(--text-tertiary, #9ca3af)',
                  fontSize: '0.98rem', fontWeight: 800, cursor: canRetake ? 'pointer' : 'not-allowed',
                }}
              >
                {canRetake
                  ? t('tastescope.intro.retake', 'أعد الاختبار')
                  : t('tastescope.profile.retakeIn', { days: daysUntilRetake, defaultValue: `أعد الاختبار بعد ${daysUntilRetake} يوم` })}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
