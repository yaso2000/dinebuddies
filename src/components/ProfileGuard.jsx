import React, { useState, useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { goToLogin } from '../utils/goToLogin';

/** Same rules as CompleteProfile / normalizeProfile — keep in sync. */
function resolutionFromUserDoc(data) {
    const roleLc = String(data?.role || '').toLowerCase();
    const accountLc = String(data?.accountType || '').toLowerCase();
    const hasBizInfo =
        data?.businessInfo &&
        typeof data.businessInfo === 'object' &&
        Object.keys(data.businessInfo).length > 0;
    const isBizDoc =
        roleLc === 'business' ||
        roleLc === 'partner' ||
        accountLc === 'business' ||
        hasBizInfo;
    const pendingBizIntent =
        String(data?.registrationIntent || '').toLowerCase() === 'business' &&
        roleLc !== 'business' &&
        roleLc !== 'partner' &&
        !hasBizInfo;
    const staffBypass = ['admin', 'staff', 'support'].includes(roleLc);
    if (isBizDoc || staffBypass || pendingBizIntent) return 'ok';
    const docComplete =
        data?.isProfileComplete === true ||
        (
            (data.displayName || data.display_name || data.nickname) &&
            data.gender &&
            (data.ageCategory || data.age)
        );
    return docComplete ? 'ok' : 'incomplete';
}

const ProfileGuard = ({ children }) => {
    const { currentUser, userProfile, loading, isGuest, isBusiness, profileServerSynced } = useAuth();
    const location = useLocation();
    const [profileWaitDone, setProfileWaitDone] = useState(false);
    /** When Firestore snapshot lags, userProfile stays null; resolve once via getDoc instead of treating as incomplete consumer. */
    const [nullProfileResolution, setNullProfileResolution] = useState(null);
    const noDocTimeoutRef = useRef(null);

    useEffect(() => {
        if (userProfile != null || !currentUser) {
            setProfileWaitDone(true);
            return;
        }
        setProfileWaitDone(false);
        const id = setTimeout(() => setProfileWaitDone(true), 2800);
        return () => clearTimeout(id);
    }, [userProfile, currentUser]);

    useEffect(() => {
        if (userProfile != null) {
            setNullProfileResolution(null);
        }
    }, [userProfile]);

    useEffect(() => {
        if (userProfile != null || !currentUser || !profileWaitDone) return;
        let cancelled = false;
        let unsubSnapshot = null;
        setNullProfileResolution('loading');

        const userRef = doc(db, 'users', currentUser.uid);

        const applyAndLog = (data) => {
            if (noDocTimeoutRef.current) {
                clearTimeout(noDocTimeoutRef.current);
                noDocTimeoutRef.current = null;
            }
            const res = resolutionFromUserDoc(data);
            setNullProfileResolution(res);
        };

        (async () => {
            try {
                const snap = await getDoc(userRef);
                if (cancelled) return;
                if (snap.exists()) {
                    applyAndLog(snap.data());
                    return;
                }
                setNullProfileResolution('waiting_firestore');
                unsubSnapshot = onSnapshot(userRef, (s) => {
                    if (cancelled || !s.exists()) return;
                    applyAndLog(s.data());
                    if (unsubSnapshot) {
                        unsubSnapshot();
                        unsubSnapshot = null;
                    }
                });
                noDocTimeoutRef.current = setTimeout(() => {
                    if (cancelled) return;
                    if (unsubSnapshot) {
                        unsubSnapshot();
                        unsubSnapshot = null;
                    }
                    setNullProfileResolution('incomplete');
                }, 15000);
            } catch (e) {
                if (!cancelled) {
                    setNullProfileResolution('ok');
                }
            }
        })();

        return () => {
            cancelled = true;
            if (unsubSnapshot) unsubSnapshot();
            if (noDocTimeoutRef.current) {
                clearTimeout(noDocTimeoutRef.current);
                noDocTimeoutRef.current = null;
            }
        };
    }, [currentUser, userProfile, profileWaitDone]);

    useEffect(() => {
        if (isGuest) goToLogin({ replace: true });
    }, [isGuest]);

    if (loading) {
        return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)' }}>Loading...</div>;
    }

    // Guest users should be handled by GuestBlockedRoute, but just in case
    if (isGuest) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)', color: 'var(--text-muted)' }}>
                …
            </div>
        );
    }

    // Avoid treating "profile not loaded yet" as incomplete consumer (sends business users to /complete-profile).
    if (currentUser && userProfile === null && !profileWaitDone) {
        return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)' }}>Loading...</div>;
    }

    // Snapshot lag: userProfile still null after wait — use one-shot Firestore read (same logic as CompleteProfile).
    if (currentUser && userProfile === null && profileWaitDone) {
        if (nullProfileResolution === null || nullProfileResolution === 'loading' || nullProfileResolution === 'waiting_firestore') {
            return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)' }}>Loading...</div>;
        }
        if (nullProfileResolution === 'ok') {
            return children;
        }
        return <Navigate to="/complete-profile" state={{ from: location }} replace />;
    }

    const hasBizInfo =
        userProfile?.businessInfo &&
        typeof userProfile.businessInfo === 'object' &&
        Object.keys(userProfile.businessInfo).length > 0;

    // Business, admin, staff, support: bypass gender/age profile completion (case-insensitive role)
    const roleLc = String(userProfile?.role || 'user').toLowerCase();
    if (
        isBusiness ||
        hasBizInfo ||
        userProfile?.pendingBusinessRegistration ||
        ['admin', 'staff', 'support', 'partner', 'business'].includes(roleLc)
    ) {
        return children;
    }

    // Check if profile is complete (Name, Gender, Age Category)
    const isComplete = userProfile?.isProfileComplete || (
        (userProfile?.displayName || userProfile?.display_name || userProfile?.nickname) &&
        userProfile?.gender &&
        (userProfile?.ageCategory || userProfile?.age)
    );

    if (!isComplete) {
        if (!profileServerSynced) {
            return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)' }}>Loading...</div>;
        }
        return <Navigate to="/complete-profile" state={{ from: location }} replace />;
    }

    return children;
};

export default ProfileGuard;
