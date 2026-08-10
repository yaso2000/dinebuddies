import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, updateDoc } from 'firebase/firestore';
import { FaCheck } from 'react-icons/fa';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useDragScrollRail } from '../../hooks/useDragScrollRail';
import { BRAND_TEMPLATES } from '../../utils/businessBrandTemplates';
import { AppText } from '../base';
import './BrandColorSwatchRail.css';

/** Compact drag-to-scroll theme color swatches — tap a color to apply + auto-save. */
export default function BrandColorSwatchRail({ onMore }) {
  const { t } = useTranslation();
  const { currentUser, userProfile } = useAuth();
  const activeThemeId =
    userProfile?.businessInfo?.theme || userProfile?.businessInfo?.brandKit?.templateId || null;
  const [savingId, setSavingId] = useState(null);
  const {
    railRef,
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onWheel,
    wasDragged,
  } = useDragScrollRail();

  const applyTemplate = async (tpl) => {
    if (!currentUser?.uid || savingId) return;
    setSavingId(tpl.id);
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        'businessInfo.brandKit': { ...tpl.kit, templateId: tpl.id },
        'businessInfo.theme': tpl.id,
      });
    } catch (err) {
      console.error('[BrandColorSwatchRail] save error:', err);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div
      ref={railRef}
      className={`brand-color-rail${isDragging ? ' is-dragging' : ''}`}
      role="listbox"
      aria-label={t('brand_kit_theme_color', 'Theme color')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onWheel={onWheel}
    >
      {BRAND_TEMPLATES.map((tpl) => {
        const active = activeThemeId === tpl.id;
        return (
          <button
            key={tpl.id}
            type="button"
            role="option"
            aria-selected={active}
            aria-label={tpl.name}
            title={tpl.name}
            disabled={savingId != null}
            className={`brand-color-swatch${active ? ' brand-color-swatch--active' : ''}`}
            style={{ background: `linear-gradient(135deg, ${tpl.kit.primaryColor}, ${tpl.kit.secondaryColor})` }}
            onClick={() => {
              if (wasDragged()) return;
              applyTemplate(tpl);
            }}
          >
            {savingId === tpl.id ? (
              <AppText as="span" className="brand-color-swatch__spinner" aria-hidden />
            ) : active ? (
              <FaCheck size={11} aria-hidden />
            ) : null}
          </button>
        );
      })}
      {onMore ? (
        <button
          type="button"
          className="brand-color-swatch brand-color-swatch--more"
          title={t('brand_kit_more', 'More styles')}
          onClick={() => {
            if (wasDragged()) return;
            onMore();
          }}
        >
          <AppText as="span">•••</AppText>
        </button>
      ) : null}
    </div>
  );
}
