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
    ...props
}) => {
    const avatarSrc = src || getSafeAvatar(user);
    const altText = alt || user?.name || user?.display_name || user?.displayName || 'User Avatar';

    const ringStyle = noGenderRing
        ? { display: 'inline-block', lineHeight: 0 }
        : getGenderAvatarRingStyle(user, { ringWidth, ringColorOverride });

    const imgStyle = {
        display: 'block',
        borderRadius: style.borderRadius ?? '50%',
        objectFit: 'cover',
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
