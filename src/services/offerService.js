import { auth, db, storage } from '../firebase/config';
import { collection, doc, getDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { uploadManagedImage } from './managedImageUpload';
import { ImageUploadZone } from './imageUploadZones';
import { normalizeBusinessTier } from '../utils/businessSubscription';

/**
 * Publishes or updates a special offer (Paid Business only).
 */
export const publishOffer = async (restaurantId, offerData, file, offerId = null) => {
    try {
        const restaurantRef = doc(db, 'users', restaurantId);
        const restaurantSnap = await getDoc(restaurantRef);

        if (!restaurantSnap.exists()) {
            throw new Error('Restaurant account not found.');
        }

        const data = restaurantSnap.data();
        if (data.role !== 'business') {
            throw new Error('Target account is not a business account.');
        }

        const isPaid = normalizeBusinessTier(data.subscriptionTier) === 'paid';

        if (!offerId && !isPaid) {
            throw new Error('Premium offers require a Paid Business subscription.');
        }

        let mediaUrl = '';
        if (file) {
            const currentUid = auth.currentUser?.uid;
            if (!currentUid || currentUid !== restaurantId) {
                throw new Error('Unauthorized media upload path for this offer.');
            }
            if (file.type.startsWith('image/')) {
                mediaUrl = await uploadManagedImage(file, currentUid, ImageUploadZone.OFFER);
            } else {
                const storageRef = ref(storage, `offers/${currentUid}_${Date.now()}`);
                await uploadBytes(storageRef, file);
                mediaUrl = await getDownloadURL(storageRef);
            }
        } else if (offerData.mediaUrl) {
            mediaUrl = offerData.mediaUrl;
        }

        const finalOffer = {
            restaurantId,
            business: {
                name: data.display_name || data.businessInfo?.businessName || 'Restaurant',
                logo: data.photo_url || data.businessInfo?.logoImage || '',
            },
            content: {
                title: offerData.title,
                description: offerData.description,
                mediaUrl,
                mediaType: file && file.type.startsWith('video') ? 'video' : 'image',
            },
            logic: {
                expirationType: offerData.expirationType,
                expiryDate: offerData.expirationType === 'fixed' ? new Date(offerData.endDate) : null,
                isPerpetual: offerData.expirationType === 'perpetual',
            },
            visual: offerData.visual || { theme: 'midnight', isGlass: true, hasShimmer: false },
            visibility: {
                isPinned: offerData.status === 'active' || offerData.visibility?.isPinned || true,
                status: offerData.status || 'active',
                identityType: offerData.identityType || 'logo',
                badgeId: offerData.badgeId || null,
                priorityScore: isPaid ? 100 : 50,
                location: data.businessInfo?.location || data.location,
            },
            stats: offerData.stats || { impressions: 0, invitationsCreated: 0 },
            updatedAt: serverTimestamp(),
        };

        if (!offerId) {
            finalOffer.createdAt = serverTimestamp();
        }

        if (offerId) {
            const offerRef = doc(db, 'special_offers', offerId);
            await updateDoc(offerRef, finalOffer);
            return { success: true, id: offerId };
        }

        const offerDoc = await addDoc(collection(db, 'special_offers'), finalOffer);
        return { success: true, id: offerDoc.id };
    } catch (error) {
        console.error('Error publishing offer:', error);
        return { success: false, message: error.message };
    }
};

export const fetchRestaurantOffers = async (restaurantId) => {
    try {
        const q = query(collection(db, 'special_offers'), where('restaurantId', '==', restaurantId));
        const snapshot = await getDocs(q);
        const offers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        return offers.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    } catch (error) {
        console.error('Error fetching restaurant offers:', error);
        throw error;
    }
};

export const updateOfferStatus = async (offerId, status) => {
    try {
        const offerRef = doc(db, 'special_offers', offerId);
        await updateDoc(offerRef, {
            'visibility.status': status,
            'visibility.isPinned': status === 'active',
            updatedAt: serverTimestamp(),
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating offer status:', error);
        return { success: false, message: error.message };
    }
};

export const deleteOffer = async (offerId) => {
    try {
        await deleteDoc(doc(db, 'special_offers', offerId));
        return { success: true };
    } catch (error) {
        console.error('Error deleting offer:', error);
        return { success: false, message: error.message };
    }
};
