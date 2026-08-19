import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  FacebookAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
} from 'firebase/auth';
import { isNativeAndroid, isNativeIos } from './runtime';

export function isNativeFacebookSignInAvailable() {
  return isNativeAndroid() || isNativeIos();
}

async function obtainNativeFacebookAccessToken() {
  if (!isNativeFacebookSignInAvailable()) {
    const err = new Error('NATIVE_ANDROID_REQUIRED');
    err.code = 'auth/operation-not-supported-in-this-environment';
    throw err;
  }

  // Do not call FirebaseAuthentication.signOut() before Facebook Login.
  // It clears LoginManager state and can leave the native sheet unresponsive.

  const result = await FirebaseAuthentication.signInWithFacebook({
    scopes: ['email', 'public_profile'],
  });
  const accessToken = result?.credential?.accessToken;
  if (!accessToken) {
    const err = new Error('Facebook Sign-In did not return an access token.');
    err.code = 'auth/no-credential';
    throw err;
  }
  return accessToken;
}

/**
 * Sign in through the native Facebook Login SDK, then establish the shared web
 * Firebase session from the returned access token.
 *
 * @param {import('firebase/auth').Auth} auth
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export async function signInWithNativeFacebookCredential(auth) {
  const accessToken = await obtainNativeFacebookAccessToken();
  return signInWithCredential(auth, FacebookAuthProvider.credential(accessToken));
}

/**
 * Re-authenticate the current Firebase user with native Facebook Login.
 *
 * @param {import('firebase/auth').User} user
 */
export async function reauthenticateWithNativeFacebook(user) {
  const accessToken = await obtainNativeFacebookAccessToken();
  return reauthenticateWithCredential(
    user,
    FacebookAuthProvider.credential(accessToken)
  );
}
