import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DIRECTORY_CARD_STYLE_IDS,
  normalizeDirectoryCardStyleId,
} from '../../constants/directoryCardStyles';
import UserDirectoryCard from '../UserDirectory/UserDirectoryCard';
import { AppText } from '../base';
import './ProfileDirectoryCardStyleSection.css';

const STYLE_META = {
  hexagon: {
    labelKey: 'user_directory_card_style_hexagon',
    labelDefault: 'Full hexagon',
    swatchClass: 'profile-card-style__swatch--hexagon',
  },
  tilt: {
    labelKey: 'user_directory_card_style_tilt',
    labelDefault: 'Tilted square',
    swatchClass: 'profile-card-style__swatch--tilt',
  },
  circle: {
    labelKey: 'user_directory_card_style_circle',
    labelDefault: 'Circle',
    swatchClass: 'profile-card-style__swatch--circle',
  },
  halfHex: {
    labelKey: 'user_directory_card_style_half_hex',
    labelDefault: 'Half hexagon',
    swatchClass: 'profile-card-style__swatch--halfHex',
  },
};

/**
 * Own-profile control: choose how this member appears on the directory cards grid.
 */
export default function ProfileDirectoryCardStyleSection({
  styleId,
  previewUser,
  currentUser,
  onStyleChange,
  saving = false,
}) {
  const { t } = useTranslation();
  const [busyId, setBusyId] = useState(null);
  const selected = normalizeDirectoryCardStyleId(styleId);

  const preview = useMemo(
    () => ({
      ...(previewUser || {}),
      directoryCardStyle: selected,
    }),
    [previewUser, selected]
  );

  const handleSelect = async (id) => {
    if (!onStyleChange || id === selected || busyId) return;
    setBusyId(id);
    try {
      await onStyleChange(id);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section
      className="profile-card-style"
      aria-labelledby="profile-card-style-title"
    >
      <AppText as="h3" id="profile-card-style-title" className="profile-card-style__title">
        {t('profile_directory_card_style_title', 'Directory card style')}
      </AppText>
      <AppText as="p" className="profile-card-style__hint">
        {t(
          'profile_directory_card_style_hint',
          'Choose how your profile card looks in the members directory. Other members may use different styles.'
        )}
      </AppText>

      <div
        className="profile-card-style__options"
        role="radiogroup"
        aria-label={t('user_directory_card_style_aria', 'Profile card style')}
      >
        {DIRECTORY_CARD_STYLE_IDS.map((id, index) => {
          const meta = STYLE_META[id];
          const active = selected === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`profile-card-style__option${active ? ' profile-card-style__option--active' : ''}`}
              disabled={Boolean(busyId) || saving}
              onClick={() => handleSelect(id)}
            >
              <span className={`profile-card-style__swatch ${meta.swatchClass}`} aria-hidden />
              <AppText as="span" className="profile-card-style__option-label">
                {index + 1}. {t(meta.labelKey, meta.labelDefault)}
              </AppText>
            </button>
          );
        })}
      </div>

      <div className="profile-card-style__preview">
        <AppText as="div" className="profile-card-style__preview-label">
          {t('profile_directory_card_style_preview', 'Preview')}
        </AppText>
        <UserDirectoryCard
          user={preview}
          currentUser={currentUser}
          cardStyle={selected}
        />
      </div>
    </section>
  );
}
