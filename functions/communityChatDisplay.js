const crypto = require('crypto');
const functions = require('firebase-functions');
const {
    resolveCommunityOwner,
    isCommunityOwnerRequester,
} = require('./communityOwner');

function normalizeDisplayToken(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const token = raw.trim();
    if (token.length < 32 || token.length > 128 || !/^[a-f0-9]+$/i.test(token)) return null;
    return token.toLowerCase();
}

function hashDisplayToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function buildDisplayUid(partnerId) {
    return `communityDisplay_${String(partnerId || '').trim()}`;
}

function resolveCastBaseUrl() {
    const fromEnv =
        process.env.APP_PUBLIC_URL ||
        process.env.APP_URL ||
        process.env.PUBLIC_APP_URL ||
        '';
    const trimmed = String(fromEnv || '').trim().replace(/\/+$/, '');
    return trimmed || 'https://www.dinebuddies.com';
}

function registerCommunityChatDisplay(exportsObj, { db, admin, enforceCallableRateLimit }) {
    exportsObj.ensureCommunityChatDisplayLink = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
        }

        const partnerId = String(data?.partnerId || context.auth.uid).trim();
        if (!partnerId) {
            throw new functions.https.HttpsError('invalid-argument', 'partnerId is required.');
        }

        const owner = await resolveCommunityOwner(db, partnerId);
        if (!owner) {
            throw new functions.https.HttpsError('not-found', 'Community owner not found.');
        }
        if (!isCommunityOwnerRequester(owner, context.auth.uid)) {
            throw new functions.https.HttpsError('permission-denied', 'Only the community owner can manage display casting.');
        }

        await enforceCallableRateLimit(context.auth.uid, 'community_chat_display_link', {
            perMinute: 6,
            perHour: 30,
            perDay: 80,
            cooldownMs: 2000,
        });

        const token = crypto.randomBytes(24).toString('hex');
        const tokenHash = hashDisplayToken(token);

        await owner.ref.set(
            {
                communityChatDisplay: {
                    enabled: true,
                    tokenHash,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
            },
            { merge: true }
        );

        const url = `${resolveCastBaseUrl()}/community/${encodeURIComponent(partnerId)}/cast?key=${token}`;

        return {
            partnerId,
            token,
            url,
        };
    });

    exportsObj.revokeCommunityChatDisplayLink = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
        }

        const partnerId = String(data?.partnerId || context.auth.uid).trim();
        if (!partnerId) {
            throw new functions.https.HttpsError('invalid-argument', 'partnerId is required.');
        }

        const owner = await resolveCommunityOwner(db, partnerId);
        if (!owner) {
            throw new functions.https.HttpsError('not-found', 'Community owner not found.');
        }
        if (!isCommunityOwnerRequester(owner, context.auth.uid)) {
            throw new functions.https.HttpsError('permission-denied', 'Only the community owner can manage display casting.');
        }

        await owner.ref.set(
            {
                communityChatDisplay: {
                    enabled: false,
                    tokenHash: null,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
            },
            { merge: true }
        );

        return { ok: true };
    });

    exportsObj.signInCommunityChatDisplay = functions.https.onCall(async (data, context) => {
        const partnerId = String(data?.partnerId || '').trim();
        const token = normalizeDisplayToken(data?.token);

        if (!partnerId || !token) {
            throw new functions.https.HttpsError('invalid-argument', 'partnerId and token are required.');
        }

        await enforceCallableRateLimit(`display_${partnerId}`, 'community_chat_display_signin', {
            perMinute: 20,
            perHour: 120,
            perDay: 500,
            cooldownMs: 250,
        });

        const owner = await resolveCommunityOwner(db, partnerId);
        if (!owner) {
            throw new functions.https.HttpsError('not-found', 'Community not found.');
        }

        const displayConfig =
            owner.data.communityChatDisplay && typeof owner.data.communityChatDisplay === 'object'
                ? owner.data.communityChatDisplay
                : null;

        if (!displayConfig?.enabled || !displayConfig?.tokenHash) {
            throw new functions.https.HttpsError('failed-precondition', 'Display casting is disabled for this community.');
        }

        if (hashDisplayToken(token) !== String(displayConfig.tokenHash)) {
            throw new functions.https.HttpsError('permission-denied', 'Invalid display link.');
        }

        const uid = buildDisplayUid(partnerId);

        try {
            await admin.auth().getUser(uid);
        } catch (err) {
            if (err?.code === 'auth/user-not-found') {
                await admin.auth().createUser({ uid });
            } else {
                throw err;
            }
        }

        const customToken = await admin.auth().createCustomToken(uid, {
            communityDisplay: true,
            communityDisplayPartnerId: partnerId,
        });

        return { customToken, partnerId };
    });
}

module.exports = { registerCommunityChatDisplay };
