import React, { useState } from 'react';
import { getProfileGiftImageSrc } from '../../constants/profileGifts';

const SIZE_CLASS = {
  card: 'profile-gift-visual--card',
  confirm: 'profile-gift-visual--confirm',
  'confirm-full': 'profile-gift-visual--confirm-full',
  ping: 'profile-gift-visual--ping',
};

/**
 * Gift visual — custom image from public/profile-gift-images/ or fallback icon.
 * Images are letterboxed to a fixed box so every gift appears the same size.
 */
export default function ProfileGiftVisual({
  gift,
  className = '',
  imgClassName = '',
  iconClassName = '',
  size = 'card',
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = getProfileGiftImageSrc(gift);
  const Icon = gift?.icon;
  const showImage = Boolean(src && !imgFailed);
  const sizeClass = SIZE_CLASS[size] || SIZE_CLASS.card;

  if (showImage) {
    return (
      <span className={`profile-gift-visual ${sizeClass}${className ? ` ${className}` : ''}`}>
        <img
          src={src}
          alt=""
          className={`profile-gift-visual__img${imgClassName ? ` ${imgClassName}` : ''}`}
          onError={() => setImgFailed(true)}
          draggable={false}
        />
      </span>
    );
  }

  if (!Icon) return null;

  return (
    <span className={`profile-gift-visual ${sizeClass}${className ? ` ${className}` : ''}`}>
      <Icon
        className={`profile-gift-visual__icon${iconClassName ? ` ${iconClassName}` : ''}`}
        aria-hidden
      />
    </span>
  );
}
