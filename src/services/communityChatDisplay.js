import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';

const REGION = 'us-central1';

function call(name, payload) {
  const fn = httpsCallable(getFunctions(app, REGION), name);
  return fn(payload).then((result) => result.data);
}

export function ensureCommunityChatDisplayLink(partnerId) {
  return call('ensureCommunityChatDisplayLink', { partnerId });
}

export function revokeCommunityChatDisplayLink(partnerId) {
  return call('revokeCommunityChatDisplayLink', { partnerId });
}

export function signInCommunityChatDisplay(partnerId, token) {
  return call('signInCommunityChatDisplay', { partnerId, token });
}
