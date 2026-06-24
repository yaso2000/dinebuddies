/**
 * Deploy Firebase auth config (googleSignIn redirect URIs) with CLI workarounds applied.
 * Usage: npm run deploy:firebase-auth
 */
import { ensureNodeTlsEnv, runFirebase } from './_firebaseCliAuth.mjs';

const result = runFirebase(['deploy', '--only', 'auth'], {
    env: ensureNodeTlsEnv(process.env),
});
process.exit(result.status ?? 1);
