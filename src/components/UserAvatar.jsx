import React from 'react';
import { getSafeAvatar, getGenderBorderColor } from '../utils/avatarUtils';

/**
 * A reusable wrapper for rendering a user's avatar.
 * It automatically fetches the correct image URL and applies
 * a colored outline corresponding to the user's gender or role.
 * 
 * We use `outline` instead of `border` to prevent disrupting
 * carefully aligned layouts (e.g. overlapping avatars).
 */
const UserAvatar = ({ 
    user, 
    className = '', 
    style = {}, 
    alt, 
    src, 
    ...props 
}) => {
    // Determine the source either from the explicit prop or from the user object
    const avatarSrc = src || getSafeAvatar(user);
    
    // Fallback alt text if not provided
    const altText = alt || user?.name || user?.display_name || user?.displayName || 'User Avatar';



    return (
        <img
            src={avatarSrc}
            className={className}
            alt={altText}
            style={style}
            onError={(e) => { 
                e.target.onerror = null; 
                e.target.src = getSafeAvatar(null); 
            }}
            {...props}
        />
    );
};

export default UserAvatar;
