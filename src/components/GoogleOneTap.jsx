import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const GoogleOneTap = () => {
    const { currentUser, signInWithGoogleOneTap } = useAuth();

    // ⚠️ IMPORTANT: Replace this with your actual Google Client ID
    // You can find this in the Google Cloud Console > Credentials > OAuth 2.0 Client IDs
    // It usually ends with '.apps.googleusercontent.com'
    // Google Client ID for One Tap
    const CLIENT_ID = "686703042572-pikb1i0uget1lc84anhbnjltlpmu726h.apps.googleusercontent.com";

    useEffect(() => {
        // If user is logged in, ensure One Tap is closed
        if (currentUser) {
            if (window.google?.accounts?.id) {
                window.google.accounts.id.cancel();
                console.log("🔒 Creating/Existing session detected - One Tap closed");
            }
            return;
        }

        const initializeGoogleOneTap = () => {
            if (!window.google) return;

            // Double check user state before initializing
            if (currentUser) return;

            window.google.accounts.id.initialize({
                client_id: CLIENT_ID,
                callback: async (response) => {
                    try {
                        await signInWithGoogleOneTap(response);
                        console.log("✅ Google One Tap sign in successful");
                    } catch (error) {
                        console.error("❌ Google One Tap error:", error);
                    }
                },
                auto_select: false,
                cancel_on_tap_outside: false,
                // Add context to help positioning if parent_id is used, but we use global CSS
            });

            window.google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed()) {
                    console.log("One Tap not displayed:", notification.getNotDisplayedReason());
                } else if (notification.isSkippedMoment()) {
                    console.log("One Tap skipped:", notification.getSkippedReason());
                } else if (notification.isDismissedMoment()) {
                    console.log("One Tap dismissed:", notification.getDismissedReason());
                }
            });
        };

        // Wait for Google script to load if necessary
        const timer = setInterval(() => {
            if (window.google) {
                clearInterval(timer);
                initializeGoogleOneTap();
            }
        }, 1000);

        return () => {
            clearInterval(timer);
            // Optional: cancel prompt on unmount if navigating away
            if (window.google?.accounts?.id) {
                window.google.accounts.id.cancel();
            }
        };

    }, [currentUser, CLIENT_ID, signInWithGoogleOneTap]);

    return null; // Component does not render anything visible
};

export default GoogleOneTap;
