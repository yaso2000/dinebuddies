// Community Management Functions
import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Join a partner's community
 */
export const joinCommunity = async (userId, partnerId) => {
    try {
        const userRef = doc(db, 'users', userId);
        const partnerRef = doc(db, 'users', partnerId);

        // Add partner to user's joined communities
        await updateDoc(userRef, {
            joinedCommunities: arrayUnion(partnerId),
            updatedAt: serverTimestamp()
        });

        // Add user to partner's community members
        await updateDoc(partnerRef, {
            'communityMembers': arrayUnion(userId),
            updatedAt: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Error joining community:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Leave a partner's community
 */
export const leaveCommunity = async (userId, partnerId) => {
    try {
        const userRef = doc(db, 'users', userId);
        const partnerRef = doc(db, 'users', partnerId);

        // Remove partner from user's joined communities
        await updateDoc(userRef, {
            joinedCommunities: arrayRemove(partnerId),
            updatedAt: serverTimestamp()
        });

        // Remove user from partner's community members
        await updateDoc(partnerRef, {
            'communityMembers': arrayRemove(userId),
            updatedAt: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Error leaving community:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Check if user is a member of a community
 */
export const isCommunityMember = async (userId, partnerId) => {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const joinedCommunities = userSnap.data().joinedCommunities || [];
            return joinedCommunities.includes(partnerId);
        }

        return false;
    } catch (error) {
        console.error('Error checking community membership:', error);
        return false;
    }
};

/**
 * Get community member count
 */
export const getCommunityMemberCount = async (partnerId) => {
    try {
        const partnerRef = doc(db, 'users', partnerId);
        const partnerSnap = await getDoc(partnerRef);

        if (partnerSnap.exists()) {
            const communityMembers = partnerSnap.data().communityMembers || [];
            return communityMembers.length;
        }

        return 0;
    } catch (error) {
        console.error('Error getting member count:', error);
        return 0;
    }
};
