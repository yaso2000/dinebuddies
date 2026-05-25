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
import { db } from '../../firebase/config';
import { stripUndefinedDeep } from '../../utils/firestoreSanitize';

function businessAuthorFromUser(data: Record<string, unknown> | undefined, ownerId: string) {
    const bi = (data?.businessInfo as Record<string, unknown>) || {};
    const name =
        String(bi.businessName || data?.display_name || data?.name || data?.displayName || '').trim() ||
        'Business';
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

/**
 * Mirror a published motion post into `communityPosts` so `/posts-feed` can show it.
 */
export async function syncPublishedMotionPostToCommunityFeed(
    motionPostId: string,
    ownerId: string,
    businessId: string
) {
    const motionRef = doc(db, 'business_motion_posts', motionPostId);
    const motionSnap = await getDoc(motionRef);
    if (!motionSnap.exists()) throw new Error('Motion post not found');
    const motion = motionSnap.data() as Record<string, unknown>;

    const userSnap = await getDoc(doc(db, 'users', ownerId));
    const author = businessAuthorFromUser(userSnap.data(), ownerId);
    const profile = userSnap.data() || {};

    const title = String((motion.content as Record<string, unknown>)?.title || '').trim();
    const description = String((motion.content as Record<string, unknown>)?.description || '').trim();
    const imageUrl = String((motion.media as Record<string, unknown>)?.imageUrl || '').trim();
    const contentText = [title, description].filter(Boolean).join('\n\n') || title || description;

    const feedPayload = stripUndefinedDeep({
        type: 'motion_post',
        source: 'smart_post_studio',
        motionPostId,
        authorId: ownerId,
        businessId,
        author: {
            id: ownerId,
            name: author.name,
            avatar: author.avatar,
        },
        content: contentText,
        mediaUrl: imageUrl,
        mediaType: imageUrl ? 'image' : null,
        status: 'published',
        authorInterests: Array.isArray(profile.interests)
            ? profile.interests
            : Array.isArray(profile.hobbies)
              ? profile.hobbies
              : [],
        motionPostSnapshot: {
            type: motion.type,
            templateId: motion.templateId,
            templateVersion: motion.templateVersion,
            category: motion.category,
            format: motion.format,
            content: motion.content,
            media: motion.media,
            style: motion.style,
            ui: motion.ui,
            studioEditor: motion.studioEditor ?? null,
            businessId: motion.businessId,
            ownerId: motion.ownerId,
        },
        likes: [],
        comments: [],
        reposts: [],
        publishedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    const existingQ = query(
        collection(db, 'communityPosts'),
        where('motionPostId', '==', motionPostId),
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
