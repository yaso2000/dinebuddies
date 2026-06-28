import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import {
  LuArrowLeft,
  LuGift,
  LuMessageCircle,
  LuSparkles,
  LuUtensilsCrossed,
  LuX,
} from 'react-icons/lu';
import { db } from '../../firebase/config';
import { useChat } from '../../context/ChatContext';
import { useNotifications } from '../../context/NotificationContext';
import { usePendingInvitesForMe } from '../../hooks/usePendingInvitesForMe';
import { useReceivedGiftsForMe } from '../../hooks/useReceivedGiftsForMe';
import { getSafeAvatar } from '../../utils/avatarUtils';
import { getInvitationDetailsPath } from '../../utils/socialInvitationDraft';
import { resolveInviteCategory } from '../../utils/inviteCategory';
import {
  formatInboxRelativeTime,
  isInboxActivityNotification,
  INBOX_CHAT_PREVIEW_LIMIT,
} from '../../utils/inboxFormat';
import { getPrivateInviteeDisplayName } from '../../utils/privateInviteAvailability';
import DeleteSwipeRow from '../DeleteSwipeRow';
import './inbox.css';
import { AppText } from '../base';

function InboxEmpty({ message }) {
  return <AppText as="p" className="inbox-empty">{message}</AppText>;
}

function InboxLoading() {
  const { t } = useTranslation();
  return <AppText as="p" className="inbox-empty">{t('inbox_loading', 'Loading…')}</AppText>;
}

function ChatsTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { conversations, loading, unreadCount } = useChat();

  const preview = useMemo(
    () => conversations.filter((c) => c.otherUser).slice(0, INBOX_CHAT_PREVIEW_LIMIT),
    [conversations]
  );

  const formatTime = useCallback(
    (timestamp) => formatInboxRelativeTime(timestamp, t),
    [t]
  );

  if (loading) return <InboxLoading />;

  if (preview.length === 0) {
    return (
      <InboxEmpty
        message={t(
          'inbox_empty_chats',
          'No conversations yet — start chatting from a member profile.'
        )}
      />
    );
  }

  return (
    <>
      <ul className="inbox-list">
        {preview.map((chat) => {
          const other = chat.otherUser;
          const name = other.displayName || t('user', 'User');
          const avatar = other.photoURL || getSafeAvatar(null);

          return (
            <li key={chat.id}>
              <button
                type="button"
                className="inbox-row inbox-row--button"
                onClick={() => navigate(`/chat/${other.uid}`)}
              >
                <img src={avatar} alt="" className="inbox-avatar" />
                <div className="inbox-row__main">
                  <div className="inbox-row__top">
                    <AppText as="span" className="inbox-row__title">{name}</AppText>
                    <AppText as="span" className="inbox-row__meta">
                      {formatTime(chat.lastMessageTime)}
                    </AppText>
                  </div>
                  <AppText as="p" className="inbox-row__preview">
                    {chat.lastMessage === 'shared_content'
                      ? `🔗 ${t('shared_content_preview', 'Shared content')}`
                      : chat.lastMessage || t('no_messages_yet', 'No messages yet')}
                  </AppText>
                </div>
                {chat.isUnread ? <AppText as="span" className="inbox-badge">1</AppText> : null}
              </button>
            </li>
          );
        })}
      </ul>
      <Link to="/messages" className="inbox-view-all">
        {t('inbox_view_all_chats', 'View all conversations')}
        {unreadCount > 0 ? (
          <AppText as="span" className="inbox-view-all__badge">{unreadCount}</AppText>
        ) : null}
      </Link>
    </>
  );
}

function InvitesTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pending, synced } = usePendingInvitesForMe();
  const { gifts, synced: giftsSynced } = useReceivedGiftsForMe();
  const [hostCache, setHostCache] = useState({});

  useEffect(() => {
    const ids = [
      ...new Set(
        pending.map((inv) => inv.authorId || inv.author?.id).filter(Boolean)
      ),
    ];

    if (ids.length === 0) return undefined;

    let cancelled = false;

    ids.forEach((hostId) => {
      getDoc(doc(db, 'users', hostId))
        .then((snap) => {
          if (cancelled || !snap.exists()) return;
          setHostCache((prev) => (prev[hostId] ? prev : { ...prev, [hostId]: snap.data() }));
        })
        .catch(() => {});
    });

    return () => {
      cancelled = true;
    };
  }, [pending]);

  const formatTime = useCallback(
    (inv) => formatInboxRelativeTime(inv.publishedAt || inv.createdAt, t),
    [t]
  );

  if (!synced || !giftsSynced) return <InboxLoading />;

  return (
    <div className="inbox-invites-stack">
      {pending.length === 0 ? (
        <InboxEmpty
          message={t(
            'inbox_empty_invites',
            'No pending invites — when someone sends you a private invite, it will appear here.'
          )}
        />
      ) : (
        <section className="inbox-section">
          <AppText as="h2" className="inbox-section__title">
            {t('inbox_section_invites', 'Invites')}
          </AppText>
          <ul className="inbox-list">
            {pending.map((inv) => {
              const hostId = inv.authorId || inv.author?.id;
              const hostDoc = hostId ? hostCache[hostId] : null;
              const hostName =
                getPrivateInviteeDisplayName(hostDoc) ||
                inv.author?.name ||
                inv.author?.displayName ||
                t('user', 'User');
              const avatar = getSafeAvatar(hostDoc || inv.author);
              const isPrivate = resolveInviteCategory(inv) === 'private';
              const title =
                inv.title?.trim() ||
                (isPrivate
                  ? t('inbox_private_invite_fallback', 'Private invite')
                  : t('inbox_social_invite_fallback', 'Social invite'));
              const path = getInvitationDetailsPath(inv);

              return (
                <li key={inv.id}>
                  <button
                    type="button"
                    className={`inbox-row inbox-row--start inbox-row--button${isPrivate ? ' inbox-row--premium' : ''}`}
                    onClick={() => navigate(path)}
                  >
                    <img src={avatar} alt="" className="inbox-avatar" />
                    <div className="inbox-row__main">
                      <div className="inbox-row__title-row">
                        <LuUtensilsCrossed className="inbox-icon-dining" size={16} />
                        <AppText as="span" className="inbox-row__title">{title}</AppText>
                      </div>
                      <AppText as="p" className="inbox-row__sub">
                        {t('inbox_invite_from', {
                          name: hostName,
                          time: formatTime(inv),
                          defaultValue: `From ${hostName} · ${formatTime(inv)}`,
                        })}
                      </AppText>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="inbox-section inbox-section--gifts">
        <AppText as="h2" className="inbox-section__title">
          <LuGift className="inbox-icon-gift" size={16} aria-hidden />
          {t('inbox_section_gifts', 'Gifts')}
        </AppText>
        {gifts.length === 0 ? (
          <AppText as="p" className="inbox-gifts-note">
            {t(
              'inbox_gifts_coming_soon',
              'No gifts yet — when someone sends you a gift, it will appear here.'
            )}
          </AppText>
        ) : (
          <ul className="inbox-list">
            {gifts.map((gift) => (
              <li key={gift.id}>
                <button
                  type="button"
                  className="inbox-row inbox-row--start inbox-row--button"
                  onClick={() => gift.actionUrl && navigate(gift.actionUrl)}
                >
                  <img src={getSafeAvatar(gift.sender)} alt="" className="inbox-avatar" />
                  <div className="inbox-row__main">
                    <div className="inbox-row__title-row">
                      <LuGift className="inbox-icon-gift" size={16} />
                      <AppText as="span" className="inbox-row__title">
                        {gift.title || t('inbox_gift_fallback', 'Gift')}
                      </AppText>
                    </div>
                    <AppText as="p" className="inbox-row__sub">
                      {t('inbox_gift_from', {
                        name: gift.senderName || t('someone', 'Someone'),
                        time: formatInboxRelativeTime(gift.createdAt, t),
                        defaultValue: `From ${gift.senderName || 'Someone'} · ${formatInboxRelativeTime(gift.createdAt, t)}`,
                      })}
                    </AppText>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ActivityTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notifications, loading, markAsRead, deleteNotification } = useNotifications();
  const [openSwipeId, setOpenSwipeId] = useState(null);

  const activityItems = useMemo(
    () => notifications.filter(isInboxActivityNotification).slice(0, 25),
    [notifications]
  );

  useEffect(() => {
    if (!openSwipeId) return undefined;
    const close = (e) => {
      if (e.target.closest('.delete-swipe__action')) return;
      const row = e.target.closest('.delete-swipe');
      if (row?.dataset?.swipeId === openSwipeId) return;
      setOpenSwipeId(null);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [openSwipeId]);

  const formatTime = useCallback(
    (notif) => formatInboxRelativeTime(notif.createdAt, t),
    [t]
  );

  const activityLabel = useCallback(
    (notif) => {
      const name = notif.fromUserName || t('someone', 'Someone');
      if (notif.type === 'follow') {
        return t('notif_msg_follow', '{{name}} started following you', { name });
      }
      if (notif.type === 'like' && notif.metadata?.mutual) {
        return t('inbox_activity_match', 'You matched with {{name}} — you can chat now', { name });
      }
      if (notif.type === 'greeting') {
        return t('inbox_activity_greeting', '{{name}} waved hi 👋', { name });
      }
      if (notif.type === 'connect') {
        return notif.message || notif.title || '';
      }
      return notif.message || notif.title || '';
    },
    [t]
  );

  const resolveActorId = useCallback(
    (notif) =>
      notif.fromUserId || notif.metadata?.senderId || notif.metadata?.likerId || null,
    []
  );

  const removeItem = useCallback(
    (notif) => {
      setOpenSwipeId(null);
      deleteNotification(notif.id, notif._collection || 'notifications');
    },
    [deleteNotification]
  );

  const handleOpen = useCallback(
    (notif) => {
      if (openSwipeId === notif.id) {
        setOpenSwipeId(null);
        return;
      }
      if (openSwipeId) {
        setOpenSwipeId(null);
        return;
      }
      if (!notif.read) {
        markAsRead(notif.id, notif._collection || 'notifications');
      }
      const uid = resolveActorId(notif);
      if (!uid) return;
      if (notif.type === 'like' && notif.metadata?.mutual) {
        navigate(`/chat/${uid}`);
        return;
      }
      navigate(`/profile/${uid}`);
    },
    [markAsRead, navigate, openSwipeId, resolveActorId]
  );

  if (loading) return <InboxLoading />;

  return (
    <div>
      {activityItems.length === 0 ? (
        <InboxEmpty
          message={t(
            'inbox_empty_activity',
            'No recent activity — mutual matches, follows, and greetings will show here.'
          )}
        />
      ) : (
        <ul className="inbox-list">
          {activityItems.map((item) => (
            <li key={`${item._collection || 'n'}-${item.id}`}>
              <DeleteSwipeRow
                rowId={item.id}
                isOpen={openSwipeId === item.id}
                onOpenChange={(open) => setOpenSwipeId(open ? item.id : null)}
                onDelete={() => removeItem(item)}
                className={!item.read ? 'inbox-activity-swipe--unread' : ''}
              >
                <div
                  className={`inbox-activity-row${!item.read ? ' inbox-activity-row--unread' : ''}`}
                  onClick={() => handleOpen(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpen(item);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <AppText as="span" className="inbox-activity-row__text">
                    {activityLabel(item)}
                  </AppText>
                  <div className="inbox-activity-row__tail">
                    <AppText as="span" className="inbox-row__meta">{formatTime(item)}</AppText>
                    <button
                      type="button"
                      className="inbox-activity-row__dismiss"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeItem(item);
                      }}
                      aria-label={t('delete', 'Delete')}
                      title={t('delete', 'Delete')}
                    >
                      <LuX size={16} aria-hidden />
                    </button>
                  </div>
                </div>
              </DeleteSwipeRow>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const INBOX_TABS = new Set(['chats', 'invites', 'activity']);

/**
 * Discovery inbox — action queue (invites), chat preview, social activity.
 */
export default function InboxScreen({ defaultTab = 'invites' }) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const initialTab = INBOX_TABS.has(tabFromUrl) ? tabFromUrl : defaultTab;
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (INBOX_TABS.has(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);
  const { pending, synced } = usePendingInvitesForMe();
  const { notifications } = useNotifications();

  const activityUnread = useMemo(
    () => notifications.filter((n) => !n.read && isInboxActivityNotification(n)).length,
    [notifications]
  );

  const tabs = useMemo(
    () => [
      { id: 'chats', label: t('inbox_tab_chats', 'Conversations'), icon: LuMessageCircle },
      {
        id: 'invites',
        label: t('inbox_tab_invites', 'Invites & gifts'),
        icon: LuGift,
        highlight: true,
        badge: synced && pending.length > 0 ? pending.length : 0,
      },
      {
        id: 'activity',
        label: t('inbox_tab_activity', 'Activity'),
        icon: LuSparkles,
        badge: activityUnread,
      },
    ],
    [t, synced, pending.length, activityUnread]
  );

  return (
    <div className="inbox-shell">
      <header className="inbox-header">
        <Link to="/search" className="inbox-back" aria-label={t('back', 'Back')}>
          <LuArrowLeft size={20} />
        </Link>
        <AppText as="h1" className="inbox-header__title">{t('inbox_title', 'Inbox')}</AppText>
      </header>

      <div className="inbox-tabs" role="tablist" aria-label={t('inbox_title', 'Inbox')}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const showDot = tab.highlight && tab.badge > 0;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'inbox-tab',
                isActive ? 'inbox-tab--active' : '',
                tab.highlight ? 'inbox-tab--highlight' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <Icon size={18} />
              <AppText as="span">{tab.label}</AppText>
              {showDot ? <AppText as="span" className="inbox-tab__dot" aria-hidden /> : null}
              {!showDot && tab.badge > 0 ? (
                <AppText as="span" className="inbox-tab__count">
                  {tab.badge > 9 ? '9+' : tab.badge}
                </AppText>
              ) : null}
            </button>
          );
        })}
      </div>

      <motion.div
        key={activeTab}
        className="inbox-body"
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'chats' && <ChatsTab />}
        {activeTab === 'invites' && <InvitesTab />}
        {activeTab === 'activity' && <ActivityTab />}
      </motion.div>
    </div>
  );
}
