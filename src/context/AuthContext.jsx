import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useToast } from './ToastContext';
import { getAuthErrorMessage } from '../utils/errorMessages';
import { isBusinessUser, isAffiliateAgent, cannotCreateInvitations, hasBusinessSessionHint } from '../utils/accountRole';
import {
    mergeConsumerProfiles,
    isConsumerProfileComplete,
} from '../utils/consumerProfileComplete';
import { normalizeUserProfile as normalizeProfile } from '../utils/userProfileNormalize';
import { mergeProfilePreserveFavoritePlaces } from '../utils/favoritePlacesUtils';
import { mergeProfileSnapshot } from '../utils/profileGallery';
import { DEFAULT_ACCESS_PLATFORM } from '../constants/userProfileSchema';
import { peekPendingReferralCode, clearPendingReferralCode } from '../utils/pendingReferral';
import { clearInboxClosedInvitationIds } from '../utils/invitationInboxSession';
import { clearInviteLandingSession } from '../utils/inviteLandingSession';

/** Keeps Layout/HomeRouter treating the session as business when userProfile is briefly null (Firestore/auth race). */
function syncBusinessNavHint(profile, uid) {
    try {
        if (profile == null && uid == null) {
            sessionStorage.removeItem('dineb_biz_uid');
            return;
        }
        if (profile && uid && isBusinessUser(profile)) {
            sessionStorage.setItem('dineb_biz_uid', uid);
        }
        // Never clear an active business-portal hint while profile is loading or markers are partial —
        // signOut() clears explicitly via syncBusinessNavHint(null, null).
    } catch { /* ignore */ }
}
import { sendPasswordResetViaResend } from '../services/passwordResetEmailService';
import { sendVerificationEmailResend } from '../services/verificationEmailService';
import { isEmailRegisteredAsAffiliate, isEmailRegisteredAsBusiness } from '../utils/authEmailConflict';
import { assertProfileMatchesPortal, AUTH_PORTAL, accountKindFromProfileData } from '../utils/authPortalGate';
import { dismissFacebookSdkOverlay } from '../utils/facebookSdkCleanup';
import {
    clearFacebookIosLoginPending,
    completeFacebookIosRedirectReturn,
    peekFacebookIosLoginPending,
    shouldUseFacebookIosSdk,
    startFacebookIosRedirectLogin,
} from '../utils/facebookIosSignIn';
import { firebaseOAuthPopupOrRedirect } from '../utils/firebaseOAuthSignIn';
import { resolveAppleDisplayName } from '../utils/appleAuth';
import {
    clearGuestModeForSignIn,
    clearOAuthRedirectPending,
    clearPostLogoutRedirect,
    hasFirebaseAuthReturnInUrl,
    markOAuthRedirectComplete,
    markPostLogoutRedirect,
    peekOAuthRedirectPending,
    peekOAuthRedirectProvider,
    stashOAuthRedirectError,
    stripFirebaseAuthParamsFromUrl,
} from '../utils/localDevAuth';
import {
    isKnownOAuthProviderId,
    oauthProviderIdToAuthProvider,
    resolveRedirectProviderId,
} from '../utils/oauthRedirectFinish';
import { createGoogleAuthProvider } from '../utils/googleAuthProvider';
import { getFirebaseRedirectResultOnce, resetFirebaseRedirectBootstrap } from '../firebase/authBootstrap';
import { getFirebaseOAuthHandlerUrl } from '../firebase/config';
import { needsOAuthRedirectProfileFinish, shouldRunOAuthRedirectBootstrap } from '../utils/oauthRedirectState';
import { adminSecurityService } from '../services/adminSecurityService';
import {
    auth,
    db
} from '../firebase/config';
import {
    OAuthProvider,
    signInWithCredential,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    FacebookAuthProvider,
    TwitterAuthProvider,
    updateProfile as updateAuthProfile,
    EmailAuthProvider,
    reauthenticateWithCredential,
    reauthenticateWithPopup
} from 'firebase/auth';

// Detect in-app browsers (Facebook, Instagram, TikTok, WeChat, etc.)
// These browsers sandbox sessionStorage and block OAuth popups/redirects.
const isInAppBrowser = () => {
    const ua = navigator.userAgent || '';
    return (
        /FBAN|FBAV|FB_IAB|FB4A|FBBV/i.test(ua) ||   // Facebook
        /Instagram/i.test(ua) ||                        // Instagram
        /TikTok|musical_ly/i.test(ua) ||               // TikTok
        /MicroMessenger/i.test(ua) ||                   // WeChat
        /Twitter/i.test(ua) ||                          // Twitter
        /Snapchat/i.test(ua) ||                         // Snapchat
        /Line\//i.test(ua)                              // LINE
    );
};

// Try to open the current URL in an external browser.
// On Android: uses an intent URI to launch Chrome.
// On iOS: returns false — caller must show instructions to the user.
const openInExternalBrowser = () => {
    const url = window.location.href;
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
        // intent:// URI forces Chrome on Android
        const intentUrl = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
        window.location.href = intentUrl;
        return true;
    }
    // iOS — can't programmatically force Safari easily; caller should show instructions
    return false;
};

import { fetchIpLocation, reverseGeocode } from '../utils/locationUtils';
import {
    unlinkDeviceTokenFromUser,
    isIosDevice,
    runPushBootstrap,
} from '../services/notificationService';
import { resetImageUploadProgress } from '../services/imageUploadProgressStore';

import {
    doc,
    setDoc,
    getDoc,
    getDocFromServer,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    onSnapshot,
    collection,
} from 'firebase/firestore';

const AuthContext = createContext();

/**
 * Firebase `User` must not be spread into context: getters like `email` often do not copy,
 * which breaks admin routing (`isAdminIdentity`) and verification helpers that read `email` / `providerData`.
 */
function toSessionAuthUser(user) {
    if (!user) return null;
    const pd = user.providerData;
    const providerData = [];
    if (pd && typeof pd.length === 'number') {
        for (let i = 0; i < pd.length; i++) {
            const p = pd[i];
            if (p) {
                providerData.push({
                    providerId: p.providerId,
                    uid: p.uid,
                    displayName: p.displayName,
                    email: p.email,
                    phoneNumber: p.phoneNumber,
                    photoURL: p.photoURL,
                });
            }
        }
    }
    return {
        uid: user.uid,
        id: user.uid,
        email: user.email ?? null,
        emailVerified: user.emailVerified === true,
        displayName: user.displayName ?? null,
        photoURL: user.photoURL ?? null,
        phoneNumber: user.phoneNumber ?? null,
        providerData,
        name: user.displayName ?? null,
        avatar: user.photoURL ?? null,
    };
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    /** True after users/{uid} is read from server (or cache fallback when server unreachable). */
    const [profileServerSynced, setProfileServerSynced] = useState(false);
    const [isGuest, setIsGuest] = useState(false);
    const nominatimFailed = useRef(false);
    const isDeletingAccountRef = useRef(false);
    const oauthRedirectHandledRef = useRef(new Set());
    /** Avoid setLoading(true) on duplicate onAuthStateChanged for the same uid (unmounts Layout /admin). */
    const lastAuthUidRef = useRef(null);
    /** After a server snapshot, ignore stale persisted-cache snapshots that would re-open onboarding. */
    const profileServerSyncedRef = useRef(false);
    /** Prevents profile listener from wiping sync after signInWithEmail already bootstrapped this uid. */
    const lastBootstrappedUidRef = useRef(null);
    const isSigningOutRef = useRef(false);
    const { showToast } = useToast();

    const markProfileSynced = (uid) => {
        profileServerSyncedRef.current = true;
        if (uid) lastBootstrappedUidRef.current = uid;
        setProfileServerSynced(true);
        setLoading(false);
        if (uid && auth.currentUser?.uid === uid) {
            void runPushBootstrap(uid);
        }
    };

    const resetSignedInSessionState = () => {
        profileServerSyncedRef.current = false;
        lastBootstrappedUidRef.current = null;
        setProfileServerSynced(false);
        setUserProfile(null);
        setIsGuest(false);
        setLoading(false);
        syncBusinessNavHint(null, null);
    };

    const clearLegacyConsumerEntryCache = (uid) => {
        if (!uid) return;
        try {
            sessionStorage.removeItem(`dineb_consumer_entry_ok_${uid}`);
        } catch {
            /* ignore */
        }
    };

    // Guest profile template
    const guestProfile = {
        uid: 'guest',
        id: 'guest',
        display_name: 'Guest', // Will be translated in components
        email: '',
        photo_url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect fill="%238b5cf6" width="150" height="150"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="60" fill="white"%3E👤%3C/text%3E%3C/svg%3E',
        photoURL: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect fill="%238b5cf6" width="150" height="150"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="60" fill="white"%3E👤%3C/text%3E%3C/svg%3E',
        role: 'guest',
        isGuest: true,
        following: [],
        followersCount: 0,
        reputation: 0,
        shortDescription: ''
    };

    // Listen to auth state changes
    useEffect(() => {

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (isSigningOutRef.current) return;

            const nextUid = user?.uid ?? null;
            const prevUid = lastAuthUidRef.current;
            lastAuthUidRef.current = nextUid;

            setCurrentUser(user);

            if (user) {
                clearPostLogoutRedirect();
                setIsGuest(false);
                // Guest mode leaves a synthetic userProfile; if the user signs in, we must not route
                // (e.g. HomeRouter) using that guest profile while Firestore is still loading.
                let clearedGuestProfile = false;
                setUserProfile((prev) => {
                    if (prev?.isGuest || prev?.role === 'guest') {
                        clearedGuestProfile = true;
                        return null;
                    }
                    return prev;
                });
                if (clearedGuestProfile) {
                    try {
                        localStorage.removeItem('guestMode');
                    } catch { /* ignore */ }
                }
                // Always wait for Firestore profile (or fail-safe timeout) after a real session change.
                // Skip setLoading(true) when Firebase re-emits the same signed-in user — that was blanking
                // the whole Layout (including /admin) and caused visible route flicker.
                const sameSignedInUser = prevUid === nextUid && nextUid != null;
                if (!sameSignedInUser) {
                    setLoading(true);
                    profileServerSyncedRef.current = false;
                    lastBootstrappedUidRef.current = null;
                    setProfileServerSynced(false);
                }
            } else {
                if (hasFirebaseAuthReturnInUrl() || shouldRunOAuthRedirectBootstrap()) {
                    clearGuestModeForSignIn();
                    setIsGuest(false);
                    setUserProfile(null);
                    setLoading(false);
                    return;
                }
                lastAuthUidRef.current = null;
                profileServerSyncedRef.current = false;
                setProfileServerSynced(false);
                const guestMode = localStorage.getItem('guestMode') === 'true';
                if (guestMode) {
                    setUserProfile(guestProfile);
                    setIsGuest(true);
                } else {
                    setUserProfile(null);
                    setIsGuest(false);
                }
                syncBusinessNavHint(null, null);
                setLoading(false);
            }
        });

        return unsubscribe;
    }, []);

    // Mirror Firebase Auth email verification onto users/{uid} so Cloud Functions can gate public_profiles.
    useEffect(() => {
        if (!currentUser || isGuest) return;
        (async () => {
            try {
                const userRef = doc(db, 'users', currentUser.uid);
                const existing = await getDoc(userRef);
                if (!existing.exists()) {
                    // Never create a bare consumer stub — business signup writes registrationIntent first.
                    return;
                }
                await setDoc(
                    userRef,
                    {
                        emailVerified: currentUser.emailVerified === true,
                        authEmail: currentUser.email || null,
                    },
                    { merge: true }
                );
            } catch (e) {
                console.warn('Auth email flags sync skipped:', e?.message || e);
            }
        })();
    }, [currentUser?.uid, currentUser?.emailVerified, currentUser?.email, isGuest]);

    // Real-time Profile Listener — depend on uid only. Firebase User object identity can change on token
    // refresh; re-subscribing on [currentUser] caused a race where profile/user flashed null and routes
    // fell through to HomeRouter → /posts-feed while on /business/:id.
    useEffect(() => {
        const uid = currentUser?.uid;
        if (!uid) {
            profileServerSyncedRef.current = false;
            lastBootstrappedUidRef.current = null;
            setProfileServerSynced(false);
            return;
        }

        const alreadyBootstrapped =
            lastBootstrappedUidRef.current === uid && profileServerSyncedRef.current;
        if (!alreadyBootstrapped) {
            profileServerSyncedRef.current = false;
            setProfileServerSynced(false);
        }
        const userRef = doc(db, 'users', uid);
        let cancelled = false;

        const applyProfileDoc = (snap) => {
            if (!snap.exists()) {
                if (!isDeletingAccountRef.current) {
                    setUserProfile(null);
                }
                return;
            }
            const normalized = normalizeProfile({
                id: snap.id,
                uid: snap.id,
                ...snap.data(),
            });
            syncBusinessNavHint(normalized, snap.id);
            setUserProfile((prev) => mergeConsumerProfiles(prev, normalized));
        };

        const applySnapshotProfile = (normalized, docId, { fromCache = false } = {}) => {
            syncBusinessNavHint(normalized, docId);
            setUserProfile((prev) => {
                const next = mergeConsumerProfiles(prev, normalized);
                let merged = mergeProfilePreserveFavoritePlaces(prev, mergeProfileSnapshot(prev, next));
                if (fromCache) {
                    merged = mergeProfileSnapshot(merged, prev);
                }
                return merged;
            });
        };

        const finishBootstrap = () => {
            if (cancelled || profileServerSyncedRef.current) return;
            markProfileSynced(uid);
        };

        const safetyTimer = setTimeout(() => {
            if (cancelled || profileServerSyncedRef.current) return;
            if (needsOAuthRedirectProfileFinish()) return;
            finishBootstrap();
        }, 25000);

        (async () => {
            if (alreadyBootstrapped) return;
            try {
                const snap = await getDocFromServer(userRef);
                if (cancelled) return;
                applyProfileDoc(snap);
                if (snap.exists()) {
                    finishBootstrap();
                }
            } catch (e) {
                console.warn('Profile getDocFromServer:', e?.message || e);
                if (cancelled) return;
                try {
                    const snap = await getDoc(userRef);
                    if (cancelled) return;
                    applyProfileDoc(snap);
                    if (snap.exists()) {
                        finishBootstrap();
                    }
                } catch (fallbackErr) {
                    console.warn('Profile getDoc fallback:', fallbackErr?.message || fallbackErr);
                    if (!needsOAuthRedirectProfileFinish()) {
                        finishBootstrap();
                    }
                }
            }
        })();

        const unsubscribeSnapshot = onSnapshot(
            userRef,
            (docSnap) => {
                const fromCache = docSnap.metadata.fromCache;
                if (docSnap.exists()) {
                    const normalized = normalizeProfile({
                        id: docSnap.id,
                        uid: docSnap.id,
                        ...docSnap.data(),
                    });
                    applySnapshotProfile(normalized, docSnap.id, { fromCache });
                } else if (!isDeletingAccountRef.current) {
                    setUserProfile(null);
                }

                if (!fromCache && docSnap.exists()) {
                    finishBootstrap();
                }
            },
            (error) => {
                console.error('Profile Error:', error);
                if (!needsOAuthRedirectProfileFinish()) {
                    finishBootstrap();
                }
            }
        );

        return () => {
            cancelled = true;
            clearTimeout(safetyTimer);
            unsubscribeSnapshot();
        };
    }, [currentUser?.uid]);

    // Update lastSeen and location
    useEffect(() => {
        if (!currentUser || isGuest) return;
        const syncMeta = async () => {
            try {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    lastSeen: serverTimestamp()
                });
                trackUserLocation();
            } catch (e) { }
        };
        syncMeta();
        const interval = setInterval(syncMeta, 5 * 60 * 1000); // 5 min
        return () => clearInterval(interval);
        // Firebase User object identity changes on token refresh; depending on [currentUser] re-ran this
        // effect and wrote lastSeen repeatedly — same doc BusinessProfile listens to → render/snapshot storm.
    }, [currentUser?.uid, isGuest]);

    const trackUserLocation = () => {
        if (!currentUser || isGuest) return;
        if (!navigator.geolocation) {
            handleIpFallback();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                try {
                    // Use BigDataCloud directly — reliable, no CORS issues, works on production
                    const response = await fetch(
                        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
                    );
                    if (!response.ok) throw new Error('BigDataCloud failed');
                    const d = await response.json();

                    const { pickCityFromReverseGeocode } = await import('../utils/locationUtils');
                    const city = pickCityFromReverseGeocode(d);
                    const country = d.countryName || '';
                    const countryCode = d.countryCode || '';
                    const fullLocation = [city, d.principalSubdivision, country].filter(Boolean).join(', ');

                    if (!city) {
                        await handleIpFallback();
                        return;
                    }

                    // Skip update if nothing has changed (within ~100m)
                    if (userProfile?.city === city &&
                        Math.abs((userProfile?.coordinates?.lat || 0) - latitude) < 0.001) {
                        return;
                    }

                    const userRef = doc(db, 'users', currentUser.uid);
                    await updateDoc(userRef, {
                        location: fullLocation,
                        city,
                        country,
                        countryCode,
                        coordinates: { lat: latitude, lng: longitude },
                        lastLocationUpdate: serverTimestamp(),
                        locationSource: 'gps'
                    });

                    setUserProfile(prev => ({
                        ...prev,
                        location: fullLocation,
                        city,
                        country,
                        countryCode,
                        coordinates: { lat: latitude, lng: longitude }
                    }));

                } catch (error) {
                    console.warn('⚠️ BigDataCloud reverse geocode failed, trying IP fallback:', error.message);
                    await handleIpFallback();
                }
            },
            async () => {
                // GPS permission denied → IP fallback
                await handleIpFallback();
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
        );
    };

    const handleIpFallback = async () => {
        try {
            const data = await fetchIpLocation();
            if (data.success) {
                const city = data.city || '';
                const country = data.country || '';
                const fullLocation = city && country ? `${city}, ${country}` : (city || country || '');

                const userRef = doc(db, 'users', currentUser.uid);
                await updateDoc(userRef, {
                    location: fullLocation,
                    city,
                    country,
                    countryCode: data.country_code,
                    coordinates: { lat: data.latitude, lng: data.longitude },
                    lastLocationUpdate: serverTimestamp(),
                    locationSource: 'ip'
                });

                setUserProfile(prev => ({
                    ...prev,
                    location: fullLocation,
                    city,
                    country,
                    countryCode: data.country_code,
                    coordinates: { lat: data.latitude, lng: data.longitude }
                }));
            }
        } catch (ipError) { }
    };

    // Fetch user profile from Firestore
    const fetchUserProfile = async (userId, { preferServer = false } = {}) => {
        try {
            const userRef = doc(db, 'users', userId);
            let userDoc;
            if (preferServer) {
                try {
                    userDoc = await getDocFromServer(userRef);
                } catch (serverErr) {
                    console.warn('Profile getDocFromServer (fetchUserProfile):', serverErr?.message || serverErr);
                    userDoc = await getDoc(userRef);
                }
            } else {
                userDoc = await getDoc(userRef);
            }
            if (userDoc.exists()) {
                const data = userDoc.data();
                const normalized = normalizeProfile({
                    id: userId,
                    uid: userId,
                    ...data
                });
                syncBusinessNavHint(normalized, userId);
                setUserProfile((prev) => {
                    const next = mergeConsumerProfiles(prev, normalized);
                    return mergeProfilePreserveFavoritePlaces(prev, mergeProfileSnapshot(prev, next));
                });
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
            showToast(getAuthErrorMessage(error) || 'Failed to load profile.', 'error');
        }
    };

    /** After popup OAuth, load profile from server and end auth bootstrap (avoids race with profile listener). */
    const finalizePopupOAuthSession = async (uid) => {
        if (!uid) return;
        await fetchUserProfile(uid, { preferServer: true });
        markProfileSynced(uid);
    };

    const signInWithEmail = async (email, password, options = {}) => {
        const portal = options.portal === AUTH_PORTAL.BUSINESS ? AUTH_PORTAL.BUSINESS : null;
        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            const uid = result.user.uid;

            if (portal === AUTH_PORTAL.BUSINESS) {
                try {
                    sessionStorage.setItem('dineb_biz_uid', uid);
                } catch {
                    /* ignore */
                }
            }

            const userRef = doc(db, 'users', uid);
            let userDoc = await getDoc(userRef);
            if (!userDoc.exists()) {
                for (let i = 0; i < 6 && !userDoc.exists(); i += 1) {
                    await new Promise((r) => setTimeout(r, 180));
                    userDoc = await getDoc(userRef);
                }
            }
            if (userDoc.exists()) {
                const raw = userDoc.data();
                if (portal === AUTH_PORTAL.BUSINESS) {
                    if (accountKindFromProfileData(raw) === AUTH_PORTAL.AFFILIATE) {
                        try {
                            await firebaseSignOut(auth);
                        } catch {
                            /* ignore */
                        }
                        assertProfileMatchesPortal(raw, AUTH_PORTAL.BUSINESS);
                    }
                } else {
                    try {
                        assertProfileMatchesPortal(raw, AUTH_PORTAL.PERSONAL);
                    } catch (portalErr) {
                        try {
                            await firebaseSignOut(auth);
                        } catch {
                            /* ignore */
                        }
                        throw portalErr;
                    }
                }
                const normalized = normalizeProfile({
                    id: uid,
                    uid,
                    ...raw,
                });
                syncBusinessNavHint(normalized, uid);
                setUserProfile((prev) => {
                    const next = mergeConsumerProfiles(prev, normalized);
                    return mergeProfilePreserveFavoritePlaces(prev, mergeProfileSnapshot(prev, next));
                });
            } else if (portal === AUTH_PORTAL.BUSINESS) {
                try {
                    await firebaseSignOut(auth);
                } catch {
                    /* ignore */
                }
                const err = new Error('Business profile not found. Finish signup at /signup/business.');
                err.code = 'auth/user-not-found';
                throw err;
            } else {
                const err = new Error('Profile missing');
                err.code = 'auth/user-not-found';
                throw err;
            }
            if (portal === AUTH_PORTAL.BUSINESS) {
                await fetchUserProfile(uid, { preferServer: true });
                try {
                    sessionStorage.setItem('dineb_biz_uid', uid);
                } catch {
                    /* ignore */
                }
            }
            markProfileSynced(uid);
            return result.user;
        } catch (error) {
            console.error('Error signing in with email:', error);
            throw error;
        }
    };

    /** Consumer sign-up with email/password — creates Firebase user + Firestore profile; sends verification email. */
    const registerWithEmail = async (email, password) => {
        const em = String(email || '').trim().toLowerCase();
        if (!em) {
            const e = new Error('missing-email');
            e.code = 'auth/missing-email';
            throw e;
        }
        if (await isEmailRegisteredAsBusiness(em)) {
            const e = new Error('business');
            e.code = 'auth/business-email-in-use';
            throw e;
        }
        if (await isEmailRegisteredAsAffiliate(em)) {
            const e = new Error('affiliate');
            e.code = 'auth/affiliate-email-in-use';
            throw e;
        }
        const result = await createUserWithEmailAndPassword(auth, em, password);
        try {
            await createUserProfile(result.user.uid, {
                display_name: result.user.displayName || '',
                email: result.user.email,
                photo_url: result.user.photoURL || '',
                authProvider: 'password',
            });
        } catch (profileErr) {
            try {
                await result.user.delete();
            } catch {
                /* ignore */
            }
            throw profileErr;
        }
        try {
            await sendVerificationEmailResend('home');
        } catch (verErr) {
            console.warn('sendVerificationEmailResend (signup):', verErr?.message || verErr);
        }
        return result.user;
    };

    /** Password reset email (Resend + same Firebase reset link / oobCode flow). */
    const sendPasswordResetToEmail = async (email) => {
        const em = String(email || '').trim().toLowerCase();
        if (!em) {
            const e = new Error('missing-email');
            e.code = 'auth/missing-email';
            throw e;
        }
        await sendPasswordResetViaResend(em);
    };

    const finishFacebookOAuthResult = async (result) => {
        if (!result?.user?.uid) {
            const err = new Error('Facebook sign-in did not return a user');
            err.code = 'auth/no-user';
            throw err;
        }
        const userDoc = await getDoc(doc(db, 'users', result.user.uid));
        let isNewUser = false;

        if (!userDoc.exists()) {
            isNewUser = true;
            await createUserProfile(result.user.uid, {
                display_name: result.user.displayName,
                email: result.user.email,
                photo_url: result.user.photoURL,
                authProvider: 'facebook',
            });
        } else {
            assertProfileMatchesPortal(userDoc.data(), AUTH_PORTAL.PERSONAL);
        }
        if (userDoc.exists() && result.user.photoURL) {
            const data = userDoc.data();
            const currentPhoto = data.photoURL || data.photo_url;
            if (!currentPhoto || currentPhoto.includes('data:image/svg+xml') || currentPhoto.length < 10) {
                await updateDoc(doc(db, 'users', result.user.uid), {
                    photoURL: result.user.photoURL,
                    photo_url: result.user.photoURL,
                    updatedAt: serverTimestamp(),
                });
            }
        }

        await finalizePopupOAuthSession(result.user.uid);
        return { user: result.user, isNewUser };
    };

    // Google Sign In
    const signInWithGoogle = async () => {
        if (isInAppBrowser()) {
            const openedExternal = openInExternalBrowser();
            if (!openedExternal) {
                const err = new Error('Please open the app in Chrome to use Google login.');
                err.code = 'auth/in-app-browser';
                throw err;
            }
            return null;
        }
        try {
            const provider = createGoogleAuthProvider();
            const oauth = await firebaseOAuthPopupOrRedirect(provider);
            if (oauth?.__oauthRedirect) return { __oauthRedirect: true };
            const result = oauth?.result;
            if (!result?.user?.uid) {
                const err = new Error('Google sign-in did not return a user');
                err.code = 'auth/no-user';
                throw err;
            }
            const userDoc = await getDoc(doc(db, 'users', result.user.uid));
            let isNewUser = false;

            if (!userDoc.exists()) {
                isNewUser = true;
                console.log('Google Auth: New user detected, creating profile for:', result.user.uid);
                await createUserProfile(result.user.uid, {
                    display_name: result.user.displayName,
                    email: result.user.email,
                    photo_url: result.user.photoURL,
                    authProvider: 'google'
                });
            } else {
                assertProfileMatchesPortal(userDoc.data(), AUTH_PORTAL.PERSONAL);
                console.log('Google Auth: Existing user, syncing photos for:', result.user.uid);
                await updateDoc(doc(db, 'users', result.user.uid), {
                    photo_url: result.user.photoURL || userDoc.data().photo_url,
                    last_active_time: serverTimestamp()
                });
            }
            await finalizePopupOAuthSession(result.user.uid);
            return { user: result.user, isNewUser };
        } catch (error) {
            if (
                error?.code === 'auth/affiliate-portal-only' ||
                error?.code === 'auth/business-portal-only'
            ) {
                try {
                    await firebaseSignOut(auth);
                } catch {
                    /* ignore */
                }
            }
            if (error.code === 'auth/account-exists-with-different-credential') {
                const email = error.customData?.email;
                if (email) {
                    try {
                        if (await isEmailRegisteredAsBusiness(email)) {
                            const e = new Error('business');
                            e.code = 'auth/business-email-in-use';
                            throw e;
                        }
                        if (await isEmailRegisteredAsAffiliate(email)) {
                            const e = new Error('affiliate');
                            e.code = 'auth/affiliate-email-in-use';
                            throw e;
                        }
                    } catch (inner) {
                        if (
                            inner?.code === 'auth/business-email-in-use' ||
                            inner?.code === 'auth/affiliate-email-in-use'
                        ) {
                            throw inner;
                        }
                    }
                }
            }
            if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                console.error('Google Sign-in Error:', error.code, error.message);
            }
            throw error;
        }
    };

    // Facebook — iOS: Meta SDK + credential. Android/desktop: Firebase popup.
    const signInWithFacebook = async () => {
        if (isInAppBrowser()) {
            const openedExternal = openInExternalBrowser();
            if (!openedExternal) {
                const err = new Error('Please open the app in Safari or Chrome to use Facebook login.');
                err.code = 'auth/in-app-browser';
                throw err;
            }
            return null;
        }
        try {
            if (shouldUseFacebookIosSdk()) {
                clearOAuthRedirectPending();
                const returnToken = await completeFacebookIosRedirectReturn();
                if (returnToken) {
                    const result = await signInWithCredential(
                        auth,
                        FacebookAuthProvider.credential(returnToken)
                    );
                    return finishFacebookOAuthResult(result);
                }
                try {
                    const token = await startFacebookIosRedirectLogin();
                    const result = await signInWithCredential(
                        auth,
                        FacebookAuthProvider.credential(token)
                    );
                    return finishFacebookOAuthResult(result);
                } catch (iosErr) {
                    if (peekFacebookIosLoginPending()) {
                        return { __facebookIosRedirect: true };
                    }
                    throw iosErr;
                }
            }

            const provider = new FacebookAuthProvider();
            provider.addScope('email');
            provider.addScope('public_profile');
            const oauth = await firebaseOAuthPopupOrRedirect(provider);
            if (oauth?.__oauthRedirect) return { __oauthRedirect: true };
            return finishFacebookOAuthResult(oauth.result);
        } catch (error) {
            clearOAuthRedirectPending();
            clearFacebookIosLoginPending();
            dismissFacebookSdkOverlay();
            if (
                error?.code === 'auth/affiliate-portal-only' ||
                error?.code === 'auth/business-portal-only'
            ) {
                try {
                    await firebaseSignOut(auth);
                } catch {
                    /* ignore */
                }
            }
            if (error.code === 'auth/account-exists-with-different-credential') {
                const email = error.customData?.email;
                if (email) {
                    try {
                        if (await isEmailRegisteredAsBusiness(email)) {
                            const e = new Error('business');
                            e.code = 'auth/business-email-in-use';
                            throw e;
                        }
                        if (await isEmailRegisteredAsAffiliate(email)) {
                            const e = new Error('affiliate');
                            e.code = 'auth/affiliate-email-in-use';
                            throw e;
                        }
                    } catch (inner) {
                        if (
                            inner?.code === 'auth/business-email-in-use' ||
                            inner?.code === 'auth/affiliate-email-in-use'
                        ) {
                            throw inner;
                        }
                    }
                }
            }
            if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                console.error('Error signing in with Facebook:', error);
            }
            throw error;
        }
    };

    // Apple Sign In — personal accounts only (same portal rules as Google / Facebook).
    const signInWithApple = async () => {
        if (isInAppBrowser()) {
            const openedExternal = openInExternalBrowser();
            if (!openedExternal) {
                const err = new Error('Please open the app in Safari or Chrome to use Apple login.');
                err.code = 'auth/in-app-browser';
                throw err;
            }
            return null;
        }
        const provider = new OAuthProvider('apple.com');
        provider.addScope('email');
        provider.addScope('name');
        const oauth = await firebaseOAuthPopupOrRedirect(provider);
        if (oauth?.__oauthRedirect) return { __oauthRedirect: true };
        const result = oauth?.result;
        if (!result?.user?.uid) {
            const err = new Error('Apple sign-in did not return a user');
            err.code = 'auth/no-user';
            throw err;
        }
        try {
            const userDoc = await getDoc(doc(db, 'users', result.user.uid));
            let isNewUser = false;

            if (!userDoc.exists()) {
                isNewUser = true;
                const appleName = resolveAppleDisplayName(result.user, result);
                await createUserProfile(result.user.uid, {
                    display_name: appleName || result.user.displayName,
                    email: result.user.email,
                    photo_url: result.user.photoURL,
                    authProvider: 'apple',
                });
            } else {
                assertProfileMatchesPortal(userDoc.data(), AUTH_PORTAL.PERSONAL);
                if (result.user.photoURL) {
                    await updateDoc(doc(db, 'users', result.user.uid), {
                        photo_url: result.user.photoURL || userDoc.data().photo_url,
                        last_active_time: serverTimestamp(),
                    });
                }
            }
            await finalizePopupOAuthSession(result.user.uid);
            return { user: result.user, isNewUser };
        } catch (error) {
            if (
                error?.code === 'auth/affiliate-portal-only' ||
                error?.code === 'auth/business-portal-only'
            ) {
                try {
                    await firebaseSignOut(auth);
                } catch {
                    /* ignore */
                }
            }
            if (error.code === 'auth/account-exists-with-different-credential') {
                const email = error.customData?.email;
                if (email) {
                    try {
                        if (await isEmailRegisteredAsBusiness(email)) {
                            const e = new Error('business');
                            e.code = 'auth/business-email-in-use';
                            throw e;
                        }
                        if (await isEmailRegisteredAsAffiliate(email)) {
                            const e = new Error('affiliate');
                            e.code = 'auth/affiliate-email-in-use';
                            throw e;
                        }
                    } catch (inner) {
                        if (
                            inner?.code === 'auth/business-email-in-use' ||
                            inner?.code === 'auth/affiliate-email-in-use'
                        ) {
                            throw inner;
                        }
                    }
                }
            }
            if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                console.error('Apple Sign-in Error:', error.code, error.message);
            }
            throw error;
        }
    };

    // Create user profile in Firestore
    const createUserProfile = async (userId, userData) => {
        // REMOVED: Deterministic cartoon avatar generation (DiceBear) as per user request to avoid "fake user" look.
        // If no photo is provided, we leave it empty/null to be handled by UI components (showing initials or grey silhouette).
        const defaultAvatar = '';

        // Smart Name Logic: STRICTLY derive from email if display_name is missing or 'User'
        let finalDisplayName = userData.display_name;

        if (!finalDisplayName || finalDisplayName === 'User') {
            if (userData.email) {
                const emailName = userData.email.split('@')[0];
                // Capitalize first letter
                finalDisplayName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
            } else {
                // Should not happen for email auth, but as a last resort
                finalDisplayName = 'Member';
            }
        }

        try {
            const existingSnap = await getDoc(doc(db, 'users', userId));
            const existing = existingSnap.exists() ? existingSnap.data() : null;
            const existingRoleLc = String(existing?.role || '').toLowerCase();
            const affiliatePortal =
                existingRoleLc === 'affiliate_agent' ||
                String(existing?.registrationChannel || '').toLowerCase() === 'affiliate_portal';
            if (affiliatePortal) {
                await fetchUserProfile(userId);
                return;
            }
            const pendingBusinessFlow =
                String(existing?.registrationIntent || '').toLowerCase() === 'business' ||
                existing?.pendingBusinessRegistration === true ||
                String(existing?.accountType || '').toLowerCase() === 'business' ||
                String(existing?.role || '').toLowerCase() === 'partner' ||
                String(existing?.role || '').toLowerCase() === 'business' ||
                (existing?.businessInfo &&
                    typeof existing.businessInfo === 'object' &&
                    Object.keys(existing.businessInfo).length > 0);

            const pendingRef =
                typeof window !== 'undefined' && !pendingBusinessFlow && !existing?.referred_by
                    ? peekPendingReferralCode()
                    : null;

            const baseProfile = {
                uid: userId,
                display_name: finalDisplayName,
                email: userData.email || '',
                photo_url: userData.photo_url || userData.photoURL || defaultAvatar,
                reputation: 100,
                freeCredits: 0,
                paidCredits: Math.max(0, Number(existing?.paidCredits) || 0),
                savedCredits: Math.max(0, Number(existing?.savedCredits) || 0),
                isGuest: false,
                created_time: serverTimestamp(),
                last_active_time: serverTimestamp(),
                lastSeen: serverTimestamp(),
                access_platform: userData.access_platform || existing?.access_platform || DEFAULT_ACCESS_PLATFORM,
            };
            if (!existing) {
                baseProfile.isProfileComplete = false;
            } else if (existing.isProfileComplete === true) {
                baseProfile.isProfileComplete = true;
            } else {
                const prior = normalizeProfile({ id: userId, uid: userId, ...existing });
                if (isConsumerProfileComplete(prior)) {
                    baseProfile.isProfileComplete = true;
                }
            }
            if (pendingRef) {
                baseProfile.referred_by = pendingRef;
            }
            // Do not stamp role:user on business accounts or in-progress business signup.
            if (!pendingBusinessFlow) {
                baseProfile.role = 'user';
            }

            await setDoc(doc(db, 'users', userId), baseProfile, { merge: true });

            if (pendingRef) {
                clearPendingReferralCode();
            }

            await fetchUserProfile(userId);
        } catch (error) {
            console.error('Profile Creation Failed:', error);
            throw error;
        }
    };

    const completeOAuthRedirectUser = async (user, result) => {
        const uid = user?.uid;
        if (!uid || oauthRedirectHandledRef.current.has(uid)) return false;

        clearGuestModeForSignIn();
        setIsGuest(false);

        const pid = await resolveRedirectProviderId(user, result);
        if (!isKnownOAuthProviderId(pid)) {
            const handler = getFirebaseOAuthHandlerUrl();
            stashOAuthRedirectError({
                code: peekOAuthRedirectProvider() === 'apple.com' ? 'auth/apple-config-mismatch' : 'auth/embedded-oauth-redirect-lost',
                message:
                    peekOAuthRedirectProvider() === 'apple.com'
                        ? `Apple sign-in did not finish. In Apple Developer → Services ID, add Return URL exactly: ${handler}`
                        : 'Sign-in did not finish. Try again in Safari or Chrome.',
            });
            clearOAuthRedirectPending();
            setLoading(false);
            return false;
        }

        const authProvider = oauthProviderIdToAuthProvider(pid);
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (!userDoc.exists()) {
            const displayName =
                authProvider === 'apple'
                    ? resolveAppleDisplayName(user, result) || user.displayName
                    : user.displayName;
            await createUserProfile(uid, {
                display_name: displayName,
                email: user.email,
                photo_url: user.photoURL,
                authProvider,
            });
        } else {
            assertProfileMatchesPortal(userDoc.data(), AUTH_PORTAL.PERSONAL);
            if (authProvider === 'google') {
                await updateDoc(doc(db, 'users', uid), {
                    photo_url: user.photoURL || userDoc.data().photo_url,
                    last_active_time: serverTimestamp(),
                });
            } else if (user.photoURL) {
                const data = userDoc.data();
                const currentPhoto = data.photoURL || data.photo_url;
                if (
                    !currentPhoto ||
                    String(currentPhoto).includes('data:image/svg+xml') ||
                    String(currentPhoto).length < 10
                ) {
                    await updateDoc(doc(db, 'users', uid), {
                        photoURL: user.photoURL,
                        photo_url: user.photoURL,
                        updatedAt: serverTimestamp(),
                    });
                }
            }
        }

        oauthRedirectHandledRef.current.add(uid);
        markOAuthRedirectComplete();
        await fetchUserProfile(uid, { preferServer: true });
        markProfileSynced(uid);
        return true;
    };

    const handleOAuthRedirectError = async (error) => {
        stashOAuthRedirectError(error);
        clearOAuthRedirectPending();
        setLoading(false);
        if (
            error?.code === 'auth/affiliate-portal-only' ||
            error?.code === 'auth/business-portal-only'
        ) {
            try {
                await firebaseSignOut(auth);
            } catch {
                /* ignore */
            }
        }
        if (error?.code === 'auth/account-exists-with-different-credential') {
            const email = error.customData?.email;
            if (email) {
                try {
                    if (await isEmailRegisteredAsBusiness(email)) {
                        console.warn('[Auth] OAuth redirect: business email conflict', email);
                    }
                } catch {
                    /* ignore */
                }
            }
        } else if (error?.code && error.code !== 'auth/no-auth-event') {
            console.warn('[Auth] OAuth redirect:', error.code, error.message);
        }
    };

    // iPhone: complete Meta SDK Facebook redirect when user returns to /login.
    useEffect(() => {
        if (!shouldUseFacebookIosSdk()) return undefined;
        if (typeof window === 'undefined' || !window.location.pathname.startsWith('/login')) {
            return undefined;
        }
        if (!peekFacebookIosLoginPending()) return undefined;

        let cancelled = false;
        (async () => {
            try {
                const token = await completeFacebookIosRedirectReturn();
                if (!token || cancelled) return;
                if (auth.currentUser?.uid) return;

                const result = await signInWithCredential(
                    auth,
                    FacebookAuthProvider.credential(token)
                );
                if (cancelled) return;
                await finishFacebookOAuthResult(result);
            } catch (error) {
                if (cancelled) return;
                clearFacebookIosLoginPending();
                dismissFacebookSdkOverlay();
                stashOAuthRedirectError(error);
                setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    // Finish Apple/Google/Facebook redirect sign-in when session appears (no UI block — LoginHub stays interactive).
    useEffect(() => {
        if (!shouldRunOAuthRedirectBootstrap() && !hasFirebaseAuthReturnInUrl()) {
            return undefined;
        }

        let cancelled = false;

        const tryFinishRedirect = async (result) => {
            let user = result?.user || auth.currentUser;
            if (!user) {
                await auth.authStateReady();
                user = auth.currentUser;
            }
            if (!user || oauthRedirectHandledRef.current.has(user.uid)) return false;

            const finished = await completeOAuthRedirectUser(user, result);
            if (finished) {
                stripFirebaseAuthParamsFromUrl();
            }
            return finished;
        };

        const loginTimeout = setTimeout(() => {
            if (cancelled) return;
            if (auth.currentUser) return;
            clearOAuthRedirectPending();
            setLoading(false);
            stashOAuthRedirectError({
                code: 'auth/oauth-redirect-timeout',
                message:
                    'Sign-in took too long. Try again. For Apple on iPhone, use Safari (not WhatsApp or Instagram).',
            });
        }, 35000);

        (async () => {
            try {
                const result = await getFirebaseRedirectResultOnce();
                if (!cancelled) {
                    await tryFinishRedirect(result);
                }
            } catch (error) {
                if (!cancelled) {
                    await handleOAuthRedirectError(error);
                }
            } finally {
                if (!cancelled) {
                    clearTimeout(loginTimeout);
                }
            }
        })();

        // Backup: onAuthStateChanged can fire before getRedirectResult resolves — do not cancel on uid change.
        const unsubAuth = onAuthStateChanged(auth, (user) => {
            if (cancelled || !user || oauthRedirectHandledRef.current.has(user.uid)) return;
            void (async () => {
                try {
                    const result = await getFirebaseRedirectResultOnce();
                    if (!cancelled) {
                        await tryFinishRedirect(result);
                    }
                } catch {
                    if (!cancelled) {
                        await tryFinishRedirect(null);
                    }
                }
            })();
        });

        return () => {
            cancelled = true;
            clearTimeout(loginTimeout);
            unsubAuth();
        };
    }, []);

    // Update user profile
    const updateUserProfile = async (updates) => {
        if (!currentUser) return;

        try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                ...updates,
                last_active_time: serverTimestamp()
            });

            setUserProfile((prev) =>
                mergeProfilePreserveFavoritePlaces(
                    prev,
                    mergeProfileSnapshot(prev, {
                        ...prev,
                        ...updates,
                        uid: currentUser.uid,
                        id: currentUser.uid
                    })
                )
            );

            if (updates.displayName || updates.display_name || updates.photoURL || updates.photo_url) {
                void updateAuthProfile(auth.currentUser, {
                    displayName: updates.displayName || updates.display_name || auth.currentUser.displayName,
                    photoURL: updates.photoURL || updates.photo_url || auth.currentUser.photoURL
                }).catch((authError) => {
                    console.warn('Auth sync failed:', authError);
                });
            }

            // Reconcile with server in background — caller should not wait on this round-trip.
            void fetchUserProfile(currentUser.uid, { preferServer: true });
        } catch (error) {
            console.error('Error updating user profile:', error);
            throw error;
        }
    };

    // Delete User Account
    // Pass { password } for email users when re-auth is required (auth/requires-recent-login).
    const deleteUserAccount = async (options = {}) => {
        const { password } = options;
        if (!currentUser) return false;

        const user = auth.currentUser;
        if (!user) return false;

        const uid = user.uid;

        const doFirestoreDelete = async () => {
            await deleteDoc(doc(db, 'users', uid));
        };

        const doAuthDelete = async () => {
            localStorage.removeItem('guestMode');
            await user.delete();
        };

        const performDelete = async () => {
            await doFirestoreDelete();
            await doAuthDelete();
            return true;
        };

        isDeletingAccountRef.current = true;
        try {
            return await performDelete();
        } catch (error) {
            const isRequiresRecentLogin = error?.code === 'auth/requires-recent-login';
            if (isRequiresRecentLogin) {
                if (password) {
                    const cred = EmailAuthProvider.credential(user.email, password);
                    await reauthenticateWithCredential(user, cred);
                    await doAuthDelete();
                    return true;
                }
                const providerIds = (user.providerData || []).map((p) => p.providerId);
                let provider = null;
                if (providerIds.includes('google.com')) provider = createGoogleAuthProvider();
                else if (providerIds.includes('apple.com')) provider = new OAuthProvider('apple.com');
                else if (providerIds.includes('facebook.com')) provider = new FacebookAuthProvider();
                else if (providerIds.includes('twitter.com')) provider = new TwitterAuthProvider();
                if (provider) {
                    await reauthenticateWithPopup(user, provider);
                    await doAuthDelete();
                    return true;
                }
                const err = new Error('Re-authentication required');
                err.code = 'auth/requires-recent-login';
                err.requirePassword = true;
                throw err;
            }
            console.error('Error deleting account:', error);
            throw error;
        } finally {
            isDeletingAccountRef.current = false;
        }
    };

    /** Full-page navigation avoids stale React state / nested routes that block SPA `navigate('/login')`. */
    const signOut = async (redirectTo = '/login') => {
        if (isSigningOutRef.current) return;
        isSigningOutRef.current = true;

        const dest =
            typeof redirectTo === 'string' && redirectTo.startsWith('/')
                ? redirectTo.replace(/\/$/, '') || '/login'
                : '/login';
        const loginUrl =
            typeof window !== 'undefined' ? `${window.location.origin}${dest}` : dest;
        const uid = currentUser?.uid || auth.currentUser?.uid || null;

        clearOAuthRedirectPending();
        resetFirebaseRedirectBootstrap({ force: true });
        dismissFacebookSdkOverlay();
        clearGuestModeForSignIn();
        markPostLogoutRedirect();

        if (uid) {
            void Promise.race([
                unlinkDeviceTokenFromUser(uid),
                new Promise((resolve) => setTimeout(resolve, 800)),
            ]).catch(() => {});
            try {
                clearLegacyConsumerEntryCache(uid);
                clearInboxClosedInvitationIds(uid);
                clearInviteLandingSession(uid);
            } catch {
                /* ignore */
            }
        }

        try {
            await firebaseSignOut(auth);
        } catch (error) {
            console.error('Error signing out:', error);
            isSigningOutRef.current = false;
            clearPostLogoutRedirect();
            throw error;
        }

        resetImageUploadProgress();
        isSigningOutRef.current = false;
        lastAuthUidRef.current = null;
        profileServerSyncedRef.current = false;
        lastBootstrappedUidRef.current = null;
        setProfileServerSynced(false);
        setCurrentUser(null);
        setUserProfile(null);
        setIsGuest(false);
        setLoading(false);
        syncBusinessNavHint(null, null);

        if (typeof window !== 'undefined') {
            const url = new URL(loginUrl);
            url.searchParams.set('signedOut', '1');
            window.location.replace(`${url.pathname}${url.search}`);
        }
    };


    // Continue as Guest — must sign out Firebase or the next onAuthStateChanged will restore the real user
    // and routing will treat them as logged-in (e.g. redirect /login → /).
    const continueAsGuest = async () => {
        localStorage.setItem('guestMode', 'true');
        const hadFirebaseUser = !!auth.currentUser;
        try {
            if (hadFirebaseUser) {
                await firebaseSignOut(auth);
            }
        } catch (e) {
            console.warn('continueAsGuest signOut:', e?.message || e);
        }
        // Always apply guest profile here so the login hub can navigate immediately; onAuthStateChanged
        // will align state when user is null (avoids race where / still sees no guest profile).
        setUserProfile(guestProfile);
        setIsGuest(true);
        setLoading(false);
        syncBusinessNavHint(guestProfile, guestProfile?.uid);
    };

    // Exit Guest Mode
    const exitGuestMode = () => {
        localStorage.removeItem('guestMode');
        setUserProfile(null);
        setIsGuest(false);
        syncBusinessNavHint(null, null);
    };

    const value = {
        currentUser: toSessionAuthUser(currentUser),
        userProfile,
        loading,
        profileServerSynced,
        // Derive from normalised profile so there is ONE source of truth
        isGuest: isGuest || userProfile?.isGuest || false,
        isBusiness:
            isBusinessUser(userProfile) ||
            Boolean(currentUser?.uid && hasBusinessSessionHint(currentUser.uid)),
        cannotCreateInvitations: cannotCreateInvitations(userProfile),
        isAdmin: userProfile?.role === 'admin',
        isStaff: userProfile?.role === 'staff' || userProfile?.role === 'support' || userProfile?.role === 'admin',
        signInWithEmail,
        registerWithEmail,
        sendPasswordResetToEmail,
        signInWithGoogle,
        signInWithFacebook,
        signInWithApple,
        signOut,
        updateUserProfile,
        deleteUserAccount,
        updateProfile: updateUserProfile,
        continueAsGuest,
        exitGuestMode,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
            {/* Loading blocker removed to prevent UI freeze */}
        </AuthContext.Provider>
    );
};
