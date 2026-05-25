import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

/** Persist push on/off in Firestore (survives reload; server push respects this). */
export async function persistPushEnabledPref(uid, enabled) {
    if (!uid) return;
    await setDoc(
        doc(db, 'users', uid, 'preferences', 'notifications'),
        { pushEnabled: enabled === true },
        { merge: true }
    );
}
