import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlus } from 'react-icons/fa';
import { sectionLabel } from '../../config/businessProfileConfig';

const SECTION_EMOJI = {
  about: '📝', hours: '🕒', contact: '☎️', delivery: '🛵', menu: '🍽️', services: '🧰', events: '🎉',
};

/**
 * The "+" control shown to owners at the end of the tab list. Opens a picker of
 * sections not currently on the profile; choosing one re-adds it (its content,
 * if any, comes back with it). Renders nothing when every section is already on.
 */
export default function BusinessSectionPicker({ disabled = [], type, onAdd }) {
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.language || 'ar').startsWith('ar');
  const [open, setOpen] = useState(false);

  if (!disabled.length) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('business_add_section', 'أضف قسمًا')}
        title={t('business_add_section', 'أضف قسمًا')}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 38, height: 38, borderRadius: 10, border: '1px dashed var(--border-color,#e5e7eb)',
          background: 'transparent', color: 'var(--primary,#ef4444)', cursor: 'pointer', flexShrink: 0,
        }}
      >
        <FaPlus />
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={overlay}>
          <div onClick={(e) => e.stopPropagation()} dir={i18n.dir()} style={sheet}>
            <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--border-color,#e5e7eb)', margin: '0 auto 14px' }} />
            <h3 style={{ margin: '0 0 4px', fontWeight: 800 }}>{t('business_add_section', 'أضف قسمًا')}</h3>
            <p style={{ margin: '0 0 14px', fontSize: '0.82rem', color: 'var(--text-secondary,#6b7280)' }}>
              {t('business_add_section_hint', 'اختر قسمًا لإظهاره في صفحتك. محتواه المحفوظ يعود معه.')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {disabled.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { onAdd(id); setOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'start',
                    padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-color,#e5e7eb)',
                    background: 'var(--bg-body,#fff)', color: 'var(--text-main)', cursor: 'pointer',
                    fontSize: '0.95rem', fontWeight: 700,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{SECTION_EMOJI[id] || '➕'}</span>
                  {sectionLabel(id, type, isArabic)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' };
const sheet = { width: '100%', maxWidth: 520, maxHeight: '85dvh', overflowY: 'auto', background: 'var(--bg-card,#fff)', borderRadius: '20px 20px 0 0', padding: '18px 20px calc(24px + env(safe-area-inset-bottom,0px))' };
