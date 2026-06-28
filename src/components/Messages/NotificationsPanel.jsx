import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  FaBell,
  FaCheckCircle,
  FaCommentAlt,
  FaTrash,
  FaUserPlus,
  FaCalendarCheck,
  FaTimesCircle,
  FaHeart,
  FaExclamationCircle,
  FaSearch,
  FaSlidersH,
  FaCheckDouble,
  FaLock,
} from 'react-icons/fa';
import EmptyState from '../EmptyState';
import UserAvatar from '../UserAvatar';
import NotificationSwipeRow from '../NotificationSwipeRow';
import NewReportModal from '../NewReportModal';
import { useInvitations } from '../../context/InvitationContext';
import { useToast } from '../../context/ToastContext';
import { toggleUserMute } from '../../utils/userSocialLists';
import '../../pages/Notifications.css';
import { navigateToHostedInvitationDetails } from '../../utils/hostedInvitationRoutes';
import {
  getNotificationInvitationId,
  isActionableSocialInvitationNotification,
  loadHostedInvitationById,
} from '../../utils/staleInvitationNotifications';
import { AppText, AppTextInput } from '../base';
const getNotifTitle = (notif, t) => {
  const name = notif.fromUserName || t('someone', 'Someone');
  switch (notif.type) {
    case 'follow':return t('notif_title_follow', 'New Follower');
    case 'invitation_accepted':return t('notif_title_accepted', 'Invitation Accepted');
    case 'invitation_rejected':return t('notif_title_rejected', 'Invitation Declined');
    case 'message':return t('notif_title_message', 'New Message');
    case 'reminder':return t('notif_title_reminder', 'Upcoming Invitation');
    case 'like':return t('notif_title_like', 'Invitation Liked');
    case 'comment':return t('notif_title_comment', 'New Comment');
    case 'comment_reply':return t('notif_title_comment_reply', 'New reply');
    case 'comment_like':return t('notif_title_comment_like', 'Comment liked');
    case 'invitation_full':return t('notif_title_full', 'Invitation Complete');
    case 'booking_confirmed':return t('notif_title_booking_confirmed', 'Booking Confirmed');
    case 'invitation_cancelled':return t('notif_title_cancelled', 'Invitation Cancelled');
    case 'booking_cancelled':return t('notif_title_booking_cancelled', 'Booking Cancelled');
    case 'invitation_completed':return t('notif_title_completed', 'Invitation Completed! 🎉');
    case 'invitation_updated':return t('notif_title_updated', 'Invitation Time Updated');
    case 'social_invitation':return t('notification_private_invitation_title', 'New private invitation');
    case 'social_invitation_response':
      return notif.status === 'declined' ?
      t('notif_title_private_declined', 'Invitation declined') :
      t('notif_title_private_accepted', 'Invitation accepted');
    case 'join_request':return t('notif_title_join_request', 'New Join Request');
    case 'request_approved':return t('notif_title_request_approved', 'Request Approved');
    case 'business_message':return t('notif_title_business_message', 'Message from Business');
    case 'new_booking':return t('notif_title_new_booking', 'New booking');
    case 'business_feedback':return t('notif_title_business_feedback', 'Customer feedback');
    case 'business_post':return t('notif_title_business_post', 'New post');
    default:return notif.title || t('notification', 'Notification');
  }
};

/**
 * Returns a translated message for a notification based on its type and metadata.
 * Falls back to the stored message if no translation is found.
 */
const getNotifMessage = (notif, t) => {
  const name = notif.fromUserName || t('someone', 'Someone');
  const title = notif.metadata?.invitationTitle || notif.invitationTitle || '';
  switch (notif.type) {
    case 'follow':
      return t('notif_msg_follow', '{{name}} started following you', { name });
    case 'invitation_accepted':
      return t('notif_msg_accepted', '{{name}} accepted your invitation', { name });
    case 'invitation_rejected':
      return t('notif_msg_rejected', '{{name}} declined your invitation', { name });
    case 'message':
      return notif.message || t('notif_msg_message', 'You have a new message from {{name}}', { name });
    case 'reminder':
      return notif.message || t('notif_msg_reminder', 'Your invitation is coming up soon');
    case 'like':
      return t('notif_msg_like', '{{name}} liked your invitation', { name });
    case 'comment':
      return notif.message || t('notif_msg_comment', '{{name}} commented on your post', { name });
    case 'comment_reply':
      return notif.message || t('notif_msg_comment_reply', '{{name}} replied to your comment', { name });
    case 'comment_like':
      return notif.message || t('notif_msg_comment_like', '{{name}} liked your comment', { name });
    case 'invitation_full':
      return t('notif_msg_full', 'Great news! Your invitation is now complete with all guests confirmed.');
    case 'booking_confirmed':
      return t('notif_msg_booking_confirmed', 'A booking at your venue is now confirmed.');
    case 'invitation_cancelled':
      return notif.message || t('notif_msg_cancelled', 'An invitation has been cancelled.');
    case 'booking_cancelled':
      return notif.message || t('notif_msg_booking_cancelled', 'A booking at your venue has been cancelled.');
    case 'invitation_completed':
      return t('notif_msg_completed', 'The invitation has been completed. Hope you had a great time!');
    case 'invitation_updated':
      return notif.message || t('notif_msg_updated', 'The invitation time has been updated. Please confirm your attendance.');
    case 'social_invitation':{
        const invTitle =
        notif.metadata?.invitationTitle ||
        notif.invitationTitle ||
        title ||
        t('social_invitation', 'Private invitation');
        return t('notification_private_invitation_message', '{{name}} has invited you to a private occasion: {{title}}', {
          name,
          title: invTitle
        });
      }
    case 'social_invitation_response':
      return notif.message || '';
    case 'join_request':
      return t('notif_msg_join_request', '{{name}} requested to join your invitation', { name });
    case 'request_approved':
      return t('notif_msg_request_approved', 'Your request to join was approved', { name });
    case 'business_message':
      return notif.message || t('notif_title_business_message', 'Message from Business');
    case 'new_booking':
    case 'business_feedback':
    case 'business_post':
      return notif.message || '';
    default:
      return notif.message || '';
  }
};

const NotificationsPanel = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const { showToast } = useToast();
  const { submitReport } = useInvitations();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    formatTime,
    createNotification
  } = useNotifications();

  // Filter and search states
  const [filterStatus, setFilterStatus] = useState('all'); // all, unread, read
  const [filterType, setFilterType] = useState('all'); // all, follow, invitation_accepted, etc.
  const [searchQuery, setSearchQuery] = useState('');
  const [openSwipeId, setOpenSwipeId] = useState(null);
  const [reportModal, setReportModal] = useState(null);

  const resolveActorId = (notif) =>
  notif.fromUserId || notif.metadata?.senderId || notif.metadata?.fromUserId || null;

  const handleMuteFromNotification = async (notif) => {
    const actorId = resolveActorId(notif);
    const myUid = currentUser?.uid;
    if (!actorId || !myUid) {
      showToast(t('notification_mute_unavailable', 'Cannot mute this notification.'), 'info');
      return;
    }
    try {
      await toggleUserMute(myUid, actorId, true);
      showToast(
        t('user_muted_toast', 'User muted for invitations and messages.'),
        'success'
      );
      deleteNotification(notif.id, notif._collection || 'notifications');
    } catch (err) {
      console.error('[Notifications] mute', err);
      showToast(t('error_update_settings', 'Something went wrong.'), 'error');
    }
  };

  const openReportForNotification = (notif) => {
    const actorId = resolveActorId(notif);
    const invId = notif.metadata?.invitationId || notif.invitationId || null;
    if (actorId) {
      setReportModal({
        reportType: 'user',
        targetId: actorId,
        targetName: notif.fromUserName || notif.senderName || t('someone', 'Someone'),
        notificationId: notif.id,
        collection: notif._collection || 'notifications'
      });
      return;
    }
    if (invId) {
      setReportModal({
        reportType: 'invitation',
        targetId: invId,
        targetName:
        notif.metadata?.invitationTitle ||
        notif.metadata?.title ||
        t('invitation', 'Invitation'),
        notificationId: notif.id,
        collection: notif._collection || 'notifications'
      });
      return;
    }
    showToast(t('notification_report_unavailable', 'Cannot report this notification.'), 'info');
  };

  useEffect(() => {
    if (!openSwipeId) return undefined;
    const close = (e) => {
      if (e.target.closest('.notification-swipe__action')) return;
      const row = e.target.closest('.notification-swipe');
      if (row?.dataset?.notifId === openSwipeId) return;
      setOpenSwipeId(null);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [openSwipeId]);

  const getIcon = (type, status) => {
    const iconStyle = { fontSize: '1.2rem' };
    switch (type) {
      case 'follow':
      case 'join_request':
        return <FaUserPlus style={{ ...iconStyle, color: 'var(--primary)' }} />;
      case 'request_approved':
        return <FaCheckDouble style={{ ...iconStyle, color: '#10b981' }} />;
      case 'invitation_accepted':
        return <FaCheckCircle style={{ ...iconStyle, color: '#10b981' }} />;
      case 'invitation_rejected':
        return <FaTimesCircle style={{ ...iconStyle, color: '#ef4444' }} />;
      case 'message':
        return <FaCommentAlt style={{ ...iconStyle, color: 'var(--secondary)' }} />;
      case 'like':
      case 'comment_like':
        return <FaHeart style={{ ...iconStyle, color: '#f472b6' }} />;
      case 'comment':
      case 'comment_reply':
        return <FaCommentAlt style={{ ...iconStyle, color: '#3b82f6' }} />;
      case 'reminder':
        return <FaExclamationCircle style={{ ...iconStyle, color: '#f59e0b' }} />;
      case 'social_invitation':
        return <FaLock style={{ ...iconStyle, color: '#8b5cf6' }} />;
      case 'social_invitation_response':
        return status === 'declined' ?
        <FaTimesCircle style={{ ...iconStyle, color: '#ef4444' }} /> :

        <FaCheckCircle style={{ ...iconStyle, color: '#10b981' }} />;

      case 'business_post':
      case 'new_booking':
        return <FaCalendarCheck style={{ ...iconStyle, color: '#10b981' }} />;
      case 'business_feedback':
        return <FaCommentAlt style={{ ...iconStyle, color: '#f59e0b' }} />;
      case 'business_message':
      case 'community_message':
        return <FaCommentAlt style={{ ...iconStyle, color: 'var(--secondary)' }} />;
      default:
        return <FaBell style={{ ...iconStyle, color: 'var(--text-secondary)' }} />;
    }
  };

  const handleNotificationClick = async (notification) => {
    if (openSwipeId === notification.id) {
      setOpenSwipeId(null);
      return;
    }
    if (openSwipeId) {
      setOpenSwipeId(null);
      return;
    }

    // Mark as read
    if (!notification.read) {
      markAsRead(notification.id, notification._collection || 'notifications');
    }

    // Special routing: business_message should always open the chat,
    // regardless of what actionUrl is stored (Cloud Function may store /profile/... by mistake)
    if (notification.type === 'business_message' || notification.type === 'message') {
      const senderId = notification.fromUserId || notification.metadata?.senderId;
      if (senderId) {
        navigate(`/chat/${senderId}`);
        return;
      }
    }

    // Private/dating invites — validate before navigate; drop stale notifications
    if (
    notification.type === 'social_invitation' ||
    notification.type === 'social_invitation_response')
    {
      const invId = getNotificationInvitationId(notification);
      if (invId) {
        const inv = await loadHostedInvitationById(invId);
        const myUid = currentUser?.uid || currentUser?.id;
        if (
        notification.type === 'social_invitation' && (
        !inv || !isActionableSocialInvitationNotification(inv, myUid)))
        {
          showToast(
            t(
              'notification_invite_unavailable',
              'This invitation is no longer available.'
            ),
            'info'
          );
          deleteNotification(notification.id, notification._collection || 'notifications');
          return;
        }
        void navigateToHostedInvitationDetails(invId, navigate);
        return;
      }
    }

    // Navigate to action URL if exists
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  // Filter and search logic
  const filteredNotifications = notifications.filter((notif) => {
    // Filter by status (read/unread)
    if (filterStatus === 'unread' && notif.read) return false;
    if (filterStatus === 'read' && !notif.read) return false;

    // Filter by type — some groups match multiple Firestore types
    if (filterType !== 'all') {
      const TYPE_GROUPS = {
        // Community membership notifications
        members: ['follow', 'community_member', 'new_community_member'],
        // All invitation-related types
        invitations: [
        'invitation_accepted', 'invitation_rejected',
        'social_invitation', 'social_invitation_response',
        'join_request', 'request_approved', 'invitation_full'],

        messages: ['message'],
        likes: ['like'],
        comments: ['comment'],
        reminders: ['reminder'],
        system: ['system_announcement']
      };
      const allowed = TYPE_GROUPS[filterType] || [filterType];
      if (!allowed.includes(notif.type)) return false;
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchTitle = notif.title?.toLowerCase().includes(query);
      const matchMessage = notif.message?.toLowerCase().includes(query);
      const matchName = notif.fromUserName?.toLowerCase().includes(query);

      if (!matchTitle && !matchMessage && !matchName) return false;
    }

    return true;
  });

  if (loading) {
    return (
      <div className="notifications-panel notifications-panel--embedded">
        <div className="messages-page__loading">{t('loading', 'Loading…')}</div>
      </div>
    );
  }

  return (
    <div className="notifications-panel notifications-panel--embedded">
      {notifications.length > 0 ? (
        <div className="notifications-panel__toolbar">
          <button
            type="button"
            onClick={() => navigate('/settings/notifications')}
            className="notif-preferences-btn"
            title={t('notification_settings', 'Notification Settings')}
            aria-label={t('notification_settings', 'Notification Settings')}>
            <AppText as="span" className="notif-preferences-btn__icon" aria-hidden>
              <FaBell />
              <FaSlidersH className="notif-preferences-btn__sliders" />
            </AppText>
            <AppText as="span" className="notif-preferences-btn__label">
              {t('notification_prefs_short', 'Alerts')}
            </AppText>
          </button>
          <div className="notifications-panel__toolbar-actions">
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={markAllAsRead}
                className="mark-all-btn ui-btn ui-btn--primary"
                title={t('mark_all_read', 'Mark all read')}>
                <FaCheckDouble />
              </button>
            ) : null}
            <button
              type="button"
              onClick={deleteAllNotifications}
              className="delete-all-btn ui-btn ui-btn--ghost"
              title={t('delete_all', 'Delete all')}>
              <FaTrash />
            </button>
          </div>
        </div>
      ) : null}

      {notifications.length > 0 ? (
        <div className="notifications-panel__filters">
          <div className="notifications-panel__search">
            <FaSearch className="notifications-panel__search-icon" aria-hidden />
            <AppTextInput
              type="text"
              className="ui-form-field notifications-panel__search-input"
              placeholder={t('search_notifications', 'Search notifications...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="notifications-panel__status-row">
            {['all', 'unread', 'read'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(status)}
                className={`ui-tab ui-tab--compact ${filterStatus === status ? 'ui-tab--active' : ''}`}>
                {t(status, status)}
              </button>
            ))}
          </div>

          <div className="notifications-panel__type-row">
            {[
              { id: 'all', label: t('all_types', 'All'), emoji: '🔔' },
              { id: 'members', label: t('members', 'Members'), emoji: '👥' },
              { id: 'invitations', label: t('invitations', 'Invites'), emoji: '📨' },
              { id: 'messages', label: t('messages', 'Messages'), emoji: '💬' },
              { id: 'likes', label: t('likes', 'Likes'), emoji: '❤️' },
              { id: 'comments', label: t('comments', 'Comments'), emoji: '💭' },
              { id: 'reminders', label: t('reminders', 'Reminders'), emoji: '⏰' },
              { id: 'system', label: t('system', 'System'), emoji: '🎁' },
            ].map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setFilterType(type.id)}
                className={`ui-tab ui-tab--compact ${filterType === type.id ? 'ui-tab--active' : ''}`}>
                <AppText as="span">{type.emoji}</AppText>
                {type.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

            {/* Notifications List */}
            <div className="notifications-list notifications-list--embedded">
                {filteredNotifications.length === 0 && notifications.length > 0 ?
        <EmptyState
          icon={FaSearch}
          title={t('no_results', 'No results found')}
          message={t('try_different_filter', 'Try a different filter or search term')}
          variant="primary" /> :

        filteredNotifications.length === 0 ?
        <EmptyState
          icon={FaBell}
          title={t('no_notifications')}
          message={t('notifications_appear_here')}
          variant="primary" /> :


        filteredNotifications.map((notif) => {
          const cardImageUrl =
          notif.metadata?.cardImageUrl || notif.cardImageUrl || null;
          return (
            <NotificationSwipeRow
              key={notif.id}
              rowId={notif.id}
              isOpen={openSwipeId === notif.id}
              onOpenChange={(open) => setOpenSwipeId(open ? notif.id : null)}
              onDelete={() =>
              deleteNotification(notif.id, notif._collection || 'notifications')
              }
              onMute={() => handleMuteFromNotification(notif)}
              onReport={() => openReportForNotification(notif)}
              className={`notification-item${!notif.read ? ' unread' : ''}`}>

                        <div
                className="notification-item__body"
                onClick={() => handleNotificationClick(notif)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleNotificationClick(notif);
                  }
                }}>

                            {!notif.read && <div className="unread-dot" aria-hidden />}

                            <div className="notification-icon">
                                {cardImageUrl && notif.type === 'social_invitation' ?
                  <img
                    src={cardImageUrl}
                    alt=""
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 10,
                      objectFit: 'cover',
                      border: '1px solid var(--border-color)'
                    }} /> :

                  notif.fromUserAvatar || notif.senderAvatar ?
                  <UserAvatar
                    src={notif.fromUserAvatar || notif.senderAvatar}
                    user={{
                      name: notif.fromUserName || notif.senderName,
                      gender: notif.fromUserGender,
                      role: notif.fromUserRole
                    }}
                    alt={notif.fromUserName || notif.senderName || 'User'} /> :


                  getIcon(notif.type, notif.status)
                  }
                            </div>

                            <div className="notification-content">
                                <AppText as="h4" className="notification-title">{getNotifTitle(notif, t)}</AppText>
                                <AppText as="p" className="notification-message">{getNotifMessage(notif, t)}</AppText>
                                <AppText as="span" className="notification-time">{formatTime(notif.createdAt)}</AppText>
                            </div>
                        </div>
                        </NotificationSwipeRow>);

        })
        }
            </div>

            {reportModal ?
      <NewReportModal
        isOpen
        onClose={() => setReportModal(null)}
        reportType={reportModal.reportType}
        targetId={reportModal.targetId}
        targetName={reportModal.targetName}
        onSubmit={async (report) => {
          await submitReport(report);
          if (reportModal.notificationId) {
            deleteNotification(reportModal.notificationId, reportModal.collection);
          }
          setReportModal(null);
        }} /> :

      null}
    </div>
  );
};

export default NotificationsPanel;