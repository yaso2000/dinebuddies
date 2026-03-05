import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase/config';
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
    arrayUnion,
    arrayRemove,
    increment,
    setDoc,
    deleteDoc,
    writeBatch
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { v4 as uuidv4 } from 'uuid';
import notificationSound from '../utils/notificationSound';
import { followUser, unfollowUser } from '../utils/followHelpers';
import { convertFromUSD, getCurrencyByCountry } from '../utils/currencyConverter';
import { BASE_SUBSCRIPTION_PLANS, BASE_CREDIT_PACKS } from '../config/planDefaults';
import { getSafeAvatar } from '../utils/avatarUtils';
import { fetchIpLocation } from '../utils/locationUtils';

const InvitationContext = createContext();

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
// free tier is intentionally absent — free users rely on purchasedPrivateCredits only

export const InvitationProvider = ({ children }) => {
    const { currentUser, userProfile: firebaseProfile, updateUserProfile, isGuest } = useAuth();
    const [invitations, setInvitations] = useState([]);
    const [privateInvitations, setPrivateInvitations] = useState([]);
    const [restaurants, setRestaurants] = useState([]);
    const [loadingInvitations, setLoadingInvitations] = useState(true);
    const [detectedCountry, setDetectedCountry] = useState(null);

    // --- 1. Sync Public Invitations ---
    useEffect(() => {
        const q = query(collection(db, 'invitations'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const staticInvites = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setInvitations(staticInvites);
            setLoadingInvitations(false);
        }, (error) => {
            console.error("Error syncing invitations:", error);
            setLoadingInvitations(false);
        });
        return () => unsubscribe();
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

    // --- 2. Sync Businesses from Users Collection ---
    useEffect(() => {
        const q = query(collection(db, 'users'), where('role', '==', 'business'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const businessList = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                const info = data.businessInfo;

                if (info) {
                    const isPublished = info.isPublished === true || info.isPublished === undefined;
                    if (isPublished) {
                        businessList.push({
                            id: doc.id,
                            uid: doc.id,
                            ownerId: doc.id,
                            name: data.display_name || 'Business',
                            type: info.businessType || 'Restaurant',
                            image: info.coverImage || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
                            avatar: data.photo_url || '',
                            location: info.city || info.address || 'Sydney',
                            description: info.description || '',
                            phone: info.phone || '',
                            rating: data.reputation ? Math.min(5, data.reputation / 20) : 5.0,
                            reviews: [],
                            lat: info.lat,
                            lng: info.lng,
                            ...info
                        });
                    }
                }
            });
            setRestaurants(businessList);
        }, (error) => {
            console.error("Error fetching business partners:", error);
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

    // Sync Users from Firestore (for Admin)
    useEffect(() => {
        const q = query(collection(db, 'users'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({
                id: doc.id,
                uid: doc.id,
                ...doc.data(),
                joinDate: doc.data().createdAt || new Date().toISOString()
            }));
            setAllUsers(usersData);
        }, (error) => console.error("Error syncing users:", error));
        return () => unsubscribe();
    }, []);

    // Sync Reports from Firestore (Admin only)
    useEffect(() => {
        if (!currentUser?.isAdmin) return;
        const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
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
    }, [currentUser?.isAdmin]);

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

    // --- Auto-reset monthly private invitation counter when month changes ---
    // Runs once per login session; resets Firestore counter if the month has changed
    useEffect(() => {
        if (!currentUser?.id || !firebaseProfile) return;
        const tier = firebaseProfile.subscriptionTier || 'free';
        if (!MONTHLY_PRIVATE_QUOTAS[tier]) return; // free users have no monthly quota to reset
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;
        if (firebaseProfile.lastPrivateResetMonth !== currentMonth) {
            const userRef = doc(db, 'users', currentUser.id);
            updateDoc(userRef, {
                usedPrivateCreditsThisMonth: 0,
                lastPrivateResetMonth: currentMonth
            }).catch(e => console.warn('Monthly reset failed:', e));
        }
    }, [currentUser?.id, firebaseProfile?.subscriptionTier, firebaseProfile?.lastPrivateResetMonth]);

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
        try {
            if (!newInvite.title) return false;
            const inviteData = {
                ...newInvite,
                hostId: currentUser.id,
                author: {
                    id: currentUser.id,
                    name: currentUser.name || 'User',
                    avatar: getSafeAvatar(currentUser),
                    isPartner: currentUser.role === 'business'
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
                    addPartnerNotification(restaurant.id, {
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
            return false;
        }
    };

    // --- Private Invitation: separate collection ---
    const addPrivateInvitation = async (newInvite) => {
        if (isGuest) return false;
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
            return false;
        }
    };

    const addReport = async (reportData) => {
        try {
            await addDoc(collection(db, 'reports'), {
                ...reportData,
                status: 'pending',
                timestamp: serverTimestamp(),
                reporterId: currentUser?.id,
                reporterName: currentUser?.name
            });
            addNotification('Sent', 'Your report has been received and our team will review it.', 'success');
        } catch (error) {
            console.error("Error adding report:", error);
        }
    };

    const addPartnerNotification = async (restaurantId, notificationData) => {
        try {
            await addDoc(collection(db, 'partner_notifications'), {
                restaurantId,
                ...notificationData,
                timestamp: serverTimestamp(),
                read: false
            });
        } catch (error) {
            console.error("Error adding partner notification", error);
        }
    };

    const requestToJoin = async (invId) => {
        if (isGuest) return;
        try {
            const invRef = doc(db, 'invitations', invId);
            const invDoc = await getDoc(invRef);
            if (!invDoc.exists()) return;

            const invData = invDoc.data();
            const hostId = invData.author?.id;

            await updateDoc(invRef, {
                requests: arrayUnion(currentUser.id)
            });

            if (hostId && hostId !== currentUser.id) {
                await addDoc(collection(db, 'notifications'), {
                    userId: hostId,
                    type: 'join_request',
                    title: '🙋 New Join Request',
                    message: `${currentUser.name} wants to join your invitation "${invData.title}"`,
                    invitationId: invId,
                    actionUrl: `/invitation/${invId}?section=join-requests`,
                    requesterId: currentUser.id,
                    requesterName: currentUser.name,
                    requesterAvatar: getSafeAvatar(currentUser),
                    createdAt: serverTimestamp(),
                    read: false
                });

                notificationSound.showJoinRequestNotification(
                    currentUser.name,
                    invData.title,
                    () => { window.location.href = `/invitation/${invId}`; }
                );
            }
        } catch (err) {
            console.error("Error requesting to join:", err);
        }
    };

    const cancelRequest = async (invId) => {
        try {
            const invRef = doc(db, 'invitations', invId);
            await updateDoc(invRef, {
                requests: arrayRemove(currentUser.id)
            });
        } catch (err) { console.error("Error canceling request:", err); }
    };

    const approveUser = async (invId, userId) => {
        try {
            const invRef = doc(db, 'invitations', invId);
            const invDoc = await getDoc(invRef);
            if (!invDoc.exists()) return;

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
                    await addDoc(collection(db, 'notifications'), {
                        userId: memberId,
                        type: 'invitation_full',
                        title: 'Invitation Complete',
                        message: `Great news! The invitation "${invData.title}" is now complete with all ${invData.guestsNeeded} guests confirmed.`,
                        invitationId: invId,
                        actionUrl: `/invitation/${invId}`,
                        fromUserId: currentUser.id,
                        fromUserName: currentUser.name,
                        fromUserAvatar: getSafeAvatar(currentUser),
                        createdAt: serverTimestamp(),
                        read: false
                    });
                }
            }

            await addDoc(collection(db, 'notifications'), {
                userId: userId,
                type: 'request_approved',
                title: '✅ Request Approved',
                message: `Your request to join "${invData.title}" has been approved`,
                invitationId: invId,
                actionUrl: `/invitation/${invId}`,
                createdAt: serverTimestamp(),
                read: false
            });
        } catch (err) {
            console.error("Error approving user:", err);
        }
    };

    const rejectUser = async (invId, userId) => {
        try {
            const invRef = doc(db, 'invitations', invId);
            await updateDoc(invRef, { requests: arrayRemove(userId) });
        } catch (err) { console.error("Error rejecting user:", err); }
    };

    // ── Private Invitation Quota System ──────────────────────────────────────
    // Quotas are derived from subscriptionTier — no extra Firestore fields needed.
    // Priority: plan monthly quota → purchased credits → deny
    // ─────────────────────────────────────────────────────────────────────────

    const canCreatePrivateInvitation = () => {
        if (!currentUser || isGuest) return { canCreate: false, reason: 'guest' };
        if (currentUser.role === 'admin') return { canCreate: true, quota: 'unlimited' };
        if (firebaseProfile?.isTester) return { canCreate: true, quota: '∞', isTester: true };

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

    const deductPrivateInvitationCredit = async () => {
        // Admin and Testers never consume credits
        if (!currentUser || currentUser.role === 'admin' || firebaseProfile?.isTester) return true;

        const userRef = doc(db, 'users', currentUser.id);
        const tier = firebaseProfile?.subscriptionTier || 'free';
        const monthlyQuota = MONTHLY_PRIVATE_QUOTAS[tier] || 0;
        const usedThisMonth = firebaseProfile?.usedPrivateCreditsThisMonth || 0;

        // 1. Deduct from plan monthly quota
        if (monthlyQuota > 0 && usedThisMonth < monthlyQuota) {
            await updateDoc(userRef, { usedPrivateCreditsThisMonth: increment(1) });
            return true;
        }

        // 2. Deduct from purchased credits
        const purchasedCredits = firebaseProfile?.purchasedPrivateCredits || 0;
        if (purchasedCredits > 0) {
            await updateDoc(userRef, { purchasedPrivateCredits: increment(-1) });
            return true;
        }

        return false;
    };

    const respondToPrivateInvitation = async (invId, status) => {
        if (!currentUser || currentUser.id === 'guest') return;
        try {
            const invRef = doc(db, 'private_invitations', invId);
            const invDoc = await getDoc(invRef);
            if (!invDoc.exists()) return;

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
                    await addDoc(collection(db, 'notifications'), {
                        userId: hostId,
                        type: 'system_announcement',
                        title: '⚠️ Invitation Cancelled',
                        message: `All invitees declined your private invitation "${data.title}"`,
                        style: 'warning',
                        createdAt: serverTimestamp(),
                        read: false
                    });
                    setTimeout(async () => { await deleteDoc(invRef); }, 5000);
                    addNotification('Cancelled', 'Invitation rejected by all invitees.', 'warning');
                    return;
                }
            }

            if (hostId && hostId !== currentUser.id) {
                await addDoc(collection(db, 'notifications'), {
                    userId: hostId,
                    type: 'private_invitation_response',
                    title: status === 'accepted' ? '✅ Invitation Accepted' : '❌ Invitation Declined',
                    message: `${currentUser.name} has ${status === 'accepted' ? 'accepted' : 'declined'} your private invitation "${invData.title}"`,
                    invitationId: invId,
                    actionUrl: `/invitation/private/${invId}`,
                    responderId: currentUser.id,
                    status: status,
                    createdAt: serverTimestamp(),
                    read: false
                });
            }
            addNotification(
                status === 'accepted' ? 'Accepted!' : 'Declined',
                status === 'accepted' ? 'You have accepted the invitation successfully.' : 'Your response has been sent to the host.',
                'success'
            );
        } catch (error) {
            console.error("Error responding to private invitation:", error);
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
            if (!targetUserDoc.exists() || targetUserDoc.data().role === 'business') return;

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
            await updateDoc(doc(db, 'users', userId), { joinedCommunities: arrayUnion(partnerId) });
            await updateDoc(doc(db, 'users', partnerId), { communityMembers: arrayUnion(userId) });
            const newCommunities = [...(firebaseProfile?.joinedCommunities || []), partnerId];
            updateUserProfile({ joinedCommunities: newCommunities });
            await addDoc(collection(db, 'notifications'), {
                userId: partnerId,
                type: 'new_community_member',
                title: '🎉 New Community Member!',
                message: `${currentUser.name || currentUser.displayName || 'Someone'} has joined your community.`,
                senderId: userId,
                senderName: currentUser.name || currentUser.displayName || 'Someone',
                senderAvatar: getSafeAvatar(currentUser),
                createdAt: serverTimestamp(),
                read: false
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
            await updateDoc(doc(db, 'users', userId), { joinedCommunities: arrayRemove(partnerId) });
            await updateDoc(doc(db, 'users', partnerId), { communityMembers: arrayRemove(userId) });
            const newCommunities = (firebaseProfile?.joinedCommunities || []).filter(id => id !== partnerId);
            updateUserProfile({ joinedCommunities: newCommunities });
            addNotification('👋 Left', 'You have left the community.', 'info');
            return true;
        } catch (error) { console.error('Error leaving community:', error); return false; }
    };

    const toggleCommunity = async (partnerId) => {
        if (!partnerId || !currentUser) return;
        const isJoined = (firebaseProfile?.joinedCommunities || []).includes(partnerId);
        if (isJoined) await leaveCommunity(partnerId); else await joinCommunity(partnerId);
    };

    const canEditRestaurant = (restaurantId) => {
        if (!currentUser) return false;
        if (currentUser.userRole === 'admin') return true;
        return currentUser.role === 'business' && currentUser.ownedRestaurants?.includes(restaurantId);
    };

    const submitReport = async (report) => {
        try {
            const reportRef = await addDoc(collection(db, 'reports'), {
                ...report,
                reporterId: currentUser.id,
                reporterName: currentUser.name,
                timestamp: serverTimestamp(),
                status: 'pending'
            });
            alert('Report submitted successfully.');
            return { id: reportRef.id, ...report };
        } catch (error) { console.error("Error submitting report:", error); return null; }
    };

    const deleteInvitation = async (invId, isPrivate = false) => {
        if (!invId || !currentUser) return false;
        try {
            const collName = isPrivate ? 'private_invitations' : 'invitations';
            const invRef = doc(db, collName, invId);
            const invDoc = await getDoc(invRef);
            if (!invDoc.exists()) {
                // Try the other collection as fallback
                const altRef = doc(db, isPrivate ? 'invitations' : 'private_invitations', invId);
                const altDoc = await getDoc(altRef);
                if (altDoc.exists() && (altDoc.data().author?.id === currentUser.id || altDoc.data().authorId === currentUser.id || currentUser.userRole === 'admin')) {
                    await deleteDoc(altRef);
                    return true;
                }
                return false;
            }
            const data = invDoc.data();
            if (data.author?.id === currentUser.id || data.authorId === currentUser.id || currentUser.userRole === 'admin') {
                await deleteDoc(invRef);
                return true;
            }
            return false;
        } catch (error) { console.error('Error deleting invitation:', error); return false; }
    };

    const extendedCurrentUser = React.useMemo(() => {
        if (!currentUser) return null;
        return { ...currentUser, ...firebaseProfile };
    }, [currentUser, firebaseProfile]);

    return (
        <InvitationContext.Provider value={{
            invitations, privateInvitations, restaurants, currentUser: extendedCurrentUser, loadingInvitations,
            addInvitation, addPrivateInvitation, requestToJoin, cancelRequest,
            approveUser, rejectUser, respondToPrivateInvitation, canCreatePrivateInvitation, deductPrivateInvitationCredit,
            sendChatMessage, updateMeetingStatus,
            updateInvitationTime, approveNewTime, rejectNewTime,
            notifications, updateProfile, updateRestaurant, markAllAsRead, addNotification, deleteInvitation,
            toggleFollow, getFollowingInvitations, submitRating, submitRestaurantRating, joinCommunity, leaveCommunity, toggleCommunity,
            canEditRestaurant,
            allUsers, reports, subscriptionPlans, creditPacks, banUser, resolveReport, updatePlan, sendSystemMessage, addReport, submitReport
        }}>
            {children}
        </InvitationContext.Provider>
    );
};
