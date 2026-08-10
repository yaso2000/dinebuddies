import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, updateDoc } from 'firebase/firestore';
import { FaCheck } from 'react-icons/fa';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useDragScrollRail } from '../../hooks/useDragScrollRail';
import { BRAND_TEMPLATES } from '../../utils/businessBrandTemplates';
import { AppText } from '../base';
import './PersonalCardThemeRail.css';

/** Compact drag-to-scroll card color picker for personal profiles — tap to apply + auto-save. */
export default function PersonalCardThemeRail() {
  const { t } = useTranslation();
  const { currentUser, userProfile } = useAuth();
  const activeThemeId = userProfile?.cardTheme?.themeId || null;
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

  const applyTheme = async (tpl) => {
    if (!currentUser?.uid || savingId) return;
    setSavingId(tpl.id);
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        cardTheme: {
          themeId: tpl.id,
          primaryColor: tpl.kit.primaryColor,
          secondaryColor: tpl.kit.secondaryColor,
        },
      });
    } catch (err) {
      console.error('[PersonalCardThemeRail] save error:', err);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div
      ref={railRef}
      className={`personal-card-theme-rail${isDragging ? ' is-dragging' : ''}`}
      role="listbox"
      aria-label={t('personal_card_theme_color', 'Card color')}
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
            className={`personal-card-theme-swatch${active ? ' personal-card-theme-swatch--active' : ''}`}
            style={{ background: `linear-gradient(135deg, ${tpl.kit.primaryColor}, ${tpl.kit.secondaryColor})` }}
            onClick={() => {
              if (wasDragged()) return;
              applyTheme(tpl);
            }}
          >
            {savingId === tpl.id ? (
              <AppText as="span" className="personal-card-theme-swatch__spinner" aria-hidden />
            ) : active ? (
              <FaCheck size={11} aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
