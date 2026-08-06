import { db, auth, storage } from '../firebase/config';
import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    setDoc,
} from 'firebase/firestore';

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { publishPremiumOffer } from './adminSecurityService';

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
            return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
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
            const q = query(
                collection(db, 'active_offers'),
                where('partnerId', '==', partnerId)
            );
            const snapshot = await getDocs(q);

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
     * Credit spend + Firestore writes happen atomically in publishPremiumOffer.
     */
    createOffer: async (offerData, file) => {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Unauthorized");

        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userSnap.data() || {};
        const tier = (userData.subscriptionTier || 'free').toLowerCase();
        const isElite = tier === 'elite';
        const isProfessional = tier === 'professional';

        if (!isElite && !isProfessional) {
            throw new Error('Publishing premium offers requires an Elite or Professional Business subscription.');
        }
        if (!isElite && isProfessional) {
            const credits = (userData.offerCredits || 0) + (userData.offerSlotCredits || 0);
            if (credits <= 0) {
                throw new Error('No offer credits remaining. Please purchase more credits to publish an offer.');
            }
        }

        if (!isElite) {
            const validation = await premiumOfferService.checkOneSlotPolicy(currentUser.uid);
            if (!validation.allowed) {
                throw new Error(validation.reason);
            }
        }

        let finalMediaUrl = offerData.imageUrl || '';
        if (file) {
            const storageRef = ref(storage, `premium_offers/${currentUser.uid}_${Date.now()}`);
            await uploadBytes(storageRef, file);
            finalMediaUrl = await getDownloadURL(storageRef);
        }

        const { platform_commission, global_status, file: _ignoreFile, ...safeOfferData } = offerData;
        void platform_commission;
        void global_status;
        void _ignoreFile;

        try {
            const result = await publishPremiumOffer({
                title: safeOfferData.title || '',
                description: safeOfferData.description || '',
                imageUrl: finalMediaUrl,
                cta: safeOfferData.cta || '',
                discountLabel: safeOfferData.discountLabel || '',
                theme: safeOfferData.theme || '',
                badgeText: safeOfferData.badgeText || '',
            });
            return result.offerId;
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

        const { platform_commission, global_status, partnerId, file: _ignoreFile, ...safeUpdates } = updateData;
        void platform_commission;
        void global_status;
        void partnerId;
        void _ignoreFile;
        safeUpdates.updatedAt = serverTimestamp();

        try {
            await updateDoc(doc(db, 'offers', offerId), safeUpdates);
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
     */
    freezeOffer: async (offerId) => {
        try {
            await updateDoc(doc(db, 'offers', offerId), {
                status: 'inactive',
                updatedAt: serverTimestamp()
            });
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
            await setDoc(doc(db, 'active_offers', offerId), {
                ...offerData,
                partnerId,
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
     */
    deleteOffer: async (offerId) => {
        try {
            try {
                await deleteDoc(doc(db, 'active_offers', offerId));
            } catch (e) { }

            try {
                await deleteDoc(doc(db, 'special_offers', offerId));
            } catch (e) { }

            await deleteDoc(doc(db, 'offers', offerId));
        } catch (error) {
            console.error("Error permanently deleting offer:", error);
            throw error;
        }
    }
};
