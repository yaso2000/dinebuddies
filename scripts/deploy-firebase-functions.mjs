/**
 * Deploy Cloud Functions — Firebase CLI login first, service account only as fallback.
 *
 * Usage:
 *   node scripts/deploy-firebase-functions.mjs              # default subset
 *   node scripts/deploy-firebase-functions.mjs all            # all functions
 *   node scripts/deploy-firebase-functions.mjs --sa         # force service account from .env
 */
import dotenv from 'dotenv';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    ensureNodeTlsEnv,
    getFirebaseCliLogin,
    printFirebaseLoginHelp,
    runFirebase,
} from './_firebaseCliAuth.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
dotenv.config({ path: resolve(root, '.env') });

const argv = process.argv.slice(2);
const forceServiceAccount = argv.includes('--sa');
const filterArg = argv.find((a) => !a.startsWith('--'));

const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'dinebuddies';

const onlyArg =
    filterArg === 'all'
        ? 'functions'
        : filterArg ||
          'functions:publishPrivateInvitationDraft,functions:ensurePrivateInvitationShareToken,functions:getPrivateInvitationSharePreview,functions:claimPrivateInvitationShare';

function buildServiceAccountEnv() {
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    const privateKeyId = process.env.FIREBASE_PRIVATE_KEY_ID || '';

    if (!clientEmail || !privateKey.includes('BEGIN PRIVATE KEY')) {
        console.error('[deploy-functions] Missing FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in .env');
        return null;
    }

    const tmpDir = mkdtempSync(join(tmpdir(), 'dinebuddies-sa-'));
    const keyPath = join(tmpDir, 'service-account.json');
    writeFileSync(
        keyPath,
        JSON.stringify(
            {
                type: 'service_account',
                project_id: projectId,
                private_key_id: privateKeyId,
                private_key: privateKey,
                client_email: clientEmail,
                client_id: '',
                auth_uri: 'https://accounts.google.com/o/oauth2/auth',
                token_uri: 'https://oauth2.googleapis.com/token',
            },
            null,
            2
        )
    );

    return {
        tmpDir,
        env: ensureNodeTlsEnv({
            ...process.env,
            GOOGLE_APPLICATION_CREDENTIALS: keyPath,
            GCLOUD_PROJECT: projectId,
            GOOGLE_CLOUD_PROJECT: projectId,
        }),
    };
}

console.log(`[deploy-functions] Project: ${projectId}`);
console.log(`[deploy-functions] Deploying: ${onlyArg}`);

let deployEnv = ensureNodeTlsEnv(process.env);
let cleanup = () => {};

if (!forceServiceAccount) {
    const login = getFirebaseCliLogin();
    if (login.email) {
        console.log(`[deploy-functions] Using Firebase CLI login: ${login.email}`);
    } else {
        console.warn('[deploy-functions] No Firebase CLI login — trying service account fallback…');
        const sa = buildServiceAccountEnv();
        if (!sa) {
            printFirebaseLoginHelp();
            process.exit(1);
        }
        deployEnv = sa.env;
        cleanup = () => {
            try {
                rmSync(sa.tmpDir, { recursive: true, force: true });
            } catch {
                /* ignore */
            }
        };
        console.log('[deploy-functions] Using service account from .env (needs IAM ActAs on appspot SA)');
    }
} else {
    const sa = buildServiceAccountEnv();
    if (!sa) process.exit(1);
    deployEnv = sa.env;
    cleanup = () => {
        try {
            rmSync(sa.tmpDir, { recursive: true, force: true });
        } catch {
            /* ignore */
        }
    };
    console.log('[deploy-functions] Forced service account from .env');
}

const forceDeleteOrphans = argv.includes('--force') || filterArg === 'all';

const deployArgs = ['deploy', '--only', onlyArg, '--project', projectId, '--non-interactive'];
if (forceDeleteOrphans) {
    console.log('[deploy-functions] --force: remove cloud functions missing from local source');
    deployArgs.push('--force');
}

const result = runFirebase(deployArgs, { cwd: root, env: deployEnv });

cleanup();
process.exit(result.status ?? 1);
