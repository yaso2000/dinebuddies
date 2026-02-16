// Browser Notification Manager
// Uses system notification sounds automatically

class NotificationSound {
    constructor() {
        this.permission = 'default';
        this.checkPermission();
    }

    // Check current permission status
    checkPermission() {
        if ('Notification' in window) {
            this.permission = Notification.permission;
        }
        return this.permission;
    }

    // Request permission from user
    async requestPermission() {
        if (!('Notification' in window)) {
            console.log('This browser does not support notifications');
            return false;
        }

        if (this.permission === 'granted') {
            return true;
        }

        const permission = await Notification.requestPermission();
        this.permission = permission;
        return permission === 'granted';
    }

    // Show notification with system sound
    showNotification(title, options = {}) {
        if (this.permission !== 'granted') {
            console.log('Notification permission not granted');
            return;
        }

        // Default options
        const defaultOptions = {
            icon: '/logo192.png',
            badge: '/logo192.png',
            vibrate: [200, 100, 200],
            requireInteraction: false,
            ...options
        };

        try {
            const notification = new Notification(title, defaultOptions);

            // Handle click
            notification.onclick = () => {
                window.focus();
                if (options.onClick) {
                    options.onClick();
                }
                notification.close();
            };

            return notification;
        } catch (error) {
            console.error('Error showing notification:', error);
        }
    }

    // Show message notification (replaces playMessageSound)
    playMessageSound(senderName, message, onClick) {
        // Only show if tab is not focused
        if (document.hidden) {
            return this.showNotification(`رسالة جديدة من ${senderName}`, {
                body: message,
                tag: 'message',
                onClick
            });
        }
    }

    // Show notification sound (replaces playNotificationSound)
    playNotificationSound(title, message, onClick) {
        // Only show if tab is not focused
        if (document.hidden) {
            return this.showNotification(title, {
                body: message,
                tag: 'notification',
                onClick
            });
        }
    }

    // Show join request notification
    showJoinRequestNotification(userName, invitationTitle, onClick) {
        if (document.hidden) {
            return this.showNotification('طلب انضمام جديد', {
                body: `${userName} يريد الانضمام إلى "${invitationTitle}"`,
                tag: 'join-request',
                onClick
            });
        }
    }

    // Backward compatibility - keep setVolume but it does nothing
    setVolume(volume) {
        // System notifications don't have volume control
        console.log('System notifications volume is controlled by OS');
    }
}

// Create singleton instance
const notificationSound = new NotificationSound();

export default notificationSound;