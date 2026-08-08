/**
 * Gender-matched demo profile photos.
 * Priority: request payload → Firebase Storage (demo-users/{male|female}/) → defaults below.
 *
 * Each entry: plain avatar URL string, or { avatar, cover?, gallery? }.
 */
const admin = require('firebase-admin');

const STORAGE_PREFIX = 'demo-users';
const IMAGE_EXT = /\.(webp|jpe?g|png|gif)$/i;

function portraitGalleryFromAvatar(avatarUrl) {
    const base = String(avatarUrl || '').trim().split('?')[0];
    if (!base) return [];
    const portrait = `${base}?w=540&h=960&fit=crop&crop=faces`;
    return [portrait, portrait, portrait];
}

function normalizeDemoMediaEntry(entry) {
    if (typeof entry === 'string') {
        const avatar = entry.trim();
        return { avatar, cover: null, gallery: portraitGalleryFromAvatar(avatar) };
    }
    const avatar = String(entry?.avatar || entry?.photo_url || '').trim();
    return {
        ...entry,
        avatar,
        gallery: portraitGalleryFromAvatar(avatar),
    };
}

/** Gender-split fallback until custom Storage uploads exist. */
const DEFAULT_DEMO_MEDIA_ASSETS = {
    female: [
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
            avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop',
            cover: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=1200&h=600&fit=crop',
            gallery: [
                'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=540&h=960&fit=crop',
                'https://images.unsplash.com/photo-1554118811-1e0d58224fb2?w=540&h=960&fit=crop',
                'https://images.unsplash.com/photo-1466978913421-dad2ebd01d98?w=540&h=960&fit=crop',
            ],
        },
    ],
    male: [
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
            avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=400&h=400&fit=crop',
            cover: 'https://images.unsplash.com/photo-1550966841-3edb65c774a3?w=1200&h=600&fit=crop',
            gallery: [
                'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=540&h=960&fit=crop',
                'https://images.unsplash.com/photo-1514933651103-005fec06c04b?w=540&h=960&fit=crop',
                'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=540&h=960&fit=crop',
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
    ],
};

for (const gender of ['male', 'female']) {
    DEFAULT_DEMO_MEDIA_ASSETS[gender] = DEFAULT_DEMO_MEDIA_ASSETS[gender].map(normalizeDemoMediaEntry);
}

function mergeMediaAssets(defaults, overrides) {
    if (!overrides || typeof overrides !== 'object') return defaults;
    return {
        male: Array.isArray(overrides.male) && overrides.male.length > 0 ? overrides.male : defaults.male,
        female:
            Array.isArray(overrides.female) && overrides.female.length > 0 ? overrides.female : defaults.female,
    };
}

function getStorageBucketName() {
    return (
        process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
        (process.env.GCLOUD_PROJECT ? `${process.env.GCLOUD_PROJECT}.firebasestorage.app` : null) ||
        'dinebuddies.firebasestorage.app'
    );
}

function buildPublicDownloadUrl(bucketName, objectPath, token) {
    const encoded = encodeURIComponent(objectPath);
    if (token) {
        return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media&token=${token}`;
    }
    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media`;
}

async function fileToPublicUrl(file, bucketName) {
    const [meta] = await file.getMetadata();
    const token = meta?.metadata?.firebaseStorageDownloadTokens;
    const firstToken = token ? String(token).split(',')[0].trim() : '';
    return buildPublicDownloadUrl(bucketName, file.name, firstToken || null);
}

/**
 * Load avatar URLs from Storage: demo-users/male/* and demo-users/female/*
 * @returns {Promise<{ male: string[], female: string[], source: 'storage' | null }>}
 */
async function loadDemoMediaAssetsFromStorage() {
    const bucketName = getStorageBucketName();
    const bucket = admin.storage().bucket(bucketName);
    const out = { male: [], female: [], source: null };

    for (const gender of ['male', 'female']) {
        const prefix = `${STORAGE_PREFIX}/${gender}/`;
        const [files] = await bucket.getFiles({ prefix, maxResults: 100 });
        const urls = [];
        for (const file of files) {
            const base = file.name.slice(prefix.length);
            if (!base || base.includes('/') || !IMAGE_EXT.test(base)) continue;
            try {
                urls.push(await fileToPublicUrl(file, bucketName));
            } catch (err) {
                console.warn(`demo media: skip ${file.name}:`, err?.message || err);
            }
        }
        out[gender] = urls;
    }

    if (out.male.length > 0 || out.female.length > 0) {
        out.source = 'storage';
    }
    return out;
}

/**
 * @param {object | null | undefined} requestAssets from admin API
 */
async function resolveDemoMediaAssets(requestAssets) {
    let assets = DEFAULT_DEMO_MEDIA_ASSETS;
    let mediaSource = 'default';

    try {
        const storageAssets = await loadDemoMediaAssetsFromStorage();
        if (storageAssets.source === 'storage') {
            assets = mergeMediaAssets(assets, storageAssets);
            mediaSource = 'storage';
        }
    } catch (err) {
        console.warn('demo media: Storage load failed, using defaults:', err?.message || err);
    }

    if (requestAssets && typeof requestAssets === 'object') {
        const hasMale = Array.isArray(requestAssets.male) && requestAssets.male.length > 0;
        const hasFemale = Array.isArray(requestAssets.female) && requestAssets.female.length > 0;
        if (hasMale || hasFemale) {
            assets = mergeMediaAssets(assets, requestAssets);
            mediaSource = 'config';
        }
    }

    return { assets, mediaSource };
}

module.exports = {
    DEFAULT_DEMO_MEDIA_ASSETS,
    STORAGE_PREFIX,
    mergeMediaAssets,
    loadDemoMediaAssetsFromStorage,
    resolveDemoMediaAssets,
};
