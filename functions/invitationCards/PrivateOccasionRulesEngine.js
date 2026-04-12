/**
 * Private invitation: rules and annotations only. No dating logic.
 */

class PrivateOccasionRulesEngine {
    validateAndAnnotate(input) {
        const occasionLabel = typeof input.occasionLabel === 'string' ? input.occasionLabel.trim() : '';
        if (!occasionLabel) {
            return { ok: false, errors: ['occasionLabel is required for private invitations.'] };
        }

        const annotations = {
            tone: input.privacyTone === 'formal' ? 'formal' : 'warm',
            occasionHints: occasionLabel,
            taboos: ['romantic_dating_subtext', 'ambiguous_pairing'],
            visualMood: input.userPreferences?.mood === 'elegant' ? 'elegant' : 'convivial'
        };

        return { ok: true, annotations };
    }
}

module.exports = PrivateOccasionRulesEngine;
