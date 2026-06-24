import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { isBusinessUser } from '../utils/accountRole';
import { useToast } from './ToastContext';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase/config';
import { navigateToHostedInvitationDetails } from '../utils/hostedInvitationRoutes';
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

/** True if user is already on the screen this notification points to (avoids toast + badge noise). */
function shouldSuppressInAppToastForPath(pathname, notif) {
    if (!notif || notif.read) return false;
    const path = String(pathname || '');

    // No foreground toasts while browsing messages, notifications, or discovery inbox.
    if (path === '/messages' || path === '/notifications' || path.startsWith('/chat/') || path === '/search/inbox') {
        return true;
    }

    const url = notif.actionUrl ? String(notif.actionUrl) : '';
    if (url && path === url) return true;

    const type = String(notif.type || '');

    if (
        type === 'social_invitation' ||
        type === 'social_invitation_response' ||
        type === 'reminder' ||
        type === 'join_request' ||
        type === 'request_approved' ||
        type === 'invitation_accepted' ||
        type === 'invitation_rejected'
    ) {
        // Private invites are shown only on app entry (/invite/received), not as in-app toasts.
        return true;
    }

    if (type !== 'message') return false;

    if (path === '/messages') return true;
    if (url.startsWith('/community/')) {
        const base = url.replace(/\/chat\/?$/, '');
        return path === base || path === url;
    }
    if (url.startsWith('/chat/')) return path === url;
    if (url.includes('/invitation/') && url.includes('/chat')) return path === url;
    return false;
}

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within NotificationProvider');
    }
    return context;
};

function partnerDocToNotif(docSnap) {
    const data = docSnap.data() || {};
    const created =
        data.createdAt?.toDate?.() ||
        data.timestamp?.toDate?.() ||
        (data.createdAt instanceof Date ? data.createdAt : null) ||
        new Date();
    return {
        id: docSnap.id,
        _collection: 'partner_notifications',
        userId: data.restaurantId,
        type: data.type || 'new_booking',
        title: data.title,
        message: data.message,
        actionUrl: data.actionUrl || null,
        invitationId: data.invitationId || null,
        fromUserId: data.senderId || null,
        fromUserName: data.fromUserName || null,
        fromUserAvatar: data.fromUserAvatar || null,
        senderId: data.senderId || null,
        senderName: data.fromUserName || null,
        senderAvatar: data.fromUserAvatar || null,
        metadata: { partnerNotificationId: docSnap.id, partnerId: data.restaurantId },
        read: data.read === true,
        createdAt: created,
    };
}

export const NotificationProvider = ({ children }) => {
    const { currentUser, userProfile } = useAuth();
    const { t, i18n } = useTranslation();
    const [inboxNotifs, setInboxNotifs] = useState([]);
    const [partnerNotifs, setPartnerNotifs] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [unreadBellCount, setUnreadBellCount] = useState(0);
    const [unreadMessageCount, setUnreadMessageCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const isBusinessAccount = isBusinessUser(userProfile);

    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useToast();
    const pathnameRef = useRef(location.pathname);
    pathnameRef.current = location.pathname;

    const notifications = useMemo(() => {
        const mirroredPartnerIds = new Set(
            inboxNotifs
                .map((n) => n.metadata?.partnerNotificationId)
                .filter(Boolean)
        );
        const legacyPartner = partnerNotifs.filter((p) => !mirroredPartnerIds.has(p.id));
        return [...inboxNotifs, ...legacyPartner]
            .sort((a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0))
            .slice(0, 50);
    }, [inboxNotifs, partnerNotifs]);

    const applyCounts = useCallback((notifs) => {
        const unread = notifs.filter((n) => !n.read).length;
        const unreadMsgs = notifs.filter((n) => !n.read && n.type === 'message').length;
        setUnreadCount(unread);
        setUnreadMessageCount(unreadMsgs);
        setUnreadBellCount(unread - unreadMsgs);
    }, []);

    useEffect(() => {
        applyCounts(notifications);
    }, [notifications, applyCounts]);

    const showSystemBannerIfBackground = useCallback((notif, docId) => {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
        // Foreground: in-app inbox + toasts only — never duplicate OS banners (especially on iOS PWA).
        if (document.visibilityState === 'visible') return;
        if (document.hasFocus()) return;
        const title = notif.title || 'DineBuddies';
        const body = notif.message || '';
        try {
            const n = new Notification(title, {
                body,
                icon: notif.fromUserAvatar || notif.senderAvatar || '/icon-light-192.png',
                tag: docId ? `db-notif-${docId}` : `db-notif-${Date.now()}`,
                data: { url: notif.actionUrl || '/' },
            });
            n.onclick = () => {
                try {
                    window.focus();
                    if (notif.actionUrl) navigate(notif.actionUrl);
                } catch {
                    /* ignore */
                }
                n.close();
            };
        } catch {
            /* ignore */
        }
    }, [navigate]);

    const toastNewItems = useCallback(
        (snapshot, isInitialLoad) => {
            if (isInitialLoad) return;
            const pathname = pathnameRef.current;
            snapshot.docChanges().forEach((change) => {
                if (change.type !== 'added') return;
                const newNotif = change.doc.data();
                const isAlreadyRead = newNotif.read;
                const onTarget = shouldSuppressInAppToastForPath(pathname, newNotif);
                if (!isAlreadyRead && !onTarget) {
                    showSystemBannerIfBackground(newNotif, change.doc.id);
                    showToast(
                        {
                            title: newNotif.title,
                            body: newNotif.message,
                            icon: newNotif.fromUserAvatar || newNotif.senderAvatar || null,
                            onClick: () => {
                                const invId =
                                    newNotif.invitationId || newNotif.metadata?.invitationId;
                                if (
                                    (newNotif.type === 'social_invitation' ||
                                        newNotif.type === 'social_invitation_response') &&
                                    invId
                                ) {
                                    void navigateToHostedInvitationDetails(invId, navigate);
                                } else if (newNotif.actionUrl) {
                                    navigate(newNotif.actionUrl);
                                }
                            },
                        },
                        'notification'
                    );
                }
            });
        },
        [navigate, showToast, showSystemBannerIfBackground]
    );

    // In-app inbox (all accounts) + legacy partner_notifications for business
    useEffect(() => {
        if (!currentUser?.uid) {
            setInboxNotifs([]);
            setPartnerNotifs([]);
            setUnreadCount(0);
            setLoading(false);
            return undefined;
        }

        let inboxInitial = true;
        let partnerInitial = true;

        const inboxQ = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid),
            orderBy('createdAt', 'desc'),
            limit(50)
        );

        const unsubInbox = onSnapshot(
            inboxQ,
            (snapshot) => {
                const notifs = snapshot.docs.map((d) => ({
                    id: d.id,
                    _collection: 'notifications',
                    ...d.data(),
                    createdAt: d.data().createdAt?.toDate?.() || new Date(),
                }));
                setInboxNotifs(notifs);
                toastNewItems(snapshot, inboxInitial);
                inboxInitial = false;
                setLoading(false);
            },
            (error) => {
                console.error('Error loading notifications:', error);
                setInboxNotifs([]);
                setLoading(false);
            }
        );

        let unsubPartner = () => {};
        if (isBusinessAccount) {
            const partnerQ = query(
                collection(db, 'partner_notifications'),
                where('restaurantId', '==', currentUser.uid),
                limit(50)
            );
            unsubPartner = onSnapshot(
                partnerQ,
                (snapshot) => {
                    const notifs = snapshot.docs.map(partnerDocToNotif);
                    setPartnerNotifs(notifs);
                    toastNewItems(snapshot, partnerInitial);
                    partnerInitial = false;
                    setLoading(false);
                },
                (error) => {
                    console.error('Error loading partner notifications:', error);
                    setPartnerNotifs([]);
                }
            );
        } else {
            setPartnerNotifs([]);
        }

        return () => {
            unsubInbox();
            unsubPartner();
        };
    }, [currentUser?.uid, isBusinessAccount, toastNewItems]);

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
            // Always write in-app notification; push prefs are enforced server-side (onNotificationCreated).
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

    const notifDocRef = (notificationId, collectionName = 'notifications') =>
        doc(db, collectionName === 'partner_notifications' ? 'partner_notifications' : 'notifications', notificationId);

    // Mark notification as read
    const markAsRead = async (notificationId, collectionName = 'notifications') => {
        if (!notificationId) return;

        try {
            await updateDoc(notifDocRef(notificationId, collectionName), {
                read: true,
                readAt: serverTimestamp(),
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const markMessageNotificationsAsRead = async (actionUrlSubstring) => {
        if (!currentUser?.uid) return;

        const unreadToClear = notifications.filter((n) => {
            if (n.read || n.type !== 'message') return false;
            if (actionUrlSubstring === '/messages') return true;
            if (!actionUrlSubstring || !n.actionUrl) return false;
            return (
                n.actionUrl.includes(actionUrlSubstring) ||
                actionUrlSubstring.includes(n.actionUrl)
            );
        });

        if (unreadToClear.length === 0) return;

        await Promise.all(
            unreadToClear.map((n) =>
                updateDoc(doc(db, 'notifications', n.id), {
                    read: true,
                    readAt: serverTimestamp(),
                }).catch((error) => {
                    console.error(`Error marking message notification ${n.id} as read:`, error);
                })
            )
        );
    };

    // Mark all as read
    const markAllAsRead = async () => {
        if (!currentUser?.uid) return;

        try {
            const batch = writeBatch(db);
            const unreadNotifs = notifications.filter(n => !n.read);

            unreadNotifs.forEach((notif) => {
                batch.update(notifDocRef(notif.id, notif._collection || 'notifications'), {
                    read: true,
                    readAt: serverTimestamp(),
                });
            });

            await batch.commit();
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    // Delete notification
    const deleteNotification = async (notificationId, collectionName = 'notifications') => {
        if (!notificationId) return;

        try {
            await deleteDoc(notifDocRef(notificationId, collectionName));
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    // Delete all notifications
    const deleteAllNotifications = async () => {
        if (!currentUser?.uid) return;

        try {
            const batch = writeBatch(db);

            notifications.forEach((notif) => {
                batch.delete(notifDocRef(notif.id, notif._collection || 'notifications'));
            });

            await batch.commit();
        } catch (error) {
            console.error('Error deleting all notifications:', error);
        }
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
        formatTime
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};
