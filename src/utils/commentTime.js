/** Short relative time for comments (Facebook-style: 9h, 2d). */
export function formatCommentTime(timestamp, t) {
    if (!timestamp) return '';
    const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    if (Number.isNaN(diff)) return '';

    if (diff < 60000) return t('Just now', 'Just now');
    if (diff < 3600000) return `${Math.floor(diff / 60000)}${t('time_m', 'm')}`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}${t('time_h', 'h')}`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}${t('time_d', 'd')}`;

    try {
        const loc = localStorage.getItem('app_language') === 'ar' ? 'ar-EG' : 'en-US';
        return date.toLocaleDateString(loc, { month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
}
