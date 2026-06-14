import { db, auth, storage } from '../firebase/config';
import { collection, query, where, getDocs, addDoc, setDoc, updateDoc, deleteDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { uploadManagedImage } from './managedImageUpload';
import { ImageUploadZone } from './imageUploadZones';
import { getBusinessSubscriptionAccess } from '../utils/businessSubscription';

/**
 * PremiumOfferService
 * Paid Business accounts only. One active carousel slot at a time.
 */
export const premiumOfferService = {

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

    createOffer: async (offerData, file) => {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Unauthorized");

        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userSnap.data() || {};
        const { isPaid } = getBusinessSubscriptionAccess(userData.subscriptionTier);

        if (!isPaid) {
            throw new Error('Publishing premium offers requires a Paid Business subscription.');
        }

        const validation = await premiumOfferService.checkOneSlotPolicy(currentUser.uid);
        if (!validation.allowed) {
            throw new Error(validation.reason);
        }

        let finalMediaUrl = offerData.imageUrl || '';
        if (file) {
            if (file.type?.startsWith('image/')) {
                finalMediaUrl = await uploadManagedImage(file, currentUser.uid, ImageUploadZone.PREMIUM_OFFER);
            } else {
                const storageRef = ref(storage, `premium_offers/${currentUser.uid}_${Date.now()}`);
                await uploadBytes(storageRef, file);
                finalMediaUrl = await getDownloadURL(storageRef);
            }
        }

        const { platform_commission, global_status, file: _ignoreFile, ...safeOfferData } = offerData;

        const finalPayload = {
            ...safeOfferData,
            imageUrl: finalMediaUrl,
            partnerId: currentUser.uid,
            createdAt: serverTimestamp(),
            status: 'active',
            tier: 'paid',
            perpetual: true,
            expiresAt: null,
        };

        try {
            const offerRef = await addDoc(collection(db, 'offers'), finalPayload);
            await setDoc(doc(db, 'active_offers', offerRef.id), finalPayload);
            return offerRef.id;
        } catch (error) {
            console.error("Error creating premium offer:", error);
            throw error;
        }
    },

    updateOffer: async (offerId, updateData, file) => {
        if (!offerId) throw new Error("Offer ID required");

        let finalMediaUrl = updateData.imageUrl || '';
        if (file) {
            const currentUser = auth.currentUser;
            if (file.type?.startsWith('image/')) {
                finalMediaUrl = await uploadManagedImage(file, currentUser.uid, ImageUploadZone.PREMIUM_OFFER);
            } else {
                const storageRef = ref(storage, `premium_offers/${currentUser.uid}_${Date.now()}`);
                await uploadBytes(storageRef, file);
                finalMediaUrl = await getDownloadURL(storageRef);
            }
            updateData.imageUrl = finalMediaUrl;
        }

        const { platform_commission, global_status, partnerId, file: _ignoreFile, ...safeUpdates } = updateData;
        safeUpdates.updatedAt = serverTimestamp();

        try {
            await updateDoc(doc(db, 'offers', offerId), safeUpdates);
            try {
                await updateDoc(doc(db, 'active_offers', offerId), safeUpdates);
            } catch (ignore) { /* not active */ }
        } catch (error) {
            console.error("Error updating offer:", error);
            throw error;
        }
    },

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
                status: 'active',
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error republishing offer:", error);
            throw error;
        }
    },

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
