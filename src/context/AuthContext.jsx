import React, { createContext, useContext, useState, useEffect } from 'react';
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
    TwitterAuthProvider
} from 'firebase/auth';
import { fetchIpLocation } from '../utils/locationUtils';
import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    addDoc,
    serverTimestamp,
    onSnapshot,
    collection,
    query,
    where,
    getDocs
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

    // Guest profile template
    const guestProfile = {
        uid: 'guest',
        display_name: 'Guest', // Will be translated in components
        email: '',
        photo_url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect fill="%238b5cf6" width="150" height="150"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="60" fill="white"%3E👤%3C/text%3E%3C/svg%3E',
        photoURL: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect fill="%238b5cf6" width="150" height="150"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="60" fill="white"%3E👤%3C/text%3E%3C/svg%3E',
        role: 'guest',
        accountType: 'guest',
        following: [],
        followersCount: 0,
        reputation: 0,
        shortDescription: '',
        isGuest: true
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
                setUserProfile(docSnap.data());
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
        if (!navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=en`);
                    const data = await response.json();

                    if (data && data.address) {
                        const city = data.address.city || data.address.town || data.address.village || '';
                        const country = data.address.country || '';
                        const fullLocation = `${city}, ${country}`;

                        if (userProfile?.location === fullLocation &&
                            Math.abs((userProfile?.coordinates?.lat || 0) - latitude) < 0.001) {
                            return;
                        }

                        const userRef = doc(db, 'users', currentUser.uid);
                        await updateDoc(userRef, {
                            location: fullLocation,
                            city,
                            country,
                            coordinates: { lat: latitude, lng: longitude },
                            lastLocationUpdate: serverTimestamp()
                        });

                        setUserProfile(prev => ({
                            ...prev,
                            location: fullLocation,
                            city,
                            country,
                            coordinates: { lat: latitude, lng: longitude }
                        }));
                    }
                } catch (error) { }
            },
            async (error) => {
                try {
                    const data = await fetchIpLocation();
                    if (data.success) {
                        const city = data.city || '';
                        const country = data.country || '';
                        const fullLocation = `${city}, ${country}`;

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
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
    };


    // Fetch user profile from Firestore
    const fetchUserProfile = async (userId) => {
        try {
            const userRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
                const data = userDoc.data();

                // --- 🔄 WEEKLY QUOTA RESET LOGIC (LAZY RESET) ---
                const lastReset = data.lastQuotaResetDate?.toDate() || data.created_time?.toDate() || new Date();
                const now = new Date();
                const diffMs = now - lastReset;
                const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

                if (diffMs >= sevenDaysMs) {
                    console.log('📅 Resetting weekly quota for user:', userId);
                    await updateDoc(userRef, {
                        usedPrivateCreditsThisWeek: 0,
                        lastQuotaResetDate: serverTimestamp()
                    });
                    data.usedPrivateCreditsThisWeek = 0; // Update local data before setting state
                }

                setUserProfile(data);
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
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
            // DEMO LOGIN BYPASS: If email ends with @d.c and user not found, 
            // check Firestore for a demo account and auto-register it.
            if ((error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') && email.endsWith('@d.c')) {
                try {
                    const q = query(collection(db, 'users'), where('email', '==', email), where('isDemo', '==', true));
                    const snapshot = await getDocs(q);

                    if (!snapshot.empty) {
                        const demoData = snapshot.docs[0].data();
                        console.log('🧪 Demo user detected in Firestore. Auto-registering in Auth...');

                        // Attempt to register with the provided password
                        const signupResult = await createUserWithEmailAndPassword(auth, email, password);

                        // Sync UID if needed
                        const oldDocRef = snapshot.docs[0].ref;
                        const newDocRef = doc(db, 'users', signupResult.user.uid);

                        if (oldDocRef.id !== signupResult.user.uid) {
                            await setDoc(newDocRef, { ...demoData, uid: signupResult.user.uid });
                            await deleteDoc(oldDocRef);
                        }

                        return signupResult.user;
                    }
                } catch (bypassError) {
                    console.error('Demo auto-reg failed:', bypassError);
                }
            }
            console.error('Error signing in with email:', error);
            throw error;
        }
    };

    // Google Sign In
    const signInWithGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider();
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
                accountType: 'individual',
                reputation: 100,
                purchasedPrivateCredits: 5,
                usedPrivateCreditsThisWeek: 0,
                trialExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                lastQuotaResetDate: serverTimestamp(),
                isGuest: false,
                created_time: serverTimestamp(),
                last_active_time: serverTimestamp(),
                lastSeen: serverTimestamp(),
                isProfileComplete: false
            }, { merge: true });

            await addDoc(collection(db, 'notifications'), {
                userId: userId,
                type: 'system_announcement',
                title: '🎁 Welcome Gift!',
                message: `Welcome to DineBuddies! You have received 5 free private invitations as a welcome gift. Enjoy!`,
                style: 'success',
                createdAt: serverTimestamp(),
                read: false
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
            await updateDoc(doc(db, 'users', currentUser.uid), {
                ...updates,
                last_active_time: serverTimestamp()
            });

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

    // Convert to Business Account
    const convertToBusiness = async (businessData) => {
        if (!currentUser) {
            throw new Error('No user logged in');
        }

        try {
            const userRef = doc(db, 'users', currentUser.uid);

            console.log('Converting to business with data:', businessData);

            // Update user document with business info AND correct role
            await updateDoc(userRef, {
                accountType: 'business',
                role: 'partner', // Explicitly set role to partner
                businessInfo: {
                    ...businessData,
                    isPublished: true, // Default to true (published) for initial conversion
                    createdAt: serverTimestamp()
                },
                updatedAt: serverTimestamp()
            });

            console.log('✅ Successfully updated Firestore with accountType: business and role: partner');

            // Refresh user profile
            await fetchUserProfile(currentUser.uid);

            console.log('✅ User profile refreshed');

            // Return success - component will handle navigation
            return true;
        } catch (error) {
            console.error('❌ Error converting to business:', error);
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
        currentUser,
        userProfile,
        loading,
        isGuest,
        isAdmin: userProfile?.role === 'admin' || userProfile?.accountType === 'admin',
        isBusiness: userProfile?.accountType === 'business' || userProfile?.role === 'partner',
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
        convertToBusiness,
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
