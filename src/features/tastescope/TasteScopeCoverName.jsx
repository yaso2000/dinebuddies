import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { normalizeUserGender } from '../../utils/avatarUtils';
import useTasteScope from './useTasteScope';
import { titleName, titleVisuals } from './titleDisplay';

/**
 * A small accent-colored pill with the signed-in user's TasteScope title name,
 * meant to sit on the profile cover in the top-inline-start corner — the corner
 * opposite the header action buttons (help / theme). Renders nothing until the
 * user has a title. Positioning is provided by the parent (absolute container).
 */
export default function TasteScopeCoverName() {
  const { t, i18n } = useTranslation();
  const { userProfile } = useAuth();
  const { titleId, hasTitle } = useTasteScope();
  const isArabic = (i18n.language || 'ar').startsWith('ar');

  if (!hasTitle || !titleId) return null;

  const name = titleName(t, titleId, normalizeUserGender(userProfile), isArabic);
  const { accent } = titleVisuals(titleId);
  if (!name) return null;

  return (
    <span
      dir={i18n.dir()}
      style={{
        position: 'absolute', top: '0.55rem', insetInlineStart: '0.55rem', zIndex: 6,
        maxWidth: '60%', padding: '4px 11px', borderRadius: 999,
        background: accent, color: '#fff', fontSize: '0.8rem', fontWeight: 800, lineHeight: 1.2,
        boxShadow: '0 2px 6px rgba(0,0,0,0.28)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {name}
    </span>
  );
}
