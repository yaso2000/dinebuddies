/**
 * Check Firebase CLI login (run this before any deploy).
 * Usage: npm run firebase:whoami
 */
import { ensureNodeTlsEnv, getFirebaseCliLogin, printFirebaseLoginHelp } from './_firebaseCliAuth.mjs';

ensureNodeTlsEnv();
const { email, output } = getFirebaseCliLogin();

if (email) {
    console.log(`Firebase CLI: logged in as ${email}`);
    process.exit(0);
}

console.log(output.trim() || 'Firebase CLI: not logged in');
printFirebaseLoginHelp();
process.exit(1);
