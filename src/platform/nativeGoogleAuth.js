import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  GoogleAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
} from 'firebase/auth';
import { isNativeAndroid, isNativeIos } from './runtime';

const AppSigningInfo = registerPlugin('AppSigningInfo');

export function isNativeGoogleSignInAvailable() {
  return isNativeAndroid() || isNativeIos();
}

function isNoCredentialsError(err) {
  const msg = String(err?.message || err || '');
  const code = String(err?.code || '');
  return (
    /no credentials available/i.test(msg) ||
    /NoCredentialException/i.test(msg) ||
    /GET_NO_CREDENTIALS/i.test(code) ||
    /GET_NO_CREDENTIALS/i.test(msg)
  );
}

function isDeveloperError10(err) {
  const msg = String(err?.message || err || '');
  const code = String(err?.code || '');
  return (
    /\b10\b/.test(msg) ||
    /DEVELOPER_ERROR/i.test(msg) ||
    /ApiException:\s*10/i.test(msg) ||
    code === '10'
  );
}

async function readNativeAppLabel() {
  try {
    const info = await App.getInfo();
    return `${info?.name || 'app'} ${info?.version || '?'} (${info?.build || '?'})`;
  } catch {
    return 'Android app';
  }
}

async function readDeviceSha1() {
  if (Capacitor.getPlatform() !== 'android') return null;
  try {
    const info = await AppSigningInfo.getSigningCertificates();
    return info?.sha1 || null;
  } catch {
    return null;
  }
}

async function obtainNativeGoogleIdToken() {
  if (!isNativeGoogleSignInAvailable()) {
    const err = new Error('NATIVE_ANDROID_REQUIRED');
    err.code = 'auth/operation-not-supported-in-this-environment';
    throw err;
  }

  // Never call FirebaseAuthentication.signOut() before Google Sign-In.

  let result;
  let lastError;
  const attempts = [
    { useCredentialManager: false },
    { useCredentialManager: true },
  ];

  for (const opts of attempts) {
    try {
      result = await FirebaseAuthentication.signInWithGoogle(opts);
      if (result?.credential?.idToken) break;
      lastError = Object.assign(new Error('Google Sign-In did not return an ID token.'), {
        code: 'auth/no-credential',
      });
    } catch (err) {
      lastError = err;
      if (!isNoCredentialsError(err) && !isDeveloperError10(err)) {
        throw err;
      }
    }
  }

  const idToken = result?.credential?.idToken;
  if (!idToken) {
    const appLabel = await readNativeAppLabel();
    const sha1 = await readDeviceSha1();
    const base = lastError || new Error('Google Sign-In did not return an ID token.');
    if (isDeveloperError10(base) || isNoCredentialsError(base)) {
      const shaPart = sha1 ? ` Device SHA-1: ${sha1}` : '';
      const err = new Error(
        `Google Sign-In failed on ${appLabel}.${shaPart} Add this exact SHA-1 in Firebase → Project settings → Android app, download google-services.json, rebuild.`
      );
      err.code = 'auth/google-developer-error';
      err.cause = base;
      err.deviceSha1 = sha1;
      throw err;
    }
    throw base;
  }
  return idToken;
}

/**
 * @param {import('firebase/auth').Auth} auth
 */
export async function signInWithNativeGoogleCredential(auth) {
  const idToken = await obtainNativeGoogleIdToken();
  return signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}

/**
 * @param {import('firebase/auth').User} user
 */
export async function reauthenticateWithNativeGoogle(user) {
  const idToken = await obtainNativeGoogleIdToken();
  return reauthenticateWithCredential(user, GoogleAuthProvider.credential(idToken));
}
