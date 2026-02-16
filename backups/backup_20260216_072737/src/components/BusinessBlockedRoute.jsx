import { Navigate } from 'react-router-dom';
import { auth } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useEffect, useState } from 'react';

/**
 * Protected Route - Blocks business/partner accounts
 * Business accounts will be redirected to home page
 */
const BusinessBlockedRoute = ({ children }) => {
    const [loading, setLoading] = useState(true);
    const [isBlocked, setIsBlocked] = useState(false);

    useEffect(() => {
        const checkAccess = async () => {
            const user = auth.currentUser;
            if (!user) {
                setLoading(false);
                return;
            }

            try {
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();

                    if (userData.accountType === 'business' || userData.accountType === 'partner') {
                        setIsBlocked(true);
                    }
                }
            } catch (error) {
                console.error('Error checking access:', error);
            } finally {
                setLoading(false);
            }
        };

        checkAccess();
    }, []);

    if (loading) {
        return null; // or a loading spinner
    }

    if (isBlocked) {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default BusinessBlockedRoute;
