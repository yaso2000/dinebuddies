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
    createUserWithEmailAndPassword
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

    // Listen to auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);

            if (user) {
                // Fetch user profile from Firestore
                await fetchUserProfile(user.uid);
            } else {
                setUserProfile(null);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

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

    // Create user profile in Firestore (متوافق مع بنية FlutterFlow)
    const createUserProfile = async (userId, userData) => {
        try {
            await setDoc(doc(db, 'users', userId), {
                uid: userId,
                display_name: userData.display_name || 'User',
                email: userData.email || '',
                photo_url: userData.photo_url || '',
                role: 'user', // Default role
                accountType: 'individual', // default
                following: [],
                followersCount: 0,
                reputation: 100,
                shortDescription: '',
                created_time: serverTimestamp(),
                last_active_time: serverTimestamp()
            });

            // Refresh user profile
            await fetchUserProfile(userId);
        } catch (error) {
            console.error('Error creating user profile:', error);
            throw error;
        }
    };

    // Update user account type (individual or partner)
    const updateAccountType = async (accountType) => {
        if (!currentUser) return;

        try {
            // Mapping accountType to role
            let newRole = 'user';
            if (accountType === 'partner' || accountType === 'business') {
                newRole = 'partner';
            } else if (accountType === 'admin') {
                newRole = 'admin';
            }

            // Using setDoc with merge: true protects against "Document not found" errors
            // if the user profile wasn't fully created during signup.
            await setDoc(doc(db, 'users', currentUser.uid), {
                accountType,
                role: newRole,
                last_active_time: serverTimestamp()
            }, { merge: true });

            // Refresh user profile
            await fetchUserProfile(currentUser.uid);
        } catch (error) {
            console.error('Error updating account type:', error);
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

    const value = {
        currentUser,
        userProfile,
        loading,
        sendPhoneOTP,
        verifyPhoneOTP,
        signUpWithEmail,
        signInWithEmail,
        signInWithGoogle,
        signInWithApple,
        signOut,
        updateAccountType,
        updateUserProfile,
        deleteUserAccount,
        setupRecaptcha,
        convertToBusiness
    };

    return (
        <AuthContext.Provider value={value}>
            {loading ? (
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                    background: '#0a0e27'
                }}>
                    <div style={{ textAlign: 'center', color: '#fff' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🍽️</div>
                        <div style={{ fontSize: '1.2rem' }}>Loading DineBuddies...</div>
                    </div>
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
};
