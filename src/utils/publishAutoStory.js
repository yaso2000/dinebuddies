import { collection, doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { uploadImage } from './imageUpload';
import { ImageUploadZone } from '../services/imageUploadZones';
import { getSafeAvatar } from './avatarUtils';
import { generateStoryCardBlob, generateStudioPostStoryCardBlob } from './shareCardCanvas';

const IMAGE_STORY_DURATION_MS = 5000;

async function resolveStoryAuthor(currentUser) {
  const userDocSnap = await getDoc(doc(db, 'users', currentUser.uid));
  const freshUserData = userDocSnap.exists() ? userDocSnap.data() : {};
  const userName =
    freshUserData.businessInfo?.businessName ||
    freshUserData.name ||
    freshUserData.displayName ||
    currentUser.displayName ||
    'User';
  const userPhoto = getSafeAvatar(freshUserData || currentUser);
  return { userName, userPhoto };
}

/** Uploads the given image blob and writes the story doc — shared by every auto-story path below. */
async function publishStoryImageBlob({ currentUser, blob, sourceType, userName, userPhoto }) {
  if (!blob) return;

  const path = `stories/${currentUser.uid}/auto_${sourceType}_${Date.now()}.png`;
  const mediaUrl = await uploadImage(blob, path, null, {}, {
    moderationZone: ImageUploadZone.STORY,
    userId: currentUser.uid,
  });

  const storyRef = doc(collection(db, 'stories'));
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const batch = writeBatch(db);
  batch.set(storyRef, {
    userId: String(currentUser.uid),
    userPhoto,
    userName,
    type: 'image',
    url: mediaUrl,
    posterUrl: null,
    text: '',
    fontFamily: null,
    textColor: null,
    backgroundColor: null,
    sessionId: storyRef.id,
    order: 0,
    mediaDurationMs: IMAGE_STORY_DURATION_MS,
    views: {},
    likes: {},
    createdAt: serverTimestamp(),
    expiresAt,
  });
  await batch.commit();
}

/**
 * Publishes an invitation as a standalone 24h story: a branded image
 * rendered natively at the real 9:16 story aspect ratio (generateStoryCard —
 * full-bleed hero, large type sized for that canvas), including
 * date/time/guests/payment/location, matching how the invitation actually
 * looks on the Invitations feed, just without the action buttons since it's
 * a static image. No link back to the source — stories expire in a day, so
 * there's nothing worth linking to by the time anyone would click it.
 * Reuses CreateStory.jsx's exact story-doc shape so the result is
 * indistinguishable from a manually-created single-image story. Safe to
 * call repeatedly (e.g. once a day) — each call is a fresh, independent
 * story doc.
 */
export async function publishContentAsStory({
  currentUser,
  title,
  image,
  description,
  date,
  time,
  location,
  maxGuests,
  paymentLine,
  sourceType = 'post',
}) {
  if (!currentUser?.uid || !image) return;

  const { userName, userPhoto } = await resolveStoryAuthor(currentUser);

  const cardBlob = await generateStoryCardBlob({
    title,
    image,
    description,
    date,
    time,
    location,
    maxGuests,
    paymentLine,
    hostName: userName,
    showMeta: sourceType === 'invitation',
  });

  await publishStoryImageBlob({ currentUser, blob: cardBlob, sourceType, userName, userPhoto });
}

/**
 * Publishes a business post as a story, honoring the post's own Studio
 * style choices (text position top/center/bottom, alignment, colors,
 * overlay tint) instead of the fixed-layout invitation card above — this is
 * what makes it resemble the actual post rather than a generic template.
 *
 * An earlier version of this screenshotted the post's own off-screen DOM
 * render via html2canvas for a pixel-exact match, but that broke outright:
 * Chrome now serializes any color-mix()-derived computed color (used
 * throughout this app's CSS, including the Studio's own styles) as
 * `color(srgb ...)`, a syntax html2canvas's CSS parser doesn't recognize at
 * all — it throws before rendering anything, on every attempt, regardless
 * of which specific colors are in play. There's no reliable way to flatten
 * around it (getComputedStyle returns that same unparseable format), so
 * this draws the story directly instead of capturing the DOM.
 */
export async function publishStudioPostAsStory({ currentUser, title, body, image, style, sourceType = 'post' }) {
  if (!currentUser?.uid || !image) return;

  const { userName, userPhoto } = await resolveStoryAuthor(currentUser);

  const cardBlob = await generateStudioPostStoryCardBlob({ title, body, image, style });

  await publishStoryImageBlob({ currentUser, blob: cardBlob, sourceType, userName, userPhoto });
}
