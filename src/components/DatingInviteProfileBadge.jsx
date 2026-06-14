import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { goToLogin } from '../utils/goToLogin';
import { isUserAvailableForDating, getDatingInviteeDisplayName } from '../utils/datingInviteAvailability';
import './DatingInviteProfileBadge.css';

/**
 * Site logo badge on profile avatars for users open to dating invites.
 * Tap → confirm → open dating invitation create with this person pre-selected.
 */
export default function DatingInviteProfileBadge({
    user,
    currentUser,
    className = '',
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const visible = isUserAvailableForDating(user);
    const displayName = getDatingInviteeDisplayName(user) || t('user', 'User');

    const handleClick = useCallback(
        (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!currentUser || currentUser.isGuest || currentUser.id === 'guest') {
                goToLogin({ returnPath: `/user/${user.id}` });
                return;
            }

            const confirmed = window.confirm(
                t('dating_send_invite_confirm', {
                    name: displayName,
                    defaultValue: `Send a DineBuddy Date invitation to ${displayName}?`,
                })
            );
            if (!confirmed) return;

            navigate('/create-dating', {
                state: {
                    preselectedInvitee: {
                        id: user.id,
                        display_name: displayName,
                        name: displayName,
                        photo_url: user.photo_url || user.photoURL || user.avatar || '',
                        photoURL: user.photoURL || user.photo_url || user.avatar || '',
                        avatar: user.avatar || user.photo_url || user.photoURL || '',
                        gender: user.gender || null,
                        availableForDating: user.availableForDating,
                    },
                },
            });
        },
        [currentUser, displayName, navigate, t, user]
    );

    if (!visible || !user?.id) return null;

    return (
        <button
            type="button"
            className={`dating-invite-profile-badge ${className}`.trim()}
            onClick={handleClick}
            title={t('dating_send_invite_badge_title', {
                name: displayName,
                defaultValue: `Send a date invitation to ${displayName}`,
            })}
            aria-label={t('dating_send_invite_badge_title', {
                name: displayName,
                defaultValue: `Send a date invitation to ${displayName}`,
            })}
        >
            <img src="/db-logo.svg" alt="" className="dating-invite-profile-badge__logo" decoding="async" draggable={false} />
        </button>
    );
}
