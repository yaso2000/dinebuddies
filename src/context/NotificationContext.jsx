import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase/config';
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    writeBatch,
    getDoc
} from 'firebase/firestore';

const NotificationContext = createContext();

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within NotificationProvider');
    }
    return context;
};

export const NotificationProvider = ({ children }) => {
    const { currentUser } = useAuth();
    const { t, i18n } = useTranslation();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [unreadBellCount, setUnreadBellCount] = useState(0);
    const [unreadMessageCount, setUnreadMessageCount] = useState(0);
    const [activePrivateInvitation, setActivePrivateInvitation] = useState(null);
    const [dismissedNotificationIds, setDismissedNotificationIds] = useState(new Set());
    const [loading, setLoading] = useState(true);

    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useToast();

    // Load notifications for current user
    useEffect(() => {
        if (!currentUser?.uid) {
            setNotifications([]);
            setUnreadCount(0);
            setLoading(false);
            return;
        }

        const notificationsRef = collection(db, 'notifications');
        const q = query(
            notificationsRef,
            where('userId', '==', currentUser.uid),
            orderBy('createdAt', 'desc'),
            limit(50)
        );


        let isInitialLoad = true;

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const notifs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate() || new Date()
                }));

                setNotifications(notifs);

                // Count unread
                const unread = notifs.filter(n => !n.read).length;
                const unreadMsgs = notifs.filter(n => !n.read && n.type === 'message').length;
                
                setUnreadCount(unread);
                setUnreadMessageCount(unreadMsgs);
                setUnreadBellCount(unread - unreadMsgs);

                // Active private-invitation overlay is synced in useEffect from sorted unreadPrivateInvitations

                // Trigger in-app floating notifications for new items
                if (!isInitialLoad) {
                    snapshot.docChanges().forEach((change) => {
                        if (change.type === 'added') {
                            const newNotif = change.doc.data();
                            
                            // Don't toast if it's already read
                            const isAlreadyRead = newNotif.read;
                            // Don't toast if the user is currently on the exact page the notification refers to
                            const isCurrentlyOnPage = location.pathname === newNotif.actionUrl;
                            
                            // Full-screen PrivateInvitationOverlay handles private_invitation; skip duplicate toast
                            if (newNotif.type === 'private_invitation') return;

                            if (!isAlreadyRead && !isCurrentlyOnPage) {
                                showToast({
                                    title: newNotif.title,
                                    body: newNotif.message,
                                    icon: newNotif.fromUserAvatar || newNotif.senderAvatar || null,
                                    onClick: () => {
                                        if (newNotif.actionUrl) {
                                            navigate(newNotif.actionUrl);
                                        }
                                    }
                                }, 'notification');
                            }
                        }
                    });
                }
                
                isInitialLoad = false;
                setLoading(false);
            },
            (error) => {
                console.error('Error loading notifications:', error);
                setLoading(false);
                setNotifications([]);
                setUnreadCount(0);
            }
        );

        return () => unsubscribe();
    }, [currentUser?.uid]); // ← dismissedNotificationIds intentionally excluded to prevent re-subscription on every dismiss

    // Helper: Check if current time is in Do Not Disturb period
    const isInDNDPeriod = (dndSettings) => {
        if (!dndSettings || !dndSettings.enabled) return false;

        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        const { startTime, endTime } = dndSettings;

        // Check if current time is in range
        if (startTime <= endTime) {
            // Normal range (e.g., 22:00 to 23:00)
            return currentTime >= startTime && currentTime <= endTime;
        } else {
            // Overnight range (e.g., 22:00 to 08:00)
            return currentTime >= startTime || currentTime <= endTime;
        }
    };

    // Helper: Get user notification settings
    const getUserSettings = async (userId) => {
        try {
            const settingsRef = doc(db, 'users', userId, 'preferences', 'notifications');
            const settingsDoc = await getDoc(settingsRef);

            if (settingsDoc.exists()) {
                return settingsDoc.data();
            }

            // Return default settings if none exist
            return {
                pushEnabled: true,
                pushTypes: {
                    follow: true,
                    invitation_accepted: true,
                    invitation_rejected: true,
                    message: true,
                    like: true,
                    comment: true,
                    reminder: true
                }
            };
        } catch (error) {
            console.error('Error loading user settings:', error);
            // Default to allowing notifications on error
            return { pushEnabled: true, pushTypes: {} };
        }
    };

    // Create a notification
    const createNotification = async ({
        userId,
        type,
        title,
        message,
        actionUrl = null,
        fromUserId = null,
        fromUserName = null,
        fromUserAvatar = null,
        metadata = {}
    }) => {
        if (!userId) return;

        try {
            // 🔍 Check user notification settings
            const settings = await getUserSettings(userId);

            // ❌ Check if push notifications are globally disabled
            if (settings.pushEnabled === false) {
                console.log('🔕 Push notifications disabled for user:', userId);
                return;
            }

            // ❌ Check if this specific notification type is disabled
            if (settings.pushTypes && settings.pushTypes[type] === false) {
                console.log(`🔕 Notification type "${type}" disabled for user:`, userId);
                return;
            }

            // 🌙 Check Do Not Disturb
            if (settings.doNotDisturb && isInDNDPeriod(settings.doNotDisturb)) {
                console.log('🌙 Do Not Disturb active - notification skipped for user:', userId);
                return;
            }

            // ✅ All checks passed - create notification
            console.log(`✅ Creating notification (${type}) for user:`, userId);

            const notificationsRef = collection(db, 'notifications');
            await addDoc(notificationsRef, {
                userId,
                type,
                title,
                message,
                actionUrl,
                fromUserId,
                fromUserName,
                fromUserAvatar,
                metadata,
                read: false,
                createdAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error creating notification:', error);
        }
    };

    // Mark notification as read
    const markAsRead = async (notificationId) => {
        if (!notificationId) return;

        try {
            const notifRef = doc(db, 'notifications', notificationId);
            await updateDoc(notifRef, {
                read: true,
                readAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const markMessageNotificationsAsRead = async (actionUrlSubstring) => {
        if (!currentUser?.uid) return;
        const unreadToClear = notifications.filter(n => 
            !n.read && 
            n.type === 'message' && 
            n.actionUrl && 
            n.actionUrl.includes(actionUrlSubstring)
        );

        if (unreadToClear.length === 0) return;

        unreadToClear.forEach(async (n) => {
            try {
                await updateDoc(doc(db, 'notifications', n.id), {
                    read: true,
                    readAt: serverTimestamp()
                });
            } catch (error) {
                console.error(`Error marking message notification ${n.id} as read:`, error);
            }
        });
    };

    // Mark all as read
    const markAllAsRead = async () => {
        if (!currentUser?.uid) return;

        try {
            const batch = writeBatch(db);
            const unreadNotifs = notifications.filter(n => !n.read);

            unreadNotifs.forEach(notif => {
                const notifRef = doc(db, 'notifications', notif.id);
                batch.update(notifRef, {
                    read: true,
                    readAt: serverTimestamp()
                });
            });

            await batch.commit();
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    // Delete notification
    const deleteNotification = async (notificationId) => {
        if (!notificationId) return;

        try {
            const notifRef = doc(db, 'notifications', notificationId);
            await deleteDoc(notifRef);
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    // Delete all notifications
    const deleteAllNotifications = async () => {
        if (!currentUser?.uid) return;

        try {
            const batch = writeBatch(db);

            notifications.forEach(notif => {
                const notifRef = doc(db, 'notifications', notif.id);
                batch.delete(notifRef);
            });

            await batch.commit();
        } catch (error) {
            console.error('Error deleting all notifications:', error);
        }
    };

    // Dismiss notification (hide for current session)
    const dismissNotification = (notificationId) => {
        if (!notificationId) return;
        setDismissedNotificationIds(prev => new Set(prev).add(notificationId));
    };

    // Format time — language-aware
    const formatTime = (date) => {
        if (!date) return '';

        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return t('just_now', 'Just now');
        if (minutes < 60) return `${minutes}${t('time_m', 'm')} ${t('time_ago', 'ago')}`;
        if (hours < 24) return `${hours}${t('time_h', 'h')} ${t('time_ago', 'ago')}`;
        if (days < 7) return `${days}${t('time_d', 'd')} ${t('time_ago', 'ago')}`;

        const locale = i18n.language === 'ar' ? 'ar-u-nu-latn' : 'en-US';
        return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    };

    // Computed outside onSnapshot to avoid re-subscription when dismissed set changes
    const unreadPrivateInvitations = useMemo(() => {
        const list = notifications.filter(
            (n) =>
                n.type === 'private_invitation' &&
                !n.read &&
                !dismissedNotificationIds.has(n.id)
        );
        const t = (d) =>
            d instanceof Date
                ? d.getTime()
                : typeof d?.toDate === 'function'
                  ? d.toDate().getTime()
                  : typeof d?.seconds === 'number'
                    ? d.seconds * 1000
                    : 0;
        return [...list].sort((a, b) => t(a.createdAt) - t(b.createdAt));
    }, [notifications, dismissedNotificationIds]);

    // Queue: oldest unread private invitation first; keep selection stable while still valid
    useEffect(() => {
        if (unreadPrivateInvitations.length === 0) {
            setActivePrivateInvitation(null);
            return;
        }
        setActivePrivateInvitation((prev) => {
            if (prev && unreadPrivateInvitations.some((n) => n.id === prev.id)) {
                return prev;
            }
            return unreadPrivateInvitations[0];
        });
    }, [unreadPrivateInvitations]);

    const value = {
        notifications,
        unreadCount,
        unreadBellCount,
        unreadMessageCount,
        loading,
        createNotification,
        markAsRead,
        markMessageNotificationsAsRead,
        markAllAsRead,
        deleteNotification,
        deleteAllNotifications,
        activePrivateInvitation,
        setActivePrivateInvitation,
        unreadPrivateInvitations,
        dismissNotification,
        formatTime
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};
