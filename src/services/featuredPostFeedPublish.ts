import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { normalizeFeaturedPostDoc } from './featuredPostService';
import { stripUndefinedDeep } from '../utils/firestoreSanitize';
import { publishGeoFromStoredDoc } from '../utils/postPublishGeo';

function businessAuthorFromUser(data: Record<string, unknown> | undefined, ownerId: string) {
    const bi = (data?.businessInfo as Record<string, unknown>) || {};
    const name =
        String(
            bi.businessName ||
                data?.display_name ||
                data?.name ||
                data?.displayName ||
                ''
        ).trim() || 'Business';
    const avatar =
        String(
            bi.logoUrl ||
                bi.logo ||
                data?.photo_url ||
                data?.photoURL ||
                data?.avatarUrl ||
                ''
        ).trim() || null;
    return { name, avatar };
}

function backgroundToMediaUrl(background: { type?: string; value?: string } | null | undefined) {
    if (!background || typeof background !== 'object') return null;
    if (background.type === 'image' && background.value) return String(background.value).trim() || null;
    return null;
}

/**
 * Mirror a published featured slide into `communityPosts` for the home feed and notifications.
 */
export async function syncPublishedFeaturedPostToCommunityFeed(
    featuredPostId: string,
    partnerId: string
) {
    const featuredRef = doc(db, 'featured_posts', featuredPostId);
    const featuredSnap = await getDoc(featuredRef);
    if (!featuredSnap.exists()) throw new Error('Featured post not found');
    const raw = featuredSnap.data() as Record<string, unknown>;
    const featured = normalizeFeaturedPostDoc(featuredSnap.id, raw);

    const userSnap = await getDoc(doc(db, 'users', partnerId));
    const author = businessAuthorFromUser(userSnap.data(), partnerId);
    const profile = userSnap.data() || {};

    const titleText = String(featured.title?.text ?? '').trim();
    const descText = String(featured.description?.text ?? '').trim();
    const contentText = [titleText, descText].filter(Boolean).join('\n\n') || titleText || descText;
    const mediaUrl = backgroundToMediaUrl(featured.background as { type?: string; value?: string });

    const feedPayload = stripUndefinedDeep({
        type: 'elite_slide',
        source: 'featured_post',
        featuredPostId,
        authorId: partnerId,
        partnerId,
        businessName: featured.businessName || author.name,
        businessLogoUrl: featured.businessLogoUrl || author.avatar,
        author: {
            id: partnerId,
            name: featured.businessName || author.name,
            avatar: featured.businessLogoUrl || author.avatar,
        },
        content: contentText,
        mediaUrl,
        mediaType: mediaUrl ? 'image' : null,
        status: 'published',
        ...publishGeoFromStoredDoc(raw),
        authorInterests: Array.isArray(profile.interests)
            ? profile.interests
            : Array.isArray(profile.hobbies)
              ? profile.hobbies
              : [],
        featuredPostSnapshot: {
            title: featured.title,
            description: featured.description,
            background: featured.background,
            layout: featured.layout,
            animation: featured.animation,
            businessName: featured.businessName,
            businessLogoUrl: featured.businessLogoUrl,
        },
        likes: [],
        comments: [],
        reposts: [],
        publishedAt: featured.publishedAt || serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    const existingQ = query(
        collection(db, 'communityPosts'),
        where('featuredPostId', '==', featuredPostId),
        limit(1)
    );
    const existing = await getDocs(existingQ);

    if (!existing.empty) {
        await updateDoc(existing.docs[0].ref, {
            ...feedPayload,
            createdAt: existing.docs[0].data().createdAt,
        });
        return existing.docs[0].id;
    }

    const feedRef = await addDoc(collection(db, 'communityPosts'), feedPayload);
    return feedRef.id;
}
