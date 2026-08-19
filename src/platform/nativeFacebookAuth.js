import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  FacebookAuthProvider,
  OAuthProvider,
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

  // iOS forces Limited Login (App Tracking Transparency) — the classic access
  // token it returns is not valid for Graph API / Firebase exchange there.
  // Android has no such restriction and keeps using the classic access token.
  const useLimitedLogin = isNativeIos();

  const result = await FirebaseAuthentication.signInWithFacebook({
    scopes: ['email', 'public_profile'],
    useLimitedLogin,
  });

  if (useLimitedLogin) {
    const idToken = result?.credential?.idToken;
    if (!idToken) {
      const err = new Error('Facebook Sign-In did not return an ID token.');
      err.code = 'auth/no-credential';
      throw err;
    }
    return { idToken, nonce: result.credential.nonce };
  }

  const accessToken = result?.credential?.accessToken;
  if (!accessToken) {
    const err = new Error('Facebook Sign-In did not return an access token.');
    err.code = 'auth/no-credential';
    throw err;
  }
  return { accessToken };
}

function buildFacebookCredential(token) {
  if (token.idToken) {
    return new OAuthProvider('facebook.com').credential({
      idToken: token.idToken,
      rawNonce: token.nonce,
    });
  }
  return FacebookAuthProvider.credential(token.accessToken);
}

/**
 * Sign in through the native Facebook Login SDK, then establish the shared web
 * Firebase session from the returned credential.
 *
 * @param {import('firebase/auth').Auth} auth
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export async function signInWithNativeFacebookCredential(auth) {
  const token = await obtainNativeFacebookAccessToken();
  return signInWithCredential(auth, buildFacebookCredential(token));
}

/**
 * Re-authenticate the current Firebase user with native Facebook Login.
 *
 * @param {import('firebase/auth').User} user
 */
export async function reauthenticateWithNativeFacebook(user) {
  const token = await obtainNativeFacebookAccessToken();
  return reauthenticateWithCredential(user, buildFacebookCredential(token));
}
