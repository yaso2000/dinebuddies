import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { resolveAccountTheme } from '../utils/accountTheme';

/** Syncs business vs personal accent theme from route + signed-in account. */
export default function AccountThemeBridge() {
    const { pathname, search } = useLocation();
    const { isBusiness, userProfile, currentUser } = useAuth();
    const { setAccountTheme } = useTheme();

    const accountTheme = useMemo(
        () =>
            resolveAccountTheme({
                pathname,
                search,
                userId: currentUser?.uid,
                profile: userProfile,
                isBusiness,
            }),
        [pathname, search, currentUser?.uid, userProfile, isBusiness]
    );

    useEffect(() => {
        setAccountTheme(accountTheme);
    }, [accountTheme, setAccountTheme]);

    return null;
}
