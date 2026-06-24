import app, { auth } from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { resolveApiUrl } from '../utils/resolveApiUrl';

const FUNCTIONS_REGION = 'us-central1';

/** Server-side mirror users/{uid} → public_profiles/{uid} (partners directory). */
export async function syncBusinessPublicProfile(uid) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not signed in');

    const functions = getFunctions(app, FUNCTIONS_REGION);
    const callable = httpsCallable(functions, 'syncMyBusinessPublicProfile');
    try {
        const { data } = await callable({});
        return data;
    } catch (callableErr) {
        console.warn('syncMyBusinessPublicProfile callable failed, trying API:', callableErr?.message || callableErr);
    }

    const token = await user.getIdToken(true);
    const res = await fetch(resolveApiUrl('/api/business/sync-public-profile'), {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid: uid || user.uid }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data?.message || 'Sync failed');
        err.code = data?.code;
        throw err;
    }
    return data;
}
