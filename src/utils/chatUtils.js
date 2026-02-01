// Simple presence and typing tracker using Firestore
// Note: For production, consider using Firebase Realtime Database for better performance

import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

// Update user online status
export const setUserOnline = async (userId) => {
    if (!userId) return;

    try {
        const presenceRef = doc(db, 'presence', userId);
        await setDoc(presenceRef, {
            online: true,
            lastSeen: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Error setting user online:', error);
    }
};

// Update user offline status
export const setUserOffline = async (userId) => {
    if (!userId) return;

    try {
        const presenceRef = doc(db, 'presence', userId);
        await setDoc(presenceRef, {
            online: false,
            lastSeen: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Error setting user offline:', error);
    }
};

// Listen to user presence
export const subscribeToPresence = (userId, callback) => {
    if (!userId) return () => { };

    const presenceRef = doc(db, 'presence', userId);
    return onSnapshot(presenceRef, (doc) => {
        if (doc.exists()) {
            callback(doc.data());
        } else {
            callback({ online: false, lastSeen: null });
        }
    });
};

// Set typing status
export const setTypingStatus = async (conversationId, userId, isTyping) => {
    if (!conversationId || !userId) return;

    try {
        const typingRef = doc(db, 'typing', conversationId);
        await setDoc(typingRef, {
            [userId]: isTyping ? serverTimestamp() : null
        }, { merge: true });
    } catch (error) {
        console.error('Error setting typing status:', error);
    }
};

// Listen to typing status
export const subscribeToTyping = (conversationId, callback) => {
    if (!conversationId) return () => { };

    const typingRef = doc(db, 'typing', conversationId);
    return onSnapshot(typingRef, (doc) => {
        if (doc.exists()) {
            callback(doc.data());
        } else {
            callback({});
        }
    });
};

// Play notification sound
export const playNotificationSound = () => {
    try {
        const audio = new Audio('/notification.mp3');
        audio.volume = 0.5;
        audio.play().catch(err => console.log('Could not play sound:', err));
    } catch (error) {
        console.error('Error playing sound:', error);
    }
};

// Request notification permission
export const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    return false;
};

// Show browser notification
export const showNotification = (title, options = {}) => {
    if (Notification.permission === 'granted') {
        new Notification(title, {
            icon: '/logo.png',
            badge: '/logo.png',
            ...options
        });
    }
};
