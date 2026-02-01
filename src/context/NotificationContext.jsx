import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase/config';
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    writeBatch
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
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

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
            orderBy('createdAt', 'desc')
        );


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
                setUnreadCount(unread);

                setLoading(false);
            },
            (error) => {
                console.error('Error loading notifications:', error);
                setLoading(false); // ✅ Important: stop loading on error
                setNotifications([]);
                setUnreadCount(0);
            }
        );

        return () => unsubscribe();
    }, [currentUser?.uid]);

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

    // Format time
    const formatTime = (date) => {
        if (!date) return '';

        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const value = {
        notifications,
        unreadCount,
        loading,
        createNotification,
        markAsRead,
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
