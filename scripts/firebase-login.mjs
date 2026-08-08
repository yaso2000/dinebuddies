/**
 * Firebase CLI login with Windows SSL fix pre-applied.
 *
 * Usage:
 *   npm run firebase:login
 *   npm run firebase:login:reauth
 *   npm run firebase:login -- --no-localhost
 */
import { ensureNodeTlsEnv, runFirebase } from './_firebaseCliAuth.mjs';

const FIREBASE_SUBCOMMANDS = new Set([
    'login',
    'login:ci',
    'logout',
    'projects:list',
    'use',
]);

function resolveLoginArgs(rawArgs) {
    if (rawArgs.length === 0) {
        return process.platform === 'win32' ? ['login', '--no-localhost'] : ['login', '--reauth'];
    }

    const [first, ...rest] = rawArgs;
    if (FIREBASE_SUBCOMMANDS.has(first)) {
        return rawArgs;
    }

    // npm run firebase:login -- --reauth --no-localhost → firebase login --reauth --no-localhost
    return ['login', ...rawArgs];
}

const env = ensureNodeTlsEnv(process.env);
const loginArgs = resolveLoginArgs(process.argv.slice(2));

const result = runFirebase(loginArgs, { env });
process.exit(result.status ?? 1);
