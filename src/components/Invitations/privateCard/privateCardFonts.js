/**
 * Decorative font presets for the private invitation card (loaded in PrivateInvitationCardPreview.css).
 */
export const DEFAULT_FONT_ID = 'playfair';

/** @typedef {{ id: string, labelKey: string, defaultLabel: string, cssFamily: string }} PrivateCardFont */

/** @type {PrivateCardFont[]} */
export const PRIVATE_CARD_FONTS = [
    {
        id: 'playfair',
        labelKey: 'private_card_font_playfair',
        defaultLabel: 'Playfair',
        cssFamily: '"Playfair Display", "Georgia", serif'
    },
    {
        id: 'cormorant',
        labelKey: 'private_card_font_cormorant',
        defaultLabel: 'Cormorant',
        cssFamily: '"Cormorant Garamond", "Times New Roman", serif'
    },
    {
        id: 'lora',
        labelKey: 'private_card_font_lora',
        defaultLabel: 'Lora',
        cssFamily: '"Lora", "Georgia", serif'
    },
    {
        id: 'montserrat',
        labelKey: 'private_card_font_montserrat',
        defaultLabel: 'Montserrat',
        cssFamily: '"Montserrat", "Segoe UI", sans-serif'
    },
    {
        id: 'dancing',
        labelKey: 'private_card_font_dancing',
        defaultLabel: 'Dancing Script',
        cssFamily: '"Dancing Script", cursive'
    },
    {
        id: 'great_vibes',
        labelKey: 'private_card_font_great_vibes',
        defaultLabel: 'Great Vibes',
        cssFamily: '"Great Vibes", cursive'
    }
];

export function getPrivateCardFontById(id) {
    return PRIVATE_CARD_FONTS.find((f) => f.id === id) || PRIVATE_CARD_FONTS[0];
}
