import React from 'react';
import { getSafeAvatar, getGenderAvatarRingStyle } from '../utils/avatarUtils';
import { AppText } from "./base";

const DEFAULT_AVATAR_PX = 40;

/**
 * Profile avatar with gender ring: blue (male), pink (female), purple (unspecified).
 * Business accounts use the neutral theme border color.
 */
const UserAvatar = ({
  user,
  className = '',
  style = {},
  alt,
  src,
  ringWidth = 2,
  ringColorOverride,
  noGenderRing = false,
  innerGapWidth,
  ...props
}) => {
  const avatarSrc = src || getSafeAvatar(user);
  const altText = alt || user?.name || user?.display_name || user?.displayName || 'User Avatar';

  const ringStyle = noGenderRing ?
  {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 0,
    borderRadius: '50%',
    boxSizing: 'border-box'
  } :
  getGenderAvatarRingStyle(user, { ringWidth, ringColorOverride });

  const gap = noGenderRing ? 0 : innerGapWidth ?? Math.max(2, ringWidth);

  const {
    width,
    height,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    borderRadius,
    ...restStyle
  } = style;

  const wrapperStyle = {
    ...ringStyle,
    flexShrink: 0,
    overflow: 'hidden',
    ...(width != null ? { width } : {}),
    ...(height != null ? { height } : {}),
    ...(minWidth != null ? { minWidth } : {}),
    ...(minHeight != null ? { minHeight } : {}),
    ...(maxWidth != null ? { maxWidth } : {}),
    ...(maxHeight != null ? { maxHeight } : {})
  };

  const hasWrapperSize =
  width != null ||
  height != null ||
  minWidth != null ||
  minHeight != null ||
  maxWidth != null ||
  maxHeight != null;

  const imgStyle = {
    display: 'block',
    borderRadius: borderRadius ?? '50%',
    objectFit: 'cover',
    boxSizing: 'border-box',
    flexShrink: 0,
    ...(gap > 0 ? { border: `${gap}px solid var(--avatar-inner-gap, var(--bg-body))` } : {}),
    ...(hasWrapperSize ?
    { width: '100%', height: '100%', minWidth: 0, minHeight: 0 } :
    {
      width: width ?? `${DEFAULT_AVATAR_PX}px`,
      height: height ?? `${DEFAULT_AVATAR_PX}px`,
      minWidth: minWidth ?? width ?? `${DEFAULT_AVATAR_PX}px`,
      minHeight: minHeight ?? height ?? `${DEFAULT_AVATAR_PX}px`,
      maxWidth: maxWidth ?? width ?? `${DEFAULT_AVATAR_PX}px`,
      maxHeight: maxHeight ?? height ?? `${DEFAULT_AVATAR_PX}px`
    }),
    ...restStyle
  };

  return (
    <AppText as="span" className={`user-avatar${className ? ` ${className}` : ''}`} style={wrapperStyle}>
            <img
        src={avatarSrc}
        className="user-avatar__img"
        alt={altText}
        style={imgStyle}
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = getSafeAvatar(null);
        }}
        {...props} />
      
        </AppText>);

};

export default UserAvatar;