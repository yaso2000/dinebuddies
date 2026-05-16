import React from 'react';
import { FaPlus } from 'react-icons/fa';
import { getSafeAvatar, getGenderBorderColor } from '../utils/avatarUtils';

/**
 * Profile image with optional gender ring and optional follow "+" badge.
 * Pass followPlus from buildFollowPlusProps(...) where follow actions exist.
 */
const UserAvatar = ({
    user,
    className = '',
    style = {},
    alt,
    src,
    genderRing = true,
    ringWidth = 2,
    followPlus = null,
    followBadgeSize = 16,
    ...props
}) => {
    const avatarSrc = src || getSafeAvatar(user);
    const altText = alt || user?.name || user?.display_name || user?.displayName || 'User';

    const ringColor = genderRing ? getGenderBorderColor(user || {}) : 'transparent';
    const wrapperShadow =
        genderRing && ringColor && ringColor !== 'transparent'
            ? { boxShadow: `0 0 0 ${ringWidth}px ${ringColor}` }
            : {};

    const imgStyle = { borderRadius: '50%', display: 'block', ...style };

    return (
        <span
            className="user-avatar-wrap"
            style={{
                position: 'relative',
                display: 'inline-block',
                lineHeight: 0,
                borderRadius: '50%',
                verticalAlign: 'middle',
                ...wrapperShadow,
            }}
        >
            <img
                src={avatarSrc}
                className={className}
                alt={altText}
                style={imgStyle}
                onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = getSafeAvatar(null);
                }}
                {...props}
            />
            {followPlus?.show && (
                <button
                    type="button"
                    aria-label="Follow"
                    onClick={followPlus.onClick}
                    style={{
                        position: 'absolute',
                        bottom: -2,
                        insetInlineEnd: -2,
                        width: followBadgeSize,
                        height: followBadgeSize,
                        borderRadius: '50%',
                        background: followPlus.disabled ? '#9ca3af' : 'var(--primary)',
                        border: '2px solid var(--bg-card, #fff)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: Math.max(7, followBadgeSize * 0.45),
                        padding: 0,
                        cursor: followPlus.disabled ? 'not-allowed' : 'pointer',
                        zIndex: 4,
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                    }}
                >
                    <FaPlus />
                </button>
            )}
        </span>
    );
};

export default UserAvatar;
