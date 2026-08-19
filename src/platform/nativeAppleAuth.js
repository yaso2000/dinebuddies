import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  OAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
} from 'firebase/auth';
import { isNativeIos } from './runtime';

/** Apple's native sign-in requirement is iOS-specific — Android/web keep the existing popup/redirect path. */
export function isNativeAppleSignInAvailable() {
  return isNativeIos();
}

async function obtainNativeAppleCredential() {
  if (!isNativeAppleSignInAvailable()) {
    const err = new Error('NATIVE_IOS_REQUIRED');
    err.code = 'auth/operation-not-supported-in-this-environment';
    throw err;
  }

  const result = await FirebaseAuthentication.signInWithApple({
    scopes: ['email', 'name'],
  });
  const idToken = result?.credential?.idToken;
  if (!idToken) {
    const err = new Error('Apple Sign-In did not return an ID token.');
    err.code = 'auth/no-credential';
    throw err;
  }
  return new OAuthProvider('apple.com').credential({
    idToken,
    rawNonce: result.credential.nonce,
  });
}

/**
 * Sign in through the native Sign In with Apple sheet, then establish the shared
 * web Firebase session from the returned ID token.
 *
 * @param {import('firebase/auth').Auth} auth
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export async function signInWithNativeAppleCredential(auth) {
  const credential = await obtainNativeAppleCredential();
  return signInWithCredential(auth, credential);
}

/**
 * Re-authenticate the current Firebase user with native Sign In with Apple.
 *
 * @param {import('firebase/auth').User} user
 */
export async function reauthenticateWithNativeApple(user) {
  const credential = await obtainNativeAppleCredential();
  return reauthenticateWithCredential(user, credential);
}
