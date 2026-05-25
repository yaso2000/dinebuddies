import app from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * Notify followers (and paid-plan community members) about a new business post.
 * @returns {Promise<{ success?: boolean, sent?: number, includeMembers?: boolean, skipped?: boolean, reason?: string }|null>}
 */
export async function notifyBusinessPostPublished({
    featuredPostId = null,
    motionPostId = null,
    communityPostId = null,
    title = '',
    notifyMembers = true,
} = {}) {
    if (!featuredPostId && !motionPostId) return null;

    try {
        const fn = httpsCallable(getFunctions(app, 'us-central1'), 'notifyBusinessPostPublished');
        const result = await fn({
            featuredPostId: featuredPostId || null,
            motionPostId: motionPostId || null,
            communityPostId: communityPostId || null,
            title: String(title || '').slice(0, 200),
            notifyMembers: notifyMembers !== false,
        });
        return result?.data || null;
    } catch (err) {
        console.error('[notifyBusinessPostPublished]', err?.code || err?.message || err);
        throw err;
    }
}
