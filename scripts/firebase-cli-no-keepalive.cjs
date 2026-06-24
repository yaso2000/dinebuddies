/**
 * Workaround for firebase-tools + Node 19+ (keepAlive breaks auth.firebase.tools/attest).
 * Usage (PowerShell):
 *   $env:NODE_OPTIONS="--require $PWD/scripts/firebase-cli-no-keepalive.cjs"
 *   npx firebase login --reauth
 */
require('http').globalAgent.keepAlive = false;
require('https').globalAgent.keepAlive = false;
