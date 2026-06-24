/**
 * Firebase CLI login with Windows SSL fix pre-applied.
 * Usage: npm run firebase:login
 */
import { ensureNodeTlsEnv, runFirebase } from './_firebaseCliAuth.mjs';

const env = ensureNodeTlsEnv(process.env);
const args = process.argv.slice(2);
const loginArgs = args.length ? args : ['login', '--reauth'];

const result = runFirebase(loginArgs, { env });
process.exit(result.status ?? 1);
