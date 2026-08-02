/**
 * Resolve how to charge a private/dating invitation publish.
 * Supports legacy invitation credits and the Dine Credits ledger (freeCredits/paidCredits).
 *
 * Costs must stay aligned with `creditsCore.js` CREDIT_COSTS.
 */
const PRIVATE_INVITATION_COST = 90;
const DATING_INVITATION_COST = 185;

const CREDIT_COSTS = {
    PRIVATE_INVITATION: PRIVATE_INVITATION_COST,
    DATING_INVITATION: DATING_INVITATION_COST,
};

function isDatingInvitationDoc(inv) {
    if (!inv || typeof inv !== 'object') return false;
    const occasionLc = String(inv.occasionType || inv.type || '')
        .trim()
        .toLowerCase();
    return (
        inv.type === 'Dating' ||
        occasionLc === 'dating' ||
        (inv.datingInvitationPreference != null && inv.datingInvitationPreference !== false)
    );
}

function getDineCreditBalance(user) {
    const free = Math.max(0, Math.floor(Number(user?.freeCredits) || 0));
    const paid = Math.max(0, Math.floor(Number(user?.paidCredits) || 0));
    return { free, paid, total: free + paid };
}

/**
 * Prefer legacy monthly/purchased private credits (welcome gifts, plan quota),
 * then fall back to Dine Credits purchased via Stripe.
 *
 * @param {Record<string, unknown>} user
 * @param {Record<string, unknown>} inv
 * @param {Record<string, number>} monthlyQuotas
 * @returns {{
 *   source: 'monthly'|'purchased'|'dine_credits',
 *   userCreditPatch: Record<string, unknown>|null,
 *   dineCost: number|null,
 * } | { source: null, error: string, dineCost?: number|null }}
 */
function resolvePrivateInvitationCharge(user, inv, monthlyQuotas) {
    const tier = String(user?.subscriptionTier || 'free').toLowerCase();
    const quota = Number(monthlyQuotas?.[tier]) || 0;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;
    let usedThisMonth = Number(user?.usedPrivateCreditsThisMonth) || 0;
    const lastResetMonth = user?.lastPrivateResetMonth || '';
    if (quota > 0 && lastResetMonth !== currentMonth) {
        usedThisMonth = 0;
    }
    const purchasedCredits = Math.max(0, Number(user?.purchasedPrivateCredits) || 0);
    const dineCost = isDatingInvitationDoc(inv)
        ? CREDIT_COSTS.DATING_INVITATION
        : CREDIT_COSTS.PRIVATE_INVITATION;
    const { total: dineTotal } = getDineCreditBalance(user);

    if (quota > 0 && usedThisMonth < quota) {
        return {
            source: 'monthly',
            userCreditPatch: {
                usedPrivateCreditsThisMonth: usedThisMonth + 1,
                lastPrivateResetMonth: currentMonth,
            },
            dineCost: null,
        };
    }
    if (purchasedCredits > 0) {
        return {
            source: 'purchased',
            userCreditPatch: {
                purchasedPrivateCredits: purchasedCredits - 1,
            },
            dineCost: null,
        };
    }
    if (dineTotal >= dineCost) {
        return {
            source: 'dine_credits',
            userCreditPatch: null,
            dineCost,
        };
    }
    return {
        source: null,
        error: 'No private invitation credits remaining.',
        dineCost,
    };
}

module.exports = {
    isDatingInvitationDoc,
    getDineCreditBalance,
    resolvePrivateInvitationCharge,
    CREDIT_COSTS,
};
