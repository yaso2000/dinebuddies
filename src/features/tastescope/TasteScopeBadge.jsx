import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaTimes } from 'react-icons/fa';
import { titleName, titleDesc, titleVisuals } from './titleDisplay';
import TasteScopeGenerate from './TasteScopeGenerate';
import TitleGlyph from './TitleGlyph';

/**
 * TasteScope title badge. Two variants (TASTESCOPE_SPEC.md §7):
 *   - `full`: pictorial icon + gendered title, tappable → a centered modal with
 *     the description and (own profile only) the generated profile + a CTA.
 *   - `icon`: the pictorial icon only, title via aria-label/tooltip; purely
 *     visual so it can sit inside an already-clickable user card.
 *
 * @param {string}  titleId  required — nothing renders without it
 * @param {'male'|'female'} gender  picks the Arabic masculine/feminine form
 * @param {'full'|'icon'} variant  default 'full'
 * @param {boolean} showCta  show the own-profile content + CTA in the modal
 * @param {number}  size     icon diameter override (icon variant)
 */
export default function TasteScopeBadge({
  titleId, gender, variant = 'full', showCta = false, size,
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isArabic = (i18n.language || 'ar').startsWith('ar');

  // Lock the page behind the modal (iOS otherwise scrolls the profile/sticky
  // header behind the overlay, so the two "mix").
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!titleId) return null;

  const name = titleName(t, titleId, gender, isArabic);
  const desc = titleDesc(t, titleId, gender, isArabic);
  const { accent } = titleVisuals(titleId);

  if (variant === 'icon') {
    return <TitleGlyph titleId={titleId} title={name} size={size || 36} />;
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
        <TitleGlyph titleId={titleId} title={name} size={26} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      </button>

      {open && createPortal(
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.62)', zIndex: 2147483000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'max(16px, env(safe-area-inset-top, 0px)) 16px max(16px, env(safe-area-inset-bottom, 0px))', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            dir={i18n.dir()}
            style={{ position: 'relative', width: '100%', maxWidth: 480, maxHeight: '86dvh', overflowY: 'auto', background: 'var(--bg-card, #fff)', borderRadius: 20, padding: '22px 22px 24px', textAlign: 'center', boxShadow: '0 18px 50px rgba(0,0,0,0.28)' }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('close', 'إغلاق')}
              style={{ position: 'absolute', top: 12, insetInlineEnd: 12, width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'var(--bg-body, rgba(0,0,0,0.06))', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem' }}
            >
              <FaTimes />
            </button>
            <TitleGlyph titleId={titleId} title={name} size={80} style={{ margin: '4px auto 10px', boxShadow: '0 6px 20px rgba(0,0,0,0.12)' }} />
            <h3 style={{ fontSize: '1.35rem', fontWeight: 900, margin: '0 0 8px', color: accent }}>{name}</h3>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: 1.7, margin: '0 0 18px' }}>{desc}</p>

            {/* Own profile: the generated reading + cover live here so they're
                always reachable after the quiz is closed. */}
            {showCta && <TasteScopeGenerate />}

            {showCta && (
              <button
                type="button"
                onClick={() => { setOpen(false); navigate('/tastescope'); }}
                style={{
                  display: 'block', width: '100%', padding: '13px 16px', borderRadius: 14, border: 'none',
                  background: 'var(--primary, #ef4444)', color: '#fff',
                  fontSize: '0.98rem', fontWeight: 800, cursor: 'pointer',
                }}
              >
                {t('tastescope.intro.openTastescope', 'افتح اختبار الطعام')}
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
