import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useToast } from './ToastContext';
import { getAuthErrorMessage } from '../utils/errorMessages';
import { isBusinessUser } from '../utils/accountRole';
import { normalizeUserProfile as normalizeProfile } from '../utils/userProfileNormalize';

/** Keeps Layout/HomeRouter treating the session as business when userProfile is briefly null (Firestore/auth race). */
function syncBusinessNavHint(profile, uid) {
    try {
        if (profile && uid && isBusinessUser(profile)) {
            sessionStorage.setItem('dineb_biz_uid', uid);
        } else {
            sessionStorage.removeItem('dineb_biz_uid');
        }
    } catch { /* ignore */ }
}
import { sendPasswordResetViaResend } from '../services/passwordResetEmailService';
import { sendVerificationEmailResend } from '../services/verificationEmailService';
import { isEmailRegisteredAsBusiness } from '../utils/authEmailConflict';
import { adminSecurityService } from '../services/adminSecurityService';
import {
    auth,
    db
} from '../firebase/config';
import {
    signInWithPopup,
    signInWithCredential,
    GoogleAuthProvider,
    OAuthProvider,
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

// Facebook App ID — used for the JS SDK auth flow
const FB_APP_ID = '1718617005774108';

// Dynamically load the Facebook JS SDK (only once per session)
const loadFacebookSDK = () => new Promise((resolve) => {
    if (window.FB) { resolve(window.FB); return; }
    window.fbAsyncInit = () => {
        window.FB.init({ appId: FB_APP_ID, version: 'v19.0', cookie: true, xfbml: false });
        resolve(window.FB);
    };
    if (!document.getElementById('facebook-jssdk')) {
        const script = document.createElement('script');
        script.id = 'facebook-jssdk';
        script.src = 'https://connect.facebook.net/en_US/sdk.js';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    }
});

import { fetchIpLocation, reverseGeocode } from '../utils/locationUtils';
import { initNotifications, removeFcmToken } from '../services/notificationService';

import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    onSnapshot,
    collection,
} from 'firebase/firestore';

const AuthContext = createContext();

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
    const [isGuest, setIsGuest] = useState(false);
    const nominatimFailed = useRef(false);
    const isDeletingAccountRef = useRef(false);
    /** Cleared when Firestore profile snapshot resolves so the 5s fail-safe cannot fire after real data. */
    const authLoadingTimeoutRef = useRef(null);

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
            setCurrentUser(user);

            if (user) {
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
                    syncBusinessNavHint(null, null);
                    try {
                        localStorage.removeItem('guestMode');
                    } catch { /* ignore */ }
                }
                // Always wait for Firestore profile (or fail-safe timeout) after any sign-in.
                // If we only set loading when leaving guest mode, loading stays false while currentUser is set
                // and userProfile is still null → HomeRouter / redirects break (wrong route or blank states).
                setLoading(true);
                if (authLoadingTimeoutRef.current) {
                    clearTimeout(authLoadingTimeoutRef.current);
                    authLoadingTimeoutRef.current = null;
                }
                // Profile listener will handle setLoading(false)
                // Fail-safe: if profile doesn't load in 5s, release the UI
                authLoadingTimeoutRef.current = setTimeout(() => {
                    setLoading(false);
                    authLoadingTimeoutRef.current = null;
                }, 5000);
                // Initialize push notifications (request permission + save FCM token)
                initNotifications(user.uid).catch(() => { });
            } else {
                if (authLoadingTimeoutRef.current) {
                    clearTimeout(authLoadingTimeoutRef.current);
                    authLoadingTimeoutRef.current = null;
                }
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
                await setDoc(
                    doc(db, 'users', currentUser.uid),
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
        if (!uid) return;
        const userRef = doc(db, 'users', uid);
        const unsubscribeSnapshot = onSnapshot(userRef, (docSnap) => {
            const fromCache = docSnap.metadata.fromCache;
            if (docSnap.exists()) {
                const normalized = normalizeProfile({
                    id: docSnap.id,
                    uid: docSnap.id,
                    ...docSnap.data()
                });
                console.log('Profile snapshot updated:', normalized.uid, 'Role:', normalized.role);
                syncBusinessNavHint(normalized, docSnap.id);
                setUserProfile(normalized);
            } else if (!isDeletingAccountRef.current) {
                console.log('Profile snapshot: Document does not exist yet for UID:', uid);
                syncBusinessNavHint(null, null);
                setUserProfile(null);
            }
            // Local cache can hold an older consumer-shaped doc; routing (HomeRouter) must not run
            // until we have a server snapshot or a fail-safe timeout.
            if (fromCache) {
                if (authLoadingTimeoutRef.current) {
                    clearTimeout(authLoadingTimeoutRef.current);
                    authLoadingTimeoutRef.current = null;
                }
                authLoadingTimeoutRef.current = setTimeout(() => {
                    setLoading(false);
                    authLoadingTimeoutRef.current = null;
                }, 8000);
                return;
            }
            if (authLoadingTimeoutRef.current) {
                clearTimeout(authLoadingTimeoutRef.current);
                authLoadingTimeoutRef.current = null;
            }
            setLoading(false);
        }, (error) => {
            console.error("Profile Error:", error);
            if (authLoadingTimeoutRef.current) {
                clearTimeout(authLoadingTimeoutRef.current);
                authLoadingTimeoutRef.current = null;
            }
            setLoading(false);
        });
        return () => unsubscribeSnapshot();
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

                    const city = d.city || d.locality || d.principalSubdivision || '';
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


    const { showToast } = useToast();

    // Fetch user profile from Firestore
    const fetchUserProfile = async (userId) => {
        try {
            const userRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
                const data = userDoc.data();
                const normalized = normalizeProfile(data);
                syncBusinessNavHint(normalized, userId);
                setUserProfile(normalized);
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
            showToast(getAuthErrorMessage(error) || 'Failed to load profile.', 'error');
        }
    };

    const signInWithEmail = async (email, password) => {
        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            const userDoc = await getDoc(doc(db, 'users', result.user.uid));
            if (!userDoc.exists()) {
                await createUserProfile(result.user.uid, {
                    display_name: result.user.displayName || '',
                    email: result.user.email,
                    photo_url: result.user.photoURL || '',
                    authProvider: 'password',
                });
            }
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

    // Google Sign In
    const signInWithGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider();
            // Only override OAuth client on non-localhost when VITE_GOOGLE_WEB_CLIENT_ID is set (e.g. Vercel).
            // Forcing client_id on http://localhost breaks sign-in if that Web client omits localhost in
            // Google Cloud Console "Authorized JavaScript origins". Leaving unset uses Firebase's default.
            const explicitClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
            const host = typeof window !== 'undefined' ? window.location.hostname : '';
            const isLocalDev = host === 'localhost' || host === '127.0.0.1';
            if (explicitClientId && !isLocalDev) {
                provider.setCustomParameters({ client_id: explicitClientId });
            }
            provider.addScope('email');
            provider.addScope('profile');
            const result = await signInWithPopup(auth, provider);
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
                console.log('Google Auth: Existing user, syncing photos for:', result.user.uid);
                // Keep photo in sync
                await updateDoc(doc(db, 'users', result.user.uid), {
                    photo_url: result.user.photoURL || userDoc.data().photo_url,
                    last_active_time: serverTimestamp()
                });
            }
            return { user: result.user, isNewUser };
        } catch (error) {
            if (error.code === 'auth/account-exists-with-different-credential') {
                const email = error.customData?.email;
                if (email) {
                    try {
                        if (await isEmailRegisteredAsBusiness(email)) {
                            const e = new Error('business');
                            e.code = 'auth/business-email-in-use';
                            throw e;
                        }
                    } catch (inner) {
                        if (inner?.code === 'auth/business-email-in-use') throw inner;
                    }
                }
            }
            if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                console.error('Google Sign-in Error:', error.code, error.message);
            }
            throw error;
        }
    };

    // Facebook Sign In — uses Facebook JS SDK + signInWithCredential.
    // This completely bypasses Firebase's popup/redirect OAuth flow (and its sessionStorage
    // partitioning issues on mobile). Facebook SDK handles the auth flow natively, then
    // we pass the resulting access token to Firebase via signInWithCredential.
    const signInWithFacebook = async () => {
        // ── In-app browser guard ─────────────────────────────────────────────
        if (isInAppBrowser()) {
            const openedExternal = openInExternalBrowser();
            if (!openedExternal) {
                const err = new Error('Please open the app in Safari or Chrome to use Facebook login.');
                err.code = 'auth/in-app-browser';
                throw err;
            }
            return null;
        }
        // ─────────────────────────────────────────────────────────────────
        try {
            // Step 1: Load the Facebook JS SDK and get access token
            const FB = await loadFacebookSDK();

            const fbAuthResponse = await new Promise((resolve, reject) => {
                FB.login((response) => {
                    if (response.status === 'connected' && response.authResponse?.accessToken) {
                        resolve(response.authResponse);
                    } else if (response.status === 'unknown' || !response.authResponse) {
                        const err = new Error('Facebook login was cancelled or failed.');
                        err.code = 'auth/popup-closed-by-user';
                        reject(err);
                    } else {
                        reject(new Error(`Facebook login failed: ${response.status}`));
                    }
                }, { scope: 'email,public_profile' });
            });

            // Step 2: Exchange Facebook token for Firebase credential
            const credential = FacebookAuthProvider.credential(fbAuthResponse.accessToken);
            const result = await signInWithCredential(auth, credential);

            // Step 3: Create or update Firestore profile
            const userDoc = await getDoc(doc(db, 'users', result.user.uid));
            let isNewUser = false;

            if (!userDoc.exists()) {
                isNewUser = true;
                await createUserProfile(result.user.uid, {
                    display_name: result.user.displayName,
                    email: result.user.email,
                    photo_url: result.user.photoURL,
                    authProvider: 'facebook'
                });
            } else if (result.user.photoURL) {
                const data = userDoc.data();
                const currentPhoto = data.photoURL || data.photo_url;
                if (!currentPhoto || currentPhoto.includes('data:image/svg+xml') || currentPhoto.length < 10) {
                    await updateDoc(doc(db, 'users', result.user.uid), {
                        photoURL: result.user.photoURL,
                        photo_url: result.user.photoURL,
                        updatedAt: serverTimestamp()
                    });
                }
            }

            return { user: result.user, isNewUser };
        } catch (error) {
            if (error.code === 'auth/account-exists-with-different-credential') {
                const email = error.customData?.email;
                if (email) {
                    try {
                        if (await isEmailRegisteredAsBusiness(email)) {
                            const e = new Error('business');
                            e.code = 'auth/business-email-in-use';
                            throw e;
                        }
                    } catch (inner) {
                        if (inner?.code === 'auth/business-email-in-use') throw inner;
                    }
                }
            }
            console.error('Error signing in with Facebook:', error);
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
            let grantedCredits = 0;
            let showWelcomeNotification = false;

            // Generate a unique identifier (email or phone)
            const uniqueId = userData.email?.toLowerCase() || auth.currentUser?.phoneNumber || null;

            // welcome_gifts_claimed must be allowed in firestore.rules; if missing/denied, skip and still create users/{uid}.
            if (uniqueId) {
                try {
                    const giftRef = doc(db, 'welcome_gifts_claimed', uniqueId);
                    const giftSnap = await getDoc(giftRef);

                    if (!giftSnap.exists()) {
                        grantedCredits = 5;
                        showWelcomeNotification = true;
                        try {
                            await setDoc(giftRef, {
                                claimedAt: serverTimestamp(),
                                userId: userId,
                                authProvider: userData.authProvider || 'unknown'
                            });
                        } catch (giftWriteErr) {
                            console.warn('welcome_gifts_claimed write skipped:', giftWriteErr?.message || giftWriteErr);
                        }
                    }
                } catch (giftReadErr) {
                    console.warn('welcome gift eligibility check skipped:', giftReadErr?.message || giftReadErr);
                    grantedCredits = 5;
                    showWelcomeNotification = true;
                }
            } else {
                // Fallback if no unique identity can be verified (rare in Firebase Auth)
                grantedCredits = 5;
                showWelcomeNotification = true;
            }

            const existingSnap = await getDoc(doc(db, 'users', userId));
            const existing = existingSnap.exists() ? existingSnap.data() : null;
            const pendingBusinessFlow =
                String(existing?.registrationIntent || '').toLowerCase() === 'business';

            const baseProfile = {
                uid: userId,
                display_name: finalDisplayName,
                email: userData.email || '',
                photo_url: userData.photo_url || userData.photoURL || defaultAvatar,
                reputation: 100,
                purchasedPrivateCredits: grantedCredits,
                usedPrivateCreditsThisMonth: 0,
                lastPrivateResetMonth: '',
                isGuest: false,
                created_time: serverTimestamp(),
                last_active_time: serverTimestamp(),
                lastSeen: serverTimestamp(),
                isProfileComplete: false
            };
            // Do not stamp role:user on top of an in-progress /business/signup stub (Firestore allows first business write only when role is absent or via registrationIntent completion rule).
            if (!pendingBusinessFlow) {
                baseProfile.role = 'user';
            }

            await setDoc(doc(db, 'users', userId), baseProfile, { merge: true });

            if (showWelcomeNotification) {
                try {
                    await adminSecurityService.createNotification({
                        userId,
                        type: 'system_announcement',
                        title: '🎁 Welcome Gift!',
                        message: 'Welcome to DineBuddies! You have received 5 free private invitations as a welcome gift. Enjoy!',
                        style: 'success'
                    });
                } catch (notifErr) {
                    console.warn('Welcome notification skipped:', notifErr?.message || notifErr);
                }
            }

            await fetchUserProfile(userId);
        } catch (error) {
            console.error('Profile Creation Failed:', error);
            throw error;
        }
    };



    // Update user profile
    const updateUserProfile = async (updates) => {
        if (!currentUser) return;

        try {
            // Update Firestore
            await updateDoc(doc(db, 'users', currentUser.uid), {
                ...updates,
                last_active_time: serverTimestamp()
            });

            // Sync with Firebase Auth if critical fields changed
            if (updates.displayName || updates.display_name || updates.photoURL || updates.photo_url) {
                try {
                    await updateAuthProfile(auth.currentUser, {
                        displayName: updates.displayName || updates.display_name || auth.currentUser.displayName,
                        photoURL: updates.photoURL || updates.photo_url || auth.currentUser.photoURL
                    });
                } catch (authError) {
                    console.warn("Auth sync failed:", authError);
                }
            }

            // Refresh user profile
            await fetchUserProfile(currentUser.uid);
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
                if (providerIds.includes('google.com')) provider = new GoogleAuthProvider();
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
        const dest = (redirectTo && String(redirectTo).replace(/\/$/, '')) || '/login';
        try {
            if (currentUser) await removeFcmToken(currentUser.uid).catch(() => { });
            await firebaseSignOut(auth);
            setUserProfile(null);
            syncBusinessNavHint(null, null);
            if (typeof window !== 'undefined') {
                const path = (window.location.pathname || '/').replace(/\/$/, '') || '/';
                if (path !== dest) {
                    window.location.replace(dest);
                }
            }
        } catch (error) {
            console.error('Error signing out:', error);
            throw error;
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
        currentUser: currentUser ? {
            ...currentUser,
            uid: currentUser.uid,
            id: currentUser.uid,
            name: currentUser.displayName,
            avatar: currentUser.photoURL
        } : null,
        userProfile,
        loading,
        // Derive from normalised profile so there is ONE source of truth
        isGuest: isGuest || userProfile?.isGuest || false,
        isBusiness: isBusinessUser(userProfile),
        isAdmin: userProfile?.role === 'admin',
        isStaff: userProfile?.role === 'staff' || userProfile?.role === 'support' || userProfile?.role === 'admin',
        signInWithEmail,
        registerWithEmail,
        sendPasswordResetToEmail,
        signInWithGoogle,
        signInWithFacebook,
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
