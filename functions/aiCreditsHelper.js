/**
 * AI credit consumption: daily free text quota for regular users, then paid credits.
 * Business motion AI always charges (no free tier).
 */
const { db, FieldValue, CREDIT_COSTS, spendCreditsInTransaction, isRegularUserDoc, isBusinessUserDoc } = require('./creditsCore');

const REGULAR_DAILY_FREE_AI_TEXT = 3;

function todayUtcKey() {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * @param {string} uid
 * @param {'ai_text_generate'|'ai_text_rewrite'|'ai_image'|'business_post_text'|'business_post_rewrite'|'offer_text'|'review_reply'} action
 */
async function consumeAiCredits(uid, action) {
    const userRef = db.collection('users').doc(uid);

    let cost = 0;
    if (action === 'ai_text_generate' || action === 'business_post_text' || action === 'offer_text') {
        cost = CREDIT_COSTS.AI_TEXT_REGULAR;
    } else if (action === 'ai_text_rewrite' || action === 'business_post_rewrite' || action === 'review_reply') {
        cost = CREDIT_COSTS.AI_REWRITE;
    } else if (action === 'ai_image') {
        cost = CREDIT_COSTS.AI_IMAGE;
    }

    return db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists) {
            const e = new Error('User not found');
            e.code = 'not-found';
            throw e;
        }
        const u = snap.data() || {};
        const isBusiness = isBusinessUserDoc(u);
        const isRegular = isRegularUserDoc(u);

        if (
            isRegular &&
            !isBusiness &&
            (action === 'ai_text_generate' || action === 'business_post_text' || action === 'offer_text')
        ) {
            const dayKey = todayUtcKey();
            const storedDay = String(u.aiFreeTextDay || '');
            let used = Math.max(0, Math.floor(Number(u.aiFreeTextCount) || 0));
            if (storedDay !== dayKey) {
                used = 0;
            }
            if (used < REGULAR_DAILY_FREE_AI_TEXT) {
                tx.update(userRef, {
                    aiFreeTextDay: dayKey,
                    aiFreeTextCount: used + 1,
                    updatedAt: FieldValue.serverTimestamp(),
                });
                return { chargedCredits: 0, usedFreeDaily: true };
            }
        }

        const accountRole = isBusiness ? 'business' : 'user';
        spendCreditsInTransaction(tx, userRef, u, {
            uid,
            accountRole,
            amount: cost,
            type: 'spend',
            reason: `ai:${action}`,
            relatedId: null,
        });
        return { chargedCredits: cost, usedFreeDaily: false };
    });
}

/**
 * Motion / marketing AI for businesses — no free daily quota.
 * @param {string} uid
 * @param {number} amount
 * @param {string} reason
 */
async function spendBusinessMotionAiCredits(uid, amount, reason) {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n <= 0) {
        return { chargedCredits: 0 };
    }
    const userRef = db.collection('users').doc(uid);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists) {
            const e = new Error('User not found');
            e.code = 'not-found';
            throw e;
        }
        const u = snap.data() || {};
        if (!isBusinessUserDoc(u)) {
            const e = new Error('Business account required for motion AI');
            e.code = 'permission-denied';
            throw e;
        }
        spendCreditsInTransaction(tx, userRef, u, {
            uid,
            accountRole: 'business',
            amount: n,
            type: 'spend',
            reason: String(reason || 'ai:motion').slice(0, 120),
            relatedId: null,
        });
    });
    return { chargedCredits: n };
}

/**
 * @param {'text'|'design'|'full'} generationMode
 * @param {string} normalizedPostType
 */
function resolveMotionAiCharge(generationMode, normalizedPostType) {
    if (generationMode === 'design') {
        return CREDIT_COSTS.AI_IMAGE;
    }
    if (generationMode === 'text') {
        return normalizedPostType === 'special_offer_post' ? CREDIT_COSTS.AI_TEXT_REGULAR : CREDIT_COSTS.AI_TEXT_REGULAR;
    }
    return CREDIT_COSTS.AI_TEXT_REGULAR + CREDIT_COSTS.AI_IMAGE;
}

module.exports = {
    REGULAR_DAILY_FREE_AI_TEXT,
    consumeAiCredits,
    spendBusinessMotionAiCredits,
    resolveMotionAiCharge,
    todayUtcKey,
};
