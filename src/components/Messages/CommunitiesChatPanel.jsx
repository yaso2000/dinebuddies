import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaTrash } from 'react-icons/fa';
import { useInvitations } from '../../context/InvitationContext';
import { AppText } from "../base";

export default function CommunitiesChatPanel({
  communities = [],
  loading = false,
  searchQuery = '',
  onLeaveCommunity
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { leaveCommunity } = useInvitations();

  const filtered = communities.filter((c) =>
  c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLeave = async (e, communityId, communityName) => {
    e.stopPropagation();
    if (
    !window.confirm(
      `${t('Are you sure you want to leave', 'Are you sure you want to leave')} ${communityName}?`
    ))
    {
      return;
    }
    try {
      const success = await leaveCommunity(communityId);
      if (success) onLeaveCommunity?.(communityId);
    } catch (error) {
      console.error('Error leaving community:', error);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {t('Loading communities...', 'Loading communities...')}
            </div>);

  }

  if (filtered.length === 0) {
    return (
      <div className="empty-state">
                <div className="empty-icon">👥</div>
                <AppText as="h3">
                    {searchQuery ?
          t('No communities found', 'No communities found') :
          t('No communities yet', 'No communities yet')}
                </AppText>
                <AppText as="p">
                    {searchQuery ?
          t('Try a different search', 'Try a different search') :
          t('Join communities from partner profiles', 'Join communities from partner profiles')}
                </AppText>
                {!searchQuery &&
        <button
          type="button"
          className="messages-hub-explore-btn"
          onClick={() => navigate('/restaurants')}>
          
                        {t('Explore Partners', 'Explore Partners')}
                    </button>
        }
            </div>);

  }

  return (
    <div className="conversations-list messages-communities-list">
            {filtered.map((community) =>
      <div
        key={community.id}
        className={`conversation-item community-chat-item${community.unreadCount > 0 ? ' unread' : ''}`}
        onClick={() => navigate(`/community/${community.id}`)}>
        
                    <div className="conversation-avatar community-chat-avatar">
                        {community.logo ?
          <img src={community.logo} alt={community.name} /> :

          <AppText as="span" className="community-chat-avatar-fallback">
                                {community.name ? community.name.charAt(0).toUpperCase() : '🏪'}
                            </AppText>
          }
                    </div>

                    <div className="conversation-content">
                        <div className="conversation-top">
                            <AppText as="h3" className="conversation-name">{community.name}</AppText>
                            {community.unreadCount > 0 &&
            <AppText as="span" className="community-unread-pill">
                                    {community.unreadCount > 99 ? '99+' : community.unreadCount}
                                </AppText>
            }
                        </div>
                        <div className="conversation-bottom">
                            <AppText as="p" className="last-message">
                                {community.lastMessage ||
              `${community.memberCount} ${t('members', 'members')}`}
                            </AppText>
                            <button
              type="button"
              className="community-leave-btn"
              onClick={(e) => handleLeave(e, community.id, community.name)}
              title={t('Leave Community', 'Leave Community')}
              aria-label={t('Leave Community', 'Leave Community')}>
              
                                <FaTrash size={12} />
                            </button>
                        </div>
                    </div>
                </div>
      )}
        </div>);

}