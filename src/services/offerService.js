import { db, storage } from '../firebase/config';
import { collection, doc, getDoc, addDoc, updateDoc, deleteDoc, increment, serverTimestamp, query, where, getDocs, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Publishes or updates a special offer.
 * 
 * @param {string} restaurantId - The ID of the restaurant/business.
 * @param {object} offerData - Data from the OfferEditor.
 * @param {File} file - Optional new media file.
 * @param {string} offerId - Optional existing offer ID for updates.
 */
export const publishOffer = async (restaurantId, offerData, file, offerId = null) => {
    try {
        console.log("🚀 Starting offer publication for restaurant:", restaurantId);

        // 1. Validate restaurant existence and credits
        const restaurantRef = doc(db, "users", restaurantId);
        const restaurantSnap = await getDoc(restaurantRef);

        if (!restaurantSnap.exists()) {
            throw new Error("Restaurant account not found.");
        }

        const data = restaurantSnap.data();
        if (data.role !== 'business') {
            throw new Error("Target account is not a business account.");
        }

        // Check for elite plan or available credits
        const isElite = data.subscriptionTier === 'elite' || data.subscriptionTier === 'premium' || data.plan === 'Elite';
        const hasEnoughCredits = (data.offerCredits > 0) || isElite;

        if (!offerId && !hasEnoughCredits) {
            throw new Error("Insufficient offer credits. Please top up your balance.");
        }

        // 2. Upload Media (image/video)
        let mediaUrl = "";
        if (file) {
            console.log("📤 Uploading media to storage...");
            const storageRef = ref(storage, `offers/${restaurantId}_${Date.now()}`);
            await uploadBytes(storageRef, file);
            mediaUrl = await getDownloadURL(storageRef);
            console.log("✅ Media uploaded:", mediaUrl);
        } else if (offerData.mediaUrl) {
            mediaUrl = offerData.mediaUrl;
        }

        // 3. Build final offer object
        const finalOffer = {
            restaurantId,
            business: {
                name: data.display_name || data.businessInfo?.businessName || "Restaurant",
                logo: data.photo_url || data.businessInfo?.logoImage || ""
            },
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
                status: offerData.status || 'active', // active, draft, frozen
                identityType: offerData.identityType || 'logo',
                badgeId: offerData.badgeId || null,
                priorityScore: isElite ? 100 : 50,
                location: data.businessInfo?.location || data.location
            },
            stats: offerData.stats || { impressions: 0, invitationsCreated: 0 },
            updatedAt: serverTimestamp()
        };

        if (!offerId) {
            finalOffer.createdAt = serverTimestamp();
        }

        console.log("💾 Saving offer to Firestore...");

        // 4. Update or Add offer
        if (offerId) {
            const offerRef = doc(db, "special_offers", offerId);
            await updateDoc(offerRef, finalOffer);
            console.log("✅ Offer updated successfully");
            return { success: true, id: offerId };
        } else {
            const offerDoc = await addDoc(collection(db, "special_offers"), finalOffer);
            if (!isElite) {
                await updateDoc(restaurantRef, {
                    offerCredits: increment(-1)
                });
            }
            return { success: true, id: offerDoc.id };
        }
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
        const offers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sort in memory to avoid index requirements
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
