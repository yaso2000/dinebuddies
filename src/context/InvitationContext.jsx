import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import app, { auth, db } from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';

const FUNCTIONS_REGION = 'us-central1';
import {
    collection,
    query,
    onSnapshot,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp,
    Timestamp,
    getDocs,
    getDoc,
    where,
    orderBy,
    limit,
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
import { computeArchiveAfterFirestoreTimestamp } from '../utils/invitationExpiry';
import {
    buildPrivateInvitationResponseChatMessage,
    buildPrivateInvitationResponseNotificationTitle,
    normalizeUserGender,
    isArabicLocale,
} from '../utils/privateInvitationResponseMessages';
import i18n from '../i18n';
import { getInvitationLatLng } from '../utils/invitationCoords';
import { followUser, unfollowUser } from '../utils/followHelpers';
import { showFollowCooldownWarning } from '../utils/connectionActionCooldown';
import {
    isConnectionComplete,
    resolveConnectionKind,
} from '../utils/connectConnection';
import { notifyConnectConnectionComplete } from '../utils/notificationHelpers';
import { getSafeAvatar, pickSafeDisplayImageUrl } from '../utils/avatarUtils';
import { DEFAULT_BUSINESS_COVER } from '../utils/businessCoverImage';
import { fetchIpLocation, detectUserLocationContext, detectLiveUserGps } from '../utils/locationUtils';
import { deleteInvitationAndStorage } from '../utils/storageCleanup';
import { maybeAwardBusinessHostingPoints } from '../services/businessLikeService';
import { filterInviteesWhoAcceptAuthor, asUidArray } from '../utils/userSocialLists';
import { filterInviteesFollowedBySender } from '../utils/privateInviteAvailability';
import {
    getTotalDineCredits,
    SOCIAL_INVITATION_PUBLISH_CREDITS,
    PRIVATE_INVITATION_PUBLISH_CREDITS,
} from '../utils/privateInvitationCredits';
import {
    assertCreatorCanCreateInvitations,
    assertPublicInvitationGeofenceRule,
    INVITATION_ERROR_CODES,
    invitationErrorI18nKey,
} from '../utils/invitationRules';
import { cannotCreateInvitations, isBusinessUser } from '../utils/accountRole';
import { getCallableErrorReason } from '../utils/callableErrorDetails';
import { resolveInviteCategory, isPrivateHostedInvitation } from '../utils/inviteCategory';
import { getHostedInvitationDetailsPath } from '../utils/hostedInvitationRoutes';

/** Read live following[] from Firestore — avoids stale cache / stuck optimistic state. */
async function readLiveFollowing(viewerUid, profileFallback = []) {
    const fallback = asUidArray(profileFallback);
    if (!viewerUid) return fallback;
    try {
        const snap = await getDoc(doc(db, 'users', viewerUid));
        if (snap.exists()) return asUidArray(snap.data()?.following);
    } catch (err) {
        console.warn('[toggleFollow] readLiveFollowing', err?.message || err);
    }
    return fallback;
}

function canTargetAcceptFollows(targetData) {
    if (!targetData || typeof targetData !== 'object') return false;
    const role = String(targetData.role || 'user').toLowerCase();
    if (role === 'business' || role === 'partner' || targetData.isBusiness === true) return false;
    return targetData.privacySettings?.allowFollowing !== false;
}

const InvitationContext = createContext(null);

export const useInvitations = () => useContext(InvitationContext);

const INITIAL_INVITATIONS_LIMIT = 50;

const INVITATION_ERROR_MESSAGES = {
    requestToJoin: 'Failed to send request. Try again.',
    respondToPrivateInvitation: 'Failed to respond. Try again.',
    approveUser: 'Failed to approve. Try again.',
    rejectUser: 'Failed to reject. Try again.',
    cancelRequest: 'Failed to cancel request. Try again.',
    addInvitation: 'Failed to create invitation. Try again.',
    addHostedInvitation: 'Failed to create invitation. Try again.'
};

export const InvitationProvider = ({ children }) => {
    const { currentUser, userProfile: firebaseProfile, updateUserProfile, isGuest } = useAuth();
    const { showToast, showPersistentWarning } = useToast();
    const [invitations, setInvitations] = useState([]);
    const [privateInvitations, setPrivateInvitations] = useState([]);
    const [restaurants, setRestaurants] = useState([]);
    const [loadingInvitations, setLoadingInvitations] = useState(true);
    const [detectedCountry, setDetectedCountry] = useState(null);
    /** Optimistic following[] until Firestore snapshot catches up (toggleFollow must not pre-write). */
    const [optimisticFollowing, setOptimisticFollowing] = useState(null);
    /** Optimistic joinedCommunities[] until Firestore snapshot catches up after join/leave. */
    const [optimisticJoinedCommunities, setOptimisticJoinedCommunities] = useState(null);
    const functions = getFunctions(app, FUNCTIONS_REGION);
    const publishPrivateInvitationDraftCallable = httpsCallable(functions, 'publishPrivateInvitationDraft');
    const getPrivateInvitationSharePreviewCallable = httpsCallable(
        functions,
        'getPrivateInvitationSharePreview'
    );
    const claimPrivateInvitationShareCallable = httpsCallable(functions, 'claimPrivateInvitationShare');
    const ensurePrivateInvitationShareTokenCallable = httpsCallable(
        functions,
        'ensurePrivateInvitationShareToken'
    );
    const publishPublicInvitationCallable = httpsCallable(functions, 'publishPublicInvitation');
    const setCommunityMembershipCallable = httpsCallable(functions, 'setCommunityMembership');
    const listCommunityMembersCallable = httpsCallable(functions, 'listCommunityMembers');
    const createBusinessNotificationCallable = httpsCallable(functions, 'createPartnerNotification');
    const createNotificationCallable = httpsCallable(functions, 'createNotification');
    const createReportCallable = httpsCallable(functions, 'createReport');

    /**
     * Firestore `users/{uid}` often lags Firebase Auth. Draft create must not fail with
     * "Please sign in" while the profile snapshot is still loading.
     */
    const getInvitationCreatorProfile = useCallback(() => {
        if (firebaseProfile) return firebaseProfile;
        const uid = currentUser?.uid || currentUser?.id;
        if (!uid || uid === 'guest' || isGuest) return null;
        return {
            role: currentUser.role || 'user',
            isBusiness: currentUser.isBusiness === true,
            isGuest: false,
            isVirtual: false,
            display_name: currentUser.displayName || currentUser.display_name,
            displayName: currentUser.displayName || currentUser.display_name,
        };
    }, [firebaseProfile, currentUser, isGuest]);

    const fetchPublicInvitations = useCallback(async () => {
        const q = query(
            collection(db, 'invitations'),
            orderBy('createdAt', 'desc'),
            limit(INITIAL_INVITATIONS_LIMIT)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((inv) => inv.adminBlocked !== true);
    }, []);

    // --- 1. Load public invitations once on app entry (no live sync / load-more) ---
    useEffect(() => {
        let cancelled = false;
        const timeout = setTimeout(() => {
            if (!cancelled) setLoadingInvitations(false);
        }, 15000);

        fetchPublicInvitations()
            .then((staticInvites) => {
                if (cancelled) return;
                setInvitations(staticInvites);
                setLoadingInvitations(false);
            })
            .catch((error) => {
                if (cancelled) return;
                console.error('Error loading invitations:', error);
                setLoadingInvitations(false);
            });

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [fetchPublicInvitations]);

    // --- 1b. Sync Private Invitations (separate collection) ---
    useEffect(() => {
        const userId = currentUser?.uid || currentUser?.id;
        if (!userId || userId === 'guest') return;

        let cancelled = false;
        let unsubHost = () => {};
        let unsubInvited = () => {};

        // Wait for Auth so Firestore rules see request.auth.uid (avoids permission-denied races).
        // Omit orderBy here so queries use only auto single-field indexes (composite indexes are
        // easy to forget to deploy — that produced two console errors for many dev/prod setups).
        auth.authStateReady().then(() => {
            if (cancelled) return;

            const sessionUid = auth.currentUser?.uid || userId;
            if (!sessionUid) return;

            const qHost = query(collection(db, 'social_invitations'), where('authorId', '==', sessionUid));
            const qInvitee = query(
                collection(db, 'social_invitations'),
                where('invitedFriends', 'array-contains', sessionUid)
            );

            const mergeResults = (hostDocs, invitedDocs) => {
                const seen = new Set();
                const merged = [];
                [...hostDocs, ...invitedDocs].forEach((d) => {
                    if (!seen.has(d.id)) {
                        seen.add(d.id);
                        merged.push(d);
                    }
                });
                merged.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setPrivateInvitations(merged);
            };

            let hostDocs = [];
            let invitedDocs = [];

            unsubHost = onSnapshot(
                qHost,
                (snap) => {
                    hostDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                    mergeResults(hostDocs, invitedDocs);
                },
                (error) => {
                    console.error('Error syncing hosted private invitations:', error);
                }
            );

            const unsubInvitee = onSnapshot(
                qInvitee,
                (snap) => {
                    invitedDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                    mergeResults(hostDocs, invitedDocs);
                },
                (error) => {
                    console.error('Error syncing invited private invitations:', error);
                }
            );

            unsubInvited = unsubInvitee;
        });

        return () => {
            cancelled = true;
            unsubHost();
            unsubInvited();
        };
    }, [currentUser?.uid]);

    // --- 2. Sync Businesses (directory - visible to everyone including guests) ---
    // Enrich with ratings so directory cards show same rating as profile/dashboard
    const fetchRatingsForBusinessIds = async (ids) => {
        if (!ids.length) return {};
        const reviewsRef = collection(db, 'reviews');
        const BATCH = 10;
        const byDocId = new Map();
        for (let i = 0; i < ids.length; i += BATCH) {
            const chunk = ids.slice(i, i + BATCH);
            const [sp, sf, sr] = await Promise.all([
                getDocs(query(reviewsRef, where('partnerId', 'in', chunk), limit(100))),
                getDocs(query(reviewsRef, where('profileId', 'in', chunk), limit(100))),
                getDocs(query(reviewsRef, where('restaurantId', 'in', chunk), limit(100)))
            ]);
            [sp.docs, sf.docs, sr.docs].flat().forEach(d => byDocId.set(d.id, d.data()));
        }
        const byBusinessId = {};
        ids.forEach(id => {
            const reviews = [...byDocId.values()].filter(
                r => r.partnerId === id || r.profileId === id || r.restaurantId === id
            );
            const count = reviews.length;
            const total = reviews.reduce((s, r) => s + (r.rating || 0), 0);
            byBusinessId[id] = { averageRating: count > 0 ? total / count : 0, reviewCount: count };
        });
        return byBusinessId;
    };

    useEffect(() => {
        const q = query(
            collection(db, 'public_profiles'),
            where('profileType', '==', 'business'),
            where('businessPublic.isPublished', '==', true),
            orderBy('updatedAt', 'desc'),
            limit(200)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const businessList = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                const info = data.businessPublic || {};
                const brandKit = info.brandKit || data.businessInfo?.brandKit || {};
                const latNum = Number(info.lat);
                const lngNum = Number(info.lng);

                businessList.push({
                    id: doc.id,
                    uid: doc.id,
                    ownerId: doc.id,
                    name: data.displayName || 'Business',
                    type: info.businessType || 'Restaurant',
                    isVirtual: data.isVirtual === true,
                    createdBy: data.createdBy || null,
                    sourceCollection: data.sourceCollection || null,
                    _sourceCollection: data.sourceCollection || null,
                    coverImageStoragePath: info.coverImageStoragePath || data.coverImageStoragePath || null,
                    businessInfo: {
                        coverImage: info.coverImage || null,
                        coverImageStoragePath: info.coverImageStoragePath || null,
                    },
                    image:
                        pickSafeDisplayImageUrl(
                            info.coverImage,
                            data.avatarUrl,
                        ) || DEFAULT_BUSINESS_COVER,
                    avatar: data.avatarUrl || '',
                    location: info.city || info.address || '',
                    description: info.description || '',
                    phone: info.phone || '',
                    rating: 5.0,
                    reviews: [],
                    ...info,
                    lat: Number.isFinite(latNum) ? latNum : null,
                    lng: Number.isFinite(lngNum) ? lngNum : null,
                    brandKit,
                    theme: info.theme || brandKit.theme || undefined,
                });
            });

            // Preserve existing ratings when snapshot updates (so we don't flash 0.0)
            setRestaurants(prev => {
                const prevById = new Map((prev || []).map(b => [b.id, b]));
                return businessList.map(b => ({
                    ...b,
                    averageRating: typeof prevById.get(b.id)?.averageRating === 'number' ? prevById.get(b.id).averageRating : 0,
                    reviewCount: typeof prevById.get(b.id)?.reviewCount === 'number' ? prevById.get(b.id).reviewCount : 0
                }));
            });

            const ids = businessList.map(b => b.id);
            fetchRatingsForBusinessIds(ids).then((ratingsById) => {
                setRestaurants(prev => (prev || []).map(b => {
                    const r = ratingsById[b.id];
                    return {
                        ...b,
                        averageRating: typeof r?.averageRating === 'number' ? r.averageRating : 0,
                        reviewCount: typeof r?.reviewCount === 'number' ? r.reviewCount : 0
                    };
                }));
            }).catch(() => { });
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

    const showInvitationRuleToast = (code, fallbackMessage) => {
        const key = invitationErrorI18nKey(code);
        showToast(i18n.t(key, fallbackMessage), 'error');
    };

    const resolveVenueCoordsForPublicInvite = async (newInvite) => {
        let lat = newInvite?.lat ?? null;
        let lng = newInvite?.lng ?? null;
        let countryCode = newInvite?.countryCode ?? null;

        if (newInvite?.restaurantId) {
            const cached = restaurants.find((r) => r.id === newInvite.restaurantId);
            if (cached) {
                if (cached.lat != null && lat == null) lat = cached.lat;
                if (cached.lng != null && lng == null) lng = cached.lng;
                if (cached.countryCode && !countryCode) countryCode = cached.countryCode;
            }
            if (lat == null || lng == null) {
                try {
                    const snap = await getDoc(doc(db, 'public_profiles', newInvite.restaurantId));
                    if (snap.exists()) {
                        const data = snap.data();
                        const info = data?.businessPublic || {};
                        if (info.lat != null && lat == null) lat = Number(info.lat);
                        if (info.lng != null && lng == null) lng = Number(info.lng);
                        if ((info.countryCode || data?.countryCode) && !countryCode) {
                            countryCode = info.countryCode || data.countryCode;
                        }
                    }
                } catch {
                    /* fall through */
                }
            }
        }

        return { lat, lng, countryCode };
    };

    const resolveCreatorGeoForInviteDraft = async () => {
        try {
            const live = await detectLiveUserGps();
            if (!live.success) {
                return {
                    userCity: '',
                    userLat: null,
                    userLng: null,
                    userCountryCode: '',
                    gpsOk: false,
                    gpsError: live.code || 'unavailable',
                };
            }

            return {
                userCity: live.city || '',
                userLat: live.latitude,
                userLng: live.longitude,
                userCountryCode: live.countryCode || '',
                gpsOk: true,
                gpsError: null,
            };
        } catch {
            return {
                userCity: '',
                userLat: null,
                userLng: null,
                userCountryCode: '',
                gpsOk: false,
                gpsError: 'unavailable',
            };
        }
    };

    const addInvitation = async (newInvite) => {
        if (isGuest) {
            return { ok: false, code: INVITATION_ERROR_CODES.GUEST_NOT_ALLOWED, message: 'Guest not allowed' };
        }

        const creatorBlock = assertCreatorCanCreateInvitations(getInvitationCreatorProfile());
        if (creatorBlock) {
            showInvitationRuleToast(creatorBlock.code, creatorBlock.message);
            return creatorBlock;
        }

        try {
            if (!newInvite.title) {
                return { ok: false, code: INVITATION_ERROR_CODES.MISSING_TITLE, message: 'Missing title' };
            }

            const venueGeo = await resolveVenueCoordsForPublicInvite(newInvite);
            const creatorGeo = await resolveCreatorGeoForInviteDraft();
            if (!creatorGeo.gpsOk) {
                const locBlock = {
                    ok: false,
                    code: INVITATION_ERROR_CODES.LOCATION_NOT_DETERMINED,
                    message: 'Your location could not be determined. Enable GPS/location access to create a public invitation.',
                };
                showInvitationRuleToast(locBlock.code, locBlock.message);
                return locBlock;
            }
            const geofenceBlock = assertPublicInvitationGeofenceRule({
                creatorCoords: { lat: creatorGeo.userLat, lng: creatorGeo.userLng },
                venueCoords: { lat: venueGeo.lat, lng: venueGeo.lng },
                creatorCountryCode: creatorGeo.userCountryCode,
                venueCountryCode: venueGeo.countryCode,
            });
            if (geofenceBlock) {
                showInvitationRuleToast(geofenceBlock.code, geofenceBlock.message);
                return geofenceBlock;
            }

            const isBusinessAccount = cannotCreateInvitations(firebaseProfile);
            const coords = getInvitationLatLng(newInvite);
            const inviteData = {
                ...newInvite,
                inviteCategory: 'public',
                userCity: creatorGeo.userCity || null,
                userLat: creatorGeo.userLat ?? null,
                userLng: creatorGeo.userLng ?? null,
                restaurantCity: newInvite.restaurantCity || newInvite.city || null,
                hostId: currentUser.id,
                author: {
                    id: currentUser.id,
                    name: currentUser.name || 'User',
                    avatar: getSafeAvatar(currentUser),
                    isBusiness: isBusinessAccount
                },
                requests: [], joined: [], chat: [],                 meetingStatus: 'planning',
                date: newInvite.date || new Date().toISOString(),
                time: newInvite.time || '20:30',
                archiveAfterAt: computeArchiveAfterFirestoreTimestamp(
                    newInvite.date || new Date().toISOString(),
                    newInvite.time || '20:30',
                    Timestamp
                ),
                privacy: newInvite.privacy || 'public',
                createdAt: serverTimestamp()
            };
            if (coords) {
                inviteData.lat = coords.lat;
                inviteData.lng = coords.lng;
            } else {
                delete inviteData.lat;
                delete inviteData.lng;
            }

            const docRef = await addDoc(collection(db, 'invitations'), inviteData);
            
            // Only notify if it's not a draft
            if (inviteData.status !== 'draft') {
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
            }
            
            return { ok: true, id: docRef.id };
        } catch (err) {
            console.error("Error adding invitation:", err);
            showToast(INVITATION_ERROR_MESSAGES.addInvitation, 'error');
            return { ok: false, code: INVITATION_ERROR_CODES.FIRESTORE_ERROR, message: INVITATION_ERROR_MESSAGES.addInvitation };
        }
    };

    // --- Private Invitation: separate collection ---
    const addHostedInvitation = async (newInvite) => {
        if (isGuest) {
            return { ok: false, code: INVITATION_ERROR_CODES.GUEST_NOT_ALLOWED, message: 'Guest not allowed' };
        }

        const creatorBlock = assertCreatorCanCreateInvitations(getInvitationCreatorProfile());
        if (creatorBlock) {
            showInvitationRuleToast(creatorBlock.code, creatorBlock.message);
            return creatorBlock;
        }

        try {
            if (!newInvite.title) {
                return { ok: false, code: INVITATION_ERROR_CODES.MISSING_TITLE, message: 'Missing title' };
            }

            // Firebase Auth User uses `uid` (not `id`). Never omit authorId or publish will reject the host.
            const creatorUid = currentUser.uid || currentUser.id;
            if (!creatorUid || creatorUid === 'guest') {
                return { ok: false, code: INVITATION_ERROR_CODES.GUEST_NOT_ALLOWED, message: 'Not signed in' };
            }

            // Remove undefined values — Firestore rejects them (e.g. lat/lng when no location selected)
            const sanitize = (obj) => {
                const clean = {};
                Object.entries(obj).forEach(([k, v]) => {
                    if (v !== undefined) clean[k] = v;
                });
                return clean;
            };

            const creatorProfile = getInvitationCreatorProfile();
            const displayName =
                currentUser.displayName ||
                creatorProfile?.display_name ||
                creatorProfile?.displayName ||
                'User';

            let inviteData = sanitize({
                ...newInvite,
                inviteCategory: resolveInviteCategory(newInvite),
                authorId: creatorUid,
                author: {
                    id: creatorUid,
                    name: displayName,
                    avatar: getSafeAvatar(currentUser)
                },
                privacy: 'social',
                createdAt: serverTimestamp()
            });
            const requestedInvitees = Array.isArray(inviteData.invitedFriends) ? inviteData.invitedFriends : [];
            let inviteeIds = requestedInvitees;
            if (inviteeIds.length && isPrivateHostedInvitation(newInvite)) {
                const following = firebaseProfile?.following ?? currentUser?.following ?? [];
                const { allowed: followed, skipped: notFollowed } = filterInviteesFollowedBySender(
                    following,
                    inviteeIds
                );
                if (notFollowed.length) {
                    showToast(
                        i18n.t(
                            'private_invite_follow_required',
                            'Follow members first to send them a private invite.'
                        ),
                        'info'
                    );
                }
                inviteeIds = followed;
            }
            if (inviteeIds.length) {
                const { allowed, skipped } = await filterInviteesWhoAcceptAuthor(creatorUid, inviteeIds);
                inviteData = { ...inviteData, invitedFriends: allowed };
                if (skipped.length) {
                    showToast('Some people could not be invited (they blocked or muted you).', 'info');
                }
                if (allowed.length === 0) {
                    showToast(
                        'No guests could be invited (blocked, muted, or unavailable). Choose someone else.',
                        'error'
                    );
                    return { ok: false, code: INVITATION_ERROR_CODES.FIRESTORE_ERROR, message: 'No invitees' };
                }
            }
            const docRef = await addDoc(collection(db, 'social_invitations'), inviteData);
            return { ok: true, id: docRef.id };
        } catch (err) {
            console.error("Error adding private invitation:", err);
            showToast(INVITATION_ERROR_MESSAGES.addHostedInvitation, 'error');
            return { ok: false, code: INVITATION_ERROR_CODES.FIRESTORE_ERROR, message: INVITATION_ERROR_MESSAGES.addHostedInvitation };
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
        if (currentUser?.role === 'business' || currentUser?.isBusiness) {
            showToast('Business accounts cannot join invitations.', 'error');
            return false;
        }
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

            // System chat broadcast for user joining
            try {
                const userDoc = await getDoc(doc(db, 'users', userId));
                const userData = userDoc.exists() ? userDoc.data() : {};
                const userName = userData.display_name || userData.displayName || userData.name || 'A guest';
                const collectionName = invData.privacy === 'social' ? 'social_invitations' : 'invitations';
                
                await addDoc(collection(db, collectionName, invId, 'messages'), {
                    text: `🎉 ${userName} has been approved to join the invitation!`,
                    senderId: 'system',
                    senderName: 'System',
                    isSystemMessage: true,
                    createdAt: serverTimestamp(),
                    type: 'status_update'
                });
            } catch (chatErr) {
                console.error("Failed to send approval chat message:", chatErr);
            }

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

    // ── Private / dating drafts: Dine Credits (free+paid), same pool as AI; admins bypass. ──

    const canCreateSocialInvitation = (kind = 'social') => {
        if (!currentUser || isGuest) return { canCreate: false, reason: 'guest' };

        if (cannotCreateInvitations(getInvitationCreatorProfile())) {
            return { canCreate: false, reason: 'business' };
        }

        const creatorProfile = getInvitationCreatorProfile();
        const adminLike =
            creatorProfile &&
            ['admin', 'moderator', 'support', 'staff'].includes(String(creatorProfile.role || ''));
        if (adminLike) return { canCreate: true, quota: 'unlimited' };

        const billingKind = kind === 'private' || kind === 'dating' ? 'private' : 'social';
        const cost =
            billingKind === 'private' ? PRIVATE_INVITATION_PUBLISH_CREDITS : SOCIAL_INVITATION_PUBLISH_CREDITS;

        // Critical: while `users/{uid}` is still loading, `getTotalDineCredits(null)` is 0 — the app
        // was treating everyone as broke and sending them to /settings/credits (toast + payment packs UI).
        if (!firebaseProfile) {
            return {
                canCreate: true,
                quota: 'pending',
                cost,
                balance: null,
                profileLoading: true,
                source: 'dine_credits'
            };
        }

        const balance = getTotalDineCredits(firebaseProfile);
        if (balance >= cost) {
            return { canCreate: true, quota: balance, cost, source: 'dine_credits' };
        }
        return { canCreate: false, reason: 'no_credits', cost, balance };
    };

    const getPrivateInvitationSharePreview = useCallback(async (token) => {
        if (!token) return null;
        try {
            const result = await getPrivateInvitationSharePreviewCallable({ token });
            return result?.data || null;
        } catch (error) {
            console.error('getPrivateInvitationSharePreview:', error);
            throw error;
        }
    }, []);

    const claimPrivateInvitationShare = useCallback(
        async (token) => {
            const uid = currentUser?.uid || currentUser?.id;
            if (!token || !currentUser || uid === 'guest') return null;
            try {
                const result = await claimPrivateInvitationShareCallable({ token });
                return result?.data?.invitationId || null;
            } catch (error) {
                console.error('claimPrivateInvitationShare:', error);
                throw error;
            }
        },
        [currentUser?.uid, currentUser?.id]
    );

    const ensurePrivateInvitationShareToken = useCallback(
        async (invitationId) => {
            const uid = currentUser?.uid || currentUser?.id;
            if (!invitationId || !currentUser || uid === 'guest') return null;
            try {
                const result = await ensurePrivateInvitationShareTokenCallable({ invitationId });
                return result?.data?.shareToken || null;
            } catch (error) {
                console.error('ensurePrivateInvitationShareToken:', error);
                throw error;
            }
        },
        [currentUser?.uid, currentUser?.id]
    );

    const publishPrivateInvitationDraft = async (invitationId) => {
        const uid = currentUser?.uid || currentUser?.id;
        if (!invitationId || !currentUser || uid === 'guest') {
            return { success: false, alreadyPublished: false, shareToken: null };
        }
        try {
            const result = await publishPrivateInvitationDraftCallable({ invitationId });
            return {
                success: true,
                alreadyPublished: result?.data?.alreadyPublished === true,
                shareToken: result?.data?.shareToken || null,
            };
        } catch (error) {
            const reason = getCallableErrorReason(error);
            if (reason === INVITATION_ERROR_CODES.BUSINESS_CANNOT_CREATE) {
                showInvitationRuleToast(reason, error?.message);
            } else {
                showToast(error?.message || 'Failed to publish private invitation.', 'error');
            }
            console.error('Error publishing private invitation draft:', error);
            return { success: false, alreadyPublished: false, shareToken: null, code: reason || null };
        }
    };

    const publishPublicInvitationDraft = async (invitationId) => {
        const uid = currentUser?.uid || currentUser?.id;
        if (!invitationId || !currentUser || uid === 'guest') {
            return { success: false, alreadyPublished: false };
        }
        try {
            const result = await publishPublicInvitationCallable({ invitationId });
            return {
                success: true,
                alreadyPublished: result?.data?.alreadyPublished === true
            };
        } catch (error) {
            const reason = getCallableErrorReason(error);
            if (
                reason === INVITATION_ERROR_CODES.BUSINESS_CANNOT_CREATE ||
                reason === INVITATION_ERROR_CODES.PUBLIC_MUST_BE_LOCAL ||
                reason === INVITATION_ERROR_CODES.LOCATION_NOT_DETERMINED
            ) {
                showInvitationRuleToast(reason, error?.message);
            } else {
                showToast(error?.message || i18n.t('failed_publish_invitation', 'Failed to publish invitation'), 'error');
            }
            console.error('Error publishing public invitation draft:', error);
            return { success: false, alreadyPublished: false, code: reason || null };
        }
    };

    const respondToPrivateInvitation = async (invId, status) => {
        const me = auth.currentUser?.uid || currentUser?.uid || currentUser?.id;
        if (!currentUser || me === 'guest') return false;
        if (currentUser?.role === 'business' || currentUser?.isBusiness) {
            showToast('Business accounts cannot respond to invitations.', 'error');
            return false;
        }
        try {
            const invRef = doc(db, 'social_invitations', invId);
            const invDoc = await getDoc(invRef);
            if (!invDoc.exists()) return false;

            const invData = invDoc.data();
            const hostId = invData.authorId || invData.author?.id;
            const responderName =
                firebaseProfile?.display_name ||
                firebaseProfile?.displayName ||
                currentUser.displayName ||
                currentUser.name ||
                'Guest';
            const locale = i18n.language || 'en';
            const isDating = invData.type === 'Private' || String(invData.occasionType || '').toLowerCase() === 'dating';
            const responderGender = normalizeUserGender(firebaseProfile || currentUser);

            let hostGender = 'neutral';
            if (hostId) {
                try {
                    const hostSnap = await getDoc(doc(db, 'users', hostId));
                    if (hostSnap.exists()) {
                        hostGender = normalizeUserGender(hostSnap.data());
                    }
                } catch {
                    /* optional host profile */
                }
            }

            const chatText = buildPrivateInvitationResponseChatMessage({
                status,
                responderGender,
                hostGender,
                invitationTitle: invData.title,
                isDating,
                locale,
            });
            const notifyTitle = buildPrivateInvitationResponseNotificationTitle({
                status,
                isDating,
                locale,
            });

            const postResponseChatMessage = async () => {
                await addDoc(collection(db, 'social_invitations', invId, 'messages'), {
                    text: chatText,
                    senderId: me,
                    senderName: responderName,
                    senderAvatar: getSafeAvatar(firebaseProfile || currentUser),
                    createdAt: serverTimestamp(),
                    type: 'text',
                    isRsvpResponse: true,
                    rsvpStatus: status,
                });
            };

            // Decline: chat while still invited (rules), then persist RSVP
            if (status === 'declined') {
                try {
                    await postResponseChatMessage();
                } catch (chatErr) {
                    console.error('Failed to send decline chat message:', chatErr);
                }
            }

            await updateDoc(invRef, {
                [`rsvps.${me}`]: status,
                updatedAt: serverTimestamp(),
            });

            setPrivateInvitations((prev) =>
                prev.map((inv) =>
                    inv.id === invId
                        ? { ...inv, rsvps: { ...(inv.rsvps || {}), [me]: status } }
                        : inv
                )
            );

            if (status === 'accepted') {
                try {
                    await postResponseChatMessage();
                } catch (chatErr) {
                    console.error('Failed to send accept chat message:', chatErr);
                }

                if (hostId && hostId !== me) {
                    try {
                        const inviteeFollowing =
                            optimisticFollowing ?? firebaseProfile?.following ?? currentUser?.following ?? [];
                        if (!inviteeFollowing.includes(hostId)) {
                            const hostSnap = await getDoc(doc(db, 'users', hostId));
                            if (hostSnap.exists()) {
                                const hostData = hostSnap.data() || {};
                                if (hostData.role !== 'business') {
                                    const followResult = await followUser(me, hostId, {
                                        id: me,
                                        name: responderName,
                                        avatar: getSafeAvatar(firebaseProfile || currentUser),
                                    }, { skipDailyLimit: true });
                                    if (followResult.success) {
                                        const nextFollowing = [...inviteeFollowing, hostId];
                                        setOptimisticFollowing(nextFollowing);
                                        const hostFollowsInvitee = (hostData.following || []).includes(me);
                                        if (hostFollowsInvitee) {
                                            const viewerProfile = { id: me, ...firebaseProfile, ...currentUser };
                                            const targetProfile = { id: hostId, ...hostData };
                                            const connectionComplete = await isConnectionComplete(
                                                me,
                                                hostId,
                                                viewerProfile,
                                                targetProfile,
                                                nextFollowing,
                                                hostData.following || []
                                            );
                                            if (connectionComplete) {
                                                const connectionKind = resolveConnectionKind(
                                                    viewerProfile,
                                                    targetProfile
                                                );
                                                notifyConnectConnectionComplete(hostId, {
                                                    id: me,
                                                    name: responderName,
                                                    avatar: getSafeAvatar(firebaseProfile || currentUser),
                                                }, connectionKind);
                                                notifyConnectConnectionComplete(me, {
                                                    id: hostId,
                                                    name:
                                                        hostData.display_name ||
                                                        hostData.displayName ||
                                                        hostData.name ||
                                                        'Someone',
                                                    avatar: getSafeAvatar(hostData),
                                                }, connectionKind);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } catch (followErr) {
                        console.warn('[respondToPrivateInvitation] invite accept follow-back failed', followErr);
                    }
                }
            }

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
                        title: isArabicLocale(locale) ? '⚠️ تم إلغاء الدعوة' : '⚠️ Invitation Cancelled',
                        message: isArabicLocale(locale)
                            ? `اعتذر جميع المدعوين عن دعوتك «${invData.title || 'الدعوة'}»`
                            : `All invitees declined your private invitation "${invData.title}"`,
                        invitationId: invId,
                        style: 'warning',
                    });
                    setTimeout(async () => { await deleteInvitationAndStorage(invId, 'social_invitations'); }, 5000);
                    addNotification('Cancelled', 'Invitation rejected by all invitees.', 'warning');
                    return true;
                }
            }

            if (hostId && hostId !== me) {
                await addUserNotification({
                    userId: hostId,
                    type: 'social_invitation_response',
                    title: notifyTitle,
                    message: chatText,
                    invitationId: invId,
                    actionUrl: getHostedInvitationDetailsPath({ id: invId, ...invData }),
                    status: status,
                    fromUserId: me,
                    fromUserName: responderName,
                });
            }
            addNotification(
                status === 'accepted' ? 'Accepted!' : 'Declined',
                status === 'accepted'
                    ? (isArabicLocale(locale) ? 'تم إرسال رسالة قبولك إلى المحادثة.' : 'Your acceptance message was sent to the chat.')
                    : (isArabicLocale(locale) ? 'تم إرسال رسالة اعتذارك بلطف.' : 'Your polite decline was sent.'),
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

            if (status === 'completed') {
                maybeAwardBusinessHostingPoints(id, 'invitations').catch(() => { });
            }
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

    const effectiveFollowing =
        optimisticFollowing !== null
            ? asUidArray(optimisticFollowing)
            : asUidArray(firebaseProfile?.following);

    const effectiveJoinedCommunities =
        optimisticJoinedCommunities ??
        firebaseProfile?.joinedCommunities ??
        currentUser?.joinedCommunities ??
        [];

    useEffect(() => {
        if (optimisticFollowing === null) return;
        const serverFollowing = asUidArray(firebaseProfile?.following);
        const opt = asUidArray(optimisticFollowing);
        const sameLength = opt.length === serverFollowing.length;
        const sameMembers =
            sameLength && opt.every((id) => serverFollowing.includes(id));
        if (sameMembers) {
            setOptimisticFollowing(null);
            return;
        }
        // Recover from stale optimistic built before profile snapshot loaded (subset of server).
        const optimisticIsStrictSubset =
            opt.length > 0 &&
            opt.length < serverFollowing.length &&
            opt.every((id) => serverFollowing.includes(id));
        if (optimisticIsStrictSubset) {
            setOptimisticFollowing(null);
        }
    }, [firebaseProfile?.following, optimisticFollowing]);

    useEffect(() => {
        if (optimisticJoinedCommunities === null) return;
        const serverJoined = firebaseProfile?.joinedCommunities ?? currentUser?.joinedCommunities ?? [];
        const sameLength = optimisticJoinedCommunities.length === serverJoined.length;
        const sameMembers =
            sameLength && optimisticJoinedCommunities.every((id) => serverJoined.includes(id));
        if (sameMembers) {
            setOptimisticJoinedCommunities(null);
        }
    }, [firebaseProfile?.joinedCommunities, currentUser?.joinedCommunities, optimisticJoinedCommunities]);

    const patchJoinedCommunitiesOptimistic = useCallback((partnerId, shouldBeJoined) => {
        if (!partnerId) return;
        setOptimisticJoinedCommunities((prev) => {
            const base = prev ?? firebaseProfile?.joinedCommunities ?? currentUser?.joinedCommunities ?? [];
            const has = base.includes(partnerId);
            if (shouldBeJoined && !has) return [...base, partnerId];
            if (!shouldBeJoined && has) return base.filter((id) => id !== partnerId);
            return base;
        });
    }, [firebaseProfile?.joinedCommunities, currentUser?.joinedCommunities]);

    const toggleFollow = async (userId) => {
        const viewerUid = currentUser?.uid || currentUser?.id;
        if (!userId || !viewerUid || userId === viewerUid) return { ok: false };

        if (isGuest || !auth.currentUser) {
            showToast(i18n.t('sign_in_required', 'Please sign in first.'), 'info');
            return { ok: false, reason: 'auth' };
        }

        if (isBusinessUser(firebaseProfile)) {
            showToast('Business accounts cannot follow other accounts.', 'error');
            return { ok: false };
        }

        const liveFollowing = await readLiveFollowing(viewerUid, firebaseProfile?.following);
        const isCurrentlyFollowing = liveFollowing.includes(userId);

        const nextFollowing = isCurrentlyFollowing
            ? liveFollowing.filter((id) => id !== userId)
            : [...liveFollowing, userId];
        setOptimisticFollowing(nextFollowing);

        try {
            if (isCurrentlyFollowing) {
                const result = await unfollowUser(viewerUid, userId);
                if (!result.success) {
                    setOptimisticFollowing(null);
                    showToast(
                        i18n.t('discovery_follow_failed', 'Could not follow. Try again.'),
                        'error'
                    );
                    return { ok: false };
                }
                return { ok: true };
            }

            const targetUserDoc = await getDoc(doc(db, 'users', userId));
            if (!targetUserDoc.exists()) {
                setOptimisticFollowing(null);
                showToast(
                    i18n.t('follow_target_not_found', 'This account cannot be followed right now.'),
                    'error'
                );
                return { ok: false };
            }
            const targetData = targetUserDoc.data() || {};
            if (!canTargetAcceptFollows(targetData)) {
                setOptimisticFollowing(null);
                if ((targetData.role || 'user') === 'business') {
                    showToast(
                        i18n.t('follow_business_not_allowed', 'Business accounts cannot be followed.'),
                        'info'
                    );
                } else {
                    showToast(
                        i18n.t('follow_not_allowed_privacy', 'This member is not accepting new followers.'),
                        'info'
                    );
                }
                return { ok: false, reason: 'privacy' };
            }

            const targetAlreadyFollowsViewer = (targetData.following || []).includes(viewerUid);

            const result = await followUser(
                viewerUid,
                userId,
                {
                    id: viewerUid,
                    name: firebaseProfile?.display_name || currentUser.displayName,
                    avatar: getSafeAvatar({ ...currentUser, ...firebaseProfile })
                },
                { skipAlreadyCheck: true }
            );
            if (!result.success) {
                setOptimisticFollowing(null);
                if (result.reason === 'cooldown' || result.message === 'cooldown') {
                    showFollowCooldownWarning(
                        showPersistentWarning,
                        i18n,
                        result.cancelledAtMs,
                        result.retryAtMs
                    );
                    return { ok: false, reason: 'cooldown', ...result };
                }
                if (result.reason === 'privacy' || result.reason === 'target_business') {
                    showToast(
                        i18n.t('follow_not_allowed_privacy', 'This member is not accepting new followers.'),
                        'info'
                    );
                    return { ok: false, reason: result.reason };
                }
                if (result.reason === 'viewer_not_found') {
                    showToast(
                        i18n.t('follow_viewer_profile_missing', 'Complete your profile before following others.'),
                        'error'
                    );
                    return { ok: false, reason: result.reason };
                }
                showToast(
                    i18n.t('discovery_follow_failed', 'Could not follow. Try again.'),
                    'error'
                );
                return { ok: false, reason: result.reason || result.message };
            }

            const viewerProfile = { id: viewerUid, ...firebaseProfile, ...currentUser };
            const targetProfile = { id: userId, ...targetData };
            const connectionComplete = await isConnectionComplete(
                viewerUid,
                userId,
                viewerProfile,
                targetProfile,
                nextFollowing,
                targetData.following || []
            );

            let connectionKind = null;
            if (connectionComplete) {
                connectionKind = resolveConnectionKind(viewerProfile, targetProfile);
                const viewerPayload = {
                    id: viewerUid,
                    name: firebaseProfile?.display_name || currentUser.displayName || 'Someone',
                    avatar: getSafeAvatar({ ...currentUser, ...firebaseProfile }),
                };
                const targetPayload = {
                    id: userId,
                    name: targetData.display_name || targetData.displayName || targetData.name || 'Someone',
                    avatar: getSafeAvatar(targetData),
                };
                notifyConnectConnectionComplete(userId, viewerPayload, connectionKind);
                notifyConnectConnectionComplete(viewerUid, targetPayload, connectionKind);
            }

            return {
                ok: true,
                mutualFollow: targetAlreadyFollowsViewer,
                connectionComplete,
                connectionKind,
            };
        } catch (error) {
            setOptimisticFollowing(null);
            console.error('Error in toggleFollow:', error);
            showToast(
                i18n.t('discovery_follow_failed', 'Could not follow. Try again.'),
                'error'
            );
            return { ok: false };
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
        const userId = currentUser.uid || currentUser.id;
        if (!userId) return false;
        if (effectiveJoinedCommunities.includes(partnerId)) return true;

        patchJoinedCommunitiesOptimistic(partnerId, true);
        try {
            await setCommunityMembershipCallable({ partnerId, action: 'join' });
            void addUserNotification({
                userId: partnerId,
                type: 'new_community_member',
                title: '🎉 New Community Member!',
                message: `${currentUser.name || currentUser.displayName || 'Someone'} has joined your community.`,
                senderName: currentUser.name || currentUser.displayName || 'Someone',
                senderAvatar: getSafeAvatar(currentUser),
            });
            addNotification('🎉 Success!', 'You have joined the community successfully.', 'success');
            return true;
        } catch (error) {
            patchJoinedCommunitiesOptimistic(partnerId, false);
            console.error('Error joining community:', error);
            const msg = String(error?.message || '');
            if (msg.includes('blocked') || error?.code === 'functions/permission-denied') {
                addNotification('🚫', 'You are blocked from joining this community.', 'error');
            }
            return false;
        }
    };

    const leaveCommunity = async (partnerId) => {
        if (!partnerId || !currentUser) return false;
        const userId = currentUser.uid || currentUser.id;
        if (!userId) return false;
        if (!effectiveJoinedCommunities.includes(partnerId)) return true;

        patchJoinedCommunitiesOptimistic(partnerId, false);
        try {
            await setCommunityMembershipCallable({ partnerId, action: 'leave' });
            addNotification('👋 Left', 'You have left the community.', 'info');
            return true;
        } catch (error) {
            patchJoinedCommunitiesOptimistic(partnerId, true);
            console.error('Error leaving community:', error);
            return false;
        }
    };

    const toggleCommunity = async (partnerId) => {
        if (!partnerId || !currentUser) return false;
        const isJoined = effectiveJoinedCommunities.includes(partnerId);
        if (isJoined) return await leaveCommunity(partnerId);
        return await joinCommunity(partnerId);
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
                members: Array.isArray(data.members) ? data.members : [],
                blockedMembers: Array.isArray(data.blockedMembers) ? data.blockedMembers : []
            };
        } catch (error) {
            console.error('Error loading community members:', error);
            return { memberCount: 0, members: [], blockedMembers: [] };
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

    const deleteInvitation = async (invId, isHosted = false) => {
        if (!invId || !currentUser) return false;
        try {
            const collName = isHosted ? 'social_invitations' : 'invitations';
            // Let Firestore rules enforce authorization; do not trust client-side admin fields.
            try {
                const primaryDeleted = await deleteInvitationAndStorage(invId, collName);
                if (primaryDeleted) return true;
            } catch (error) {
                console.warn(`Primary delete failed for ${collName}/${invId}:`, error?.message || error);
            }

            const altColl = isPrivate ? 'invitations' : 'social_invitations';
            const fallbackDeleted = await deleteInvitationAndStorage(invId, altColl);
            return !!fallbackDeleted;
        } catch (error) { console.error('Error deleting invitation:', error); return false; }
    };

    const invitationsFiltered = React.useMemo(() => {
        const blocked = new Set(asUidArray(firebaseProfile?.blockedUserIds));
        if (blocked.size === 0) return invitations;
        return invitations.filter((inv) => {
            if (inv.adminBlocked === true) return false;
            const aid = inv.author?.id;
            if (!aid) return true;
            return !blocked.has(aid);
        });
    }, [invitations, firebaseProfile?.blockedUserIds]);

    const privateInvitationsFiltered = React.useMemo(() => {
        const blocked = new Set(asUidArray(firebaseProfile?.blockedUserIds));
        const muted = new Set(asUidArray(firebaseProfile?.mutedUserIds));
        if (blocked.size === 0 && muted.size === 0) return privateInvitations;
        return privateInvitations.filter((inv) => {
            const aid = inv.authorId || inv.author?.id;
            if (!aid) return true;
            if (blocked.has(aid)) return false;
            if (muted.has(aid)) return false;
            return true;
        });
    }, [privateInvitations, firebaseProfile?.blockedUserIds, firebaseProfile?.mutedUserIds]);

    const extendedCurrentUser = useMemo(() => {
        if (!currentUser) return null;
        return { ...currentUser, ...firebaseProfile, following: effectiveFollowing, joinedCommunities: effectiveJoinedCommunities };
    }, [currentUser, firebaseProfile, effectiveFollowing, effectiveJoinedCommunities]);

    return (
        <InvitationContext.Provider value={{
            invitations: invitationsFiltered, privateInvitations: privateInvitationsFiltered, restaurants, currentUser: extendedCurrentUser, loadingInvitations,
            addInvitation, addHostedInvitation, requestToJoin, cancelRequest,
            approveUser, rejectUser, respondToPrivateInvitation, canCreateSocialInvitation, publishPrivateInvitationDraft, publishPublicInvitationDraft,
            getPrivateInvitationSharePreview, claimPrivateInvitationShare, ensurePrivateInvitationShareToken,
            sendChatMessage, updateMeetingStatus,
            updateInvitationTime, approveNewTime, rejectNewTime,
            notifications, updateProfile, updateRestaurant, markAllAsRead, addNotification, deleteInvitation,
            toggleFollow, getFollowingInvitations, submitRating, submitRestaurantRating, joinCommunity, leaveCommunity, toggleCommunity,
            canEditRestaurant, getCommunityMembers,
            allUsers, reports, banUser, resolveReport, sendSystemMessage, addReport, submitReport
        }}>
            {children}
        </InvitationContext.Provider>
    );
};
