import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../../firebase/config';
import { db } from '../../firebase/config';

const FUNCTIONS_REGION = 'us-central1';
import { MOTION_TEMPLATE_REGISTRY, type MotionPostType, type MotionTemplateId } from './templates/registry';

type SaveDraftInput = {
    ownerId: string;
    businessId: string;
    subscriptionTier: string;
    payload: {
        type: MotionPostType;
        format: 'square';
        templateId: MotionTemplateId;
        content: {
            title: string;
            subtitle?: string;
            description?: string;
            cta?: string;
            badgeText?: string;
            dateText?: string;
            timeText?: string;
            locationText?: string;
            imageUrl?: string;
        };
        style: {
            animation: 'fade' | 'slide' | 'pop' | 'stagger';
            themeId: 'midnight' | 'sunset' | 'emerald' | 'violet' | 'mono' | 'rose';
            durationMs: number;
        };
    };
    ui?: {
        postSize?: 'landscape' | 'square' | 'vertical';
        aspectRatio?: '16:9' | '1:1' | '9:16';
        /** Normal-post layout placeholder id (Classic Split, etc.). */
        postTemplateId?: string;
        aiDesign?: {
            textPlacement?: string;
            overlayStrength?: number;
            imageFocus?: string;
            styleMood?: string;
            themeSuggestion?: string;
            animationSuggestion?: string;
            formatSuggestion?: string;
        } | null;
        finalImage?: {
            source: 'aiDesign' | 'previewFallback';
            imageUrl: string;
        } | null;
    };
};

const toCategory = (type: MotionPostType) => {
    if (type === 'event_post') return 'event';
    if (type === 'normal_post') return 'normal';
    return 'offer';
};

export async function createMotionPostDraft(input: SaveDraftInput) {
    const def = MOTION_TEMPLATE_REGISTRY[input.payload.templateId];
    const docRef = await addDoc(collection(db, 'business_motion_posts'), {
        businessId: input.businessId,
        ownerId: input.ownerId,
        type: input.payload.type,
        templateId: input.payload.templateId,
        templateVersion: def?.version || 1,
        category: toCategory(input.payload.type),
        format: 'square',
        content: {
            title: input.payload.content.title,
            subtitle: input.payload.content.subtitle || '',
            description: input.payload.content.description || '',
            cta: input.payload.content.cta || '',
            badgeText: input.payload.content.badgeText || '',
            dateText: input.payload.content.dateText || '',
            timeText: input.payload.content.timeText || '',
            locationText: input.payload.content.locationText || '',
        },
        media: {
            imageUrl: input.payload.content.imageUrl || '',
        },
        style: input.payload.style,
        ui: {
            postSize: input.ui?.postSize || 'square',
            aspectRatio: input.ui?.aspectRatio || '1:1',
            postTemplateId: input.ui?.postTemplateId || '',
            aiDesign: input.ui?.aiDesign || null,
            finalImage: input.ui?.finalImage || null,
        },
        status: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        subscriptionTierAtCreation: String(input.subscriptionTier || 'free').toLowerCase(),
    });
    return docRef.id;
}

export async function updateMotionPostDraft(postId: string, input: SaveDraftInput) {
    const ref = doc(db, 'business_motion_posts', postId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Draft not found');
    const data = snap.data();
    if (data.ownerId !== input.ownerId || data.businessId !== input.businessId) {
        throw new Error('Unauthorized update for this draft');
    }
    if (data.status === 'archived') {
        throw new Error('Cannot update an archived post');
    }

    const def = MOTION_TEMPLATE_REGISTRY[input.payload.templateId];
    await updateDoc(ref, {
        type: input.payload.type,
        templateId: input.payload.templateId,
        templateVersion: def?.version || 1,
        category: toCategory(input.payload.type),
        format: 'square',
        content: {
            title: input.payload.content.title,
            subtitle: input.payload.content.subtitle || '',
            description: input.payload.content.description || '',
            cta: input.payload.content.cta || '',
            badgeText: input.payload.content.badgeText || '',
            dateText: input.payload.content.dateText || '',
            timeText: input.payload.content.timeText || '',
            locationText: input.payload.content.locationText || '',
        },
        media: {
            imageUrl: input.payload.content.imageUrl || '',
        },
        style: input.payload.style,
        ui: {
            postSize: input.ui?.postSize || 'square',
            aspectRatio: input.ui?.aspectRatio || '1:1',
            postTemplateId: input.ui?.postTemplateId || '',
            aiDesign: input.ui?.aiDesign || null,
            finalImage: input.ui?.finalImage || null,
        },
        updatedAt: serverTimestamp(),
    });
}

export async function archiveMotionPost(postId: string, ownerId: string, businessId: string) {
    const ref = doc(db, 'business_motion_posts', postId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Draft not found');
    const data = snap.data();
    if (data.ownerId !== ownerId || data.businessId !== businessId) {
        throw new Error('Unauthorized archive for this draft');
    }
    if (data.status === 'archived') {
        throw new Error('Post is already archived');
    }

    await updateDoc(ref, {
        status: 'archived',
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
}

export async function publishMotionPost(postId: string, ownerId: string, businessId: string) {
    const ref = doc(db, 'business_motion_posts', postId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Post not found');
    const data = snap.data();
    if (data.ownerId !== ownerId || data.businessId !== businessId) {
        throw new Error('Unauthorized publish for this post');
    }
    const status = data.status;
    if (status === 'archived') {
        throw new Error('Archived posts cannot be published');
    }

    const functions = getFunctions(app, FUNCTIONS_REGION);
    const publishFn = httpsCallable(functions, 'publishBusinessMotionPost');
    await publishFn({ postId });
}

export async function unpublishMotionPost(postId: string, ownerId: string, businessId: string) {
    const ref = doc(db, 'business_motion_posts', postId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Post not found');
    const data = snap.data();
    if (data.ownerId !== ownerId || data.businessId !== businessId) {
        throw new Error('Unauthorized unpublish for this post');
    }
    if (data.status !== 'published') {
        throw new Error('Only published posts can be unpublished');
    }

    await updateDoc(ref, {
        status: 'draft',
        updatedAt: serverTimestamp(),
    });
}

export async function listMotionPostsForBusiness(ownerId: string, businessId: string) {
    const q = query(
        collection(db, 'business_motion_posts'),
        where('ownerId', '==', ownerId),
        where('businessId', '==', businessId)
    );
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return rows.sort((a: any, b: any) => {
        const aMs = a?.updatedAt?.toMillis?.() || a?.createdAt?.toMillis?.() || 0;
        const bMs = b?.updatedAt?.toMillis?.() || b?.createdAt?.toMillis?.() || 0;
        return bMs - aMs;
    });
}

