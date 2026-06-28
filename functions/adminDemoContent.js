/**
 * Admin-seeded community posts and public invitations attributed to demo users.
 */
const { resolveRestaurantGeo } = require('./invitationRules');
const { computeArchiveAfterFirestoreTimestamp } = require('./invitationArchiveCore');

function asTrimmedString(v) {
    return typeof v === 'string' ? v.trim() : '';
}

function asStringArray(v) {
    if (!Array.isArray(v)) return [];
    return v.map((item) => String(item || '').trim()).filter(Boolean);
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} demoUid
 */
async function getDemoUserOrThrow(db, demoUid) {
    const id = asTrimmedString(demoUid);
    if (!id) throw new Error('demoUid is required.');
    const snap = await db.collection('users').doc(id).get();
    if (!snap.exists || snap.data()?.isDemo !== true) {
        throw new Error('Demo user not found.');
    }
    return { uid: id, ...(snap.data() || {}) };
}

function demoAuthorFromUser(user) {
    return {
        id: user.uid,
        name: user.displayName || user.display_name || user.name || 'User',
        avatar: user.photo_url || user.photoURL || '',
    };
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {typeof import('firebase-admin')} admin
 * @param {Record<string, unknown>} input
 * @param {string} adminUid
 */
async function createDemoUserPost(db, admin, input, adminUid) {
    const demoUid = asTrimmedString(input.demoUid);
    const content = asTrimmedString(input.content);
    const postTitle = asTrimmedString(input.postTitle) || null;
    const mediaUrl = asTrimmedString(input.mediaUrl) || null;
    const mediaType = asTrimmedString(input.mediaType) || (mediaUrl ? 'image' : null);

    if (!content && !mediaUrl) {
        throw new Error('Post must include text content or an image.');
    }

    const user = await getDemoUserOrThrow(db, demoUid);
    const author = demoAuthorFromUser(user);
    const coords = user.coordinates && typeof user.coordinates === 'object' ? user.coordinates : null;

    /** @type {Record<string, unknown>} */
    const postData = {
        author,
        authorId: demoUid,
        postTitle,
        content: content || '',
        mediaUrl,
        mediaType,
        textStyle: {
            fontSize: 16,
            textAlign: 'left',
            fontWeight: 'normal',
            fontStyle: 'normal',
            color: '#f4f4f5',
            backgroundColor: 'transparent',
            fontFamily: '"Inter", sans-serif',
        },
        overlayText: '',
        overlayStyle: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        likes: [],
        comments: [],
        reposts: [],
        isDemoContent: true,
        adminCreatedBy: adminUid,
        adminCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (coords && Number.isFinite(Number(coords.lat)) && Number.isFinite(Number(coords.lng))) {
        postData.coordinates = { lat: Number(coords.lat), lng: Number(coords.lng) };
        postData.city = user.city || null;
        postData.country = user.country || null;
        postData.countryCode = user.countryCode || null;
        postData.location = user.location || user.city || null;
        postData.publishGeoSource = 'demo_user';
        postData.publishGeoAt = admin.firestore.FieldValue.serverTimestamp();
    }

    const ref = await db.collection('communityPosts').add(postData);
    return {
        success: true,
        postId: ref.id,
        authorId: demoUid,
        authorName: author.name,
    };
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {typeof import('firebase-admin')} admin
 * @param {Record<string, unknown>} input
 * @param {string} adminUid
 */
async function createDemoUserPublicInvitation(db, admin, input, adminUid) {
    const demoUid = asTrimmedString(input.demoUid);
    const title = asTrimmedString(input.title);
    const date = asTrimmedString(input.date);
    const time = asTrimmedString(input.time) || '20:30';
    const location = asTrimmedString(input.location);

    if (!title) throw new Error('title is required.');
    if (!date) throw new Error('date is required.');
    if (!time) throw new Error('time is required.');
    if (!location) throw new Error('location is required.');

    const genderGroups = asStringArray(input.genderGroups);
    const ageGroups = asStringArray(input.ageGroups);
    if (genderGroups.length === 0) throw new Error('Select at least one gender group.');
    if (ageGroups.length === 0) throw new Error('Select at least one age group.');

    const user = await getDemoUserOrThrow(db, demoUid);
    const author = { ...demoAuthorFromUser(user), isBusiness: false };

    let lat = Number(input.lat);
    let lng = Number(input.lng);
    let venueCountryCode = asTrimmedString(input.countryCode) || user.countryCode || null;
    const restaurantId = asTrimmedString(input.restaurantId) || null;
    let restaurantName = asTrimmedString(input.restaurantName) || null;
    let restaurantImage = asTrimmedString(input.restaurantImage) || null;

    if (restaurantId) {
        const geo = await resolveRestaurantGeo(db, restaurantId);
        if (geo.lat != null) lat = geo.lat;
        if (geo.lng != null) lng = geo.lng;
        if (geo.countryCode) venueCountryCode = geo.countryCode;

        if (!restaurantName || !restaurantImage) {
            const [restSnap, profileSnap] = await Promise.all([
                db.collection('restaurants').doc(restaurantId).get(),
                db.collection('public_profiles').doc(restaurantId).get(),
            ]);
            const rest = restSnap.exists ? (restSnap.data() || {}) : {};
            const profile = profileSnap.exists ? (profileSnap.data() || {}) : {};
            const info = profile.businessPublic && typeof profile.businessPublic === 'object'
                ? profile.businessPublic
                : {};
            if (!restaurantName) {
                restaurantName = rest.name || info.businessName || profile.displayName || null;
            }
            if (!restaurantImage) {
                restaurantImage =
                    rest.image ||
                    rest.coverImage ||
                    info.coverImage ||
                    profile.coverImage ||
                    null;
            }
        }
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error('Venue coordinates are required. Select a business or enter lat/lng.');
    }

    const creatorLat = Number(user.coordinates?.lat ?? lat);
    const creatorLng = Number(user.coordinates?.lng ?? lng);

    /** @type {Record<string, unknown>} */
    const invData = {
        title,
        description: asTrimmedString(input.description) || '',
        inviteCategory: 'public',
        status: 'active',
        hostId: demoUid,
        authorId: demoUid,
        author,
        userCity: user.city || null,
        userLat: creatorLat,
        userLng: creatorLng,
        restaurantCity: asTrimmedString(input.city) || user.city || null,
        city: asTrimmedString(input.city) || user.city || null,
        country: user.country || '',
        countryCode: venueCountryCode,
        location,
        lat,
        lng,
        date,
        time,
        guestsNeeded: Math.min(10, Math.max(1, Math.floor(Number(input.guestsNeeded) || 3))),
        genderGroups,
        ageGroups,
        genderPreference: 'custom',
        ageRange: 'custom',
        paymentType: asTrimmedString(input.paymentType) || 'Split',
        privacy: 'public',
        type: asTrimmedString(input.type) || 'Restaurant',
        inviteMood: asTrimmedString(input.inviteMood) || 'social',
        templateType: asTrimmedString(input.templateType) || 'hero_4_5',
        colorScheme: asTrimmedString(input.colorScheme) || 'oceanBlue',
        requests: [],
        joined: [],
        chat: [],
        meetingStatus: 'planning',
        publishedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        archiveAfterAt: computeArchiveAfterFirestoreTimestamp(date, time),
        isDemoContent: true,
        adminCreatedBy: adminUid,
        adminCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (restaurantId) {
        invData.restaurantId = restaurantId;
        if (restaurantName) invData.restaurantName = restaurantName;
        if (restaurantImage) {
            invData.restaurantImage = restaurantImage;
            invData.mediaSource = 'restaurant';
            invData.mediaType = 'image';
        }
    }

    const cardFontFamily = asTrimmedString(input.cardFontFamily);
    if (cardFontFamily) invData.cardFontFamily = cardFontFamily;

    const ref = await db.collection('invitations').add(invData);
    return {
        success: true,
        invitationId: ref.id,
        hostId: demoUid,
        hostName: author.name,
    };
}

module.exports = {
    createDemoUserPost,
    createDemoUserPublicInvitation,
};
