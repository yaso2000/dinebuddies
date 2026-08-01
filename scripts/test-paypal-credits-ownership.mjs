/**
 * Regression: PayPal credits fulfillment must not re-attribute another user's paid order
 * via reference_id fallback (credit theft).
 *
 * Mirrors the ownership checks in functions/paypal.js#resolveCreditsOrderMeta.
 */
import assert from 'node:assert/strict';

const CREDIT_PACKAGES = {
    credits_200: { credits: 200 },
    credits_500: { credits: 500 },
};

function parsePayPalCustomId(raw) {
    try {
        const parsed = JSON.parse(String(raw || '{}'));
        return {
            userId: String(parsed.userId || '').trim(),
            packageId: String(parsed.packageId || '').trim(),
            credits: Math.floor(Number(parsed.credits) || 0),
        };
    } catch {
        return { userId: '', packageId: '', credits: 0 };
    }
}

function resolveCreditsOrderMeta({ customId, referenceId, pending, authUid }) {
    const parsed = parsePayPalCustomId(customId);
    if (
        parsed.userId &&
        parsed.userId === authUid &&
        parsed.packageId &&
        CREDIT_PACKAGES[parsed.packageId] &&
        parsed.credits > 0
    ) {
        return {
            userId: parsed.userId,
            packageId: parsed.packageId,
            credits: CREDIT_PACKAGES[parsed.packageId].credits,
        };
    }

    if (parsed.userId && parsed.userId !== authUid) {
        return { userId: '', packageId: '', credits: 0 };
    }

    // Intentionally NO referenceId → authUid fallback (the vulnerability).
    void referenceId;

    if (
        pending &&
        String(pending.userId || '').trim() === authUid &&
        String(pending.kind || 'credits') === 'credits' &&
        CREDIT_PACKAGES[pending.packageId]
    ) {
        return {
            userId: authUid,
            packageId: String(pending.packageId).trim(),
            credits: CREDIT_PACKAGES[pending.packageId].credits,
        };
    }

    return { userId: '', packageId: '', credits: 0 };
}

// Attacker captures victim's paid order: custom_id has victim, reference_id is a valid package.
const stolen = resolveCreditsOrderMeta({
    customId: JSON.stringify({ userId: 'victim', packageId: 'credits_500', credits: 500 }),
    referenceId: 'credits_500',
    pending: { userId: 'victim', kind: 'credits', packageId: 'credits_500', credits: 500 },
    authUid: 'attacker',
});
assert.equal(stolen.userId, '', 'must not grant credits to attacker');
assert.equal(stolen.credits, 0, 'must not grant package credits via reference_id');

// Legitimate owner still works via custom_id.
const owner = resolveCreditsOrderMeta({
    customId: JSON.stringify({ userId: 'victim', packageId: 'credits_200', credits: 9999 }),
    referenceId: 'credits_200',
    pending: null,
    authUid: 'victim',
});
assert.equal(owner.userId, 'victim');
assert.equal(owner.credits, 200, 'catalog credits win over forged custom_id credit count');

// Recovery via server-stored checkout doc when custom_id missing.
const recovered = resolveCreditsOrderMeta({
    customId: '',
    referenceId: 'credits_200',
    pending: { userId: 'alice', kind: 'credits', packageId: 'credits_200', credits: 200 },
    authUid: 'alice',
});
assert.equal(recovered.userId, 'alice');
assert.equal(recovered.credits, 200);

// reference_id alone must never authorize fulfillment for the caller.
const refOnly = resolveCreditsOrderMeta({
    customId: '',
    referenceId: 'credits_3000',
    pending: null,
    authUid: 'mallory',
});
assert.equal(refOnly.credits, 0);

console.log('test-paypal-credits-ownership: all assertions passed');
