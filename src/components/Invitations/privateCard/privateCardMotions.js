/**
 * Loop motion presets for private invitation card (text + host block inside the frame).
 */

export const DEFAULT_MOTION_ID = 'none';

export const PRIVATE_CARD_MOTIONS = [
    { id: 'none', labelKey: 'private_card_motion_none', defaultLabel: 'None' },
    { id: 'sway', labelKey: 'private_card_motion_sway', defaultLabel: 'Sway' },
    { id: 'pulse', labelKey: 'private_card_motion_pulse', defaultLabel: 'Pulse' },
    { id: 'float', labelKey: 'private_card_motion_float', defaultLabel: 'Float' }
];

const MOTION_IDS = new Set(PRIVATE_CARD_MOTIONS.map((m) => m.id));

export function isPrivateCardMotionId(id) {
    return typeof id === 'string' && MOTION_IDS.has(id);
}
