import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { POST_BACKGROUND_GRADIENTS } from '../constants/postBackgroundGradients';
import { db } from '../firebase/config';
import { stripUndefinedDeep } from '../utils/firestoreSanitize';
import { publishGeoFirestoreFields, resolvePostPublishGeo } from '../utils/postPublishGeo';
import { syncPublishedFeaturedPostToCommunityFeed } from './featuredPostFeedPublish';
import { notifyBusinessPostPublished } from './businessPostNotifyService';

const GRADIENT_PRESETS = POST_BACKGROUND_GRADIENTS;

export { GRADIENT_PRESETS };

/** Normalize Firestore doc for feed + PostCard (always elite slide shape). */
export function normalizeFeaturedPostDoc(id, data) {
    const raw = data || {};
    const titleText = String(raw.title?.text ?? raw.title ?? raw.caption ?? '').trim();
    const descText = String(raw.description?.text ?? raw.description ?? '').trim();
    let background = raw.background;
    if (!background && (raw.backgroundUrl || raw.imageUrl || raw.mediaUrl)) {
        const url = raw.backgroundUrl || raw.imageUrl || raw.mediaUrl;
        background = { type: 'image', value: url };
    }
    if (!background) {
        background = { type: 'gradient', value: GRADIENT_PRESETS[0].value };
    }
    const partnerId = raw.partnerId || raw.authorId || null;
    return {
        id,
        ...raw,
        type: 'elite_slide',
        status: raw.status === 'draft' ? 'draft' : 'published',
        partnerId,
        authorId: partnerId,
        title: { text: titleText, ...(raw.title && typeof raw.title === 'object' ? raw.title : {}) },
        description:
            raw.description && typeof raw.description === 'object'
                ? { ...raw.description, ...(descText ? { text: descText } : {}) }
                : descText
                  ? { text: descText }
                  : null,
        background,
        _isFeatured: true,
        _isMotionPost: false,
    };
}

/**
 * Publish an elite featured slide to `featured_posts` (home feed collection).
 */
export async function publishFeaturedSlide({
    partnerId,
    businessName,
    businessLogoUrl,
    titleText,
    titleStyle = {},
    descriptionText,
    descriptionStyle = {},
    background,
    layout = 'center',
    animation = 'stagger',
}) {
    const title = String(titleText || '').trim();
    if (!title) throw new Error('featured_title_required');
    const desc = String(descriptionText || '').trim();

    let publishGeoFields = {};
    try {
        const userSnap = await getDoc(doc(db, 'users', partnerId));
        const publishGeo = await resolvePostPublishGeo(userSnap.exists() ? userSnap.data() : null);
        publishGeoFields = publishGeoFirestoreFields(publishGeo);
    } catch (err) {
        console.warn('[publishFeaturedSlide] publish geo resolve failed', err);
    }

    const payload = stripUndefinedDeep({
        partnerId,
        type: 'elite_slide',
        status: 'published',
        businessName: businessName || null,
        businessLogoUrl: businessLogoUrl || null,
        title: { text: title, ...titleStyle },
        description: desc ? { text: desc, ...descriptionStyle } : null,
        background: background || { type: 'gradient', value: GRADIENT_PRESETS[0].value },
        layout,
        animation,
        animationDuration: 0.5,
        likes: [],
        comments: [],
        reposts: [],
        createdAt: serverTimestamp(),
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...publishGeoFields,
    });

    const ref = await addDoc(collection(db, 'featured_posts'), payload);
    const featuredPostId = ref.id;

    let communityPostId = null;
    try {
        communityPostId = await syncPublishedFeaturedPostToCommunityFeed(featuredPostId, partnerId);
    } catch (err) {
        console.warn('[publishFeaturedSlide] community feed sync failed', err);
    }

    let notifyResult = null;
    try {
        notifyResult = await notifyBusinessPostPublished({
            featuredPostId,
            communityPostId,
            title,
            notifyMembers: true,
        });
    } catch (err) {
        console.warn('[publishFeaturedSlide] member notify failed', err);
    }

    return { featuredPostId, communityPostId, notifyResult };
}

/** Update an existing featured slide and refresh its community feed mirror. */
export async function updateFeaturedSlide({
    featuredPostId,
    partnerId,
    titleText,
    titleStyle = {},
    descriptionText,
    descriptionStyle = {},
    background,
    layout = 'center',
}) {
    const title = String(titleText || '').trim();
    if (!title) throw new Error('featured_title_required');
    const desc = String(descriptionText || '').trim();

    const payload = stripUndefinedDeep({
        title: { text: title, ...titleStyle },
        description: desc ? { text: desc, ...descriptionStyle } : null,
        background: background || { type: 'gradient', value: GRADIENT_PRESETS[0].value },
        layout,
        updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'featured_posts', featuredPostId), payload);
    const communityPostId = await syncPublishedFeaturedPostToCommunityFeed(
        featuredPostId,
        partnerId
    );
    return { featuredPostId, communityPostId };
}
