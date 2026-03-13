import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db } from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
    collection,
    query,
    onSnapshot,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp,
    getDocs,
    getDoc,
    where,
    orderBy,
    limit,
    startAfter,
    arrayUnion,
    arrayRemove,
    increment,
    setDoc,
    writeBatch
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { v4 as uuidv4 } from 'uuid';
import notificationSound from '../utils/notificationSound';
import { followUser, unfollowUser } from '../utils/followHelpers';
import { convertFromUSD, getCurrencyByCountry } from '../utils/currencyConverter';
import { BASE_SUBSCRIPTION_PLANS, BASE_CREDIT_PACKS } from '../config/planDefaults';
import { getSafeAvatar } from '../utils/avatarUtils';
import { fetchIpLocation } from '../utils/locationUtils';
import { deleteInvitationAndStorage } from '../utils/storageCleanup';

const InvitationContext = createContext(null);

export const useInvitations = () => useContext(InvitationContext);

// ── Monthly private invitation quota per subscription tier ─────────────
// Derived directly from planDefaults.js plan configuration.
// Key = subscriptionTier value stored in Firestore users/{id}.subscriptionTier
// ───────────────────────────────────────────────────────────
const MONTHLY_PRIVATE_QUOTAS = {
    pro: 4,   // Pro plan     —  4 private invitations per month
    premium: 10,  // Premium plan — 10 private invitations per month
    vip: 10,  // legacy tier alias for premium
};
const INVITATIONS_PAGE_SIZE = 20;

const INVITATION_ERROR_MESSAGES = {
    requestToJoin: 'Failed to send request. Try again.',
    respondToPrivateInvitation: 'Failed to respond. Try again.',
    approveUser: 'Failed to approve. Try again.',
    rejectUser: 'Failed to reject. Try again.',
    cancelRequest: 'Failed to cancel request. Try again.',
    addInvitation: 'Failed to create invitation. Try again.',
    addPrivateInvitation: 'Failed to create invitation. Try again.'
};

export const InvitationProvider = ({ children }) => {
    const { currentUser, userProfile: firebaseProfile, updateUserProfile, isGuest } = useAuth();
    const { showToast } = useToast();
    const [invitations, setInvitations] = useState([]);
    const [loadedMoreInvitations, setLoadedMoreInvitations] = useState([]);
    const [hasMoreInvitations, setHasMoreInvitations] = useState(true);
    const [loadingMoreInvitations, setLoadingMoreInvitations] = useState(false);
    const lastInvitationDocRef = useRef(null);
    const [privateInvitations, setPrivateInvitations] = useState([]);
    const [restaurants, setRestaurants] = useState([]);
    const [loadingInvitations, setLoadingInvitations] = useState(true);
    const [detectedCountry, setDetectedCountry] = useState(null);
    const functions = getFunctions();
    const publishPrivateInvitationDraftCallable = httpsCallable(functions, 'publishPrivateInvitationDraft');
    const setCommunityMembershipCallable = httpsCallable(functions, 'setCommunityMembership');
    const listCommunityMembersCallable = httpsCallable(functions, 'listCommunityMembers');
    const createBusinessNotificationCallable = httpsCallable(functions, 'createPartnerNotification');
    const createNotificationCallable = httpsCallable(functions, 'createNotification');
    const createReportCallable = httpsCallable(functions, 'createReport');

    // --- 1. Sync Public Invitations (first page only; use Load More for more) ---
    useEffect(() => {
        const q = query(
            collection(db, 'invitations'),
            orderBy('createdAt', 'desc'),
            limit(INVITATIONS_PAGE_SIZE)
        );
        const timeout = setTimeout(() => {
            setLoadingInvitations(false);
        }, 15000);
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const staticInvites = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
            lastInvitationDocRef.current = lastDoc;
            setInvitations(staticInvites);
            setLoadingInvitations(false);
            if (snapshot.docs.length < INVITATIONS_PAGE_SIZE) setHasMoreInvitations(false);
        }, (error) => {
            console.error("Error syncing invitations:", error);
            setLoadingInvitations(false);
        });
        return () => {
            clearTimeout(timeout);
            unsubscribe();
        };
    }, []);

    // --- 1b. Sync Private Invitations (separate collection) ---
    useEffect(() => {
        if (!currentUser?.id || currentUser.id === 'guest') return;
        const userId = currentUser.id;

        // Query 1: invitations where user is the host
        const qHost = query(
            collection(db, 'private_invitations'),
            where('authorId', '==', userId),
            orderBy('createdAt', 'desc')
        );

        // Query 2: invitations where user is invited
        const qInvited = query(
            collection(db, 'private_invitations'),
            where('invitedFriends', 'array-contains', userId),
            orderBy('createdAt', 'desc')
        );

        const mergeResults = (hostDocs, invitedDocs) => {
            const seen = new Set();
            const merged = [];
            [...hostDocs, ...invitedDocs].forEach(doc => {
                if (!seen.has(doc.id)) {
                    seen.add(doc.id);
                    merged.push(doc);
                }
            });
            // Sort by createdAt desc
            merged.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setPrivateInvitations(merged);
        };

        let hostDocs = [];
        let invitedDocs = [];

        const unsubHost = onSnapshot(qHost, (snap) => {
            hostDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            mergeResults(hostDocs, invitedDocs);
        }, (error) => {
            console.error("Error syncing hosted private invitations:", error);
        });

        const unsubInvited = onSnapshot(qInvited, (snap) => {
            invitedDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            mergeResults(hostDocs, invitedDocs);
        }, (error) => {
            console.error("Error syncing invited private invitations:", error);
        });

        return () => {
            unsubHost();
            unsubInvited();
        };
    }, [currentUser?.id]);

    // --- 2. Sync Businesses (directory - visible to everyone including guests) ---
    useEffect(() => {
        const q = query(
            collection(db, 'public_profiles'),
            where('profileType', '==', 'business'),
            where('businessPublic.isPublished', '==', true),
            limit(20)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const businessList = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                const info = data.businessPublic || {};
                const brandKit = info.brandKit || data.businessInfo?.brandKit || {};

                businessList.push({
                    id: doc.id,
                    uid: doc.id,
                    ownerId: doc.id,
                    name: data.displayName || 'Business',
                    type: info.businessType || 'Restaurant',
                    image: info.coverImage || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
                    avatar: data.avatarUrl || '',
                    location: info.city || info.address || 'Sydney',
                    description: info.description || '',
                    phone: '',
                    rating: 5.0,
                    reviews: [],
                    lat: info.lat,
                    lng: info.lng,
                    brandKit,
                    theme: info.theme || brandKit.theme || undefined,
                    ...info
                });
            });
            setRestaurants(businessList);
        }, (error) => {
            console.error("Error fetching businesses:", error);
        });

        return () => unsubscribe();
    }, []);

    // --- 3. Auto-Detect Country via IP ---
    useEffect(() => {
        const detectCountry = async () => {
            try {
                // If user is logged in and has a country in their profile, use it
                if (firebaseProfile?.country) {
                    setDetectedCountry(firebaseProfile.country);
                    return;
                }

                // Otherwise, detect via IP
                const data = await fetchIpLocation();
                if (data.success) {
                    // Map country code to full name for the converter
                    const countryName = data.country || 'United States';
                    setDetectedCountry(countryName);
                    console.log('🌍 Country detected via IP:', countryName);
                }
            } catch (error) {
                console.error('❌ IP Location Error:', error);
                setDetectedCountry('United States'); // Fallback
            }
        };

        detectCountry();
    }, [firebaseProfile?.country]);

    const [notifications, setNotifications] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [reports, setReports] = useState([]);

    // Sync users list from Firestore (admin-only).
    // Non-admins must use trusted endpoints/public projections instead of raw users list.
    useEffect(() => {
        if (!currentUser?.uid) {
            setAllUsers([]);
            return;
        }
        if (firebaseProfile?.role !== 'admin') {
            setAllUsers([]);
            return;
        }
        const q = query(
            collection(db, 'users'),
            limit(500)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const usersData = snapshot.docs.map(d => ({
                id: d.id,
                uid: d.id,
                ...d.data(),
                joinDate: d.data().createdAt || new Date().toISOString()
            }));
            setAllUsers(usersData);
        }, (error) => console.error("Error syncing users:", error));
        return () => unsubscribe();
    }, [currentUser?.uid, firebaseProfile?.role]);

    // Sync Reports from Firestore (Admin only, limit to reduce cost)
    useEffect(() => {
        if (firebaseProfile?.role !== 'admin') return;
        const q = query(
            collection(db, 'reports'),
            orderBy('timestamp', 'desc'),
            limit(200)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const reportsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setReports(reportsData);
        }, (error) => {
            console.error("Error syncing reports:", error);
        });
        return () => unsubscribe();
    }, [firebaseProfile?.role]);

    const [dbPlans, setDbPlans] = useState([]);
    const [dbCreditPacks, setDbCreditPacks] = useState([]);

    // Sync subscription plans from Firestore
    useEffect(() => {
        const q = query(collection(db, 'subscriptionPlans'), where('active', '==', true));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const plansData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    stripePriceId: data.stripe?.priceId || data.stripePriceId,
                    features: data.features?.map(f => typeof f === 'object' ? f.text : (f.text || f)) || []
                };
            });
            console.log('📦 Dynamic plans synced:', plansData.length);
            setDbPlans(plansData);
        }, (error) => {
            console.error("Error syncing dynamic plans:", error);
        });
        return () => unsubscribe();
    }, []);

    // Sync credit packs from Firestore
    useEffect(() => {
        const q = query(collection(db, 'creditPacks'), where('active', '==', true));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const packsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log('💎 Dynamic credit packs synced:', packsData.length);
            setDbCreditPacks(packsData);
        }, (error) => {
            console.error("Error syncing credit packs:", error);
        });
        return () => unsubscribe();
    }, []);

    const baseSubscriptionPlans = BASE_SUBSCRIPTION_PLANS;
    const baseCreditPacks = BASE_CREDIT_PACKS;

    // Helper to detect Arabic text
    const hasArabic = (text) => /[\u0600-\u06FF]/.test(text);

    const allPlans = React.useMemo(() => {
        // Start with a map of base plans for quick lookup
        const mergedMap = {};

        // 1. Add all hardcoded base plans first
        baseSubscriptionPlans.forEach(plan => {
            const key = plan.stripePriceId || plan.id;
            mergedMap[key] = { ...plan };
        });

        // 2. Merge/Add all Firestore plans
        dbPlans.forEach(dbPlan => {
            // IGNORE any plan that has Arabic in the name - this is the "mess" removal
            if (hasArabic(dbPlan.name || '') || hasArabic(dbPlan.title || '')) {
                console.log('🚫 Filtered out Arabic plan from DB:', dbPlan.name);
                return;
            }

            const key = dbPlan.stripePriceId || dbPlan.id;

            if (mergedMap[key]) {
                // EXTREMELY IMPORTANT: We keep the HARDCODED English name/description/features
                // because Firestore might still contain old Arabic versions until the user syncs.
                // We only take the price, active state, and Stripe ID from Firestore.
                mergedMap[key] = {
                    ...mergedMap[key],
                    ...dbPlan,
                    // FORCE English fields from local config for existing plans
                    name: mergedMap[key].name,
                    description: mergedMap[key].description,
                    features: mergedMap[key].features,
                    title: mergedMap[key].title || mergedMap[key].name,
                    // Keep standard Stripe sync fields
                    price: dbPlan.price !== undefined ? dbPlan.price : mergedMap[key].price,
                    currency: dbPlan.currency || mergedMap[key].currency,
                    id: dbPlan.id
                };
            } else {
                // New plan created in Admin UI - should already be English
                // But we check for duplicates: if it's a "Free" plan and we already have one of that type, skip it
                const isDuplicateFree = dbPlan.price === 0 && Object.values(mergedMap).some(p => p.price === 0 && p.type === dbPlan.type);

                if (!isDuplicateFree) {
                    mergedMap[dbPlan.id] = { ...dbPlan };
                }
            }
        });

        // Convert back to array
        return Object.values(mergedMap);
    }, [dbPlans, baseSubscriptionPlans]);

    const allCreditPacks = React.useMemo(() => {
        const mergedMap = {};

        // 1. Add base packs
        baseCreditPacks.forEach(pack => {
            mergedMap[pack.stripePriceId || pack.id] = { ...pack };
        });

        // 2. Add/Merge Firestore packs
        dbCreditPacks.forEach(dbPack => {
            // Ignore Arabic packs
            if (hasArabic(dbPack.name || '')) return;

            const key = dbPack.stripePriceId || dbPack.id;
            if (mergedMap[key]) {
                mergedMap[key] = {
                    ...mergedMap[key],
                    ...dbPack,
                    // Force English name from local config
                    name: mergedMap[key].name
                };
            } else {
                mergedMap[dbPack.id] = { ...dbPack };
            }
        });

        return Object.values(mergedMap);
    }, [dbCreditPacks, baseCreditPacks, hasArabic]);

    const countryToUse = firebaseProfile?.country || detectedCountry || 'Australia';

    const subscriptionPlans = React.useMemo(() => {
        return allPlans.map(plan => {
            if (plan.price === 0) return plan;
            const converted = convertFromUSD(plan.price, countryToUse);
            const originalConverted = plan.originalPrice ? convertFromUSD(plan.originalPrice, countryToUse) : null;
            return {
                ...plan,
                price: converted.price,
                currency: converted.code,
                currencySymbol: converted.symbol,
                originalPrice: originalConverted ? originalConverted.price : null
            };
        });
    }, [allPlans, countryToUse]);

    const creditPacks = React.useMemo(() => {
        return allCreditPacks.map(pack => {
            const converted = convertFromUSD(pack.price, countryToUse);
            return {
                ...pack,
                price: converted.price,
                currency: converted.code,
                currencySymbol: converted.symbol
            };
        });
    }, [allCreditPacks, countryToUse]);

    // --- Methods ---

    const banUser = async (userId) => {
        try {
            const userRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
                const currentStatus = userDoc.data().status || 'active';
                const newStatus = currentStatus === 'active' ? 'banned' : 'active';
                await updateDoc(userRef, { status: newStatus });
                addNotification('Updated', `User status has been updated to ${newStatus}`, 'success');
            }
        } catch (error) {
            console.error("Error banning user:", error);
        }
    };

    const resolveReport = async (reportId) => {
        try {
            await updateDoc(doc(db, 'reports', reportId), {
                status: 'resolved',
                resolvedAt: serverTimestamp()
            });
            addNotification('Resolved', 'Report status updated to "Resolved"', 'success');
        } catch (error) {
            console.error("Error resolving report:", error);
        }
    };

    const updatePlan = (planId, newData) => {
        // This is local-only for now, in a real app it would update Firestore
        setDbPlans(prev => prev.map(p => p.id === planId ? { ...p, ...newData } : p));
    };

    const sendSystemMessage = async (userId, message) => {
        try {
            await addDoc(collection(db, 'system_messages'), {
                userId,
                message,
                timestamp: serverTimestamp(),
                read: false
            });
            addNotification('Sent', `Message sent to user`, 'success');
        } catch (error) {
            console.error("Error sending system message:", error);
        }
    };

    const addNotification = (title, message, type = 'info') => {
        setNotifications(prev => [{ id: uuidv4(), title, message, time: 'Now', read: false, type }, ...prev]);
    };

    const addInvitation = async (newInvite) => {
        if (isGuest) return false;
        if (currentUser.role === 'business') {
            showToast('Business accounts cannot create or publish invitations.', 'error');
            return false;
        }
        try {
            if (!newInvite.title) return false;
            const inviteData = {
                ...newInvite,
                hostId: currentUser.id,
                author: {
                    id: currentUser.id,
                    name: currentUser.name || 'User',
                    avatar: getSafeAvatar(currentUser),
                    isBusiness: currentUser.role === 'business'
                },
                requests: [], joined: [], chat: [], meetingStatus: 'planning',
                date: newInvite.date || new Date().toISOString(),
                time: newInvite.time || '20:30',
                lat: newInvite.lat || (-33.8688 + (Math.random() - 0.5) * 0.1),
                lng: newInvite.lng || (151.2093 + (Math.random() - 0.5) * 0.1),
                privacy: newInvite.privacy || 'public',
                createdAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, 'invitations'), inviteData);
            addNotification('Published!', 'Your invitation is now available to everyone.', 'success');

            if (newInvite.restaurantId) {
                const restaurant = restaurants.find(r => r.id === newInvite.restaurantId);
                if (restaurant) {
                    addBusinessNotification(restaurant.id, {
                        type: 'new_booking',
                        title: '🎉 New Booking!',
                        message: `${currentUser.name} booked a table for ${inviteData.guestsNeeded} people at ${restaurant.name}`,
                        invitationId: docRef.id,
                        date: inviteData.date,
                        time: inviteData.time,
                        guestsNeeded: inviteData.guestsNeeded
                    });
                }
            }
            return docRef.id;
        } catch (err) {
            console.error("Error adding invitation:", err);
            showToast(INVITATION_ERROR_MESSAGES.addInvitation, 'error');
            return false;
        }
    };

    // --- Private Invitation: separate collection ---
    const addPrivateInvitation = async (newInvite) => {
        if (isGuest) return false;
        if (currentUser.role === 'business') {
            showToast('Business accounts cannot create or publish invitations.', 'error');
            return false;
        }
        try {
            if (!newInvite.title) return false;

            // Remove undefined values — Firestore rejects them (e.g. lat/lng when no location selected)
            const sanitize = (obj) => {
                const clean = {};
                Object.entries(obj).forEach(([k, v]) => {
                    if (v !== undefined) clean[k] = v;
                });
                return clean;
            };

            const inviteData = sanitize({
                ...newInvite,
                authorId: currentUser.id,
                author: {
                    id: currentUser.id,
                    name: currentUser.name || 'User',
                    avatar: getSafeAvatar(currentUser)
                },
                privacy: 'private',
                createdAt: serverTimestamp()
            });
            const docRef = await addDoc(collection(db, 'private_invitations'), inviteData);
            return docRef.id;
        } catch (err) {
            console.error("Error adding private invitation:", err);
            showToast(INVITATION_ERROR_MESSAGES.addPrivateInvitation, 'error');
            return false;
        }
    };

    const addReport = async (reportData) => {
        try {
            await createReportCallable({
                type: reportData?.type,
                targetId: reportData?.targetId,
                targetName: reportData?.targetName,
                reason: reportData?.reason,
                details: reportData?.details,
                metadata: reportData?.metadata || {}
            });
            addNotification('Sent', 'Your report has been received and our team will review it.', 'success');
        } catch (error) {
            console.error("Error adding report:", error);
        }
    };

    const addBusinessNotification = async (restaurantId, notificationData) => {
        try {
            await createBusinessNotificationCallable({
                restaurantId,
                ...notificationData
            });
        } catch (error) {
            console.error("Error adding business notification", error);
        }
    };

    const addUserNotification = async (notificationData) => {
        try {
            await createNotificationCallable(notificationData);
        } catch (error) {
            console.error("Error creating notification:", error);
        }
    };

    const requestToJoin = async (invId) => {
        if (isGuest) return false;
        try {
            const invRef = doc(db, 'invitations', invId);
            const invDoc = await getDoc(invRef);
            if (!invDoc.exists()) return false;

            const invData = invDoc.data();
            const hostId = invData.author?.id;

            await updateDoc(invRef, {
                requests: arrayUnion(currentUser.id)
            });

            if (hostId && hostId !== currentUser.id) {
                await addUserNotification({
                    userId: hostId,
                    type: 'join_request',
                    title: '🙋 New Join Request',
                    message: `${currentUser.name} wants to join your invitation "${invData.title}"`,
                    invitationId: invId,
                    actionUrl: `/invitation/${invId}?section=join-requests`,
                });

                notificationSound.showJoinRequestNotification(
                    currentUser.name,
                    invData.title,
                    () => { window.location.href = `/invitation/${invId}`; }
                );
            }
            return true;
        } catch (err) {
            console.error("Error requesting to join:", err);
            showToast(INVITATION_ERROR_MESSAGES.requestToJoin, 'error');
            return false;
        }
    };

    const cancelRequest = async (invId) => {
        try {
            const invRef = doc(db, 'invitations', invId);
            await updateDoc(invRef, {
                requests: arrayRemove(currentUser.id)
            });
            return true;
        } catch (err) {
            console.error("Error canceling request:", err);
            showToast(INVITATION_ERROR_MESSAGES.cancelRequest, 'error');
            return false;
        }
    };

    const approveUser = async (invId, userId) => {
        try {
            const invRef = doc(db, 'invitations', invId);
            const invDoc = await getDoc(invRef);
            if (!invDoc.exists()) return false;

            const invData = invDoc.data();
            await updateDoc(invRef, {
                requests: arrayRemove(userId),
                joined: arrayUnion(userId)
            });

            const newJoinedCount = (invData.joined?.length || 0) + 1;
            const isFull = newJoinedCount >= invData.guestsNeeded;

            if (isFull) {
                const allJoinedMembers = [...(invData.joined || []), userId];
                for (const memberId of allJoinedMembers) {
                    await addUserNotification({
                        userId: memberId,
                        type: 'invitation_full',
                        title: 'Invitation Complete',
                        message: `Great news! The invitation "${invData.title}" is now complete with all ${invData.guestsNeeded} guests confirmed.`,
                        invitationId: invId,
                        actionUrl: `/invitation/${invId}`,
                    });
                }
            }

            await addUserNotification({
                userId: userId,
                type: 'request_approved',
                title: '✅ Request Approved',
                message: `Your request to join "${invData.title}" has been approved`,
                invitationId: invId,
                actionUrl: `/invitation/${invId}`,
            });
            return true;
        } catch (err) {
            console.error("Error approving user:", err);
            showToast(INVITATION_ERROR_MESSAGES.approveUser, 'error');
            return false;
        }
    };

    const rejectUser = async (invId, userId) => {
        try {
            const invRef = doc(db, 'invitations', invId);
            await updateDoc(invRef, { requests: arrayRemove(userId) });
            return true;
        } catch (err) {
            console.error("Error rejecting user:", err);
            showToast(INVITATION_ERROR_MESSAGES.rejectUser, 'error');
            return false;
        }
    };

    // ── Private Invitation Quota System ──────────────────────────────────────
    // Quotas are derived from subscriptionTier — no extra Firestore fields needed.
    // Priority: plan monthly quota → purchased credits → deny
    // ─────────────────────────────────────────────────────────────────────────

    const canCreatePrivateInvitation = () => {
        if (!currentUser || isGuest) return { canCreate: false, reason: 'guest' };
        if (currentUser.role === 'admin') return { canCreate: true, quota: 'unlimited' };

        const tier = firebaseProfile?.subscriptionTier || 'free';
        const monthlyQuota = MONTHLY_PRIVATE_QUOTAS[tier] || 0;

        // 1. Check plan monthly quota
        if (monthlyQuota > 0) {
            const usedThisMonth = firebaseProfile?.usedPrivateCreditsThisMonth || 0;
            const remaining = monthlyQuota - usedThisMonth;
            if (remaining > 0) return { canCreate: true, quota: remaining, period: 'month', source: 'plan' };
        }

        // 2. Check purchased credits (available to all tiers)
        const purchasedCredits = firebaseProfile?.purchasedPrivateCredits || 0;
        if (purchasedCredits > 0) {
            return { canCreate: true, quota: purchasedCredits, source: 'purchased' };
        }

        return { canCreate: false, reason: 'no_credits' };
    };

    const publishPrivateInvitationDraft = async (invitationId) => {
        if (!invitationId || !currentUser || currentUser.id === 'guest') {
            return { success: false, alreadyPublished: false };
        }
        try {
            const result = await publishPrivateInvitationDraftCallable({ invitationId });
            return {
                success: true,
                alreadyPublished: result?.data?.alreadyPublished === true
            };
        } catch (error) {
            const message = error?.message || 'Failed to publish private invitation.';
            console.error('Error publishing private invitation draft:', error);
            showToast(message, 'error');
            return { success: false, alreadyPublished: false };
        }
    };

    const respondToPrivateInvitation = async (invId, status) => {
        if (!currentUser || currentUser.id === 'guest') return false;
        try {
            const invRef = doc(db, 'private_invitations', invId);
            const invDoc = await getDoc(invRef);
            if (!invDoc.exists()) return false;

            const invData = invDoc.data();
            const hostId = invData.authorId || invData.author?.id;

            await updateDoc(invRef, { [`rsvps.${currentUser.id}`]: status });

            if (status === 'declined') {
                const updatedDoc = await getDoc(invRef);
                const data = updatedDoc.data();
                const rsvps = data.rsvps || {};
                const invitedFriends = data.invitedFriends || [];
                const allDeclined = invitedFriends.length > 0 && invitedFriends.every(id => rsvps[id] === 'declined');

                if (allDeclined) {
                    await addUserNotification({
                        userId: hostId,
                        type: 'system_announcement',
                        title: '⚠️ Invitation Cancelled',
                        message: `All invitees declined your private invitation "${data.title}"`,
                        invitationId: invId,
                        style: 'warning',
                    });
                    setTimeout(async () => { await deleteInvitationAndStorage(invId, 'private_invitations'); }, 5000);
                    addNotification('Cancelled', 'Invitation rejected by all invitees.', 'warning');
                    return true;
                }
            }

            if (hostId && hostId !== currentUser.id) {
                await addUserNotification({
                    userId: hostId,
                    type: 'private_invitation_response',
                    title: status === 'accepted' ? '✅ Invitation Accepted' : '❌ Invitation Declined',
                    message: `${currentUser.name} has ${status === 'accepted' ? 'accepted' : 'declined'} your private invitation "${invData.title}"`,
                    invitationId: invId,
                    actionUrl: `/invitation/private/${invId}`,
                    status: status,
                });
            }
            addNotification(
                status === 'accepted' ? 'Accepted!' : 'Declined',
                status === 'accepted' ? 'You have accepted the invitation successfully.' : 'Your response has been sent to the host.',
                'success'
            );
            return true;
        } catch (error) {
            console.error("Error responding to private invitation:", error);
            showToast(INVITATION_ERROR_MESSAGES.respondToPrivateInvitation, 'error');
            return false;
        }
    };

    const sendChatMessage = (invId, text) => {
        const msg = { id: uuidv4(), senderId: currentUser.id, senderName: currentUser.name, text, timestamp: new Date().toISOString() };
        setInvitations(prev => prev.map(inv => inv.id === invId ? { ...inv, chat: [...(inv.chat || []), msg] } : inv));
    };

    const updateMeetingStatus = async (id, status) => {
        try {
            const invitationRef = doc(db, 'invitations', id);
            const updateData = { participantStatus: { [currentUser.id]: status } };

            if (status === 'completed') {
                updateData.meetingStatus = 'completed';
                updateData.completedAt = serverTimestamp();
                const invDoc = await getDoc(invitationRef);
                if (invDoc.exists()) {
                    const invData = invDoc.data();
                    const hostId = invData.hostId || invData.author?.id;
                    const attendees = invData.joined || [];
                    if (hostId && !invData.rewardsDistributed) {
                        const batch = writeBatch(db);
                        batch.update(doc(db, 'users', hostId), { reputation: increment(10) });
                        attendees.forEach(a => { if (a !== hostId) batch.update(doc(db, 'users', a), { reputation: increment(5) }); });
                        updateData.rewardsDistributed = true;
                        await batch.commit();
                    }
                }
            }

            await setDoc(invitationRef, updateData, { merge: true });
        } catch (error) { console.error('Error updating meeting status:', error); }
    };

    const updateInvitationTime = (id, newDate, newTime) => {
        setInvitations(prev => prev.map(inv => inv.id === id ? { ...inv, date: new Date(newDate).toISOString(), time: newTime } : inv));
    };

    const approveNewTime = (invId) => {
        setInvitations(prev => prev.map(inv => inv.id === invId ? {
            ...inv,
            pendingChangeApproval: (inv.pendingChangeApproval || []).filter(id => id !== currentUser.id),
            joined: [...inv.joined, currentUser.id]
        } : inv));
    };

    const rejectNewTime = (invId) => {
        setInvitations(prev => prev.map(inv => inv.id === invId ? { ...inv, pendingChangeApproval: (inv.pendingChangeApproval || []).filter(id => id !== currentUser.id) } : inv));
    };

    const toggleFollow = async (userId) => {
        if (isGuest || !userId || userId === currentUser.id) return;
        const isCurrentlyFollowing = (currentUser.following || []).includes(userId);
        try {
            const targetUserDoc = await getDoc(doc(db, 'users', userId));
            if (!targetUserDoc.exists()) return;
            const targetRole = targetUserDoc.data()?.role || 'user';
            if (targetRole === 'business') return; // no one follows business accounts
            // Business accounts cannot follow regular (user) accounts
            if (currentUser.role === 'business' && targetRole === 'user') {
                showToast('Business accounts cannot follow regular users.', 'error');
                return;
            }

            const currentUserRef = doc(db, 'users', currentUser.id);

            if (isCurrentlyFollowing) {
                // Atomic remove — no race condition
                await updateDoc(currentUserRef, { following: arrayRemove(userId) });
                await unfollowUser(currentUser.id, userId);
            } else {
                // Atomic add — no race condition
                await updateDoc(currentUserRef, { following: arrayUnion(userId) });
                await followUser(currentUser.id, userId, {
                    id: currentUser.id,
                    name: currentUser.name,
                    avatar: getSafeAvatar(currentUser)
                });
            }
        } catch (error) {
            console.error('Error in toggleFollow:', error);
        }
    };

    const getFollowingInvitations = () => {
        if (!currentUser || !currentUser.following) return [];
        return invitations.filter(inv => currentUser.following.includes(inv.author?.id));
    };

    const submitRating = (invId, ratingData) => {
        setInvitations(prev => prev.map(inv => (inv.id === invId ? { ...inv, rating: ratingData } : inv)));
        addNotification('🌟 Thank you for your rating!', 'You earned +10 reputation points.', 'success');
    };

    const submitRestaurantRating = (restaurantId, ratingData) => {
        const review = {
            id: uuidv4(),
            userId: currentUser.id,
            userName: currentUser.name,
            userAvatar: getSafeAvatar(currentUser),
            rating: ratingData.rating,
            comment: ratingData.comment,
            date: new Date().toISOString(),
            helpful: 0
        };
        setRestaurants(prev => prev.map(res => {
            if (res.id === restaurantId) {
                const reviews = [...(res.reviews || []), review];
                const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
                return { ...res, reviews, rating: Math.round(avgRating * 10) / 10 };
            }
            return res;
        }));
        addNotification('⭐ Thank you for your rating!', 'You earned +15 reputation points.', 'success');
    };

    const updateProfile = async (data) => {
        if (!currentUser?.uid || currentUser.uid === 'guest') return false;

        try {
            const updates = { ...data };

            if (data.name || data.displayName) {
                updates.display_name = data.name || data.displayName;
                updates.displayName = data.name || data.displayName;
            }

            if (data.avatar || data.photoURL || data.photo_url) {
                const photo = data.avatar || data.photoURL || data.photo_url;
                updates.photo_url = photo;
                updates.photoURL = photo;
            }

            if (updateUserProfile) {
                await updateUserProfile(updates);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error updating profile:', error);
            throw error;
        }
    };

    const updateRestaurant = async (resId, data) => {
        try {
            const targetId = resId === 'new_res' ? (currentUser.uid + '_restaurant') : resId;
            const resRef = doc(db, 'restaurants', targetId);

            // Avoid JSON.parse(JSON.stringify) for data that might contain Firestore objects
            const cleanData = { ...data };

            if (!cleanData.ownerId) cleanData.ownerId = currentUser.uid;
            await setDoc(resRef, cleanData, { merge: true });
            return { success: true, id: targetId };
        } catch (error) { console.error("Error updating restaurant:", error); return { success: false, error }; }
    };

    const markAllAsRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    const joinCommunity = async (partnerId) => {
        if (!partnerId || !currentUser) return false;
        try {
            const userId = currentUser.uid || currentUser.id;
            if (!userId) return false;
            await setCommunityMembershipCallable({ partnerId, action: 'join' });
            await addUserNotification({
                userId: partnerId,
                type: 'new_community_member',
                title: '🎉 New Community Member!',
                message: `${currentUser.name || currentUser.displayName || 'Someone'} has joined your community.`,
                senderName: currentUser.name || currentUser.displayName || 'Someone',
                senderAvatar: getSafeAvatar(currentUser),
            });
            addNotification('🎉 Success!', 'You have joined the community successfully.', 'success');
            return true;
        } catch (error) { console.error('Error joining community:', error); return false; }
    };

    const leaveCommunity = async (partnerId) => {
        if (!partnerId || !currentUser) return false;
        try {
            const userId = currentUser.uid || currentUser.id;
            if (!userId) return false;
            await setCommunityMembershipCallable({ partnerId, action: 'leave' });
            addNotification('👋 Left', 'You have left the community.', 'info');
            return true;
        } catch (error) { console.error('Error leaving community:', error); return false; }
    };

    const toggleCommunity = async (partnerId) => {
        if (!partnerId || !currentUser) return;
        const isJoined = (firebaseProfile?.joinedCommunities || []).includes(partnerId);
        if (isJoined) await leaveCommunity(partnerId); else await joinCommunity(partnerId);
    };

    const getCommunityMembers = async (partnerId, options = {}) => {
        if (!partnerId || !currentUser?.uid) return { memberCount: 0, members: [] };
        try {
            const payload = {
                partnerId,
                includeMembers: options.includeMembers !== false,
                limit: Number.isFinite(options.limit) ? options.limit : 50
            };
            const result = await listCommunityMembersCallable(payload);
            const data = result?.data || {};
            return {
                memberCount: Number(data.memberCount || 0),
                members: Array.isArray(data.members) ? data.members : []
            };
        } catch (error) {
            console.error('Error loading community members:', error);
            return { memberCount: 0, members: [] };
        }
    };

    const canEditRestaurant = (restaurantId) => {
        if (!currentUser) return false;
        if (currentUser.userRole === 'admin') return true;
        return currentUser.role === 'business' && currentUser.ownedRestaurants?.includes(restaurantId);
    };

    const submitReport = async (report) => {
        try {
            const result = await createReportCallable({
                type: report?.type,
                targetId: report?.targetId,
                targetName: report?.targetName,
                reason: report?.reason,
                details: report?.details,
                metadata: report?.metadata || {}
            });
            showToast('Report submitted successfully.', 'success');
            const reportId = result?.data?.reportId || null;
            return reportId ? { id: reportId, ...report } : { ...report };
        } catch (error) { console.error("Error submitting report:", error); return null; }
    };

    const deleteInvitation = async (invId, isPrivate = false) => {
        if (!invId || !currentUser) return false;
        try {
            const collName = isPrivate ? 'private_invitations' : 'invitations';
            // Let Firestore rules enforce authorization; do not trust client-side admin fields.
            try {
                const primaryDeleted = await deleteInvitationAndStorage(invId, collName);
                if (primaryDeleted) return true;
            } catch (error) {
                console.warn(`Primary delete failed for ${collName}/${invId}:`, error?.message || error);
            }

            const altColl = isPrivate ? 'invitations' : 'private_invitations';
            const fallbackDeleted = await deleteInvitationAndStorage(invId, altColl);
            return !!fallbackDeleted;
        } catch (error) { console.error('Error deleting invitation:', error); return false; }
    };

    const loadMoreInvitations = async () => {
        if (loadingMoreInvitations || !hasMoreInvitations || !lastInvitationDocRef.current) return;
        setLoadingMoreInvitations(true);
        try {
            const q = query(
                collection(db, 'invitations'),
                orderBy('createdAt', 'desc'),
                startAfter(lastInvitationDocRef.current),
                limit(INVITATIONS_PAGE_SIZE)
            );
            const snap = await getDocs(q);
            const next = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const lastDoc = snap.docs[snap.docs.length - 1] || null;
            lastInvitationDocRef.current = lastDoc;
            setLoadedMoreInvitations(prev => [...prev, ...next]);
            setHasMoreInvitations(snap.docs.length === INVITATIONS_PAGE_SIZE);
        } catch (error) {
            console.error('Error loading more invitations:', error);
        } finally {
            setLoadingMoreInvitations(false);
        }
    };

    const invitationsMerged = React.useMemo(() => {
        const firstIds = new Set(invitations.map(i => i.id));
        const extra = loadedMoreInvitations.filter(i => !firstIds.has(i.id));
        return [...invitations, ...extra];
    }, [invitations, loadedMoreInvitations]);

    const extendedCurrentUser = React.useMemo(() => {
        if (!currentUser) return null;
        return { ...currentUser, ...firebaseProfile };
    }, [currentUser, firebaseProfile]);

    return (
        <InvitationContext.Provider value={{
            invitations: invitationsMerged, privateInvitations, restaurants, currentUser: extendedCurrentUser, loadingInvitations,
            loadMoreInvitations, hasMoreInvitations, loadingMoreInvitations,
            addInvitation, addPrivateInvitation, requestToJoin, cancelRequest,
            approveUser, rejectUser, respondToPrivateInvitation, canCreatePrivateInvitation, publishPrivateInvitationDraft,
            sendChatMessage, updateMeetingStatus,
            updateInvitationTime, approveNewTime, rejectNewTime,
            notifications, updateProfile, updateRestaurant, markAllAsRead, addNotification, deleteInvitation,
            toggleFollow, getFollowingInvitations, submitRating, submitRestaurantRating, joinCommunity, leaveCommunity, toggleCommunity,
            canEditRestaurant, getCommunityMembers,
            allUsers, reports, subscriptionPlans, creditPacks, banUser, resolveReport, updatePlan, sendSystemMessage, addReport, submitReport
        }}>
            {children}
        </InvitationContext.Provider>
    );
};
