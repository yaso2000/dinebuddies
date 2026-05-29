import { cert, getApps, initializeApp } from 'firebase-admin/app';

function normalizePrivateKey(raw) {
    if (typeof raw !== 'string') return '';
    let key = raw.trim();
    if (
        (key.startsWith('"') && key.endsWith('"')) ||
        (key.startsWith("'") && key.endsWith("'"))
    ) {
        key = key.slice(1, -1).trim();
    }
    key = key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return key;
}

function configFromServiceAccountJson() {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw || !String(raw).trim()) {
        return null;
    }

    let parsed;
    try {
        parsed = JSON.parse(String(raw).trim());
    } catch {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON');
    }

    const projectId = String(parsed.project_id || '').trim();
    const clientEmail = String(parsed.client_email || '').trim();
    const privateKey = normalizePrivateKey(String(parsed.private_key || ''));
    const privateKeyId = String(parsed.private_key_id || '').trim();

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must include project_id, client_email, private_key');
    }

    /** @type {{ projectId: string, clientEmail: string, privateKey: string, privateKeyId?: string }} */
    const config = { projectId, clientEmail, privateKey };
    if (privateKeyId) {
        config.privateKeyId = privateKeyId;
    }
    return config;
}

/**
 * Service account fields for firebase-admin `cert()`.
 */
export function getFirebaseAdminCertConfig() {
    const fromJson = configFromServiceAccountJson();
    if (fromJson) {
        return fromJson;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY || '');
    const privateKeyId = String(process.env.FIREBASE_PRIVATE_KEY_ID || '').trim();

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error('Firebase Admin credentials are not configured');
    }

    if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) {
        throw new Error('FIREBASE_PRIVATE_KEY is missing BEGIN/END PRIVATE KEY markers');
    }

    /** @type {{ projectId: string, clientEmail: string, privateKey: string, privateKeyId?: string }} */
    const config = { projectId, clientEmail, privateKey };
    if (privateKeyId) {
        config.privateKeyId = privateKeyId;
    }
    return config;
}

export function ensureFirebaseAdmin() {
    if (getApps().length) {
        return;
    }

    try {
        initializeApp({
            credential: cert(getFirebaseAdminCertConfig()),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/already exists/i.test(message)) {
            return;
        }
        throw new Error(`Firebase Admin init failed: ${message}`);
    }
}
