/**
 * Dating invitation: rules and annotations only. No private occasion logic.
 */

class DatingInteractionRulesEngine {
    validateAndAnnotate(input) {
        const interactionIntent = typeof input.interactionIntent === 'string' ? input.interactionIntent.trim() : '';
        const comfortLevel = typeof input.comfortLevel === 'string' ? input.comfortLevel.trim() : '';

        if (!interactionIntent) {
            return { ok: false, errors: ['interactionIntent is required for dating invitations.'] };
        }
        if (!comfortLevel) {
            return { ok: false, errors: ['comfortLevel is required for dating invitations.'] };
        }

        const annotations = {
            tone: comfortLevel === 'cautious' ? 'soft_neutral' : 'friendly',
            interactionHints: interactionIntent,
            taboos: ['explicit_content', 'pressure_language', 'private_home_address'],
            visualMood: input.userPreferences?.mood === 'playful' ? 'light' : 'calm'
        };

        return { ok: true, annotations };
    }
}

module.exports = DatingInteractionRulesEngine;
