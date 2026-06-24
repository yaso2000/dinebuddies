import { POST_BACKGROUND_GRADIENTS } from '../../../constants/postBackgroundGradients';

/** Flat color fills — `value` is a CSS color. */
export const PRIVATE_CARD_SOLID_BACKGROUNDS = [
    { id: 'solid-ink', value: '#0f172a', labelKey: 'card_grad_solid_ink', defaultLabel: 'Ink' },
    { id: 'solid-snow', value: '#f8fafc', labelKey: 'card_grad_solid_snow', defaultLabel: 'Snow' },
    { id: 'solid-rose', value: '#be185d', labelKey: 'card_grad_solid_rose', defaultLabel: 'Rose' },
    { id: 'solid-violet', value: '#6d28d9', labelKey: 'card_grad_solid_violet', defaultLabel: 'Violet' },
    { id: 'solid-teal', value: '#0f766e', labelKey: 'card_grad_solid_teal', defaultLabel: 'Teal' },
    { id: 'solid-gold', value: '#b45309', labelKey: 'card_grad_solid_gold', defaultLabel: 'Gold' },
    { id: 'solid-coral', value: '#ea580c', labelKey: 'card_grad_solid_coral', defaultLabel: 'Coral' },
    { id: 'solid-sage', value: '#3f6212', labelKey: 'card_grad_solid_sage', defaultLabel: 'Sage' },
];

const GRADIENT_ENTRIES = POST_BACKGROUND_GRADIENTS.map((g) => ({
    id: g.id,
    value: g.value,
    labelKey: `card_grad_${g.id}`,
    defaultLabel: g.id,
}));

/** Gradients first, then solids — shown in the color/gradient rail. */
export const PRIVATE_CARD_COLOR_BACKGROUNDS = [...GRADIENT_ENTRIES, ...PRIVATE_CARD_SOLID_BACKGROUNDS];

export const DEFAULT_PRIVATE_CARD_GRADIENT_ID = 'midnight';

export function getPrivateCardColorBackgroundById(id) {
    if (!id) return null;
    return PRIVATE_CARD_COLOR_BACKGROUNDS.find((b) => b.id === id) || null;
}

export function resolvePrivateCardColorBackgroundCss(id) {
    const entry = getPrivateCardColorBackgroundById(id);
    return entry?.value || null;
}

export function isPrivateCardGradientBackgroundId(id) {
    return Boolean(getPrivateCardColorBackgroundById(id));
}
