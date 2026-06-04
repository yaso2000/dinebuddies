import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getAiDesignUseDestination } from '../constants/aiDesignStudioUseDestinations';
import { ImageUploadZone } from './imageUploadZones';
import { uploadManagedImage } from './managedImageUpload';
import { ensurePublicImageUrl, fetchRemoteImageBlob } from './mediaService';
import { buildAiStudioImagePayload } from '../utils/aiStudioImagePayload';

/**
 * @param {string} url
 * @returns {Promise<File>}
 */
async function remoteUrlToImageFile(url) {
    const blob = await fetchRemoteImageBlob(url);
    const ext = (blob.type || '').includes('png') ? 'png' : 'jpg';
    return new File([blob], `studio_${Date.now()}.${ext}`, {
        type: blob.type || 'image/jpeg',
    });
}

/**
 * Copy studio image into a permanent public Storage folder (moderated when applicable).
 * @param {string} sourceUrl
 * @param {string} userId
 * @param {string} folder
 * @param {string} [zone]
 */
export async function persistStudioImageForUse(sourceUrl, userId, folder, zone) {
    if (zone === ImageUploadZone.AVATAR || zone === ImageUploadZone.COVER || zone === ImageUploadZone.LOGO) {
        const file = await remoteUrlToImageFile(sourceUrl);
        return uploadManagedImage(file, userId, zone);
    }
    const published = await ensurePublicImageUrl(sourceUrl, userId, folder);
    if (!published) {
        throw new Error('persist_failed');
    }
    return published;
}

/**
 * @param {{
 *   destinationId: string,
 *   imageUrl: string,
 *   userId: string,
 *   updateUserProfile?: (updates: Record<string, unknown>) => Promise<void>,
 *   navigate?: (path: string, opts?: { state?: unknown }) => void,
 * }} params
 */
export async function applyStudioImageUse({
    destinationId,
    imageUrl,
    userId,
    updateUserProfile,
    navigate,
}) {
    const dest = getAiDesignUseDestination(destinationId);
    if (!dest || !userId || !imageUrl) {
        throw new Error('invalid_destination');
    }

    let zone;
    if (dest.updateKey === 'profile_avatar') zone = ImageUploadZone.AVATAR;
    else if (dest.updateKey === 'profile_cover' || dest.updateKey === 'business_cover') {
        zone = ImageUploadZone.COVER;
    } else if (dest.updateKey === 'business_logo') zone = ImageUploadZone.LOGO;

    const publishedUrl = await persistStudioImageForUse(imageUrl, userId, dest.folder, zone);
    const payload = buildAiStudioImagePayload(publishedUrl);

    if (dest.kind === 'navigate') {
        if (!navigate || !dest.route) {
            throw new Error('navigate_unavailable');
        }
        const navState = { aiStudioImage: payload };
        if (dest.scrollToComposer) {
            navState.scrollToComposer = true;
        }
        navigate(dest.route, { state: navState });
        return { action: 'navigate', route: dest.route, publishedUrl };
    }

    switch (dest.updateKey) {
        case 'profile_avatar':
            if (!updateUserProfile) throw new Error('profile_update_unavailable');
            await updateUserProfile({ photo_url: publishedUrl, avatar: publishedUrl });
            break;
        case 'profile_cover':
            if (!updateUserProfile) throw new Error('profile_update_unavailable');
            await updateUserProfile({ cover_photo: publishedUrl });
            break;
        case 'business_cover': {
            const userSnap = await getDoc(doc(db, 'users', userId));
            const businessInfo = userSnap.data()?.businessInfo || {};
            const merged = { ...businessInfo, coverImage: publishedUrl };
            await updateDoc(doc(db, 'users', userId), { businessInfo: merged });
            if (updateUserProfile) {
                await updateUserProfile({ businessInfo: merged });
            }
            break;
        }
        case 'business_logo':
            await updateDoc(doc(db, 'users', userId), { photo_url: publishedUrl });
            if (updateUserProfile) {
                await updateUserProfile({ photo_url: publishedUrl, avatar: publishedUrl });
            }
            break;
        default:
            throw new Error('unsupported_direct_update');
    }

    return { action: 'applied', publishedUrl, updateKey: dest.updateKey };
}
