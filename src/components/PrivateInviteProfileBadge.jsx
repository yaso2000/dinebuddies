import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { goToLogin } from '../utils/goToLogin';
import { useToast } from '../context/ToastContext';
import { isUserAvailableForPrivateInvite, getPrivateInviteeDisplayName, senderFollowsInvitee } from '../utils/privateInviteAvailability';
import './PrivateInviteProfileBadge.css';

/**
 * Site logo badge on profile avatars — tap to send a private invite when available.
 */
export default function PrivateInviteProfileBadge({
    user,
    currentUser,
    className = '',
    logoSrc = '/db-logo.svg',
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const canInvite = isUserAvailableForPrivateInvite(user);
    const senderFollowing = currentUser?.following || [];
    const followsInvitee = senderFollowsInvitee(senderFollowing, user?.id);
    const displayName = getPrivateInviteeDisplayName(user) || t('user', 'User');

    const handleClick = useCallback(
        (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!canInvite) {
                showToast(
                    t(
                        'private_invite_social_only_toast',
                        'This member only accepts social/public invites — private invites are turned off.'
                    ),
                    'info'
                );
                return;
            }

            if (!followsInvitee) {
                showToast(
                    t(
                        'private_invite_follow_required',
                        'Follow this member first to send a private invite.'
                    ),
                    'info'
                );
                return;
            }

            if (!currentUser || currentUser.isGuest || currentUser.id === 'guest') {
                goToLogin({ returnPath: `/user/${user.id}` });
                return;
            }

            const confirmed = window.confirm(
                t('private_send_invite_confirm', {
                    name: displayName,
                    defaultValue: `Send a Private Invite invitation to ${displayName}?`,
                })
            );
            if (!confirmed) return;

            navigate('/create-private', {
                state: {
                    preselectedInvitee: {
                        id: user.id,
                        display_name: displayName,
                        name: displayName,
                        photo_url: user.photo_url || user.photoURL || user.avatar || '',
                        photoURL: user.photoURL || user.photo_url || user.avatar || '',
                        avatar: user.avatar || user.photo_url || user.photoURL || '',
                        gender: user.gender || null,
                        availableForPrivateInvite: user.availableForPrivateInvite,
                    },
                },
            });
        },
        [canInvite, followsInvitee, currentUser, displayName, navigate, showToast, t, user]
    );

    if (!user?.id) return null;

    return (
        <button
            type="button"
            className={`private-invite-profile-badge${canInvite ? '' : ' private-invite-profile-badge--disabled'} ${className}`.trim()}
            onClick={handleClick}
            title={
                canInvite
                    ? t('private_send_invite_badge_title', {
                          name: displayName,
                          defaultValue: `Send a private invite to ${displayName}`,
                      })
                    : t('user_directory_dating_unavailable', 'Not open to private invites')
            }
            aria-label={
                canInvite
                    ? t('private_send_invite_badge_title', {
                          name: displayName,
                          defaultValue: `Send a private invite to ${displayName}`,
                      })
                    : t('user_directory_dating_unavailable', 'Not open to private invites')
            }
            aria-disabled={!canInvite}
        >
            <img src={logoSrc} alt="" className="private-invite-profile-badge__logo" decoding="async" draggable={false} />
        </button>
    );
}
