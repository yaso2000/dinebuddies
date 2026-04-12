/**
 * Single builder with internal branching by invitationKind.
 * Produces one blueprint per card (visual prompt + fields for copy composers).
 */

class PromptBlueprintBuilder {
    build({ invitationKind, input, annotations, variationSlot, seed }) {
        const base = {
            invitationKind,
            inviterDisplayName: input.inviterDisplayName || '',
            placeDisplayName: input.placeDisplayName || '',
            message: input.message || '',
            userPreferences: input.userPreferences || {},
            variationSlot,
            seed,
            annotations
        };

        if (invitationKind === 'private') {
            const privateBase = {
                ...base,
                adjustmentHint: input.adjustmentHint || ''
            };
            return {
                ...privateBase,
                occasionLabel: input.occasionLabel || '',
                guestCountHint: input.guestCountHint,
                privacyTone: input.privacyTone,
                visualPrompt: this._privateVisualPrompt(privateBase, annotations, variationSlot, seed)
            };
        }

        if (invitationKind === 'dating') {
            return {
                ...base,
                interactionIntent: input.interactionIntent || '',
                comfortLevel: input.comfortLevel || '',
                visualPrompt: this._datingVisualPrompt(base, annotations, variationSlot, seed)
            };
        }

        throw new Error('PromptBlueprintBuilder: unknown invitationKind.');
    }

    _privateVisualPrompt(base, annotations, variationSlot, seed) {
        const style = base.userPreferences?.visualStyle || 'modern card';
        const palette = base.userPreferences?.colorFamily || 'warm gold and cream';
        const lines = [
            'Vertical invitation card design, no real-world photo of people, no text in the image.',
            `Mood: ${annotations.visualMood}, occasion: ${annotations.occasionHints}.`,
            `Venue context: ${base.placeDisplayName}.`,
            `Style variation ${variationSlot}, palette: ${palette}, art direction: ${style}.`,
            `Composition id: ${seed.slice(0, 16)}.`
        ];
        if (base.adjustmentHint) {
            lines.splice(lines.length - 1, 0, `Refinement direction: ${base.adjustmentHint}.`);
        }
        return lines.join(' ');
    }

    _datingVisualPrompt(base, annotations, variationSlot, seed) {
        const style = base.userPreferences?.visualStyle || 'soft minimal';
        const palette = base.userPreferences?.colorFamily || 'muted rose and ivory';
        return [
            'Vertical invitation card design, tasteful abstract or soft illustration, no faces, no text in the image.',
            `Safe social meet-up vibe, ${annotations.tone}, intent: ${base.interactionIntent}.`,
            `Place mood: ${base.placeDisplayName}.`,
            `Style variation ${variationSlot}, palette: ${palette}, art: ${style}.`,
            `Composition id: ${seed.slice(0, 16)}.`
        ].join(' ');
    }
}

module.exports = PromptBlueprintBuilder;
