import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { uploadManagedImage } from './managedImageUpload';
import { ImageUploadZone } from './imageUploadZones';
import { getBusinessSubscriptionAccess } from '../utils/businessSubscription';
import { normalizeSwipeSpecialOffer, toDateInputValue } from '../utils/businessSwipeSpecialOffer';
import { syncBusinessPublicProfile } from './businessPublicProfileSync';

function assertPaidBusiness(userData) {
  const { isPaid } = getBusinessSubscriptionAccess(userData?.subscriptionTier);
  if (!isPaid) {
    throw new Error('Swipe special offers require a Paid Business subscription.');
  }
}

/**
 * Save / replace the swipe-card special offer (one active slot on the business).
 * @param {{ title: string, startDate: string, endDate: string, imageUrl?: string|null, clearImage?: boolean }} offerInput
 * @param {File|null} [file]
 */
export async function saveBusinessSwipeSpecialOffer(offerInput, file = null) {
  const user = auth.currentUser;
  if (!user) throw new Error('Unauthorized');

  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('Business profile not found');
  const userData = snap.data() || {};
  assertPaidBusiness(userData);

  const title = String(offerInput?.title || '').trim().slice(0, 80);
  const startDate = toDateInputValue(offerInput?.startDate);
  const endDate = toDateInputValue(offerInput?.endDate);
  if (!title) throw new Error('Offer title is required.');
  if (!startDate || !endDate) throw new Error('Start and end dates are required.');
  if (endDate < startDate) throw new Error('End date must be on or after the start date.');

  let imageUrl = offerInput?.clearImage
    ? null
    : String(offerInput?.imageUrl || '').trim() || null;

  if (file) {
    imageUrl = await uploadManagedImage(file, user.uid, ImageUploadZone.OFFER);
  }

  const payload = normalizeSwipeSpecialOffer({
    title,
    imageUrl,
    startDate,
    endDate,
  });
  if (!payload) throw new Error('Invalid offer.');

  await updateDoc(userRef, {
    'businessInfo.swipeSpecialOffer': {
      ...payload,
      updatedAt: serverTimestamp(),
    },
  });

  try {
    await syncBusinessPublicProfile(user.uid);
  } catch (err) {
    console.warn('[swipeSpecialOffer] public sync failed (will retry via backend):', err?.message || err);
  }

  return payload;
}

/** Remove the swipe-card special offer. */
export async function clearBusinessSwipeSpecialOffer() {
  const user = auth.currentUser;
  if (!user) throw new Error('Unauthorized');

  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('Business profile not found');
  assertPaidBusiness(snap.data() || {});

  await updateDoc(userRef, {
    'businessInfo.swipeSpecialOffer': null,
  });

  try {
    await syncBusinessPublicProfile(user.uid);
  } catch (err) {
    console.warn('[swipeSpecialOffer] public sync failed (will retry via backend):', err?.message || err);
  }
}
