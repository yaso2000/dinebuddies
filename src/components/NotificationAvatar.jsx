import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FaUser } from 'react-icons/fa';

const NotificationAvatar = ({ userId, initialSrc, alt, fallbackIcon }) => {
    const [avatarUrl, setAvatarUrl] = useState(initialSrc);
    // Determine if we should attempt to fetch. 
    // If initialSrc is a data URI (generated SVG), we definitely want to try fetching a real pic.
    // If it's a real URL, we might still want to fetch to see if updated, or just accept it.
    // Use simple logic: always try to fetch if userId is present.

    useEffect(() => {
        let isMounted = true;

        const fetchUserAvatar = async () => {
            if (!userId) return;

            try {
                const userRef = doc(db, 'users', userId);
                const userSnap = await getDoc(userRef);

                if (isMounted && userSnap.exists()) {
                    const data = userSnap.data();
                    const realAvatar = data.profilePicture || data.photo_url;

                    if (realAvatar) {
                        setAvatarUrl(realAvatar);
                    }
                }
            } catch (err) {
                console.error("Error fetching avatar for notification:", err);
            }
        };

        fetchUserAvatar();

        return () => { isMounted = false; };
    }, [userId]);

    // Render logic
    if (avatarUrl && !avatarUrl.startsWith('data:image/svg')) {
        // If we have a real URL (not the generated SVG placeholder), show it
        return (
            <div className="notification-icon">
                <img
                    src={avatarUrl}
                    alt={alt || 'User'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                        e.target.style.display = 'none';
                        // Show fallback if text
                    }}
                />
            </div>
        );
    }

    // If we have the generated SVG or no avatar, but we have a fallback icon (e.g. standard notification type icon)
    // AND the notification type isn't specifically a 'message' or user-centric one that requires an avatar
    // Actually, fallbackIcon is passed from parent (getIcon(type)).

    // If we have a userId but no real avatar yet, we might fallback to the placeholder if it exists?
    // But the user dislikes the placeholder.

    // If we have a specific fallback icon (like a Heart for like, Bell for misc), use that.
    if (fallbackIcon) {
        return (
            <div className="notification-icon">
                {fallbackIcon}
            </div>
        );
    }

    // Ultimate fallback
    return (
        <div className="notification-icon" style={{ background: '#f1f5f9', color: '#64748b' }}>
            <FaUser />
        </div>
    );
};

export default NotificationAvatar;
