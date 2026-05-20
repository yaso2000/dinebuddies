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
    },
    {
        id: 'amiri',
        labelKey: 'private_card_font_amiri',
        defaultLabel: 'Amiri',
        cssFamily: '"Amiri", "Traditional Arabic", serif',
        script: 'arabic',
    },
    {
        id: 'scheherazade',
        labelKey: 'private_card_font_scheherazade',
        defaultLabel: 'Scheherazade New',
        cssFamily: '"Scheherazade New", "Amiri", serif',
        script: 'arabic',
    },
    {
        id: 'reem_kufi',
        labelKey: 'private_card_font_reem_kufi',
        defaultLabel: 'Reem Kufi',
        cssFamily: '"Reem Kufi", "Segoe UI", sans-serif',
        script: 'arabic',
    },
    {
        id: 'katibeh',
        labelKey: 'private_card_font_katibeh',
        defaultLabel: 'Katibeh',
        cssFamily: '"Katibeh", "Traditional Arabic", cursive',
        script: 'arabic',
    },
    {
        id: 'aref_ruqaa',
        labelKey: 'private_card_font_aref_ruqaa',
        defaultLabel: 'Aref Ruqaa',
        cssFamily: '"Aref Ruqaa", "Traditional Arabic", serif',
        script: 'arabic',
    },
    {
        id: 'el_messiri',
        labelKey: 'private_card_font_el_messiri',
        defaultLabel: 'El Messiri',
        cssFamily: '"El Messiri", "Segoe UI", sans-serif',
        script: 'arabic',
    },
    {
        id: 'marhey',
        labelKey: 'private_card_font_marhey',
        defaultLabel: 'Marhey',
        cssFamily: '"Marhey", "Segoe UI", sans-serif',
        script: 'arabic',
    },
  /* ── Arabic decorative / calligraphic ── */
    {
        id: 'gulzar',
        labelKey: 'private_card_font_gulzar',
        defaultLabel: 'Gulzar',
        cssFamily: '"Gulzar", "Scheherazade New", serif',
        script: 'arabic',
    },
    {
        id: 'mirza',
        labelKey: 'private_card_font_mirza',
        defaultLabel: 'Mirza',
        cssFamily: '"Mirza", "Amiri", serif',
        script: 'arabic',
    },
    {
        id: 'rakkas',
        labelKey: 'private_card_font_rakkas',
        defaultLabel: 'Rakkas',
        cssFamily: '"Rakkas", "Katibeh", cursive',
        script: 'arabic',
    },
    {
        id: 'jomhuria',
        labelKey: 'private_card_font_jomhuria',
        defaultLabel: 'Jomhuria',
        cssFamily: '"Jomhuria", "Reem Kufi", serif',
        script: 'arabic',
    },
    {
        id: 'lemonada',
        labelKey: 'private_card_font_lemonada',
        defaultLabel: 'Lemonada',
        cssFamily: '"Lemonada", "El Messiri", sans-serif',
        script: 'arabic',
    },
    {
        id: 'lalezar',
        labelKey: 'private_card_font_lalezar',
        defaultLabel: 'Lalezar',
        cssFamily: '"Lalezar", "Katibeh", cursive',
        script: 'arabic',
    },
    {
        id: 'kufam',
        labelKey: 'private_card_font_kufam',
        defaultLabel: 'Kufam',
        cssFamily: '"Kufam", "Reem Kufi", sans-serif',
        script: 'arabic',
    },
    {
        id: 'fustat',
        labelKey: 'private_card_font_fustat',
        defaultLabel: 'Fustat',
        cssFamily: '"Fustat", "El Messiri", sans-serif',
        script: 'arabic',
    },
    {
        id: 'ruwudu',
        labelKey: 'private_card_font_ruwudu',
        defaultLabel: 'Ruwudu',
        cssFamily: '"Ruwudu", "Marhey", sans-serif',
        script: 'arabic',
    },
];

export function getPrivateCardFontById(id) {
    return PRIVATE_CARD_FONTS.find((f) => f.id === id) || PRIVATE_CARD_FONTS[0];
}
