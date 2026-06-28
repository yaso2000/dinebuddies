/**
 * Admin-seeded demo consumer profiles (Firestore only — no Auth accounts).
 */
const admin = require('firebase-admin');
const crypto = require('crypto');
const { resolveDemoMediaAssets } = require('./demoUserMediaAssets');

const DEMO_COUNT_MAX = 50;
const PERSONA_POOL_SIZE = 20;

const DINING_PERSONA_PRESETS = [
    '☕ Coffee',
    '🚶 Walking',
    '🍿 Cinema',
    '🍣 Sushi',
    '🎨 Art',
    '🍕 Pizza',
    '🥗 Healthy',
    '🌮 Street Food',
    '🎵 Live Music',
    '🏃 Running',
];

const JOIN_REASON_PAIRS = [
    ['open_to_dating', 'new_friends'],
    ['open_to_dating', 'fun_hangouts'],
    ['open_to_dating', 'explore_places'],
    ['open_to_dating', 'activity_partner'],
];

const INVITE_PREFS = ['any', 'any', 'any', 'male_only', 'female_only'];

const LOOKING_FOR_VALID = new Set(['dating', 'friendship', 'social']);

function normalizeLookingFor(raw, { includeDating = true } = {}) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const item of raw) {
        let id = String(item || '').trim().toLowerCase();
        if (id === 'icebreaker') id = 'social';
        if (!LOOKING_FOR_VALID.has(id) || out.includes(id)) continue;
        if (id === 'dating' && !includeDating) continue;
        out.push(id);
        if (out.length >= LOOKING_FOR_VALID.size) break;
    }
    return out;
}

function normalizeOpenToDating(raw) {
    return raw === true;
}

function syncLookingForWithOpenToDating(lookingFor, openToDating) {
    const normalized = normalizeLookingFor(lookingFor, { includeDating: true });
    if (openToDating) {
        return normalized.includes('dating') ? normalized : [...normalized, 'dating'];
    }
    return normalized.filter((id) => id !== 'dating');
}

/** Curated Unsplash sets — avatar (square), cover (landscape), gallery ×3 (portrait 9:16). */
const PERSONA_MEDIA = [
    {
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
        cover: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&h=600&fit=crop',
        gallery: [
            'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=540&h=960&fit=crop',
            'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=540&h=960&fit=crop',
            'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=540&h=960&fit=crop',
        ],
    },
    {
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
        cover: 'https://images.unsplash.com/photo-1514933651103-005fec06c04b?w=1200&h=600&fit=crop',
        gallery: [
            'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=540&h=960&fit=crop',
            'https://images.unsplash.com/photo-1466978913421-dad2ebd01d98?w=540&h=960&fit=crop',
            'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=540&h=960&fit=crop',
        ],
    },
    {
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=400&fit=crop',
        cover: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1200&h=600&fit=crop',
        gallery: [
            'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=540&h=960&fit=crop',
            'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=540&h=960&fit=crop',
            'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=540&h=960&fit=crop',
        ],
    },
    {
        avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop',
        cover: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1200&h=600&fit=crop',
        gallery: [
            'https://images.unsplash.com/photo-1525610553991-2bede1a236e2?w=540&h=960&fit=crop',
            'https://images.unsplash.com/photo-1554118811-1e0d58224fb2?w=540&h=960&fit=crop',
            'https://images.unsplash.com/photo-1445118980489-6619b2a0569e?w=540&h=960&fit=crop',
        ],
    },
    {
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
        cover: 'https://images.unsplash.com/photo-1478144592103-25e218a04891?w=1200&h=600&fit=crop',
        gallery: [
            'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=540&h=960&fit=crop',
            'https://images.unsplash.com/photo-1493857671505-729407e13c79?w=540&h=960&fit=crop',
            'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=540&h=960&fit=crop',
        ],
    },
    {
        avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=400&h=400&fit=crop',
        cover: 'https://images.unsplash.com/photo-1550966841-3edb65c774a3?w=1200&h=600&fit=crop',
        gallery: [
            'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=540&h=960&fit=crop',
            'https://images.unsplash.com/photo-1514933651103-005fec06c04b?w=540&h=960&fit=crop',
            'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=540&h=960&fit=crop',
        ],
    },
    {
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop',
        cover: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=1200&h=600&fit=crop',
        gallery: [
            'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=540&h=960&fit=crop',
            'https://images.unsplash.com/photo-1554118811-1e0d58224fb2?w=540&h=960&fit=crop',
            'https://images.unsplash.com/photo-1466978913421-dad2ebd01d98?w=540&h=960&fit=crop',
        ],
    },
    {
        avatar: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=400&h=400&fit=crop',
        cover: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=600&fit=crop',
        gallery: [
            'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=540&h=960&fit=crop',
            'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=540&h=960&fit=crop',
            'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=540&h=960&fit=crop',
        ],
    },
];

const FEMALE_NAMES = [
    'Layla', 'Sara', 'Nour', 'Maya', 'Emma', 'Olivia', 'Aisha', 'Fatima', 'Lina', 'Hana',
];
const MALE_NAMES = [
    'Omar', 'Adam', 'Khalid', 'James', 'Noah', 'Youssef', 'Ali', 'Ryan', 'Leo', 'Sam',
];

const AGE_CATEGORIES = ['18-24', '25-34', '25-34', '35-44', '30-34'];
const BIOS = [
    'Coffee lover exploring new spots around town.',
    'Always up for good food and great conversation.',
    'Looking for fun hangouts and maybe something more.',
    'Foodie who loves discovering hidden gems.',
    'Weekend brunch enthusiast — join me?',
];

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
}

function buildDemoCityId(city, countryCode) {
    const cc = String(countryCode || '').toLowerCase().slice(0, 2);
    const citySlug = slugify(city) || 'city';
    return `${citySlug}-${cc}`;
}

function randomOffsetCoords(baseLat, baseLng, radiusKm = 10) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * radiusKm;
    const latRad = (baseLat * Math.PI) / 180;
    const dLat = (dist * Math.cos(angle)) / 111;
    const dLng = (dist * Math.sin(angle)) / (111 * Math.cos(latRad) || 1);
    return {
        lat: baseLat + dLat,
        lng: baseLng + dLng,
    };
}

function pickPersonaMedia(index) {
    const entry = PERSONA_MEDIA[index % PERSONA_MEDIA.length];
    const portrait = portraitGalleryFromAvatar(entry.avatar);
    return {
        avatar: entry.avatar,
        cover: entry.cover,
        gallery: portrait,
    };
}

/** 9:16 portrait crops from the same person photo as avatar (dating swipe — never food/scenes). */
function portraitGalleryFromAvatar(avatarUrl) {
    const base = String(avatarUrl || '').trim().split('?')[0];
    if (!base) return ['', '', ''];
    const portrait = `${base}?w=540&h=960&fit=crop&crop=faces`;
    return [portrait, portrait, portrait];
}

const JOIN_REASON_IDS = new Set([
    'explore_places',
    'activity_partner',
    'new_friends',
    'expand_network',
    'fun_hangouts',
    'open_to_dating',
]);

const AGE_CATEGORIES_ALLOWED = new Set(['18-24', '25-34', '35-44', '45-54', '55+']);

function deriveAgeFromCategory(ageCategory) {
    const raw = String(ageCategory || '').trim();
    if (!raw) return 25;
    if (raw.endsWith('+')) {
        const n = parseInt(raw.replace(/\D/g, ''), 10);
        return Number.isFinite(n) ? n : 55;
    }
    const parts = raw.split('-');
    const n = parseInt(parts[0]?.replace(/\D/g, '') || '', 10);
    return Number.isFinite(n) ? n : 25;
}

/** Normalize one AI/Gemini persona row into internal shape. */
function normalizeAiUser(raw, index = 0) {
    if (!raw || typeof raw !== 'object') {
        throw new Error(`aiGeneratedJson[${index}] must be an object.`);
    }
    const displayName = String(raw.display_name || raw.displayName || '').trim().slice(0, 40);
    if (!displayName) {
        throw new Error(`aiGeneratedJson[${index}].display_name is required.`);
    }
    const gender = String(raw.gender || '').toLowerCase() === 'female' ? 'female' : 'male';
    const ageRaw = String(raw.ageCategory || raw.age_category || '25-34');
    const ageCategory = AGE_CATEGORIES_ALLOWED.has(ageRaw) ? ageRaw : '25-34';
    const bio = String(raw.bio || '').trim().slice(0, 150);
    const diningPersona = (Array.isArray(raw.diningPersona) ? raw.diningPersona : [])
        .map((t) => String(t || '').trim())
        .filter(Boolean)
        .slice(0, 8);
    const joinReasons = (Array.isArray(raw.joinReasons) ? raw.joinReasons : [])
        .map((r) => String(r || '').trim())
        .filter((r) => JOIN_REASON_IDS.has(r))
        .slice(0, 2);
    const safeJoinReasons =
        joinReasons.length > 0 ? joinReasons : ['open_to_dating', 'new_friends'];
    const firstDatePlaceHint = String(raw.firstDatePlaceHint || '').trim().slice(0, 30);
    const invitePref = String(raw.invitePreference || 'any').toLowerCase();
    const invitePreference =
        invitePref === 'male_only' || invitePref === 'female_only' ? invitePref : 'any';

    const galleryRaw = Array.isArray(raw.profileGallery) ? raw.profileGallery : [];
    const profileGallery = [
        String(galleryRaw[0] || '').trim(),
        String(galleryRaw[1] || '').trim(),
        String(galleryRaw[2] || '').trim(),
    ];

    return {
        displayName,
        gender,
        ageCategory,
        bio,
        diningPersona,
        joinReasons: safeJoinReasons,
        firstDatePlaceHint,
        invitePreference,
        photo_url: String(raw.photo_url || raw.photoURL || raw.avatarUrl || '').trim() || null,
        cover_photo: String(raw.cover_photo || raw.coverPhoto || '').trim() || null,
        profileGallery: profileGallery.some(Boolean) ? profileGallery : null,
    };
}

/** Admin single-user form — extends AI row with onboarding-aligned fields. */
function normalizeDemoUserProfile(raw, index = 0) {
    const base = normalizeAiUser(raw, index);
    const galleryRaw = Array.isArray(raw.profileGallery) ? raw.profileGallery : [];
    const profileGallery = [
        String(galleryRaw[0] || '').trim(),
        String(galleryRaw[1] || '').trim(),
        String(galleryRaw[2] || '').trim(),
    ];
    return {
        ...base,
        nickname: String(raw.nickname || raw.displayName || raw.display_name || base.displayName || '')
            .trim()
            .slice(0, 40),
        availableForPrivateInvite: raw.availableForPrivateInvite !== false,
        openToDating: normalizeOpenToDating(raw.openToDating),
        lookingFor: syncLookingForWithOpenToDating(raw.lookingFor, normalizeOpenToDating(raw.openToDating)),
        profileGallery,
    };
}

function normalizeMediaEntry(entry) {
    if (typeof entry === 'string') {
        const avatar = entry.trim();
        return avatar ? { avatar, cover: null, gallery: null } : null;
    }
    if (!entry || typeof entry !== 'object') return null;

    const avatar = String(entry.avatar || entry.photo_url || entry.url || '').trim();
    if (!avatar) return null;

    const cover = String(entry.cover || entry.cover_photo || '').trim() || null;
    const gallery = Array.isArray(entry.gallery)
        ? entry.gallery.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 3)
        : null;

    return { avatar, cover, gallery };
}

function pickRandomFromGenderPool(pool) {
    if (!Array.isArray(pool) || pool.length === 0) return null;
    const entry = pool[Math.floor(Math.random() * pool.length)];
    return normalizeMediaEntry(entry);
}

/**
 * Resolve avatar + cover + 3 gallery slots.
 * @param {object} aiUser normalized AI row (needs gender)
 * @param {number} index fallback index for cover/gallery
 * @param {object} [mediaAssets] { male: string[]|object[], female: [...] }
 */
function resolvePersonaMedia(aiUser, index, mediaAssets) {
    if (aiUser.photo_url) {
        const fallback = pickPersonaMedia(index);
        const gallery =
            aiUser.profileGallery && aiUser.profileGallery.some(Boolean)
                ? aiUser.profileGallery
                : fallback.gallery;
        return {
            avatar: aiUser.photo_url,
            cover: aiUser.cover_photo || fallback.cover,
            gallery: [...gallery],
        };
    }

    const genderPool = aiUser.gender === 'female' ? mediaAssets?.female : mediaAssets?.male;
    const picked = pickRandomFromGenderPool(genderPool);
    if (picked) {
        return {
            avatar: picked.avatar,
            cover: picked.cover || picked.avatar,
            gallery:
                Array.isArray(picked.gallery) && picked.gallery.length >= 3
                    ? picked.gallery.slice(0, 3)
                    : [picked.avatar, picked.avatar, picked.avatar],
        };
    }

    return pickPersonaMedia(index);
}

/**
 * Admin single demo user — never fill gallery from defaults; only admin uploads count.
 */
function resolveAdminDemoUserMedia(aiUser, mediaAssets) {
    const gallery = Array.isArray(aiUser.profileGallery)
        ? [
              String(aiUser.profileGallery[0] || '').trim(),
              String(aiUser.profileGallery[1] || '').trim(),
              String(aiUser.profileGallery[2] || '').trim(),
          ]
        : ['', '', ''];

    if (aiUser.photo_url) {
        let cover = aiUser.cover_photo || '';
        if (!cover) {
            const genderPool = aiUser.gender === 'female' ? mediaAssets?.female : mediaAssets?.male;
            const picked = pickRandomFromGenderPool(genderPool);
            cover = picked?.cover || picked?.avatar || aiUser.photo_url;
        }
        return {
            avatar: aiUser.photo_url,
            cover,
            gallery: [...gallery],
        };
    }

    const genderPool = aiUser.gender === 'female' ? mediaAssets?.female : mediaAssets?.male;
    const picked = pickRandomFromGenderPool(genderPool);
    if (picked) {
        return {
            avatar: picked.avatar,
            cover: aiUser.cover_photo || picked.cover || picked.avatar,
            gallery: [...gallery],
        };
    }

    const fallback = pickPersonaMedia(0);
    return {
        avatar: fallback.avatar,
        cover: aiUser.cover_photo || fallback.cover,
        gallery: [...gallery],
    };
}

function buildPersonaProfile(index, batchId) {
    const isFemale = index % 2 === 1;
    const names = isFemale ? FEMALE_NAMES : MALE_NAMES;
    const displayName = names[index % names.length];
    const media = pickPersonaMedia(index);
    const joinReasons = JOIN_REASON_PAIRS[index % JOIN_REASON_PAIRS.length];
    const personaTags = [
        DINING_PERSONA_PRESETS[index % DINING_PERSONA_PRESETS.length],
        DINING_PERSONA_PRESETS[(index + 3) % DINING_PERSONA_PRESETS.length],
        DINING_PERSONA_PRESETS[(index + 5) % DINING_PERSONA_PRESETS.length],
    ];

    return {
        displayName,
        gender: isFemale ? 'female' : 'male',
        ageCategory: AGE_CATEGORIES[index % AGE_CATEGORIES.length],
        bio: BIOS[index % BIOS.length],
        media,
        joinReasons,
        diningPersona: personaTags,
        invitePreference: INVITE_PREFS[index % INVITE_PREFS.length],
        firstDatePlaceHint: ['Quiet café', 'Rooftop spot', 'Park walk', 'Sushi bar'][index % 4],
        batchId,
    };
}

function buildDemoUserDoc({
    uid,
    persona,
    geo,
    demoCityId,
    batchId,
    adminUid,
}) {
    const coords = geo.exactCoords
        ? { lat: geo.lat, lng: geo.lng }
        : randomOffsetCoords(geo.lat, geo.lng, 12);
    const locationParts = [geo.city, geo.stateName, geo.countryName].filter(Boolean);
    const fullLocation = locationParts.join(', ');
    const age = deriveAgeFromCategory(persona.ageCategory);

    return {
        uid,
        role: 'user',
        display_name: persona.displayName,
        displayName: persona.displayName,
        name: persona.displayName,
        nickname: persona.nickname || persona.displayName,
        gender: persona.gender,
        ageCategory: persona.ageCategory,
        age_category: persona.ageCategory,
        age,
        isProfileComplete: true,
        isDemo: true,
        access_platform: 'all',
        demoCityId,
        demoBatchId: batchId,
        demoCreatedBy: adminUid,
        demoCreatedAt: admin.firestore.FieldValue.serverTimestamp(),

        photo_url: persona.media.avatar,
        photoURL: persona.media.avatar,
        cover_photo: persona.media.cover,
        profileGallery: [...persona.media.gallery],
        directoryCoverIndex: 0,

        bio: persona.bio,
        diningPersona: persona.diningPersona,
        joinReasons: persona.joinReasons,
        firstDatePlaceHint: persona.firstDatePlaceHint,
        availableForPrivateInvite: persona.availableForPrivateInvite !== false,
        invitePreference: persona.invitePreference,
        openToDating: persona.openToDating === true,
        lookingFor: Array.isArray(persona.lookingFor) ? persona.lookingFor : [],

        city: geo.city,
        country: geo.countryName || '',
        countryCode: String(geo.countryCode || '').toUpperCase().slice(0, 2),
        location: fullLocation,
        coordinates: coords,

        reputation: 80 + (persona.displayName.length * 3),
        freeCredits: 0,
        paidCredits: 0,
        savedCredits: 0,
        followersCount: 5 + (uid.charCodeAt(uid.length - 1) % 40),
        following: [],
        isGuest: false,
        created_time: admin.firestore.FieldValue.serverTimestamp(),
        last_active_time: admin.firestore.FieldValue.serverTimestamp(),
        lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        locationSource: 'demo_seed',
        privacySettings: {
            profileVisibility: 'public',
            showEmail: false,
            showLocation: true,
            allowMessages: true,
            allowInvitations: true,
            showActivity: true,
            allowFollowing: true,
            showInvitationHistory: false,
            showFriends: false,
        },
    };
}

/**
 * @param {FirebaseFirestore.Firestore} db
 */
function buildDemoUserDocFromAi({
    uid,
    aiUser,
    media,
    geo,
    demoCityId,
    batchId,
    adminUid,
}) {
    const persona = {
        displayName: aiUser.displayName,
        nickname: aiUser.nickname,
        gender: aiUser.gender,
        ageCategory: aiUser.ageCategory,
        bio: aiUser.bio,
        diningPersona: aiUser.diningPersona,
        joinReasons: aiUser.joinReasons,
        firstDatePlaceHint: aiUser.firstDatePlaceHint,
        invitePreference: aiUser.invitePreference,
        availableForPrivateInvite: aiUser.availableForPrivateInvite,
        openToDating: aiUser.openToDating,
        lookingFor: aiUser.lookingFor,
        media,
    };
    return buildDemoUserDoc({ uid, persona, geo, demoCityId, batchId, adminUid });
}

/**
 * Create one demo consumer profile at an exact location (admin form).
 * @param {FirebaseFirestore.Firestore} db
 */
async function createDemoUser(db, input, adminUid) {
    const lat = Number(input.lat ?? input.center?.lat);
    const lng = Number(input.lng ?? input.center?.lng);
    const city = String(input.city || '').trim();
    const countryCode = String(input.countryCode || '').trim().toUpperCase().slice(0, 2);
    const countryName = String(input.countryName || '').trim();
    const stateName = String(input.stateName || '').trim();
    const profileRaw = input.profile && typeof input.profile === 'object' ? input.profile : input;

    if (!city || countryCode.length !== 2) {
        throw new Error('city and countryCode are required.');
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error('lat and lng are required.');
    }

    const displayName = String(
        profileRaw.display_name || profileRaw.displayName || '',
    ).trim();
    if (!displayName) {
        throw new Error('displayName is required.');
    }
    const genderRaw = String(profileRaw.gender || '').trim().toLowerCase();
    if (genderRaw !== 'male' && genderRaw !== 'female') {
        throw new Error('gender is required (male or female).');
    }
    const ageRaw = String(profileRaw.ageCategory || profileRaw.age_category || '').trim();
    if (!AGE_CATEGORIES_ALLOWED.has(ageRaw)) {
        throw new Error('ageCategory is required.');
    }

    const profile = normalizeDemoUserProfile(profileRaw, 0);

    const demoCityId = buildDemoCityId(city, countryCode);
    const batchId = `single_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const geo = { lat, lng, city, countryCode, countryName, stateName, exactCoords: true };

    const { assets: mediaAssets, mediaSource } = await resolveDemoMediaAssets(input.mediaAssets);
    const media = resolveAdminDemoUserMedia(profile, mediaAssets);

    const suffix = crypto.randomBytes(4).toString('hex');
    const uid = `demo_${demoCityId}_${suffix}`;
    const doc = buildDemoUserDocFromAi({
        uid,
        aiUser: profile,
        media,
        geo,
        demoCityId,
        batchId,
        adminUid,
    });

    await db.collection('users').doc(uid).set(doc, { merge: false });

    return {
        success: true,
        uid,
        demoCityId,
        batchId,
        city,
        countryCode,
        mediaSource,
    };
}

async function createDemoUsers(db, input, adminUid) {
    const countFromInput = Math.floor(Number(input.count) || 0);
    const lat = Number(input.lat ?? input.center?.lat);
    const lng = Number(input.lng ?? input.center?.lng);
    const city = String(input.city || '').trim();
    const countryCode = String(input.countryCode || '').trim().toUpperCase().slice(0, 2);
    const countryName = String(input.countryName || '').trim();
    const stateName = String(input.stateName || '').trim();

    if (!city || countryCode.length !== 2) {
        throw new Error('city and countryCode are required.');
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error('lat and lng are required.');
    }

    let aiRows = Array.isArray(input.aiGeneratedJson) ? input.aiGeneratedJson : null;
    const useAi = input.useAi !== false;

    if (!aiRows && useAi) {
        const { callGeminiForDemographics } = require('./demoUsersGemini');
        aiRows = await callGeminiForDemographics({
            city,
            state: stateName,
            country: countryName || countryCode,
            countryCode,
            count: Math.min(Math.max(countFromInput, 1), DEMO_COUNT_MAX),
        });
    }

    const count = aiRows
        ? Math.min(aiRows.length, DEMO_COUNT_MAX)
        : Math.min(Math.max(countFromInput, 1), DEMO_COUNT_MAX);

    const demoCityId = buildDemoCityId(city, countryCode);
    const batchId = `batch_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const geo = { lat, lng, city, countryCode, countryName, stateName };

    const existingSnap = await db
        .collection('users')
        .where('demoCityId', '==', demoCityId)
        .limit(1)
        .get();
    if (!existingSnap.empty && input.replaceExisting !== true) {
        const err = new Error('Demo users already exist for this city. Pass replaceExisting to wipe and recreate.');
        err.code = 'already-exists';
        throw err;
    }

    if (input.replaceExisting === true) {
        await wipeDemoUsers(db, { demoCityId });
    }

    const uids = [];
    let batch = db.batch();
    let ops = 0;

    const { assets: mediaAssets, mediaSource: staticMediaSource } = await resolveDemoMediaAssets(
        input.mediaAssets,
    );

    for (let i = 0; i < count; i += 1) {
        const suffix = crypto.randomBytes(4).toString('hex');
        const uid = `demo_${demoCityId}_${suffix}`;

        let doc;
        if (aiRows) {
            const aiUser = normalizeAiUser(aiRows[i], i);
            const media = resolvePersonaMedia(aiUser, i, mediaAssets);

            doc = buildDemoUserDocFromAi({
                uid,
                aiUser,
                media,
                geo,
                demoCityId,
                batchId,
                adminUid,
            });
        } else {
            const persona = buildPersonaProfile(i % PERSONA_POOL_SIZE, batchId);
            persona.media = resolvePersonaMedia(
                { gender: persona.gender, photo_url: null },
                i,
                mediaAssets,
            );
            doc = buildDemoUserDoc({ uid, persona, geo, demoCityId, batchId, adminUid });
        }

        batch.set(db.collection('users').doc(uid), doc, { merge: false });
        uids.push(uid);
        ops += 1;
        if (ops >= 400) {
            await batch.commit();
            batch = db.batch();
            ops = 0;
        }
    }
    if (ops > 0) await batch.commit();

    return {
        success: true,
        created: uids.length,
        uids,
        demoCityId,
        batchId,
        city,
        countryCode,
        aiGenerated: Boolean(aiRows && useAi),
        mediaSource: staticMediaSource,
        mediaCounts: {
            male: mediaAssets.male?.length || 0,
            female: mediaAssets.female?.length || 0,
        },
    };
}

/**
 * @param {FirebaseFirestore.Firestore} db
 */
async function wipeDemoUsers(db, { demoCityId, batchId = null }) {
    const cityId = String(demoCityId || '').trim();
    if (!cityId) throw new Error('demoCityId is required.');

    let q = db.collection('users').where('demoCityId', '==', cityId);
    const snap = await q.get();
    const toDelete = snap.docs.filter((d) => {
        if (!batchId) return true;
        return String(d.data()?.demoBatchId || '') === String(batchId);
    });

    let deleted = 0;
    let batch = db.batch();
    let ops = 0;

    for (const docSnap of toDelete) {
        batch.delete(docSnap.ref);
        batch.delete(db.collection('public_profiles').doc(docSnap.id));
        ops += 2;
        deleted += 1;
        if (ops >= 400) {
            await batch.commit();
            batch = db.batch();
            ops = 0;
        }
    }
    if (ops > 0) await batch.commit();

    return { success: true, deleted, demoCityId: cityId, batchId: batchId || null };
}

/**
 * @param {FirebaseFirestore.Firestore} db
 */
async function listDemoCitySummaries(db) {
    const snap = await db.collection('users').where('isDemo', '==', true).limit(500).get();
    /** @type {Map<string, { demoCityId: string, city: string, countryCode: string, count: number, lastBatchId: string|null }>} */
    const byCity = new Map();

    snap.docs.forEach((docSnap) => {
        const d = docSnap.data() || {};
        const demoCityId = String(d.demoCityId || '').trim();
        if (!demoCityId) return;
        const row = byCity.get(demoCityId) || {
            demoCityId,
            city: d.city || '',
            countryCode: d.countryCode || '',
            count: 0,
            lastBatchId: null,
        };
        row.count += 1;
        if (d.demoBatchId) row.lastBatchId = String(d.demoBatchId);
        byCity.set(demoCityId, row);
    });

    return [...byCity.values()].sort((a, b) => a.city.localeCompare(b.city));
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {{ demoCityId?: string, limit?: number }} [opts]
 */
async function listDemoUserProfiles(db, opts = {}) {
    const limit = Math.min(Math.max(Math.floor(Number(opts.limit) || 500), 1), 500);
    const demoCityId = String(opts.demoCityId || '').trim();

    let q = db.collection('users').where('isDemo', '==', true);
    if (demoCityId) {
        q = q.where('demoCityId', '==', demoCityId);
    }
    const snap = await q.limit(limit).get();

    return snap.docs
        .map((docSnap) => {
            const d = docSnap.data() || {};
            return {
                uid: docSnap.id,
                displayName: d.displayName || d.display_name || '',
                gender: d.gender || '',
                ageCategory: d.ageCategory || d.age_category || '',
                city: d.city || '',
                countryCode: d.countryCode || '',
                demoCityId: d.demoCityId || '',
                photo_url: d.photo_url || d.photoURL || '',
                bio: d.bio || '',
                coordinates: d.coordinates || null,
                demoBatchId: d.demoBatchId || null,
            };
        })
        .sort((a, b) => {
            const cityCmp = a.city.localeCompare(b.city);
            if (cityCmp !== 0) return cityCmp;
            return a.displayName.localeCompare(b.displayName);
        });
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} uid
 */
async function deleteDemoUser(db, uid) {
    const id = String(uid || '').trim();
    if (!id) throw new Error('uid is required.');

    const ref = db.collection('users').doc(id);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.isDemo !== true) {
        const err = new Error('Demo user not found.');
        err.code = 'not-found';
        throw err;
    }

    const batch = db.batch();
    batch.delete(ref);
    batch.delete(db.collection('public_profiles').doc(id));
    await batch.commit();

    return { success: true, uid: id, demoCityId: snap.data()?.demoCityId || null };
}

module.exports = {
    DEMO_COUNT_MAX,
    buildDemoCityId,
    normalizeAiUser,
    normalizeDemoUserProfile,
    createDemoUsers,
    createDemoUser,
    wipeDemoUsers,
    deleteDemoUser,
    listDemoCitySummaries,
    listDemoUserProfiles,
};
