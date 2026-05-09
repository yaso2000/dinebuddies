const assert = require('node:assert/strict');
const test = require('node:test');

const { buildAdminGrantClaims } = require('./adminClaims');

const superOwnerUids = ['super-uid'];
const superOwnerEmails = ['owner@example.com'];

test('admin grants do not copy requester superOwner status to arbitrary targets', () => {
    const claims = buildAdminGrantClaims({
        targetUid: 'regular-user',
        targetEmail: 'regular@example.com',
        currentClaims: { betaAccess: true, superOwner: true },
        superOwnerUids,
        superOwnerEmails
    });

    assert.deepEqual(claims, {
        betaAccess: true,
        admin: true,
        superOwner: false
    });
});

test('configured super owners keep superOwner claim when granted admin', () => {
    const claimsByUid = buildAdminGrantClaims({
        targetUid: 'super-uid',
        targetEmail: 'someone@example.com',
        currentClaims: {},
        superOwnerUids,
        superOwnerEmails
    });
    const claimsByEmail = buildAdminGrantClaims({
        targetUid: 'other-uid',
        targetEmail: ' Owner@Example.com ',
        currentClaims: {},
        superOwnerUids,
        superOwnerEmails
    });

    assert.equal(claimsByUid.superOwner, true);
    assert.equal(claimsByEmail.superOwner, true);
});
