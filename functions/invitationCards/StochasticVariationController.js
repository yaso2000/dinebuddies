/**
 * All randomness for card variation flows through here (deterministic seeds per slot/attempt).
 */

const crypto = require('crypto');

class StochasticVariationController {
    /**
     * Three distinct seeds for the three cards in one attempt.
     */
    seedsForAttempt(draftGroupId, attemptIndex) {
        const out = [];
        for (let slot = 1; slot <= 3; slot += 1) {
            const h = crypto
                .createHash('sha256')
                .update(`${draftGroupId}|${attemptIndex}|${slot}|invitation_cards_v1`)
                .digest('hex');
            out.push(h);
        }
        return out;
    }

    fingerprint(textOverlay, imageRef) {
        const a = String(textOverlay || '');
        const b = String(imageRef || '');
        return crypto.createHash('sha256').update(`${a}|${b}`).digest('hex');
    }

    /**
     * If candidate matches any prior fingerprint, nudge seed (single retry).
     */
    nudgeSeed(seed) {
        return crypto.createHash('sha256').update(`${seed}|nudge`).digest('hex');
    }
}

module.exports = StochasticVariationController;
