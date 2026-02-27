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
import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp
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
        photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=guest&backgroundColor=b6e3f4',
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
                // Fetch user profile from Firestore
                await fetchUserProfile(user.uid);
                setIsGuest(false);
            } else {
                // Check if guest mode is active
                const guestMode = localStorage.getItem('guestMode') === 'true';
                if (guestMode) {
                    setUserProfile(guestProfile);
                    setIsGuest(true);
                } else {
                    setUserProfile(null);
                    setIsGuest(false);
                }
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    // Update lastSeen every 2 minutes for logged-in users
    useEffect(() => {
        if (!currentUser || isGuest) return;

        const updateLastSeen = async () => {
            try {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    lastSeen: serverTimestamp()
                });
            } catch (error) {
                console.error('Error updating lastSeen:', error);
            }
        };

        // Update immediately on mount
        updateLastSeen();

        // Track Location Silently
        trackUserLocation();

        // Then update every 2 minutes
        const interval = setInterval(updateLastSeen, 2 * 60 * 1000);

        return () => clearInterval(interval);
    }, [currentUser, isGuest]);

    // Silent User Location Tracking (City/Country)
    const trackUserLocation = () => {
        if (!currentUser || isGuest) return;
        if (!navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                try {
                    // 1. Reverse Geocoding to get City/Country
                    // Using OpenStreetMap Nominatim (Free, no key required for low usage)
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=en`);
                    const data = await response.json();

                    if (data && data.address) {
                        const city = data.address.city || data.address.town || data.address.village || data.address.county || '';
                        const country = data.address.country || '';
                        const fullLocation = `${city}, ${country}`;

                        // 2. Update Firestore silently
                        // Only update if changed or if it's the first time to avoid writes? 
                        // For now we update to ensure "freshness" for the "My City" feature.

                        const userRef = doc(db, 'users', currentUser.uid);
                        await updateDoc(userRef, {
                            location: fullLocation,
                            city: city,
                            country: country,
                            coordinates: {
                                lat: latitude,
                                lng: longitude
                            },
                            lastLocationUpdate: serverTimestamp()
                        });

                        // Update local state if needed (userProfile usually auto-updates via fetchUserProfile)
                        // But we can patch it locally to be instant
                        setUserProfile(prev => ({
                            ...prev,
                            location: fullLocation,
                            city: city,
                            country: country,
                            coordinates: { lat: latitude, lng: longitude }
                        }));

                        console.log(`📍 Location updated silent: ${fullLocation}`);
                    }
                } catch (error) {
                    console.error('Error updating user location:', error);
                    // Fail silently, don't bother user
                }
            },
            async (error) => {
                console.log('Location permission denied/unavailable (Silent mode). Attempting IP Fallback...');

                // IP Fallback Implementation
                try {
                    const response = await fetch('https://ipwho.is/');
                    const data = await response.json();

                    if (data.success) {
                        const city = data.city || '';
                        const country = data.country || '';
                        const fullLocation = `${city}, ${country}`;

                        // Update Firestore with IP Location
                        const userRef = doc(db, 'users', currentUser.uid);
                        // Using setDoc with merge to follow pattern or updateDoc if sure doc exists
                        // updateDoc is safer if we know user is logged in
                        await updateDoc(userRef, {
                            location: fullLocation,
                            city: city,
                            country: country, // Full country name
                            countryCode: data.country_code, // Add code for flags
                            coordinates: {
                                lat: data.latitude,
                                lng: data.longitude
                            },
                            lastLocationUpdate: serverTimestamp(),
                            locationSource: 'ip'
                        });

                        // Update local state
                        setUserProfile(prev => ({
                            ...prev,
                            location: fullLocation,
                            city: city,
                            country: country,
                            countryCode: data.country_code,
                            coordinates: { lat: data.latitude, lng: data.longitude }
                        }));
                        console.log(`📍 IP Location updated: ${fullLocation}`);
                    }
                } catch (ipError) {
                    console.error('IP Location Fallback failed:', ipError);
                }
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
    };


    // Fetch user profile from Firestore
    const fetchUserProfile = async (userId) => {
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                setUserProfile(userDoc.data());
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
            console.error('Error signing in with email:', error);
            throw error;
        }
    };

    // Google Sign In
    const signInWithGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);

            // Check if user exists in Firestore, if not create profile
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
            }

            return { user: result.user, isNewUser };
        } catch (error) {
            console.error('Error signing in with Google:', error);
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
            // SAFE WRITE: Use setDoc with { merge: true } to prevent accidental data wiping
            await setDoc(doc(db, 'users', userId), {
                uid: userId,
                display_name: finalDisplayName,
                email: userData.email || '',
                photo_url: userData.photo_url || defaultAvatar,
                role: 'user',
                accountType: 'individual',
                following: [],
                followersCount: 0,
                reputation: 100, // Default reputation
                shortDescription: '',
                isGuest: false, // Explicitly not a guest
                created_time: serverTimestamp(),
                last_active_time: serverTimestamp(),
                lastSeen: serverTimestamp()
            }, { merge: true }); // <--- CRITICAL: Merge prevents overwriting existing profile data

            console.log(`✅ Profile secured for: ${finalDisplayName}`);

            // Refresh user profile
            await fetchUserProfile(userId);
        } catch (error) {
            console.error('Error creating/updating user profile:', error);
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
            // Delete from Firestore first
            await deleteDoc(doc(db, 'users', currentUser.uid));
            // Delete from Auth
            await currentUser.delete();
            setUserProfile(null);
        } catch (error) {
            console.error('Error deleting account:', error);
            throw error;
        }
    };

    // Sign Out
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
            {loading && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    zIndex: 9999,
                    backgroundColor: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column'
                }}>
                    {/* Loading indicator removed as per request to avoid duplication */}
                </div>
            )}
        </AuthContext.Provider>
    );
};
