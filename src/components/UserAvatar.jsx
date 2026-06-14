import React from 'react';
import { getSafeAvatar, getGenderAvatarRingStyle } from '../utils/avatarUtils';

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

    const ringStyle = noGenderRing
        ? {
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 0,
              borderRadius: '50%',
              boxSizing: 'border-box',
          }
        : getGenderAvatarRingStyle(user, { ringWidth, ringColorOverride });

    const gap = noGenderRing ? 0 : (innerGapWidth ?? Math.max(2, ringWidth));

    const imgStyle = {
        display: 'block',
        borderRadius: style.borderRadius ?? '50%',
        objectFit: 'cover',
        boxSizing: 'border-box',
        ...(gap > 0 ? { border: `${gap}px solid var(--avatar-inner-gap, var(--bg-body))` } : {}),
        ...style,
    };

    return (
        <span className={`user-avatar${className ? ` ${className}` : ''}`} style={ringStyle}>
            <img
                src={avatarSrc}
                className="user-avatar__img"
                alt={altText}
                style={imgStyle}
                onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = getSafeAvatar(null);
                }}
                {...props}
            />
        </span>
    );
};

export default UserAvatar;
