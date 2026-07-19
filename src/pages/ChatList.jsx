import { useTranslation } from 'react-i18next';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import UserAvatar from '../components/UserAvatar';
import OnlineStatusBadge from '../components/profile/OnlineStatusBadge';
import { useUserPresence } from '../hooks/usePresence';
import CommunitiesChatPanel from '../components/Messages/CommunitiesChatPanel';
import StagesChatPanel from '../components/Messages/StagesChatPanel';
import NotificationsPanel from '../components/Messages/NotificationsPanel';
import { useJoinedCommunities } from '../hooks/useJoinedCommunities';
import { useJoinedStages } from '../hooks/useJoinedStages';
import AppBackButton from '../components/AppBackButton';
import { APP_HOME_PATH } from '../utils/appRouteShell';
import { LuBell, LuMessageCircle, LuSearch } from 'react-icons/lu';
import './ChatList.css';
import { goToLogin } from '../utils/goToLogin';
import { AppText, AppTextInput } from '../components/base';

const PANEL_MESSAGES = 'messages';
const PANEL_NOTIFICATIONS = 'notifications';
const TAB_CHATS = 'chats';
const TAB_COMMUNITIES = 'communities';
const TAB_STAGES = 'stages';

function readPanel(searchParams) {
  return searchParams.get('panel') === PANEL_NOTIFICATIONS ? PANEL_NOTIFICATIONS : PANEL_MESSAGES;
}

function readTab(searchParams) {
  const tab = searchParams.get('tab');
  if (tab === TAB_COMMUNITIES) return TAB_COMMUNITIES;
  if (tab === TAB_STAGES) return TAB_STAGES;
  return TAB_CHATS;
}

function MessagesEmpty({ title, message, ctaLabel, ctaTo }) {
  return (
    <div className="messages-page__empty">
      <div className="messages-page__empty-icon" aria-hidden>
        <LuMessageCircle />
      </div>
      <AppText as="h3" className="messages-page__empty-title" format={false}>
        {title}
      </AppText>
      <AppText as="p" className="messages-page__empty-text" format={false}>
        {message}
      </AppText>
      {ctaLabel && ctaTo ? (
        <Link to={ctaTo} className="messages-page__empty-cta">
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}

function ConversationRow({ convo, onOpen, formatTime, t }) {
  const otherUser = convo.otherUser;
  const isOnline = useUserPresence(otherUser?.uid, { fallback: Boolean(otherUser?.isOnline) });

  if (!otherUser) return null;

  return (
    <div
      className={`messages-page__item${convo.isUnread ? ' unread' : ''}`}
      onClick={() => onOpen(otherUser.uid)}>
      <div className="messages-page__avatar">
        <UserAvatar user={otherUser} alt={otherUser.displayName} style={{ objectFit: 'cover' }} />
        {isOnline ? <div className="messages-page__online" /> : null}
      </div>

      <div className="messages-page__content">
        <div className="messages-page__row-top">
          <div className="messages-page__name-row">
            <AppText as="h3" className="messages-page__name">
              {otherUser.displayName}
            </AppText>
            {isOnline ? <OnlineStatusBadge isOnline size="sm" className="messages-page__online-badge" /> : null}
          </div>
          <AppText as="span" className="messages-page__time">
            {formatTime(convo.lastMessageTime)}
          </AppText>
        </div>
        <div className="messages-page__row-bottom">
          <AppText as="p" className="messages-page__preview">
            {convo.lastMessage === 'shared_content'
              ? `🔗 ${t('shared_content_preview', 'Shared content')}`
              : convo.lastMessage || t('no_messages_yet', 'No messages yet')}
          </AppText>
          {convo.isUnread ? <div className="messages-page__unread-dot" /> : null}
        </div>
      </div>
    </div>
  );
}

const ChatList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activePanel = readPanel(searchParams);
  const activeTab = readTab(searchParams);
  const { conversations, loading: chatsLoading, unreadCount: chatUnreadCount } = useChat();
  const { unreadBellCount = 0, unreadMessageCount = 0 } = useNotifications();
  const { communities, loading: communitiesLoading, totalUnread: communityUnread, removeCommunity } =
    useJoinedCommunities();
  const {
    stages,
    loading: stagesLoading,
    totalUnread: stageUnread,
    leaveStage,
  } = useJoinedStages();
  const { userProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const messagesBadge = chatUnreadCount + communityUnread + stageUnread + unreadMessageCount;
  const notificationsBadge = unreadBellCount;

  useEffect(() => {
    if (userProfile?.isGuest || userProfile?.role === 'guest') {
      goToLogin();
    }
  }, [userProfile, navigate]);

  useEffect(() => {
    if (searchParams.get('tab') === TAB_STAGES) {
      navigate('/stages', { replace: true });
    }
  }, [searchParams, navigate]);

  const setActivePanel = (panel) => {
    if (panel === PANEL_NOTIFICATIONS) {
      setSearchParams({ panel: PANEL_NOTIFICATIONS }, { replace: true });
    } else {
      const tab = searchParams.get('tab');
      if (tab === TAB_COMMUNITIES || tab === TAB_STAGES) {
        setSearchParams({ tab }, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    }
    setSearchQuery('');
  };

  const setActiveTab = (tab) => {
    if (tab === TAB_STAGES) {
      navigate('/stages');
      return;
    }
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

    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return t('yesterday', 'Yesterday');
    }

    const diff = now - date;
    if (diff < 604800000) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const searchPlaceholder =
    activeTab === TAB_COMMUNITIES
      ? t('search_communities', 'Search communities...')
      : activeTab === TAB_STAGES
        ? t('search_stages', 'Search stages...')
        : t('search_conversations', 'Search conversations...');

  const isLoading = activePanel === PANEL_MESSAGES && activeTab === TAB_CHATS && chatsLoading;

  let messagesBody;
  if (activeTab === TAB_CHATS) {
    messagesBody =
      filteredConversations.length === 0 ? (
        <MessagesEmpty
          title={t('no_conversations', 'No conversations yet')}
          message={t(
            'messages_empty_hint',
            'Connect with members from their profile — like, follow, or send a greeting to open a chat.'
          )}
          ctaLabel={t('messages_empty_cta', 'Browse members')}
          ctaTo="/search/list"
        />
      ) : (
        <div className="messages-page__list">
          {filteredConversations.map((convo) => (
            <ConversationRow
              key={convo.id}
              convo={convo}
              onOpen={(uid) => navigate(`/chat/${uid}`)}
              formatTime={formatTime}
              t={t}
            />
          ))}
        </div>
      );
  } else if (activeTab === TAB_STAGES) {
    messagesBody = (
      <StagesChatPanel
        stages={stages}
        loading={stagesLoading}
        searchQuery={searchQuery}
        onLeaveStage={leaveStage}
      />
    );
  } else {
    messagesBody = (
      <CommunitiesChatPanel
        communities={communities}
        loading={communitiesLoading}
        searchQuery={searchQuery}
        onLeaveCommunity={removeCommunity}
      />
    );
  }

  const hubShell = (body) => (
    <div className="chat-list-container messages-page">
      <div className="messages-page__top">
        <header className="messages-page__header">
          <AppBackButton className="back-btn messages-page__back" fallback={APP_HOME_PATH} />
          <AppText as="h1" className="messages-page__title">
            {t('inbox_hub_title', 'Inbox')}
          </AppText>
          <span className="messages-page__header-spacer" aria-hidden />
        </header>

        <div className="messages-page__hub-tabs" role="tablist" aria-label={t('inbox_hub_title', 'Inbox')}>
        <button
          type="button"
          role="tab"
          aria-selected={activePanel === PANEL_MESSAGES}
          className={`messages-page__hub-tab${activePanel === PANEL_MESSAGES ? ' active' : ''}`}
          onClick={() => setActivePanel(PANEL_MESSAGES)}>
          <LuMessageCircle aria-hidden />
          {t('inbox_panel_messages', 'Messages')}
          {messagesBadge > 0 ? (
            <AppText as="span" className="messages-page__tab-badge">
              {messagesBadge > 99 ? '99+' : messagesBadge}
            </AppText>
          ) : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activePanel === PANEL_NOTIFICATIONS}
          className={`messages-page__hub-tab${activePanel === PANEL_NOTIFICATIONS ? ' active' : ''}`}
          onClick={() => setActivePanel(PANEL_NOTIFICATIONS)}>
          <LuBell aria-hidden />
          {t('inbox_panel_notifications', 'Notifications')}
          {notificationsBadge > 0 ? (
            <AppText as="span" className="messages-page__tab-badge">
              {notificationsBadge > 99 ? '99+' : notificationsBadge}
            </AppText>
          ) : null}
        </button>
      </div>
      </div>

      {activePanel === PANEL_MESSAGES ? (
        <>
          <div className="messages-page__tabs messages-page__tabs--sub" role="tablist" aria-label={t('messages', 'Messages')}>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === TAB_CHATS}
              className={`messages-page__tab${activeTab === TAB_CHATS ? ' active' : ''}`}
              onClick={() => setActiveTab(TAB_CHATS)}>
              {t('messages_tab_chats', 'Chats')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === TAB_COMMUNITIES}
              className={`messages-page__tab${activeTab === TAB_COMMUNITIES ? ' active' : ''}`}
              onClick={() => setActiveTab(TAB_COMMUNITIES)}>
              {t('messages_tab_communities', 'Communities')}
              {communityUnread > 0 ? (
                <AppText as="span" className="messages-page__tab-badge">
                  {communityUnread > 99 ? '99+' : communityUnread}
                </AppText>
              ) : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === TAB_STAGES}
              className={`messages-page__tab${activeTab === TAB_STAGES ? ' active' : ''}`}
              onClick={() => setActiveTab(TAB_STAGES)}>
              {t('messages_tab_stages', 'Stages')}
              {stageUnread > 0 || stages.length > 0 ? (
                <AppText as="span" className="messages-page__tab-badge">
                  {stageUnread > 0
                    ? stageUnread > 99
                      ? '99+'
                      : stageUnread
                    : stages.length > 99
                      ? '99+'
                      : stages.length}
                </AppText>
              ) : null}
            </button>
          </div>

          <div className="messages-page__search-wrap">
            <div className="messages-page__search">
              <LuSearch className="messages-page__search-icon" aria-hidden />
              <AppTextInput
                type="text"
                className="messages-page__search-input"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </>
      ) : null}

      <div
        className={`messages-page__body${activePanel === PANEL_NOTIFICATIONS ? ' messages-page__body--notifications' : ''}`}>
        {body}
      </div>
    </div>
  );

  if (isLoading) {
    return hubShell(
      <div className="messages-page__loading">{t('loading_conversations', 'Loading conversations...')}</div>
    );
  }

  return hubShell(activePanel === PANEL_NOTIFICATIONS ? <NotificationsPanel /> : messagesBody);
};

export default ChatList;
