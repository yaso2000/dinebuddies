/**
 * Three guided adjustment options for the next attempt, based on kind and last cards.
 */

class AdjustmentOptionSuggester {
    suggest({ invitationKind, cards }) {
        if (invitationKind === 'private') {
            return [
                'More formal typography and calmer background',
                'Warmer palette and softer illustration',
                'Bolder contrast and cleaner negative space'
            ];
        }
        if (invitationKind === 'dating') {
            return [
                'Softer colors and more neutral illustration',
                'Lighter layout with extra breathing room',
                'Slightly more vibrant but still tasteful accents'
            ];
        }
        return ['Adjust visual style', 'Try a calmer layout', 'Try a brighter accent'];
    }
}

module.exports = AdjustmentOptionSuggester;
