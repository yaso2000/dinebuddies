import { useAuth } from '../context/AuthContext';

/** Profile/credits checks run in background — never block page render. */
export function useAuthProfileReady() {
    const { loading } = useAuth();
    return {
        authLoading: Boolean(loading),
        profileReady: true,
        waiting: false
    };
}
