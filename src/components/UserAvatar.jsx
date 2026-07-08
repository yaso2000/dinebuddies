import React, { useEffect, useState } from 'react';
import { getSafeAvatar, getAvatarUrlOrNull, getGenderAvatarRingStyle, getDefaultAvatar } from '../utils/avatarUtils';
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
  solidPlaceholder = false,
  innerGapWidth,
  ...props
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const resolvedSrc =
    src ||
    (solidPlaceholder ? getAvatarUrlOrNull(user) : getSafeAvatar(user));
  const showSolid = solidPlaceholder && (!resolvedSrc || imgFailed);

  useEffect(() => {
    setImgFailed(false);
  }, [resolvedSrc]);

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
    flexShrink,
    margin,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    marginInline,
    marginInlineStart,
    marginInlineEnd,
    marginBlock,
    marginBlockStart,
    marginBlockEnd,
    alignSelf,
    ...restStyle
  } = style;

  const wrapperLayout = {
    ...(flexShrink != null ? { flexShrink } : {}),
    ...(margin != null ? { margin } : {}),
    ...(marginTop != null ? { marginTop } : {}),
    ...(marginRight != null ? { marginRight } : {}),
    ...(marginBottom != null ? { marginBottom } : {}),
    ...(marginLeft != null ? { marginLeft } : {}),
    ...(marginInline != null ? { marginInline } : {}),
    ...(marginInlineStart != null ? { marginInlineStart } : {}),
    ...(marginInlineEnd != null ? { marginInlineEnd } : {}),
    ...(marginBlock != null ? { marginBlock } : {}),
    ...(marginBlockStart != null ? { marginBlockStart } : {}),
    ...(marginBlockEnd != null ? { marginBlockEnd } : {}),
    ...(alignSelf != null ? { alignSelf } : {}),
  };

  const wrapperStyle = {
    ...ringStyle,
    ...wrapperLayout,
    flexShrink: wrapperLayout.flexShrink ?? 0,
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
    ...(solidPlaceholder ? { background: 'var(--bg-body)' } : {}),
    ...restStyle
  };

  if (showSolid) {
    return (
      <AppText
        as="span"
        className={`user-avatar user-avatar--solid-placeholder${className ? ` ${className}` : ''}`}
        style={{ ...wrapperStyle, background: 'var(--bg-body)' }}
        aria-label={altText}
        role="img"
      />
    );
  }

  return (
    <AppText as="span" className={`user-avatar${className ? ` ${className}` : ''}`} style={wrapperStyle}>
            <img
        src={resolvedSrc}
        className="user-avatar__img"
        alt={altText}
        style={imgStyle}
        onError={(e) => {
          if (solidPlaceholder) {
            setImgFailed(true);
            return;
          }
          // Stable, name-based data-URI default — never re-fetches, so it can't loop or flicker.
          e.target.onerror = null;
          e.target.src = getDefaultAvatar(
            user?.display_name || user?.displayName || user?.name || ''
          );
        }}
        {...props} />
      
        </AppText>);

};

export default UserAvatar;