import { useEffect } from 'react';
import { setUserOnline, setUserOffline } from '../utils/chatUtils';
import { useAuth } from '../context/AuthContext';

// Hook to manage user presence
export const usePresence = () => {
    const { currentUser } = useAuth();

    useEffect(() => {
        if (!currentUser?.uid) return;

        // Set user online when component mounts
        setUserOnline(currentUser.uid);

        // Set offline on unmount
        return () => {
            setUserOffline(currentUser.uid);
        };
    }, [currentUser?.uid]);

    // Handle page visibility
    useEffect(() => {
        if (!currentUser?.uid) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                setUserOffline(currentUser.uid);
            } else {
                setUserOnline(currentUser.uid);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [currentUser?.uid]);

    // Handle beforeunload
    useEffect(() => {
        if (!currentUser?.uid) return;

        const handleBeforeUnload = () => {
            setUserOffline(currentUser.uid);
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [currentUser?.uid]);
};
