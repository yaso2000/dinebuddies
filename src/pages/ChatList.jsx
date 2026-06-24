import { useTranslation } from 'react-i18next';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import UserAvatar from '../components/UserAvatar';
import CommunitiesChatPanel from '../components/Messages/CommunitiesChatPanel';
import { useJoinedCommunities } from '../hooks/useJoinedCommunities';
import { FaArrowLeft, FaSearch, FaEllipsisV } from 'react-icons/fa';
import './ChatList.css';
import { goToLogin } from '../utils/goToLogin';
import { AppText, AppTextInput } from "../components/base";

const TAB_CHATS = 'chats';
const TAB_COMMUNITIES = 'communities';

function readTab(searchParams) {
  return searchParams.get('tab') === TAB_COMMUNITIES ? TAB_COMMUNITIES : TAB_CHATS;
}

const ChatList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = readTab(searchParams);
  const { conversations, loading: chatsLoading } = useChat();
  const { communities, loading: communitiesLoading, totalUnread: communityUnread, removeCommunity } =
  useJoinedCommunities();
  const { userProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (userProfile?.isGuest || userProfile?.role === 'guest') {
      goToLogin();
    }
  }, [userProfile, navigate]);

  const setActiveTab = (tab) => {
    if (tab === TAB_COMMUNITIES) {
      setSearchParams({ tab: TAB_COMMUNITIES }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
    setSearchQuery('');
  };

  const filteredConversations = useMemo(
    () =>
    conversations.filter((convo) => {
      if (!searchQuery) return true;
      const otherUser = convo.otherUser;
      return otherUser?.displayName?.toLowerCase().includes(searchQuery.toLowerCase());
    }),
    [conversations, searchQuery]
  );

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now - date;

    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return t('yesterday', 'Yesterday');
    }

    if (diff < 604800000) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const searchPlaceholder =
  activeTab === TAB_COMMUNITIES ?
  t('Search communities...', 'Search communities...') :
  t('search_conversations');

  const isLoading = activeTab === TAB_CHATS && chatsLoading;

  if (isLoading) {
    return (
      <div className="chat-list-container">
                <header className="chat-list-header">
                    <button type="button" className="back-btn" onClick={() => navigate('/posts-feed')}>
                        <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <AppText as="h1">{t('messages')}</AppText>
                </header>
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t('loading_conversations')}
                </div>
            </div>);

  }

  return (
    <>
            <div className="chat-list-desktop-placeholder">
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>💬</div>
                    <AppText as="h3" style={{ fontWeight: '700', marginBottom: '6px', color: 'var(--text-main)' }}>
                        {t('messages')}
                    </AppText>
                    <AppText as="p" style={{ fontSize: '0.9rem' }}>{t('select_conversation_prompt')}</AppText>
                </div>
            </div>

            <div className="chat-list-container">
                <header className="chat-list-header">
                    <button type="button" className="back-btn" onClick={() => navigate('/posts-feed')}>
                        <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <AppText as="h1">{t('messages')}</AppText>
                    <button type="button" className="options-btn" aria-hidden="true">
                        <FaEllipsisV />
                    </button>
                </header>

                <div className="messages-hub-tabs" role="tablist" aria-label={t('messages')}>
                    <button
            type="button"
            role="tab"
            aria-selected={activeTab === TAB_CHATS}
            className={`messages-hub-tab${activeTab === TAB_CHATS ? ' active' : ''}`}
            onClick={() => setActiveTab(TAB_CHATS)}>
            
                        {t('messages_tab_chats', 'Chats')}
                    </button>
                    <button
            type="button"
            role="tab"
            aria-selected={activeTab === TAB_COMMUNITIES}
            className={`messages-hub-tab${activeTab === TAB_COMMUNITIES ? ' active' : ''}`}
            onClick={() => setActiveTab(TAB_COMMUNITIES)}>
            
                        {t('messages_tab_communities', 'Communities')}
                        {communityUnread > 0 &&
            <AppText as="span" className="messages-hub-tab-badge">
                                {communityUnread > 99 ? '99+' : communityUnread}
                            </AppText>
            }
                    </button>
                </div>

                <div className="search-bar">
                    <FaSearch className="search-icon" />
                    <AppTextInput
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} />
          
                </div>

                {activeTab === TAB_CHATS ?
        <div className="conversations-list">
                        {filteredConversations.length === 0 ?
          <div className="empty-state">
                                <div className="empty-icon">💬</div>
                                <AppText as="h3">{t('no_conversations')}</AppText>
                                <AppText as="p">{t('start_chatting_friends')}</AppText>
                            </div> :

          filteredConversations.map((convo) => {
            const otherUser = convo.otherUser;
            if (!otherUser) return null;

            return (
              <div
                key={convo.id}
                className={`conversation-item ${convo.isUnread ? 'unread' : ''}`}
                onClick={() => navigate(`/chat/${otherUser.uid}`)}>
                
                                        <div className="conversation-avatar">
                                            <UserAvatar
                    user={otherUser}
                    alt={otherUser.displayName}
                    style={{ objectFit: 'cover' }} />
                  
                                            {otherUser.isOnline && <div className="online-indicator" />}
                                        </div>

                                        <div className="conversation-content">
                                            <div className="conversation-top">
                                                <AppText as="h3" className="conversation-name">{otherUser.displayName}</AppText>
                                                <AppText as="span" className="conversation-time">
                                                    {formatTime(convo.lastMessageTime)}
                                                </AppText>
                                            </div>
                                            <div className="conversation-bottom">
                                                <AppText as="p" className="last-message">
                                                    {convo.lastMessage === 'shared_content' ?
                      `🔗 ${t('shared_content_preview', 'Shared content')}` :
                      convo.lastMessage || t('no_messages_yet')}
                                                </AppText>
                                                {convo.isUnread && <div className="unread-badge" />}
                                            </div>
                                        </div>
                                    </div>);

          })
          }
                    </div> :

        <CommunitiesChatPanel
          communities={communities}
          loading={communitiesLoading}
          searchQuery={searchQuery}
          onLeaveCommunity={removeCommunity} />

        }
            </div>
        </>);

};

export default ChatList;