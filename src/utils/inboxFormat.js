/**
 * Relative time labels for discovery inbox rows.
 * @param {import('firebase/firestore').Timestamp | Date | null | undefined} timestamp
 * @param {(key: string, fallback?: string) => string} t
 */
export function formatInboxRelativeTime(timestamp, t) {
    if (!timestamp) return '';
    const date =
        timestamp?.toDate?.() instanceof Date
            ? timestamp.toDate()
            : timestamp instanceof Date
              ? timestamp
              : null;
    if (!date || Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const diffMs = now - date;

    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return t('yesterday', 'Yesterday');
    }

    if (diffMs < 604800000) {
        return date.toLocaleDateString(undefined, { weekday: 'short' });
    }

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const INBOX_ACTIVITY_TYPES = new Set(['follow', 'like', 'greeting']);

/** Activity tab — mutual likes only (no one-way "who liked you"). */
export function isInboxActivityNotification(n) {
    const type = String(n?.type || '');
    if (type === 'like') return n?.metadata?.mutual === true;
    return INBOX_ACTIVITY_TYPES.has(type);
}

export const INBOX_CHAT_PREVIEW_LIMIT = 5;
