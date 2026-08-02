/**
 * Regression: Stripe Dine Credits (paidCredits/freeCredits) must be usable
 * for private/dating invitation publish after legacy quota is exhausted.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const {
    resolvePrivateInvitationCharge,
    isDatingInvitationDoc,
    CREDIT_COSTS,
} = require(join(root, 'functions/privateInvitationBilling.js'));

const MONTHLY = { free: 3, pro: 4, premium: 10, vip: 10 };

function assert(cond, msg) {
    if (!cond) {
        console.error('FAIL:', msg);
        process.exit(1);
    }
}

// Exhausted legacy + paid Dine Credits → charge dine_credits at private cost
{
    const charge = resolvePrivateInvitationCharge(
        {
            subscriptionTier: 'free',
            usedPrivateCreditsThisMonth: 3,
            lastPrivateResetMonth: `${new Date().getFullYear()}-${new Date().getMonth() + 1}`,
            purchasedPrivateCredits: 0,
            freeCredits: 10,
            paidCredits: 200,
        },
        { type: 'private', occasionType: 'social' },
        MONTHLY
    );
    assert(charge.source === 'dine_credits', 'paid Dine Credits must unlock private publish');
    assert(charge.dineCost === CREDIT_COSTS.PRIVATE_INVITATION, 'private publish cost mismatch');
    assert(charge.userCreditPatch == null, 'dine_credits path must not patch legacy fields');
}

// Dating invitations cost more Dine Credits
{
    const charge = resolvePrivateInvitationCharge(
        {
            subscriptionTier: 'free',
            usedPrivateCreditsThisMonth: 3,
            lastPrivateResetMonth: `${new Date().getFullYear()}-${new Date().getMonth() + 1}`,
            purchasedPrivateCredits: 0,
            paidCredits: 200,
        },
        { type: 'Dating' },
        MONTHLY
    );
    assert(isDatingInvitationDoc({ type: 'Dating' }), 'Dating type must be detected');
    assert(charge.source === 'dine_credits', 'dating publish must accept Dine Credits');
    assert(charge.dineCost === CREDIT_COSTS.DATING_INVITATION, 'dating publish cost mismatch');
}

// Insufficient Dine Credits after legacy exhaustion → deny
{
    const charge = resolvePrivateInvitationCharge(
        {
            subscriptionTier: 'free',
            usedPrivateCreditsThisMonth: 3,
            lastPrivateResetMonth: `${new Date().getFullYear()}-${new Date().getMonth() + 1}`,
            purchasedPrivateCredits: 0,
            paidCredits: 50,
        },
        { occasionType: 'social' },
        MONTHLY
    );
    assert(charge.source === null, 'must deny when Dine Credits < private cost');
}

// Legacy purchasedPrivateCredits still preferred over burning 90 Dine Credits
{
    const charge = resolvePrivateInvitationCharge(
        {
            subscriptionTier: 'free',
            usedPrivateCreditsThisMonth: 3,
            lastPrivateResetMonth: `${new Date().getFullYear()}-${new Date().getMonth() + 1}`,
            purchasedPrivateCredits: 2,
            paidCredits: 500,
        },
        { occasionType: 'social' },
        MONTHLY
    );
    assert(charge.source === 'purchased', 'welcome/purchased private credits must still work first');
    assert(charge.userCreditPatch?.purchasedPrivateCredits === 1, 'legacy decrement mismatch');
}

// Wire-up: publish callable spends dine credits; client gate checks wallet
const publishSrc = readFileSync(join(root, 'functions/index.js'), 'utf8');
const publishBlock = publishSrc.slice(
    publishSrc.indexOf('exports.publishPrivateInvitationDraft'),
    publishSrc.indexOf('exports.suggestInvitationMessages')
);
assert(
    publishBlock.includes('resolvePrivateInvitationCharge'),
    'publishPrivateInvitationDraft must use resolvePrivateInvitationCharge'
);
assert(
    publishBlock.includes("chargedSource === 'dine_credits'") ||
        publishBlock.includes('spendCreditsInTransaction'),
    'publishPrivateInvitationDraft must spend Dine Credits via spendCreditsInTransaction'
);

const inviteCtx = readFileSync(join(root, 'src/context/InvitationContext.jsx'), 'utf8');
assert(
    inviteCtx.includes('getTotalDineCredits') && inviteCtx.includes('MIN_HOST_INVITATION_DRAFT_CREDITS'),
    'canCreatePrivateInvitation must accept Dine Credits wallet balance'
);
assert(
    inviteCtx.includes("source: 'dine_credits'"),
    'canCreatePrivateInvitation must report dine_credits source'
);

const webhook = readFileSync(join(root, 'functions/webhook.js'), 'utf8');
assert(
    webhook.includes('grantPaidCreditsInTransaction') && webhook.includes("purchaseType === 'dine_credits'"),
    'Stripe dine_credits path must still grant paidCredits'
);

const creditsCore = readFileSync(join(root, 'functions/creditsCore.js'), 'utf8');
assert(
    creditsCore.includes('PRIVATE_INVITATION: 90') && creditsCore.includes('DATING_INVITATION: 185'),
    'creditsCore costs must stay aligned with privateInvitationBilling'
);
const clientCosts = readFileSync(join(root, 'src/utils/privateInvitationCredits.js'), 'utf8');
assert(
    clientCosts.includes('PRIVATE_INVITATION_PUBLISH_CREDITS = 90') &&
        clientCosts.includes('DATING_INVITATION_PUBLISH_CREDITS = 185'),
    'client privateInvitationCredits costs must stay aligned'
);

console.log('test-private-invitation-dine-credits: all assertions passed');
