import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from './ToastContext';
import { getAuthErrorMessage } from '../utils/errorMessages';
import { adminSecurityService } from '../services/adminSecurityService';
import {
    auth,
    db
} from '../firebase/config';
import {
    signInWithPopup,
    GoogleAuthProvider,
    OAuthProvider,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    FacebookAuthProvider,
    TwitterAuthProvider,
    updateProfile as updateAuthProfile
} from 'firebase/auth';
import { fetchIpLocation, reverseGeocode } from '../utils/locationUtils';
import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    onSnapshot,
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
    const [recaptchaVerifier, setRecaptchaVerifier] = useState(null);
    const [isGuest, setIsGuest] = useState(false);
    const nominatimFailed = React.useRef(false);

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

    // Canonical: only role. user | business | admin | staff | support | guest. Use "business" for partners (no "partner" value).
    const normalizeProfile = (data) => {
        if (!data) return null;
        const isBusiness = data.role === 'business';
        const isGuestProfile = data.role === 'guest' || data.isGuest === true;
        return {
            ...data,
            id: data.id || data.uid || '',
            uid: data.uid || data.id || '',
            displayName: data.displayName || data.display_name || data.nickname || '',
            display_name: data.display_name || data.displayName || data.nickname || '',
            photoURL: data.photoURL || data.photo_url || data.avatar || '',
            photo_url: data.photo_url || data.photoURL || data.avatar || '',
            // ── Unified flags — use ONLY these across the whole codebase ──
            isBusiness,
            isGuest: isGuestProfile,
            // Ensure role is always set
            role: isBusiness ? 'business' : isGuestProfile ? 'guest' : (data.role || 'user'),
            // Business accounts are always profile-complete (no gender/age required)
            // Guests are always considered complete (minimal profile)
            // Only regular users need to fill gender + ageCategory
            isProfileComplete: isBusiness || isGuestProfile
                ? true
                : data.isProfileComplete === true || (
                    (data.displayName || data.display_name) &&
                    data.gender &&
                    (data.ageCategory || data.age)
                )
        };
    };

    // Listen to auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);

            if (user) {
                setIsGuest(false);
                // Profile listener will handle setLoading(false)
                // Fail-safe: if profile doesn't load in 5s, release the UI
                setTimeout(() => setLoading(false), 5000);
            } else {
                const guestMode = localStorage.getItem('guestMode') === 'true';
                if (guestMode) {
                    setUserProfile(guestProfile);
                    setIsGuest(true);
                } else {
                    setUserProfile(null);
                    setIsGuest(false);
                }
                setLoading(false);
            }
        });

        return unsubscribe;
    }, []);


    // Real-time Profile Listener
    useEffect(() => {
        if (!currentUser) return;
        const userRef = doc(db, 'users', currentUser.uid);
        const unsubscribeSnapshot = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                setUserProfile(normalizeProfile({
                    id: docSnap.id,
                    uid: docSnap.id,
                    ...docSnap.data()
                }));
            } else {
                setUserProfile(null);
            }
            setLoading(false);
        }, (error) => {
            console.error("Profile Error:", error);
            setLoading(false);
        });
        return () => unsubscribeSnapshot();
    }, [currentUser]);

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
    }, [currentUser, isGuest]);

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
                setUserProfile(normalizeProfile(data));
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
            showToast(getAuthErrorMessage(error) || 'Failed to load profile.', 'error');
        }
    };

    // Setup reCAPTCHA for phone authentication
    const setupRecaptcha = (elementId = 'recaptcha-container') => {
        if (!recaptchaVerifier) {
            const verifier = new RecaptchaVerifier(auth, elementId, {
                size: 'invisible',
                callback: (response) => {
                    // reCAPTCHA solved
                },
                'expired-callback': () => {
                    // Response expired
                }
            });
            setRecaptchaVerifier(verifier);
            return verifier;
        }
        return recaptchaVerifier;
    };

    // Phone Authentication - Send OTP
    const sendPhoneOTP = async (phoneNumber) => {
        try {
            const verifier = setupRecaptcha();
            const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier);
            return confirmationResult;
        } catch (error) {
            console.error('Error sending OTP:', error);
            throw error;
        }
    };

    // Phone Authentication - Verify OTP
    const verifyPhoneOTP = async (confirmationResult, code) => {
        try {
            const result = await confirmationResult.confirm(code);
            // Create profile if new user
            const userDoc = await getDoc(doc(db, 'users', result.user.uid));
            if (!userDoc.exists()) {
                await createUserProfile(result.user.uid, {
                    display_name: result.user.phoneNumber,
                    email: '',
                    authProvider: 'phone'
                });
            }
            return result.user;
        } catch (error) {
            console.error('Error verifying OTP:', error);
            throw error;
        }
    };

    // Email/Password Sign Up
    const signUpWithEmail = async (email, password, name) => {
        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            // Create user profile in Firestore
            await createUserProfile(result.user.uid, {
                display_name: name,
                email,
                authProvider: 'email'
            });
            return result.user;
        } catch (error) {
            console.error('Error signing up with email:', error);
            throw error;
        }
    };

    // Email/Password Sign In
    const signInWithEmail = async (email, password) => {
        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            return result.user;
        } catch (error) {
            console.error('Error signing in with email:', error);
            throw error;
        }
    };

    // Google Sign In
    const signInWithGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider();
            // Force Firebase to use the correct Google Cloud Client ID
            provider.setCustomParameters({
                client_id: '596978732537-vfum3vmph4gjak0ctnhftlj8u0ms35oj.apps.googleusercontent.com'
            });
            provider.addScope('email');
            provider.addScope('profile');
            const result = await signInWithPopup(auth, provider);
            const userDoc = await getDoc(doc(db, 'users', result.user.uid));
            let isNewUser = false;

            if (!userDoc.exists()) {
                isNewUser = true;
                await createUserProfile(result.user.uid, {
                    display_name: result.user.displayName,
                    email: result.user.email,
                    photo_url: result.user.photoURL,
                    authProvider: 'google'
                });
            } else {
                // Keep photo in sync
                await updateDoc(doc(db, 'users', result.user.uid), {
                    photo_url: result.user.photoURL || userDoc.data().photo_url,
                    last_active_time: serverTimestamp()
                });
            }
            return { user: result.user, isNewUser };
        } catch (error) {
            if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                console.error('Google Sign-in Error:', error.code, error.message);
            }
            throw error;
        }
    };

    // Apple Sign In
    const signInWithApple = async () => {
        try {
            const provider = new OAuthProvider('apple.com');
            const result = await signInWithPopup(auth, provider);

            // Check if user exists in Firestore, if not create profile
            const userDoc = await getDoc(doc(db, 'users', result.user.uid));
            let isNewUser = false;

            if (!userDoc.exists()) {
                isNewUser = true;
                await createUserProfile(result.user.uid, {
                    display_name: result.user.displayName || 'Apple User',
                    email: result.user.email,
                    photo_url: result.user.photoURL,
                    authProvider: 'apple'
                });
            } else if (result.user.photoURL) {
                // Sync photo if missing or default
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
            console.error('Error signing in with Apple:', error);
            throw error;
        }
    };

    // Facebook Sign In
    const signInWithFacebook = async () => {
        try {
            const provider = new FacebookAuthProvider();
            const result = await signInWithPopup(auth, provider);

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
                // Sync photo if missing or default
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
            console.error('Error signing in with Facebook:', error);
            throw error;
        }
    };

    // Twitter (X) Sign In
    const signInWithTwitter = async () => {
        try {
            const provider = new TwitterAuthProvider();
            const result = await signInWithPopup(auth, provider);

            const userDoc = await getDoc(doc(db, 'users', result.user.uid));
            let isNewUser = false;

            if (!userDoc.exists()) {
                isNewUser = true;
                await createUserProfile(result.user.uid, {
                    display_name: result.user.displayName,
                    email: result.user.email,
                    photo_url: result.user.photoURL,
                    authProvider: 'twitter'
                });
            } else if (result.user.photoURL) {
                // Sync photo if missing or default
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
            console.error('Error signing in with Twitter:', error);
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
            await setDoc(doc(db, 'users', userId), {
                uid: userId,
                display_name: finalDisplayName,
                email: userData.email || '',
                photo_url: userData.photo_url || userData.photoURL || defaultAvatar,
                role: 'user',
                reputation: 100,
                purchasedPrivateCredits: 5,          // welcome gift: 5 free private invitation credits
                usedPrivateCreditsThisMonth: 0,       // monthly usage counter (reset by InvitationContext)
                lastPrivateResetMonth: '',             // tracks which month was last reset
                isGuest: false,
                created_time: serverTimestamp(),
                last_active_time: serverTimestamp(),
                lastSeen: serverTimestamp(),
                isProfileComplete: false
            }, { merge: true });

            await adminSecurityService.createNotification({
                userId,
                type: 'system_announcement',
                title: '🎁 Welcome Gift!',
                message: 'Welcome to DineBuddies! You have received 5 free private invitations as a welcome gift. Enjoy!',
                style: 'success'
            });

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
    const deleteUserAccount = async () => {
        if (!currentUser) return;

        try {
            const uid = currentUser.uid;

            // 1. Delete from Firestore first
            await deleteDoc(doc(db, 'users', uid));

            // 2. Clear Guest Mode and Profile
            localStorage.removeItem('guestMode');
            setUserProfile(null);

            // 3. Delete from Auth
            const user = auth.currentUser;
            if (user) {
                await user.delete();
            }

            return true;
        } catch (error) {
            console.error('Error deleting account:', error);
            // Re-authentication might be needed: auth/requires-recent-login
            throw error;
        }
    };

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
            setUserProfile(null);
        } catch (error) {
            console.error('Error signing out:', error);
            throw error;
        }
    };


    // Continue as Guest
    const continueAsGuest = () => {
        localStorage.setItem('guestMode', 'true');
        setCurrentUser(null); // Important: clear Firebase user
        setUserProfile(guestProfile);
        setIsGuest(true);
        setLoading(false); // Ensure loading is false
        console.log('✅ Guest mode activated');
    };

    // Exit Guest Mode
    const exitGuestMode = () => {
        localStorage.removeItem('guestMode');
        setUserProfile(null);
        setIsGuest(false);
        console.log('✅ Guest mode deactivated');
    };

    const value = {
        currentUser: currentUser ? {
            ...currentUser,
            id: currentUser.uid,
            name: currentUser.displayName,
            avatar: currentUser.photoURL
        } : null,
        userProfile,
        loading,
        // Derive from normalised profile so there is ONE source of truth
        isGuest: isGuest || userProfile?.isGuest || false,
        isBusiness: userProfile?.isBusiness || false,
        isAdmin: userProfile?.role === 'admin',
        isStaff: userProfile?.role === 'staff' || userProfile?.role === 'support' || userProfile?.role === 'admin',
        sendPhoneOTP,
        verifyPhoneOTP,
        signUpWithEmail,
        signInWithEmail,
        signInWithGoogle,
        signInWithApple,
        signInWithFacebook,
        signInWithTwitter,
        signOut,

        updateUserProfile,
        deleteUserAccount,
        setupRecaptcha,
        convertToBusiness: null, // removed — use role: 'business' directly
        updateProfile: updateUserProfile,
        continueAsGuest,
        exitGuestMode
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
            {/* Loading blocker removed to prevent UI freeze */}
        </AuthContext.Provider>
    );
};
