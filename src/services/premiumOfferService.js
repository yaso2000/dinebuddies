import { db, auth, storage } from '../firebase/config';
import { collection, query, where, getDocs, addDoc, setDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * PremiumOfferService 
 * Handles the "One-Slot Policy" constraints and binds partnerId safely.
 */
export const premiumOfferService = {

    /**
     * Fetch all offers for a specific partner.
     */
    getPartnerOffers: async (partnerId) => {
        if (!partnerId) throw new Error("Unauthorized");

        try {
            const q = query(
                collection(db, 'offers'),
                where('partnerId', '==', partnerId)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching partner offers:", error);
            throw error;
        }
    },

    /**
     * Enforces the "One-Slot Policy". Checks if the partner already has
     * an active offer in the database.
     */
    checkOneSlotPolicy: async (partnerId) => {
        try {
            // First check the active_offers collection
            const q = query(
                collection(db, 'active_offers'),
                where('partnerId', '==', partnerId)
            );
            const snapshot = await getDocs(q);

            // If length is > 0, they already have an active offer slot used.
            if (!snapshot.empty) {
                return { allowed: false, reason: 'You already have an active Premium Offer in the carousel. Please Freeze or Delete it to publish a new one.' };
            }
            return { allowed: true };
        } catch (error) {
            console.error("Error checking one-slot policy:", error);
            throw new Error("Unable to validate slot availability.");
        }
    },

    /**
     * Create a new premium offer.
     * Automatically injects `partnerId` and `timestamp`.
     */
    createOffer: async (offerData, file) => {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Unauthorized");

        // 1. Validate One-Slot Policy
        const validation = await premiumOfferService.checkOneSlotPolicy(currentUser.uid);
        if (!validation.allowed) {
            throw new Error(validation.reason);
        }

        // Upload image
        let finalMediaUrl = offerData.imageUrl || '';
        if (file) {
            const storageRef = ref(storage, `premium_offers/${currentUser.uid}_${Date.now()}`);
            await uploadBytes(storageRef, file);
            finalMediaUrl = await getDownloadURL(storageRef);
        }

        // 2. Strip restricted fields and non-serializable objects (like 'file')
        const { platform_commission, global_status, file: _ignoreFile, ...safeOfferData } = offerData;

        // 3. Inject automatic fields
        const finalPayload = {
            ...safeOfferData,
            imageUrl: finalMediaUrl,
            partnerId: currentUser.uid, // Cannot be spoofed, Firebase rules verify this
            createdAt: serverTimestamp(),
            status: 'active'
        };

        // 4. Save to `offers` (master history) AND `active_offers` (carousel pool)
        try {
            const offerRef = await addDoc(collection(db, 'offers'), finalPayload);
            await setDoc(doc(db, 'active_offers', offerRef.id), finalPayload);
            return offerRef.id;
        } catch (error) {
            console.error("Error creating premium offer:", error);
            throw error;
        }
    },

    /**
     * Update existing offer
     */
    updateOffer: async (offerId, updateData, file) => {
        if (!offerId) throw new Error("Offer ID required");

        let finalMediaUrl = updateData.imageUrl || '';
        if (file) {
            const currentUser = auth.currentUser;
            const storageRef = ref(storage, `premium_offers/${currentUser.uid}_${Date.now()}`);
            await uploadBytes(storageRef, file);
            finalMediaUrl = await getDownloadURL(storageRef);
            updateData.imageUrl = finalMediaUrl;
        }

        // Strip restricted fields and non-serializable objects (like 'file')
        const { platform_commission, global_status, partnerId, file: _ignoreFile, ...safeUpdates } = updateData;
        safeUpdates.updatedAt = serverTimestamp();

        try {
            await updateDoc(doc(db, 'offers', offerId), safeUpdates);
            // Sync to active_offers if it exists there
            try {
                await updateDoc(doc(db, 'active_offers', offerId), safeUpdates);
            } catch (ignore) { /* Document might not be active, which is fine */ }
        } catch (error) {
            console.error("Error updating offer:", error);
            throw error;
        }
    },

    /**
     * Freeze (Pause) Offer
     * Changes status to inactive and removes it from `active_offers` public carousel.
     */
    freezeOffer: async (offerId) => {
        try {
            // Update status in master history
            await updateDoc(doc(db, 'offers', offerId), {
                status: 'inactive',
                updatedAt: serverTimestamp()
            });
            // Remove from public carousel pool
            await deleteDoc(doc(db, 'active_offers', offerId));
        } catch (error) {
            console.error("Error freezing offer:", error);
            throw error;
        }
    },

    /**
     * Re-publish Offer
     */
    republishOffer: async (offerId, partnerId, offerData) => {
        const validation = await premiumOfferService.checkOneSlotPolicy(partnerId);
        if (!validation.allowed) {
            throw new Error(validation.reason);
        }

        try {
            await updateDoc(doc(db, 'offers', offerId), {
                status: 'active',
                updatedAt: serverTimestamp()
            });
            // Re-add to active carousel
            await setDoc(doc(db, 'active_offers', offerId), {
                ...offerData,
                status: 'active',
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error republishing offer:", error);
            throw error;
        }
    },

    /**
     * Delete Offer entirely
     * Performs a hard delete across all possible collections: active_offers, offers, and special_offers
     */
    deleteOffer: async (offerId) => {
        try {
            // Remove from active_offers
            try {
                await deleteDoc(doc(db, 'active_offers', offerId));
            } catch (e) { }

            // Remove from special_offers
            try {
                await deleteDoc(doc(db, 'special_offers', offerId));
            } catch (e) { }

            // Hard delete from the main offers table
            await deleteDoc(doc(db, 'offers', offerId));
        } catch (error) {
            console.error("Error permanently deleting offer:", error);
            throw error;
        }
    }
};
