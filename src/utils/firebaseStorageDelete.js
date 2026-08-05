import { ref, deleteObject } from 'firebase/storage';
import { storage } from '../firebase/config';

/** Extract Storage object path from a Firebase download URL. */
export function pathFromFirebaseDownloadURL(url) {
    if (!url || typeof url !== 'string') return null;
    try {
        const idx = url.indexOf('/o/');
        if (idx === -1) return null;
        let path = url.slice(idx + 3);
        const q = path.indexOf('?');
        if (q !== -1) path = path.slice(0, q);
        return decodeURIComponent(path.replace(/\+/g, ' '));
    } catch {
        return null;
    }
}

/** Delete Storage objects for the given download URLs (deduped). Ignores missing objects. */
export async function deleteFilesAtFirebaseDownloadUrls(urls) {
    const unique = [...new Set((urls || []).filter(Boolean))];
    for (const url of unique) {
        const path = pathFromFirebaseDownloadURL(url);
        if (!path) continue;
        try {
            await deleteObject(ref(storage, path));
        } catch (e) {
            if (e?.code !== 'storage/object-not-found') {
                console.warn('deleteFilesAtFirebaseDownloadUrls:', path, e?.message);
            }
        }
    }
}
