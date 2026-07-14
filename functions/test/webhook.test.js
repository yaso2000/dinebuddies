const assert = require('node:assert/strict');
const { before, test } = require('node:test');
const admin = require('firebase-admin');

let handleDineCreditsPurchase;

before(() => {
    if (!admin.apps.length) {
        admin.initializeApp({ projectId: 'demo-dinebuddies' });
    }
    process.env.STRIPE_SECRET_KEY ||= 'sk_test_placeholder';
    ({ handleDineCreditsPurchase } = require('../webhook')._test);
});

function makeFirestore({ userExists = true, alreadyFulfilled = false, userData = {} } = {}) {
    const writes = [];
    let transactionCalls = 0;

    const firestore = {
        collection(name) {
            return {
                doc(id) {
                    return { collection: name, id };
                },
            };
        },
        async runTransaction(callback) {
            transactionCalls += 1;
            return callback({
                async get(ref) {
                    if (ref.collection === 'stripe_dine_credit_fulfillments') {
                        return { exists: alreadyFulfilled };
                    }
                    if (ref.collection === 'users') {
                        return {
                            exists: userExists,
                            data: () => userData,
                        };
                    }
                    throw new Error(`Unexpected read: ${ref.collection}`);
                },
                update(ref, data) {
                    writes.push({ operation: 'update', ref, data });
                },
                set(ref, data) {
                    writes.push({ operation: 'set', ref, data });
                },
            });
        },
    };

    return {
        firestore,
        writes,
        get transactionCalls() {
            return transactionCalls;
        },
    };
}

function creditSession(overrides = {}) {
    return {
        id: 'cs_paid_123',
        metadata: {
            userId: 'user-123',
            credits: '200',
            packageId: 'credits_200',
        },
        ...overrides,
    };
}

test('rejects invalid credit metadata so Stripe retries the event', async () => {
    const fake = makeFirestore();

    await assert.rejects(
        handleDineCreditsPurchase(
            creditSession({ metadata: { userId: 'user-123', credits: '0' } }),
            fake.firestore
        ),
        /Invalid dine credits checkout metadata/
    );
    assert.equal(fake.transactionCalls, 0);
});

test('rejects a missing user so a paid checkout is not acknowledged unfulfilled', async () => {
    const fake = makeFirestore({ userExists: false });

    await assert.rejects(
        handleDineCreditsPurchase(creditSession(), fake.firestore),
        /User not found for dine credits: user-123/
    );
    assert.equal(fake.writes.length, 0);
});

test('atomically grants purchased credits and records fulfillment', async () => {
    const fake = makeFirestore({ userData: { paidCredits: 25, role: 'user' } });

    const result = await handleDineCreditsPurchase(creditSession(), fake.firestore);

    assert.deepEqual(result, { alreadyFulfilled: false });
    const userUpdate = fake.writes.find(
        (write) => write.operation === 'update' && write.ref.collection === 'users'
    );
    assert.equal(userUpdate.data.paidCredits, 225);
    assert.ok(
        fake.writes.some(
            (write) =>
                write.operation === 'set' &&
                write.ref.collection === 'stripe_dine_credit_fulfillments' &&
                write.ref.id === 'cs_paid_123'
        )
    );
});

test('treats an existing fulfillment as an idempotent replay', async () => {
    const fake = makeFirestore({ alreadyFulfilled: true });

    const result = await handleDineCreditsPurchase(creditSession(), fake.firestore);

    assert.deepEqual(result, { alreadyFulfilled: true });
    assert.equal(fake.writes.length, 0);
});
