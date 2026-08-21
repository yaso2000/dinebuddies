import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaGift, FaUserCheck, FaUserPlus } from 'react-icons/fa';
import { AppText } from '../base';
import { useAuth } from '../../context/AuthContext';
import { useInvitations } from '../../context/InvitationContext';
import { useToast } from '../../context/ToastContext';
import { goToLogin } from '../../utils/goToLogin';
import { sendDiscoveryGreeting } from '../../utils/discoveryProfile';
import { isFollowing as checkIsFollowing } from '../../utils/followHelpers';

/**
 * Follow / wave-hi / send-gift row for a Stage participant — shared by the
 * desktop avatar-grid preview card and the mobile members list.
 */
export default function StageParticipantActions({ member, onGift, className = '' }) {
    const { t } = useTranslation();
    const { currentUser, isGuest } = useAuth();
    const { toggleFollow, currentUser: invitationUser } = useInvitations();
    const { showToast } = useToast();
    const [followBusy, setFollowBusy] = useState(false);
    const [greetingBusy, setGreetingBusy] = useState(false);
    const [greeted, setGreeted] = useState(false);

    const viewerUid = currentUser?.uid || currentUser?.id;
    const viewerFollowing = invitationUser?.following || [];
    const isSelf = Boolean(viewerUid && member?.id === viewerUid);
    const isFollowingMember = checkIsFollowing(viewerFollowing, member?.id);

    useEffect(() => {
        setGreeted(false);
    }, [member?.id]);

    const requireAuth = useCallback(() => {
        if (!viewerUid || isGuest) {
            goToLogin({ returnPath: window.location.pathname });
            return false;
        }
        return true;
    }, [isGuest, viewerUid]);

    const handleFollow = useCallback(
        async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!requireAuth() || isSelf || followBusy) return;
            setFollowBusy(true);
            try {
                await toggleFollow(member.id);
            } catch (err) {
                console.error('[StageParticipantActions] follow', err);
                showToast(t('follow_action_failed', 'Could not update follow status.'), 'error');
            } finally {
                setFollowBusy(false);
            }
        },
        [followBusy, isSelf, member, requireAuth, showToast, t, toggleFollow]
    );

    const handleGreeting = useCallback(
        async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!requireAuth() || isSelf || greetingBusy || greeted) return;
            setGreetingBusy(true);
            try {
                const result = await sendDiscoveryGreeting(viewerUid, member, invitationUser || currentUser);
                if (result?.reason === 'daily_limit') {
                    showToast(t('discovery_greeting_daily_limit', 'You can wave once per day to this member.'), 'info');
                    return;
                }
                if (result?.ok) {
                    setGreeted(true);
                    showToast('👋', 'success');
                }
            } catch (err) {
                console.error('[StageParticipantActions] greeting', err);
                showToast(t('discovery_greeting_failed', 'Could not send greeting. Try again.'), 'error');
            } finally {
                setGreetingBusy(false);
            }
        },
        [currentUser, greeted, greetingBusy, invitationUser, isSelf, member, requireAuth, showToast, t, viewerUid]
    );

    const handleGift = useCallback(
        (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!requireAuth() || isSelf) return;
            onGift?.(member);
        },
        [isSelf, member, onGift, requireAuth]
    );

    if (isSelf) return null;

    return (
        <div className={`stage-participant-actions${className ? ` ${className}` : ''}`}>
            <button
                type="button"
                className={`stage-participant-actions__btn${isFollowingMember ? ' stage-participant-actions__btn--active' : ''}`}
                onClick={handleFollow}
                disabled={followBusy}
                title={isFollowingMember ? t('following', 'Following') : t('follow', 'Follow')}
                aria-label={isFollowingMember ? t('following', 'Following') : t('follow', 'Follow')}
            >
                {isFollowingMember ? <FaUserCheck aria-hidden /> : <FaUserPlus aria-hidden />}
            </button>
            <button
                type="button"
                className={`stage-participant-actions__btn${greeted ? ' stage-participant-actions__btn--active' : ''}`}
                onClick={handleGreeting}
                disabled={greetingBusy || greeted}
                title={t('user_directory_greeting', 'Wave hi')}
                aria-label={t('user_directory_greeting', 'Wave hi')}
            >
                <AppText as="span" aria-hidden>👋</AppText>
            </button>
            <button
                type="button"
                className="stage-participant-actions__btn"
                onClick={handleGift}
                title={t('user_directory_send_gift', 'Send gift')}
                aria-label={t('user_directory_send_gift', 'Send gift')}
            >
                <FaGift aria-hidden />
            </button>
        </div>
    );
}
