/**
 * Frame + unified text palette for the private invitation card preview.
 */
export const DEFAULT_FRAME_COLOR_ID = 'gold';

export const PRIVATE_CARD_FRAME_COLORS = [
    {
        id: 'gold',
        labelKey: 'private_card_frame_gold',
        defaultLabel: 'Gold',
        border: 'rgba(212, 175, 55, 0.92)',
        shadow: '0 0 0 1px rgba(212, 175, 55, 0.45), 0 8px 32px rgba(212, 175, 55, 0.12)',
        textTitle: '#5c4818',
        textMessage: 'rgba(70, 55, 22, 0.94)',
        textHost: '#4a3a12',
        textMeta: 'rgba(62, 50, 18, 0.88)',
        textDivider: 'rgba(180, 140, 40, 0.45)'
    },
    {
        id: 'rose',
        labelKey: 'private_card_frame_rose',
        defaultLabel: 'Rose',
        border: 'rgba(244, 114, 182, 0.88)',
        shadow: '0 0 0 1px rgba(244, 114, 182, 0.4), 0 8px 32px rgba(244, 114, 182, 0.12)',
        textTitle: '#831843',
        textMessage: 'rgba(107, 24, 58, 0.94)',
        textHost: '#7a1d45',
        textMeta: 'rgba(94, 23, 49, 0.9)',
        textDivider: 'rgba(190, 24, 93, 0.42)'
    },
    {
        id: 'silver',
        labelKey: 'private_card_frame_silver',
        defaultLabel: 'Silver',
        border: 'rgba(203, 213, 225, 0.9)',
        shadow: '0 0 0 1px rgba(148, 163, 184, 0.45), 0 8px 28px rgba(148, 163, 184, 0.1)',
        textTitle: '#1e293b',
        textMessage: 'rgba(30, 41, 59, 0.94)',
        textHost: '#0f172a',
        textMeta: 'rgba(51, 65, 85, 0.9)',
        textDivider: 'rgba(100, 116, 139, 0.45)'
    },
    {
        id: 'cream',
        labelKey: 'private_card_frame_cream',
        defaultLabel: 'Cream',
        border: 'rgba(253, 230, 138, 0.85)',
        shadow: '0 0 0 1px rgba(252, 211, 77, 0.35), 0 8px 28px rgba(251, 191, 36, 0.08)',
        textTitle: '#713f12',
        textMessage: 'rgba(100, 52, 12, 0.94)',
        textHost: '#5c2e0a',
        textMeta: 'rgba(85, 42, 10, 0.88)',
        textDivider: 'rgba(180, 110, 30, 0.4)'
    },
    {
        id: 'emerald',
        labelKey: 'private_card_frame_emerald',
        defaultLabel: 'Emerald',
        border: 'rgba(52, 211, 153, 0.88)',
        shadow: '0 0 0 1px rgba(16, 185, 129, 0.4), 0 8px 32px rgba(16, 185, 129, 0.1)',
        textTitle: '#064e3b',
        textMessage: 'rgba(6, 78, 59, 0.94)',
        textHost: '#065f46',
        textMeta: 'rgba(4, 90, 68, 0.9)',
        textDivider: 'rgba(16, 150, 110, 0.4)'
    },
    {
        id: 'burgundy',
        labelKey: 'private_card_frame_burgundy',
        defaultLabel: 'Burgundy',
        border: 'rgba(190, 18, 60, 0.88)',
        shadow: '0 0 0 1px rgba(157, 23, 77, 0.45), 0 8px 32px rgba(157, 23, 77, 0.12)',
        textTitle: '#6b0f2a',
        textMessage: 'rgba(95, 18, 40, 0.94)',
        textHost: '#5c1028',
        textMeta: 'rgba(80, 16, 35, 0.9)',
        textDivider: 'rgba(157, 23, 77, 0.45)'
    },
    {
        id: 'navy',
        labelKey: 'private_card_frame_navy',
        defaultLabel: 'Navy',
        border: 'rgba(99, 102, 241, 0.75)',
        shadow: '0 0 0 1px rgba(67, 56, 202, 0.45), 0 8px 32px rgba(49, 46, 129, 0.15)',
        textTitle: '#1e1b4b',
        textMessage: 'rgba(42, 39, 95, 0.94)',
        textHost: '#312e81',
        textMeta: 'rgba(49, 46, 120, 0.9)',
        textDivider: 'rgba(79, 70, 229, 0.42)'
    },
    {
        id: 'white',
        labelKey: 'private_card_frame_white',
        defaultLabel: 'White',
        border: 'rgba(255, 255, 255, 0.92)',
        shadow: '0 0 0 1px rgba(255, 255, 255, 0.5), 0 8px 28px rgba(255, 255, 255, 0.08)',
        textTitle: '#111827',
        textMessage: 'rgba(17, 24, 39, 0.95)',
        textHost: '#0f172a',
        textMeta: 'rgba(30, 41, 59, 0.92)',
        textDivider: 'rgba(148, 163, 184, 0.5)'
    }
];

export function getFrameColorById(id) {
    return PRIVATE_CARD_FRAME_COLORS.find((c) => c.id === id) || PRIVATE_CARD_FRAME_COLORS[0];
}
