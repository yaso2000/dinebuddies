import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getSafeAvatar } from '../../utils/avatarUtils';
import UserAvatar from '../UserAvatar';
import { useInvitations } from '../../context/InvitationContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { buildFollowPlusProps } from '../../utils/followPlusUi';

const MembersList = ({ joined, author, joinedMembersData, spotsLeft }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { currentUser, toggleFollow } = useInvitations();
    const { userProfile } = useAuth();
    const { showToast } = useToast();

    const safeMembersData = joinedMembersData || {};

    const followCtx = useMemo(
        () => ({ currentUser, userProfile, toggleFollow, showToast, t }),
        [currentUser, userProfile, toggleFollow, showToast, t]
    );

    const hostFollowPlus = useMemo(
        () => buildFollowPlusProps(author, followCtx),
        [author, followCtx]
    );

    return (
        <div style={{ padding: '0 1.25rem', marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-main)', fontWeight: '800' }}>
                {t('members_list_title', 'Who\'s Coming')} ({joined.length + 1})
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ textAlign: 'center', position: 'relative' }}>
                    <div
                        style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            border: '2px solid var(--luxury-gold)',
                            padding: '2px',
                            position: 'relative',
                            boxShadow: '0 0 10px rgba(251, 191, 36, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <UserAvatar
                            user={author}
                            src={getSafeAvatar(author)}
                            followPlus={hostFollowPlus || undefined}
                            followBadgeSize={16}
                            alt={author?.name}
                            title={`${author?.name} (${t('host', { defaultValue: 'Host' })})`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div
                            style={{
                                position: 'absolute',
                                bottom: '-6px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: 'var(--luxury-gold)',
                                color: 'black',
                                fontSize: '0.6rem',
                                fontWeight: '900',
                                padding: '2px 6px',
                                borderRadius: '6px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            }}
                        >
                            {t('host_badge')}
                        </div>
                    </div>
                    <span
                        style={{
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            color: 'var(--text-main)',
                            display: 'block',
                            marginTop: '8px',
                            maxWidth: '60px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {author?.name || t('host')}
                    </span>
                </div>

                {joined.map((userId) => {
                    const member = safeMembersData[userId] || {
                        name: t('member'),
                        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
                    };
                    const memberUser = { ...member, id: userId, uid: userId };
                    const memberFp = buildFollowPlusProps(memberUser, followCtx);
                    return (
                        <div key={userId} style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate(`/profile/${userId}`)}>
                            <div
                                style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '50%',
                                    border: '2px solid var(--primary)',
                                    padding: '2px',
                                    transition: 'transform 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'scale(1.05)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)';
                                }}
                            >
                                <UserAvatar
                                    user={memberUser}
                                    src={getSafeAvatar(member)}
                                    followPlus={memberFp || undefined}
                                    followBadgeSize={16}
                                    alt={member.name}
                                    title={member.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            </div>
                            <span
                                style={{
                                    fontSize: '0.7rem',
                                    color: 'var(--text-muted)',
                                    display: 'block',
                                    marginTop: '8px',
                                    maxWidth: '60px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {member.name}
                            </span>
                        </div>
                    );
                })}

                {[...Array(Math.max(0, parseInt(spotsLeft) || 0))].map((_, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                        <div
                            style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '50%',
                                border: '2px dashed var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-muted)',
                                fontSize: '1.2rem',
                                opacity: 0.3,
                                background: 'rgba(255,255,255,0.02)',
                            }}
                        >
                            +
                        </div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '8px', opacity: 0.5 }}>
                            {t('open')}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MembersList;
