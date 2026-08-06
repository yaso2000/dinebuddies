/**
 * Regression: createNotification must not allow unconditional message/reminder,
 * and placeId business resolution must prefer earliest claimant.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const {
    canSenderTriggerNotificationType,
    pickBusinessForPlaceId,
} = require('../functions/notificationAuth.js');

function makeDoc(id, data, createMs = 0) {
    return {
        id,
        data: () => data,
        createTime: { toMillis: () => createMs },
    };
}

function makeDb(collections) {
    return {
        collection(name) {
            const docs = collections[name] || {};
            return {
                doc(id) {
                    return {
                        async get() {
                            if (!(id in docs)) return { exists: false, data: () => null, id };
                            return { exists: true, data: () => docs[id], id };
                        },
                    };
                },
            };
        },
    };
}

// --- Static: index.js must not unconditionally allow message/reminder ---
const indexSrc = readFileSync(join(root, 'functions/index.js'), 'utf8');
assert.match(indexSrc, /notificationAuth/, 'index.js must use notificationAuth helper');
assert.doesNotMatch(
    indexSrc,
    /if \(type === 'message' \|\| type === 'reminder'\) \{\s*return true;\s*\}/,
    'index.js must not unconditionally allow message/reminder'
);

// --- message: deny arbitrary recipient ---
{
    const db = makeDb({
        conversations: {},
        invitations: {},
        private_invitations: {},
        users: {},
    });
    const ok = await canSenderTriggerNotificationType({
        db,
        senderId: 'attacker',
        userId: 'victim',
        type: 'message',
        invitationId: '',
        metadata: {},
        isAdminUid: async () => false,
    });
    assert.equal(ok, false, 'message to stranger without conversation must be denied');
}

// --- message: allow DM conversation participants ---
{
    const db = makeDb({
        conversations: {
            'attacker_victim': { participants: ['attacker', 'victim'] },
        },
    });
    // conversationIdFor sorts ids: attacker_victim
    const ok = await canSenderTriggerNotificationType({
        db,
        senderId: 'attacker',
        userId: 'victim',
        type: 'message',
        isAdminUid: async () => false,
    });
    assert.equal(ok, true, 'DM participants may send message notifications');
}

// --- reminder: deny without invitation scope ---
{
    const db = makeDb({ invitations: {} });
    const ok = await canSenderTriggerNotificationType({
        db,
        senderId: 'host1',
        userId: 'guest1',
        type: 'reminder',
        isAdminUid: async () => false,
    });
    assert.equal(ok, false, 'reminder without invitationId must be denied');
}

// --- like without invitationId: deny unless post author matches ---
{
    const db = makeDb({
        communityPosts: {
            p1: { userId: 'author1', content: 'hi' },
        },
    });
    const denied = await canSenderTriggerNotificationType({
        db,
        senderId: 'liker',
        userId: 'random',
        type: 'like',
        metadata: { postId: 'p1', collection: 'communityPosts' },
        isAdminUid: async () => false,
    });
    assert.equal(denied, false, 'like notification to non-author denied');

    const allowed = await canSenderTriggerNotificationType({
        db,
        senderId: 'liker',
        userId: 'author1',
        type: 'like',
        metadata: { postId: 'p1', collection: 'communityPosts' },
        isAdminUid: async () => false,
    });
    assert.equal(allowed, true, 'like notification to post author allowed');
}

// --- booking_cancelled: host cannot spam arbitrary userId ---
{
    const db = makeDb({
        invitations: {
            inv1: {
                author: { id: 'host1' },
                joined: ['guest1'],
                restaurantId: 'biz1',
                placeId: 'place-abc',
            },
        },
        users: {
            biz1: { role: 'business', businessInfo: { placeId: 'place-abc' } },
            stranger: { role: 'user' },
        },
    });
    const spam = await canSenderTriggerNotificationType({
        db,
        senderId: 'host1',
        userId: 'stranger',
        type: 'booking_cancelled',
        invitationId: 'inv1',
        isAdminUid: async () => false,
    });
    assert.equal(spam, false, 'host cannot send booking_cancelled to unrelated user');

    const toBiz = await canSenderTriggerNotificationType({
        db,
        senderId: 'host1',
        userId: 'biz1',
        type: 'booking_cancelled',
        invitationId: 'inv1',
        isAdminUid: async () => false,
    });
    assert.equal(toBiz, true, 'host may notify linked restaurant');
}

// --- placeId picker: earliest created wins (late hijack loses) ---
{
    const victim = makeDoc('victimBiz', { role: 'business', createdAt: { toMillis: () => 100 } }, 100);
    const attacker = makeDoc('attackerBiz', { role: 'business', createdAt: { toMillis: () => 999 } }, 999);
    const picked = pickBusinessForPlaceId([attacker, victim]);
    assert.equal(picked.found, true);
    assert.equal(picked.businessId, 'victimBiz', 'earliest business wins placeId attribution');
    assert.equal(picked.ambiguous, true);
    assert.equal(picked.matchCount, 2);
}

// --- placeId: once set, client owner updates cannot replace it ---
{
    const rules = readFileSync(join(root, 'firestore.rules'), 'utf8');
    assert.match(rules, /function businessPlaceIdWriteOk/, 'rules must define businessPlaceIdWriteOk');
    assert.match(
        rules,
        /businessPlaceIdWriteOk\(\)/,
        'owner user updates must gate businessInfo.placeId via businessPlaceIdWriteOk'
    );
}

// --- special_offers: server create; updates keep ownership bind ---
{
    const rules = readFileSync(join(root, 'firestore.rules'), 'utf8');
    const specialBlock = rules.slice(rules.indexOf('match /special_offers'));
    assert.match(specialBlock, /allow create: if false/, 'special_offers create must be server-only');
    assert.match(
        specialBlock,
        /resource\.data\.restaurantId == request\.auth\.uid/,
        'special_offers update must keep restaurantId ownership bind'
    );
}

// --- premium / special offers: server-only create + atomic publish callables ---
{
    const premium = readFileSync(join(root, 'src/services/premiumOfferService.js'), 'utf8');
    const offerSvc = readFileSync(join(root, 'src/services/offerService.js'), 'utf8');
    const rules = readFileSync(join(root, 'firestore.rules'), 'utf8');
    assert.match(premium, /publishPremiumOffer/, 'premiumOfferService must use publishPremiumOffer callable');
    assert.match(offerSvc, /publishSpecialOffer/, 'offerService must use publishSpecialOffer callable');
    assert.match(indexSrc, /exports\.publishPremiumOffer/, 'publishPremiumOffer must be exported');
    assert.match(indexSrc, /exports\.publishSpecialOffer/, 'publishSpecialOffer must be exported');
    const offersBlock = rules.slice(rules.indexOf('match /offers/{offerId}'), rules.indexOf('match /active_offers'));
    assert.match(offersBlock, /allow create: if false/, 'offers create must be server-only');
    const specialBlock2 = rules.slice(rules.indexOf('match /special_offers'));
    assert.match(specialBlock2, /allow create: if false/, 'special_offers create must be server-only');
}

// --- motion posts: rules + publish callable exist ---
{
    const rules = readFileSync(join(root, 'firestore.rules'), 'utf8');
    assert.match(rules, /match \/business_motion_posts/, 'firestore.rules must define business_motion_posts');
    assert.match(indexSrc, /exports\.publishBusinessMotionPost/, 'publishBusinessMotionPost must be exported');
}

console.log('test-notification-auth: all assertions passed');
