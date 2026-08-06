import { auth, db, storage } from '../firebase/config';
import { collection, doc, getDoc, updateDoc, deleteDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { publishSpecialOffer } from './adminSecurityService';

/**
 * Publishes or updates a special offer.
 * New creates go through publishSpecialOffer (atomic credit spend + ownership bind).
 *
 * @param {string} restaurantId - The ID of the restaurant/business.
 * @param {object} offerData - Data from the OfferEditor.
 * @param {File} file - Optional new media file.
 * @param {string} offerId - Optional existing offer ID for updates.
 */
export const publishOffer = async (restaurantId, offerData, file, offerId = null) => {
    try {
        console.log("🚀 Starting offer publication for restaurant:", restaurantId);

        const restaurantRef = doc(db, "users", restaurantId);
        const restaurantSnap = await getDoc(restaurantRef);

        if (!restaurantSnap.exists()) {
            throw new Error("Restaurant account not found.");
        }

        const data = restaurantSnap.data();
        if (data.role !== 'business' && data.role !== 'partner') {
            throw new Error("Target account is not a business account.");
        }

        const currentUid = auth.currentUser?.uid;
        if (!currentUid || currentUid !== restaurantId) {
            throw new Error("Unauthorized: can only publish offers for your own business.");
        }

        const isElite = data.subscriptionTier === 'elite';
        const hasEnoughCredits = ((data.offerCredits || 0) + (data.offerSlotCredits || 0) > 0) || isElite;

        if (!offerId && !hasEnoughCredits) {
            throw new Error("Insufficient offer credits. Please top up your balance.");
        }

        let mediaUrl = "";
        if (file) {
            console.log("📤 Uploading media to storage...");
            const storageRef = ref(storage, `offers/${currentUid}_${Date.now()}`);
            await uploadBytes(storageRef, file);
            mediaUrl = await getDownloadURL(storageRef);
            console.log("✅ Media uploaded:", mediaUrl);
        } else if (offerData.mediaUrl) {
            mediaUrl = offerData.mediaUrl;
        }

        if (offerId) {
            const finalOffer = {
                content: {
                    title: offerData.title,
                    description: offerData.description,
                    mediaUrl: mediaUrl,
                    mediaType: file && file.type.startsWith('video') ? 'video' : 'image'
                },
                logic: {
                    expirationType: offerData.expirationType,
                    expiryDate: offerData.expirationType === 'fixed' ? new Date(offerData.endDate) : null,
                    isPerpetual: offerData.expirationType === 'perpetual'
                },
                visual: offerData.visual || { theme: 'midnight', isGlass: true, hasShimmer: false },
                visibility: {
                    isPinned: offerData.status === 'active' || offerData.visibility?.isPinned || true,
                    status: offerData.status || 'active',
                    identityType: offerData.identityType || 'logo',
                    badgeId: offerData.badgeId || null,
                    priorityScore: isElite ? 100 : 50,
                    location: data.businessInfo?.location || data.location
                },
                status: offerData.status || 'active',
                updatedAt: serverTimestamp()
            };
            const offerRef = doc(db, "special_offers", offerId);
            await updateDoc(offerRef, finalOffer);
            console.log("✅ Offer updated successfully");
            return { success: true, id: offerId };
        }

        const result = await publishSpecialOffer({
            title: offerData.title,
            description: offerData.description,
            mediaUrl,
            mediaType: file && file.type.startsWith('video') ? 'video' : 'image',
            expirationType: offerData.expirationType,
            endDate: offerData.endDate || null,
            status: offerData.status || 'active',
            identityType: offerData.identityType || 'logo',
            badgeId: offerData.badgeId || null,
            visual: offerData.visual || { theme: 'midnight', isGlass: true, hasShimmer: false },
        });
        return { success: true, id: result.offerId };
    } catch (error) {
        console.error("❌ Error publishing offer:", error);
        return { success: false, message: error.message };
    }
};

export const fetchRestaurantOffers = async (restaurantId) => {
    try {
        const q = query(
            collection(db, "special_offers"),
            where("restaurantId", "==", restaurantId)
        );
        const snapshot = await getDocs(q);
        const offers = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

        return offers.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    } catch (error) {
        console.error("❌ Error fetching restaurant offers:", error);
        throw error;
    }
};

/**
 * Updates the status of an existing offer.
 * @param {string} offerId 
 * @param {string} status - 'active', 'draft', 'frozen'
 */
export const updateOfferStatus = async (offerId, status) => {
    try {
        const offerRef = doc(db, "special_offers", offerId);
        await updateDoc(offerRef, {
            status,
            "visibility.status": status,
            "visibility.isPinned": status === 'active',
            updatedAt: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error("❌ Error updating offer status:", error);
        return { success: false, message: error.message };
    }
};

/**
 * Deletes an offer permanently.
 */
export const deleteOffer = async (offerId) => {
    try {
        const offerRef = doc(db, "special_offers", offerId);
        await deleteDoc(offerRef);
        return { success: true };
    } catch (error) {
        console.error("❌ Error deleting offer:", error);
        return { success: false, message: error.message };
    }
};
